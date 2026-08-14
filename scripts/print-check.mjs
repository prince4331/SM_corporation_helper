import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9364;
const URL = 'file:///F:/My_projects/Cansat_accountant/chalan-generator/index.html';

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

// Front-filled pagination expectation (mirror of app.js paginateItems).
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
    '--user-data-dir=C:/Windows/Temp/cdp-print-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    const wsUrl = await getWsUrl();
    const cdp = await CDP.connect(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: URL });
    await sleep(1700);
    await cdp.evaluate('(function(){ switchMode("bill"); return "ok"; })()');
    await sleep(120);

    const runBill = async (sc) => {
      await cdp.evaluate(`(function(){
        document.getElementById('date').value = '2026-08-13';
        document.getElementById('customerName').value = 'MD Shamsuzzaman';
        document.getElementById('customerAddress').value = '3 no road, Shyamoli';
        while (document.querySelectorAll('#itemsTableBody tr').length < ${sc.n}) { addItemRow(); }
        while (document.querySelectorAll('#itemsTableBody tr').length > ${sc.n}) { document.querySelector('#itemsTableBody tr').remove(); }
        Array.from(document.querySelectorAll('#itemsTableBody tr')).forEach((row, i) => {
          row.querySelector('.item-desc').value = 'Item ' + (i+1);
          row.querySelector('.item-quantity').value = String(100 + i);
          row.querySelector('.item-rate').value = '50';
          calculateRowAmount(row);
        });
        document.getElementById('laborBill').value = '200';
        document.getElementById('transportBill').value = '3000';
        document.getElementById('billVatMode').value = '${sc.a ? "include" : "exclude"}';
        document.getElementById('billVatMode').dispatchEvent(new Event('change'));
        document.getElementById('billVatAmount').value = '20';
        document.getElementById('billAitMode').value = '${sc.a ? "include" : "exclude"}';
        document.getElementById('billAitMode').dispatchEvent(new Event('change'));
        document.getElementById('billAitAmount').value = '${sc.a ? "500" : ""}';
        generateChalan();
        return 'ok';
      })()`);
      await sleep(150);
    };

    const runChalan = async (sc) => {
      await cdp.evaluate(`(function(){
        document.getElementById('date').value = '2026-08-13';
        document.getElementById('customerName').value = 'MD Shamsuzzaman';
        document.getElementById('customerAddress').value = '3 no road, Shyamoli';
        while (document.querySelectorAll('#itemsTableBody tr').length < ${sc.n}) { addItemRow(); }
        while (document.querySelectorAll('#itemsTableBody tr').length > ${sc.n}) { document.querySelector('#itemsTableBody tr').remove(); }
        Array.from(document.querySelectorAll('#itemsTableBody tr')).forEach((row, i) => {
          row.querySelector('.item-desc').value = 'Item ' + (i+1);
          row.querySelector('.item-quantity').value = String(100 + i);
          row.querySelector('.item-origin').value = 'Bangladesh';
          row.querySelector('.item-packaging').value = '50kg';
          row.querySelector('.item-rate').value = '50';
          calculateRowAmount(row);
        });
        generateChalan();
        return 'ok';
      })()`);
      await sleep(150);
    };

    const check = async (label, expectedDist, capacities) => {
      const dom = await cdp.evaluate(`(function(){
        const sheets = document.querySelectorAll('.bill-sheet');
        const dist = Array.from(sheets).map(s => {
          const it = Array.from(s.querySelectorAll('tbody tr')).filter(tr => !tr.classList.contains('chalan-total-row') && tr.querySelector('td').textContent.trim() !== '');
          return it.length + (s.querySelector('tr.chalan-total-row') ? '*' : '');
        });
        return JSON.stringify({ pages: dist.length, dist });
      })()`);

      const geo = await cdp.evaluate(`(async function(){
        await new Promise(r => setTimeout(r, 100));
        const sheets = Array.from(document.querySelectorAll('.bill-sheet'));
        const out = sheets.map(s => {
          const r = s.getBoundingClientRect();
          const lastEl = s.querySelector('.bill-page-no') || s.querySelector('.bill-page');
          const lastBottom = lastEl.getBoundingClientRect().bottom;
          return { h: Math.round(r.height), bottomOverflow: Math.round((lastBottom - r.bottom) * 100) / 100 };
        });
        return JSON.stringify(out);
      })()`, true);

      const pdf = await cdp.send('Page.printToPDF', {
        printBackground: true,
        paperWidth: 8.2677165,
        paperHeight: 11.6929134,
        marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
        preferCSSPageSize: true
      });
      const pbuf = Buffer.from(pdf.data, 'base64');
      const info = analyzePdf(pbuf);

      // Front-fill invariants
      const actualDist = JSON.parse(dom).dist.map(d => parseInt(d, 10));
      const issues = [];
      if (JSON.stringify(actualDist) !== JSON.stringify(expectedDist)) {
        issues.push(`distribution mismatch: expected [${expectedDist}] got [${actualDist}]`);
      }
      const finalCap = capacities.final;
      const normalCap = capacities.normal;
      const last = actualDist.length - 1;
      if (actualDist[last] > finalCap) issues.push(`final page exceeds capacity ${finalCap}`);
      for (let i = 0; i < last; i++) {
        if (actualDist[i] > normalCap) issues.push(`page ${i} exceeds normal capacity`);
        if (actualDist[i] < normalCap) {
          const later = actualDist.slice(i + 1).reduce((a, b) => a + b, 0);
          if (later > 1) issues.push(`page ${i} not front-filled (${actualDist[i]} with ${later} later)`);
          break;
        }
      }
      if (info.pageCount !== JSON.parse(dom).pages) issues.push(`print pages ${info.pageCount} != DOM ${JSON.parse(dom).pages}`);
      JSON.parse(geo).forEach((g, i) => {
        if (g.bottomOverflow > 0.5) issues.push(`sheet ${i} bottom overflow ${g.bottomOverflow}`);
      });

      const result = {
        scenario: label,
        pass: issues.length === 0,
        issues,
        dom: JSON.parse(dom),
        printPdfPages: info.pageCount,
        printPdfSizes: info.sizes,
        geometry: JSON.parse(geo)
      };
      console.log(JSON.stringify(result));
      return result;
    };

    await cdp.evaluate('(function(){ switchMode("bill"); return "ok"; })()');
    await sleep(120);
    const billScenarios = [{ n: 1, a: false }, { n: 5, a: false }, { n: 6, a: false }, { n: 7, a: false }, { n: 12, a: false }, { n: 13, a: false }, { n: 15, a: false }, { n: 17, a: false }, { n: 18, a: false }, { n: 20, a: false }, { n: 24, a: false }, { n: 25, a: false }, { n: 29, a: false }, { n: 30, a: false }, { n: 1, a: true }, { n: 4, a: true }, { n: 5, a: true }, { n: 8, a: true }, { n: 12, a: true }, { n: 13, a: true }, { n: 16, a: true }, { n: 17, a: true }, { n: 20, a: true }, { n: 28, a: true }, { n: 29, a: true }];
    const results = [];
    for (const sc of billScenarios) {
      await runBill(sc);
      const final = sc.a ? 4 : 5;
      results.push(await check(`bill n=${sc.n}${sc.a ? ' AIT' : ''}`, expectDistribution(sc.n, 12, final), { normal: 12, final }));
    }

    await cdp.evaluate('(function(){ switchMode("chalan"); return "ok"; })()');
    await sleep(120);
    for (const sc of [{ n: 1 }, { n: 7 }, { n: 8 }, { n: 9 }, { n: 10 }, { n: 12 }, { n: 13 }, { n: 15 }, { n: 16 }, { n: 17 }, { n: 20 }, { n: 21 }, { n: 24 }, { n: 25 }, { n: 30 }, { n: 32 }, { n: 33 }]) {
      await runChalan(sc);
      results.push(await check(`chalan n=${sc.n}`, expectDistribution(sc.n, 12, 8), { normal: 12, final: 8 }));
    }

    const failed = results.filter(r => !r.pass);
    console.log('=== SUMMARY ===');
    console.log(`TOTAL=${results.length} PASS=${results.length - failed.length} FAIL=${failed.length}`);
    failed.forEach(r => console.log('FAILED:', r.scenario, JSON.stringify(r.issues)));
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });