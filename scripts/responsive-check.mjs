import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

// Responsive + cross-viewport validation.
//
// At each required viewport:
//   - no unintended body horizontal overflow
//   - form/controls usable (generation works, buttons present)
//   - A4 preview scaled to fit (no clipping, no page overlap)
//
// Then generates the SAME documents at 375 / 768 / 1440 and checks the PDF
// geometry is identical (A4 MediaBox, same page count, same centering).

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9366;
const URL = 'file:///F:/My_projects/Cansat_accountant/chalan-generator/index.html';

const VIEWPORTS = [
  { w: 320, h: 568 },
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 768, h: 1024 },
  { w: 1024, h: 768 },
  { w: 1280, h: 720 },
  { w: 1440, h: 900 },
];

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('timeout ws');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const cdp = new CDP(ws);
    ws.onmessage = (ev) => cdp._onMessage(ev);
    return cdp;
  }
  _onMessage(ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, awaitPromise = false) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (result.exceptionDetails) throw new Error('Eval error: ' + JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
}

function analyzePdf(buffer) {
  const str = new TextDecoder('latin1').decode(new Uint8Array(buffer));
  const counts = [...str.matchAll(/\/Count\s+(\d+)/g)].map(m => parseInt(m[1], 10));
  const pageCount = counts.length ? Math.max(...counts) : 0;
  const boxes = [...str.matchAll(/\/MediaBox\s*\[\s*([\d.\s]+)\s*\]/g)].map(m => m[1].trim().split(/\s+/).map(Number));
  const sizes = boxes.map(b => ({ w: Math.round((b[2] - b[0]) * 100) / 100, h: Math.round((b[3] - b[1]) * 100) / 100 }));
  return { pageCount, sizes };
}

function expectDistribution(total, normal, final) {
  if (total === 0) return [0];
  if (total <= final) return [total];
  const P = Math.ceil((total - final) / normal) + 1;
  const dist = [];
  let start = 0;
  for (let p = 0; p < P - 1; p++) {
    const remainingItems = total - start;
    const pagesAfterCurrent = P - p - 1;
    const take = Math.max(1, Math.min(normal, remainingItems - pagesAfterCurrent));
    dist.push(take);
    start += take;
  }
  dist.push(total - start);
  return dist;
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*', '--window-size=1000,1600',
    '--user-data-dir=C:/Windows/Temp/cdp-responsive-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    const wsUrl = await getWsUrl();
    const cdp = await CDP.connect(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: URL });
    await sleep(1800);
    await cdp.evaluate('(function(){ switchMode("chalan"); return "ok"; })()');
    await sleep(120);

    const runChalan15 = async () => {
      await cdp.evaluate(`(function(){
        document.getElementById('date').value = '2026-08-13';
        document.getElementById('customerName').value = 'MD Shamsuzzaman';
        document.getElementById('customerAddress').value = '3 no road, Shyamoli';
        document.getElementById('poNo').value = 'PO-15';
        const tb = document.getElementById('itemsTableBody');
        tb.innerHTML = '';
        for (let i = 0; i < 15; i++) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><input class="item-desc" value="Item '+i+'"></td><td><input class="item-origin" value="Bangladesh"></td><td><input class="item-packaging" value="50kg"></td><td><input class="item-quantity" value="1"></td><td><input class="item-rate" value="100"></td><td></td>';
          tb.appendChild(tr);
        }
        generateChalan();
        return 'ok';
      })()`);
      await sleep(200);
    };

    const setViewport = async (w, h) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await sleep(250);
    };

    const responsiveResults = [];
    for (const vp of VIEWPORTS) {
      await setViewport(vp.w, vp.h);
      await cdp.evaluate('(function(){ showInputForm(); return "ok"; })()');
      await sleep(120);
      // Form-mode usability: Add Item + controls must be visible & no overflow
      // BEFORE generating (after generation the form is hidden by preview mode).
      const formReport = await cdp.evaluate(`(function(){
        const doc = document.documentElement;
        const body = document.body;
        const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - (window.innerWidth || doc.clientWidth);
        return JSON.stringify({
          formVisible: !document.getElementById('input-section').classList.contains('hidden'),
          addItemVisible: document.getElementById('addItemBtn').offsetParent !== null,
          printBtnVisible: document.getElementById('printBtn').offsetParent !== null,
          downloadBtnVisible: document.getElementById('downloadPdfBtn').offsetParent !== null,
          overflowX: Math.round(overflowX * 100) / 100,
        });
      })()`);
      const fr = JSON.parse(formReport);
      const fIssues = [];
      if (!fr.formVisible) fIssues.push('input form not visible');
      if (!fr.addItemVisible) fIssues.push('Add Item button not visible');
      if (fr.overflowX > 1) fIssues.push(`body horizontal overflow ${fr.overflowX}px`);

      await runChalan15();
      const report = await cdp.evaluate(`(async function(){
        await new Promise(r => setTimeout(r, 100));
        const doc = document.documentElement;
        const body = document.body;
        const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - (window.innerWidth || doc.clientWidth);
        const viewport = document.querySelector('.preview-viewport');
        const wrapper = document.querySelector('.preview-scale');
        const paper = document.getElementById('chalan-preview');
        const sheets = paper.querySelectorAll('.bill-sheet');
        const vs = viewport ? viewport.getBoundingClientRect() : null;
        const wr = wrapper ? wrapper.getBoundingClientRect() : null;
        const sheetRects = Array.from(sheets).map(s => s.getBoundingClientRect());
        let overlap = false;
        for (let i = 1; i < sheetRects.length; i++) {
          if (sheetRects[i].top < sheetRects[i-1].bottom - 1) overlap = true;
        }
        const paperR = paper.getBoundingClientRect();
        const clipRight = paperR.right > vs.right + 1;
        const clipLeft = paperR.left < vs.left - 1;
        const transform = wrapper ? getComputedStyle(wrapper).transform : 'none';
        const scale = transform === 'none' ? 1 : parseFloat(/matrix\\(([-+eE0-9.]+)/.exec(transform)[1]);
        // Untransformed CSS width: must stay fixed A4 (400px) regardless of scale.
        const wm = paper.querySelector('.table-watermark');
        const wmCss = wm ? parseFloat(getComputedStyle(wm).width) : null;
        const pw = parseFloat(getComputedStyle(paper).width);
        return JSON.stringify({
          vw: window.innerWidth, docW: doc.scrollWidth, bodyW: body.scrollWidth,
          overflowX: Math.round(overflowX * 100) / 100,
          sheetCount: sheets.length,
          scale,
          paperWidthCss: Math.round(pw * 100) / 100,
          paperRectW: Math.round(paperR.width * 100) / 100,
          wmCss,
          viewportW: vs ? Math.round(vs.width) : null,
          clipRight, clipLeft, overlap,
          previewVisible: !document.getElementById('preview-section').classList.contains('hidden'),
          printBtnVisible: document.getElementById('printBtn').offsetParent !== null,
          downloadBtnVisible: document.getElementById('downloadPdfBtn').offsetParent !== null,
        });
      })()`, true);
      const r = JSON.parse(report);
      const issues = [...fIssues];
      if (r.overflowX > 1) issues.push(`body horizontal overflow ${r.overflowX}px`);
      if (r.sheetCount !== 2) issues.push(`expected 2 sheets, got ${r.sheetCount}`);
      if (r.scale > 1) issues.push(`scale ${r.scale} > 1`);
      if (r.clipRight || r.clipLeft) issues.push('preview clipped horizontally');
      if (r.overlap) issues.push('multi-page overlap');
      if (!r.previewVisible) issues.push('preview section not visible');
      if (!r.printBtnVisible) issues.push('Print button not visible');
      if (!r.downloadBtnVisible) issues.push('Download button not visible');
      // Scale must fit the ACTUAL preview viewport width (fixed A4 retained)
      const expectedScale = Math.min(1, r.viewportW / 793.7);
      if (Math.abs(r.scale - expectedScale) > 0.02) issues.push(`scale ${r.scale} != expected ${expectedScale}`);
      // Fixed A4 internal width must not depend on viewport
      if (r.paperWidthCss < 790) issues.push(`paper width ${r.paperWidthCss} < A4 793.7`);
      if (r.wmCss !== null && Math.abs(r.wmCss - 400) > 1) issues.push(`watermark CSS width ${r.wmCss} != 400 (fixed A4)`);
      responsiveResults.push({ vp: `${r.vw}`, pass: issues.length === 0, issues, r });
      console.log(JSON.stringify({ viewport: `${r.vw}`, pass: issues.length === 0, issues, report: r }));
    }

    // ---- Cross-viewport PDF identity ----
    const crossResults = [];
    const crossCases = [
      { mode: 'bill', n: 13, a: false, label: 'bill-13' },
      { mode: 'bill', n: 16, a: true, label: 'bill-16-AIT' },
      { mode: 'chalan', n: 15, label: 'chalan-15' },
      { mode: 'quotation', n: 1, label: 'quotation' },
    ];
    for (const vp of [{ w: 375, h: 667 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }]) {
      await setViewport(vp.w, vp.h);
      for (const c of crossCases) {
        await cdp.evaluate(`(function(){
          switchMode(${JSON.stringify(c.mode)});
          return 'ok';
        })()`);
        await sleep(100);
        await cdp.evaluate(`(function(){
          document.getElementById('date').value = '2026-08-13';
          document.getElementById('customerName').value = 'MD Shamsuzzaman';
          document.getElementById('customerAddress').value = '3 no road, Shyamoli';
          document.getElementById('poNo').value = 'PO-99';
          document.getElementById('quoteTo').value = 'ACME Corp';
          document.getElementById('quoteTerms').value = 'Custom term line';
          document.getElementById('quoteIncludeVat').value = 'include';
          document.getElementById('quoteIncludeAit').value = 'exclude';
          document.getElementById('quoteIncludeDelivery').value = 'include';
          const tb = document.getElementById('itemsTableBody');
          tb.innerHTML = '';
          for (let i = 0; i < ${c.n}; i++) {
            const tr = document.createElement('tr');
            if (${JSON.stringify(c.mode)} === 'quotation') {
              tr.innerHTML = '<td><input class="item-quote-product" value="Product '+i+'"></td><td><input class="item-quote-packing" value="50kg"></td><td><input class="item-quote-origin" value="Bangladesh"></td><td><input class="item-quote-price" value="100"></td><td></td>';
            } else {
              tr.innerHTML = '<td><input class="item-desc" value="Item '+i+'"></td><td><input class="item-origin" value="Bangladesh"></td><td><input class="item-packaging" value="50kg"></td><td><input class="item-quantity" value="2"></td><td><input class="item-rate" value="50"></td><td></td>';
            }
            tb.appendChild(tr);
          }
          if (${JSON.stringify(c.mode)} === 'bill') {
            document.getElementById('laborBill').value = '200';
            document.getElementById('transportBill').value = '3000';
            document.getElementById('billVatMode').value = '${c.a ? "include" : "exclude"}';
            document.getElementById('billVatMode').dispatchEvent(new Event('change'));
            document.getElementById('billVatAmount').value = '20';
            document.getElementById('billAitMode').value = '${c.a ? "include" : "exclude"}';
            document.getElementById('billAitMode').dispatchEvent(new Event('change'));
            document.getElementById('billAitAmount').value = '${c.a ? "500" : ""}';
          }
          generateChalan();
          return 'ok';
        })()`);
        await sleep(200);
        const info = await cdp.evaluate(`(async function(){
          const orig = window.triggerPdfDownload;
          let captured = null;
          window.triggerPdfDownload = function(blob, name){
            blob.arrayBuffer().then(function(ab){ captured = { buf: ab, name }; });
          };
          downloadPdf();
          await new Promise(r => setTimeout(r, 6000));
          window.triggerPdfDownload = orig;
          let info = null;
          if (captured) {
            const str = new TextDecoder('latin1').decode(new Uint8Array(captured.buf));
            const counts = [...str.matchAll(/\\/Count\\s+(\\d+)/g)].map(m => +m[1]);
            const boxes = [...str.matchAll(/\\/MediaBox\\s*\\[\\s*([\\d.\\s]+)\\s*\\]/g)].map(m => m[1].trim().split(/\\s+/).map(Number));
            info = { pages: counts.length ? Math.max(...counts) : 0, name: captured.name,
              sizes: boxes.map(b => ({ w: Math.round((b[2]-b[0])*100)/100, h: Math.round((b[3]-b[1])*100)/100 })) };
          }
          const dist = Array.from(document.querySelectorAll('.bill-sheet')).map(s =>
            Array.from(s.querySelectorAll('tbody tr')).filter(tr => !tr.classList.contains('chalan-total-row')).length);
          const paper = document.getElementById('chalan-preview');
          const pw = parseFloat(getComputedStyle(paper).width);
          return JSON.stringify({ info, dist, pw });
        })()`, true);
        const parsed = JSON.parse(info);
        crossResults.push({ vp: vp.w, label: c.label, pdf: parsed.info, dist: parsed.dist, pw: parsed.pw });
        console.log(JSON.stringify({ crossProgress: { vp: vp.w, label: c.label, pdf: parsed.info } }));
      }
    }
    const byLabel = {};
    for (const r of crossResults) {
      (byLabel[r.label] = byLabel[r.label] || []).push(r);
    }
    const crossIssues = [];
    for (const [label, rows] of Object.entries(byLabel)) {
      const ref = rows[0];
      const geometryOf = (r) => JSON.stringify({ pages: r.pdf.pages, sizes: r.pdf.sizes });
      for (const row of rows.slice(1)) {
        if (geometryOf(row) !== geometryOf(ref)) {
          crossIssues.push(`${label}: PDF geometry differs at ${row.vp} (${geometryOf(row)}) vs ${ref.vp} (${geometryOf(ref)})`);
        }
        if (JSON.stringify(row.dist) !== JSON.stringify(ref.dist)) {
          crossIssues.push(`${label}: dist differs at ${row.vp} [${row.dist}] vs [${ref.dist}]`);
        }
      }
      console.log(JSON.stringify({ crossLabel: label, rows: rows.map(r => ({ vp: r.vp, pdf: r.pdf, dist: r.dist })) }));
    }

    const rFailed = responsiveResults.filter(r => !r.pass);
    console.log('=== RESPONSIVE SUMMARY ===');
    console.log(`TOTAL=${responsiveResults.length} PASS=${responsiveResults.length - rFailed.length} FAIL=${rFailed.length}`);
    rFailed.forEach(r => console.log('FAILED:', r.vp, JSON.stringify(r.issues)));
    console.log('=== CROSS-VIEWPORT PDF ===');
    console.log(crossIssues.length === 0 ? 'IDENTICAL across 375/768/1440' : crossIssues.join('\n'));
    if (rFailed.length > 0 || crossIssues.length > 0) process.exitCode = 1;
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
