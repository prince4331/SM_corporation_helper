import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9421;
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
    '--remote-allow-origins=*', '--window-size=1400,2200',
    '--user-data-dir=C:/Windows/Temp/cdp-chalan-pdf-profile',
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

    // LOGO_DATA_URI is defined in logo-data.js loaded via script tag
    for (const n of [1, 8, 13, 20, 30]) {
      await cdp.evaluate(`(function(){
        document.getElementById('date').value = '2026-08-13';
        document.getElementById('customerName').value = 'ACME Corp';
        document.getElementById('customerAddress').value = 'Dhaka';
        document.getElementById('poNo').value = 'PO-9';
        const tb = document.getElementById('itemsTableBody');
        tb.innerHTML = '';
        for (let i = 0; i < ${n}; i++) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><input class="item-desc" value="Item '+i+'"></td><td><input class="item-origin" value="Bangladesh"></td><td><input class="item-packaging" value="50kg"></td><td><input class="item-quantity" value="1"></td><td><input class="item-rate" value="100"></td><td></td>';
          tb.appendChild(tr);
        }
        generateChalan();
        return 'ok';
      })()`);
      await sleep(150);

      const res = await cdp.evaluate(`(async function(){
        const origExpand = window.triggerPdfDownload;
        let captured = null;
        window.triggerPdfDownload = function(blob, name){
          blob.arrayBuffer().then(function(ab){ captured = { name, bytes: ab.byteLength, buf: ab }; });
        };
        const origErr = console.error; let errCap = null;
        console.error = function(...a){ errCap = (a[0] && a[0].stack) ? a[0].stack : String(a[0]); origErr.apply(console, a); };
        const origAlert = window.alert; let alertMsgs = [];
        window.alert = function(m){ alertMsgs.push(m); };
        downloadPdf();
        await new Promise(r => setTimeout(function(){ console.error = origErr; window.alert = origAlert; r(); }, 8000));
        let info = null;
        if (captured) { const str = new TextDecoder('latin1').decode(new Uint8Array(captured.buf));
          const counts = [...str.matchAll(/\\/Count\\s+(\\d+)/g)].map(m => +m[1]);
          const boxes = [...str.matchAll(/\\/MediaBox\\s*\\[\\s*([\\d.\\s]+)\\s*\\]/g)].map(m => m[1].trim().split(/\\s+/).map(Number));
          info = { pages: counts.length ? Math.max(...counts) : 0, bytes: captured.bytes, name: captured.name,
            sizes: boxes.map(b => ({ w: Math.round((b[2]-b[0])*100)/100, h: Math.round((b[3]-b[1])*100)/100 })) };
        }
        const sheets = document.querySelectorAll('.bill-sheet').length;
        const pageNos = Array.from(document.querySelectorAll('.bill-page-no')).map(e => e.textContent);
        const pdfExportLeft = document.body.classList.contains('pdf-export');
        return JSON.stringify({ info, err: errCap, alerts: alertMsgs, domSheets: sheets, pageNos, pdfExportLeft });
      })()`, true);
      const cap = JSON.parse(res);
      console.log(JSON.stringify({
        scenario: `n=${n}`,
        pdf: cap.info ? { pages: cap.info.pages, sizes: cap.info.sizes, bytes: cap.info.bytes, name: cap.info.name } : null,
        domSheets: cap.domSheets,
        pageNos: cap.pageNos,
        pdfExportLeft: cap.pdfExportLeft,
        err: cap.err ? cap.err.slice(0, 150) : null,
        alerts: cap.alerts
      }));
    }

    // Repeated downloads (5x same scenario) - performance & stability
    await cdp.evaluate(`(function(){
      document.getElementById('date').value = '2026-08-13';
      document.getElementById('customerName').value = 'ACME Corp';
      document.getElementById('customerAddress').value = 'Dhaka';
      const tb = document.getElementById('itemsTableBody');
      tb.innerHTML = '';
      for (let i = 0; i < 25; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><input class="item-desc" value="Item '+i+'"></td><td><input class="item-origin" value="Bangladesh"></td><td><input class="item-packaging" value="50kg"></td><td><input class="item-quantity" value="1"></td><td><input class="item-rate" value="100"></td><td></td>';
        tb.appendChild(tr);
      }
      generateChalan();
      return 'ok';
    })()`);
    await sleep(150);
    const rep = await cdp.evaluate(`(async function(){
      const origExpand = window.triggerPdfDownload;
      let count = 0; let pages = 0; let bytes = 0; let errs = [];
      window.triggerPdfDownload = function(blob, name){
        blob.arrayBuffer().then(function(ab){
          const str = new TextDecoder('latin1').decode(new Uint8Array(ab));
          const counts = [...str.matchAll(/\\/Count\\s+(\\d+)/g)].map(m => +m[1]);
          pages = counts.length ? Math.max(...counts) : 0;
          bytes = ab.byteLength; count++;
        });
      };
      const origErr = console.error;
      console.error = function(...a){ errs.push(a[0]); origErr.apply(console, a); };
      const t0 = performance.now();
      for (let i = 0; i < 5; i++) { downloadPdf(); await new Promise(r => setTimeout(r, 5000)); }
      const ms = Math.round(performance.now() - t0);
      console.error = origErr;
      return JSON.stringify({ count, pages, bytes, ms, errs: errs.length });
    })()`, true);
    console.log('REPEAT5=' + rep);
  } finally {
    chrome.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });