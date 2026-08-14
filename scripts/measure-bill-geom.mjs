import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9383;
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
async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*', '--window-size=1400,2400',
    '--user-data-dir=C:/Windows/Temp/cdp-billgeom-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    const wsUrl = await getWsUrl();
    const cdp = await CDP.connect(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: URL });
    await sleep(1800);

    const fillItems = (count, ait) => `(function(){
      document.getElementById('date').value = '2026-08-13';
      document.getElementById('customerName').value = 'ACME Corp';
      document.getElementById('customerAddress').value = 'Dhaka';
      const tbody = document.getElementById('itemsTableBody');
      tbody.innerHTML = '';
      for (let i = 0; i < ${count}; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><input class="item-desc" value="Item '+i+'"></td><td><input class="item-origin" value="Bangladesh"></td><td><input class="item-packaging" value="50kg"></td><td><input class="item-quantity" value="1"></td><td><input class="item-rate" value="100"></td><td></td>';
        tbody.appendChild(tr);
      }
      ${ait ? `document.getElementById('billAitMode').value='include'; document.getElementById('billAitAmount').value='500';` : `document.getElementById('billAitMode').value='exclude';`}
      generateChalan();
      return 'ok';
    })()`;

    const geom = `(function(){
      document.body.classList.add('pdf-export');
      const out = {};
      const paper = document.getElementById('chalan-preview');
      const pr = paper.getBoundingClientRect();
      out.paper = { top: pr.top, bottom: pr.bottom, height: pr.height };
      const sheets = [...paper.querySelectorAll('.bill-sheet')];
      out.sheets = sheets.map(s => {
        const r = s.getBoundingClientRect();
        const page = s.querySelector('.bill-page');
        const pr2 = page.getBoundingClientRect();
        const header = s.querySelector('.chalan-header');
        const hr = header ? header.getBoundingClientRect() : null;
        const infoRows = [...s.querySelectorAll('.chalan-info-row')];
        const irs = infoRows.map(e => { const rr = e.getBoundingClientRect(); return {top: Math.round(rr.top), bottom: Math.round(rr.bottom), h: Math.round(rr.height)}; });
        const thead = s.querySelector('thead');
        const thr = thead ? thead.getBoundingClientRect() : null;
        const tbodyEl = s.querySelector('tbody');
        const tbr = tbodyEl ? tbodyEl.getBoundingClientRect() : null;
        const trows = tbodyEl ? tbodyEl.querySelectorAll('tr').length : 0;
        const totalRows = [...(tbodyEl ? tbodyEl.querySelectorAll('tr.chalan-total-row') : [])].length;
        const footer = s.querySelector('.chalan-footer');
        const fr = footer ? footer.getBoundingClientRect() : null;
        const sign = s.querySelector('.chalan-signatory');
        const sr = sign ? sign.getBoundingClientRect() : null;
        const isLast = s === sheets[sheets.length-1];
        const lastRow = tbodyEl ? tbodyEl.querySelector('tr:last-child') : null;
        const lrr = lastRow ? lastRow.getBoundingClientRect() : null;
        return {
          isLast,
          sheetH: Math.round(r.height),
          page: { top: Math.round(pr2.top), bottom: Math.round(pr2.bottom), height: Math.round(pr2.height) },
          header: hr ? Math.round(hr.height) : null,
          infoH: irs.length ? Math.round((irs[irs.length-1].bottom - irs[0].top)) : null,
          thead: thr ? Math.round(thr.height) : null,
          tbody: { top: tbr ? Math.round(tbr.top) : null, bottom: tbr ? Math.round(tbr.bottom) : null, h: tbr ? Math.round(tbr.height) : null, rows: trows, totalRows },
          lastRowBottom: lrr ? Math.round(lrr.bottom) : null,
          footer: fr ? { top: Math.round(fr.top), bottom: Math.round(fr.bottom), h: Math.round(fr.height) } : null,
          sign: sr ? { top: Math.round(sr.top), bottom: Math.round(sr.bottom) } : null,
          pageBottomOfSheet: Math.round(pr2.bottom - r.top),
          footerVsSheet: fr ? Math.round(fr.bottom - r.bottom) : null,
          signVsSheet: sr ? Math.round(sr.bottom - r.bottom) : null
        };
      });
      document.body.classList.remove('pdf-export');
      return JSON.stringify(out);
    })()`;

    for (const { label, n, ait } of [
      { label: 'bill-5', n: 5, ait: false },
      { label: 'bill-4-ait', n: 4, ait: true },
      { label: 'bill-20', n: 20, ait: false },
      { label: 'bill-16-ait', n: 16, ait: true },
      { label: 'bill-29-ait', n: 29, ait: true }
    ]) {
      await cdp.evaluate(`switchMode('bill');`); await sleep(50);
      await cdp.evaluate(fillItems(n, ait)); await sleep(250);
      const g = await cdp.evaluate(geom);
      console.log(`${label}: ` + g);
    }
  } finally {
    chrome.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });