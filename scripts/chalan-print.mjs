import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9423;
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

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*', '--window-size=1000,1600',
    '--user-data-dir=C:/Windows/Temp/cdp-chalan-print-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    const wsUrl = await getWsUrl();
    const cdp = await CDP.connect(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: URL });
    await sleep(1700);
    await cdp.evaluate('(function(){ switchMode("chalan"); return "ok"; })()');
    await sleep(120);

    for (const n of [5, 8, 9, 13, 17, 20, 25, 30]) {
      await cdp.evaluate(`(function(){
        document.getElementById('date').value = '2026-08-13';
        document.getElementById('customerName').value = 'MD Shamsuzzaman';
        document.getElementById('customerAddress').value = '3 no road, Shyamoli';
        while (document.querySelectorAll('#itemsTableBody tr').length < ${n}) { addItemRow(); }
        while (document.querySelectorAll('#itemsTableBody tr').length > ${n}) { document.querySelector('#itemsTableBody tr').remove(); }
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

      const dom = await cdp.evaluate(`(function(){
        const sheets = document.querySelectorAll('.bill-sheet');
        const dist = Array.from(sheets).map(s => {
          const it = Array.from(s.querySelectorAll('tbody tr')).filter(tr => !tr.classList.contains('chalan-total-row') && tr.querySelector('td').textContent.trim() !== '');
          return it.length + (s.querySelector('tr.chalan-total-row') ? '*' : '');
        });
        const pageNos = Array.from(document.querySelectorAll('.bill-page-no')).map(e => e.textContent);
        return JSON.stringify({ pages: dist.length, dist, pageNos });
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

      console.log(JSON.stringify({
        scenario: `chalan n=${n}`,
        dom: JSON.parse(dom),
        printPdfPages: info.pageCount,
        printPdfSizes: info.sizes,
        geometry: JSON.parse(geo)
      }));
    }
  } finally {
    chrome.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });