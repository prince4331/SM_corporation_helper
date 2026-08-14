import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9420;
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
    '--remote-allow-origins=*', '--window-size=1400,2000',
    '--user-data-dir=C:/Windows/Temp/cdp-chalan-matrix-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    const wsUrl = await getWsUrl();
    const cdp = await CDP.connect(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: URL });
    await sleep(1800);
    await cdp.evaluate(`switchMode('chalan');`);

    const scenarios = [1, 7, 8, 9, 10, 12, 13, 15, 16, 17, 20, 21, 24, 25, 30, 32, 33];
    const results = [];

    for (const n of scenarios) {
      await cdp.evaluate(`(function(){
        document.getElementById('date').value = '2026-08-13';
        document.getElementById('customerName').value = 'ACME Corp';
        document.getElementById('customerPhone').value = '01712345678';
        document.getElementById('customerAddress').value = 'Dhaka';
        document.getElementById('poNo').value = 'PO-1';
        const tb = document.getElementById('itemsTableBody');
        tb.innerHTML = '';
        for (let i = 0; i < ${n}; i++) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><input class="item-desc" value="Item '+i+'"></td><td><input class="item-origin" value="Bangladesh"></td><td><input class="item-packaging" value="50kg"></td><td><input class="item-quantity" value="2"></td><td><input class="item-rate" value="100"></td><td></td>';
          tb.appendChild(tr);
        }
        generateChalan();
        document.body.classList.add('pdf-export');
        return 'ok';
      })()`);
      await sleep(180);

      // DOM structure analysis
      const dom = await cdp.evaluate(`(function(){
        const sheets = Array.from(document.querySelectorAll('.bill-sheet'));
        const out = sheets.map((s, si) => {
          const allRows = Array.from(s.querySelectorAll('tbody tr'));
          const itemRows = allRows.filter(tr => !tr.classList.contains('chalan-total-row') && tr.querySelector('td').textContent.trim() !== '');
          const blankRows = allRows.filter(tr => !tr.classList.contains('chalan-total-row') && tr.querySelector('td').textContent.trim() === '');
          const totalRows = allRows.filter(tr => tr.classList.contains('chalan-total-row'));
          const serials = itemRows.map(tr => tr.querySelector('.col-sl').textContent.trim());
          const descs = itemRows.map(tr => tr.querySelector('.col-desc').textContent.trim());
          const pageNo = s.querySelector('.bill-page-no') ? s.querySelector('.bill-page-no').textContent : null;
          const taka = s.querySelector('.chalan-taka-row span') ? s.querySelector('.chalan-taka-row span').textContent : null;
          const sign = s.querySelector('.chalan-signatory') ? s.querySelector('.chalan-signatory').textContent.trim() : null;
          const badge = s.querySelector('.chalan-badge') ? s.querySelector('.chalan-badge').textContent : null;
          const hasWatermark = !!s.querySelector('.table-watermark');
          const headerShown = !!s.querySelector('.chalan-header');
          const totalCell = totalRows.length ? totalRows[0].querySelector('td:last-child').textContent.trim() : null;
          const srect = s.getBoundingClientRect();
          const lastEl = s.querySelector('.bill-page-no') || s.querySelector('.bill-page');
          const lastBottom = lastEl.getBoundingClientRect().bottom;
          const overflow = Math.round((lastBottom - srect.bottom) * 100) / 100;
          return {
            itemRows: itemRows.length,
            blankRows: blankRows.length,
            totalRows: totalRows.length,
            serials, descs,
            pageNo, taka, sign, badge, hasWatermark, headerShown, totalCell,
            overflow
          };
        });
        return JSON.stringify(out);
      })()`);

      // Print PDF check
      const pdf = await cdp.send('Page.printToPDF', {
        printBackground: true,
        paperWidth: 8.2677165,
        paperHeight: 11.6929134,
        marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
        preferCSSPageSize: true
      });
      const pbuf = Buffer.from(pdf.data, 'base64');
      const info = analyzePdf(pbuf);

      // Front-fill invariant checks
      const parsed = JSON.parse(dom);
      const actualDist = parsed.map(p => p.itemRows);
      const expectedDist = expectDistribution(n, 12, 8);
      const issues = [];
      if (JSON.stringify(actualDist) !== JSON.stringify(expectedDist)) {
        issues.push(`distribution mismatch: expected [${expectedDist}] got [${actualDist}]`);
      }
      const last = actualDist.length - 1;
      if (last >= 0 && actualDist[last] > 8) issues.push(`final page exceeds capacity 8`);
      for (let i = 0; i < last; i++) {
        if (actualDist[i] > 12) issues.push(`page ${i} exceeds normal capacity 12`);
        if (actualDist[i] < 12) {
          const later = actualDist.slice(i + 1).reduce((a, b) => a + b, 0);
          if (later > 1) issues.push(`page ${i} not front-filled (${actualDist[i]} with ${later} later)`);
          break;
        }
      }
      parsed.forEach((p, i) => {
        if (i < last && p.blankRows > 0 && actualDist[i] < 12 && actualDist.slice(i + 1).reduce((a, b) => a + b, 0) > 1) {
          issues.push(`blank rows on page ${i} while later real items exist`);
        }
        if (i === last) {
          if (p.totalRows !== 1) issues.push(`final page missing single total row`);
          if (!p.taka) issues.push(`final page missing Quantity-in-Word`);
          if (!p.sign) issues.push(`final page missing signatory`);
        }
        if (i < last && (p.taka || p.sign)) issues.push(`non-final page carries final-only footer`);
        if (i < last && !p.hasWatermark) issues.push(`page ${i} missing watermark`);
        if (i < last && !p.headerShown) issues.push(`page ${i} missing repeated header`);
        if (p.overflow > 0.5) issues.push(`page ${i} bottom overflow ${p.overflow}`);
      });
      if (info.pageCount !== parsed.length) issues.push(`print pages ${info.pageCount} != DOM ${parsed.length}`);

      console.log(`CHALAN n=${n}: ${issues.length === 0 ? 'PASS' : 'FAIL ' + JSON.stringify(issues)} dom=${dom} print=${JSON.stringify(info)}`);
      results.push({ n, pass: issues.length === 0, issues });
    }

    // Reset check: New Chalan must produce single clean form
    await cdp.evaluate(`startNewChalan();`);
    await sleep(120);
    const reset = await cdp.evaluate(`(function(){
      const paper = document.getElementById('chalan-preview');
      const sheets = paper.querySelectorAll('.bill-sheet');
      return JSON.stringify({ sheets: sheets.length, html: paper.innerHTML.slice(0, 120) });
    })()`);
    console.log('RESET=' + reset);
    const failed = results.filter(r => !r.pass);
    console.log('=== SUMMARY ===');
    console.log(`TOTAL=${results.length} PASS=${results.length - failed.length} FAIL=${failed.length}`);
    failed.forEach(r => console.log('FAILED:', 'chalan n=' + r.n, JSON.stringify(r.issues)));
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    chrome.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });