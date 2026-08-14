import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9392;
const URL = 'file:///F:/My_projects/Cansat_accountant/chalan-generator/index.html';
const OUT = 'F:/My_projects/Cansat_accountant/chalan-generator/.pdfout';
const n = parseInt(process.argv[2] || '1', 10);
const AIT = process.argv[3] === 'ait';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      if (list.find(t => t.type === 'page')) return list.find(t => t.type === 'page').webSocketDebuggerUrl;
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
function pdfInfo(file) {
  const s = fs.readFileSync(file, 'latin1');
  const counts = [...s.matchAll(/\/Count\s+(\d+)/g)].map(m => parseInt(m[1], 10));
  const pageCount = counts.length ? Math.max(...counts) : 0;
  const boxes = [...s.matchAll(/\/MediaBox\s*\[\s*([\d.\s]+)\s*\]/g)].map(m => m[1].trim().split(/\s+/).map(Number));
  const sizes = boxes.map(b => ({ w: Math.round((b[2]-b[0])*100)/100, h: Math.round((b[3]-b[1])*100)/100 }));
  return { pageCount, sizes };
}
async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*', '--window-size=1000,1600',
    '--user-data-dir=C:/Windows/Temp/cdp-validate2-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    const wsUrl = await getWsUrl();
    const cdp = await CDP.connect(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT, eventsEnabled: true });
    await cdp.send('Page.navigate', { url: URL });
    await sleep(1500);
    await cdp.evaluate('(function(){ switchMode("bill"); return "ok"; })()');
    await sleep(100);
    await cdp.evaluate(`(function(){
      document.getElementById('date').value = '2026-08-13';
      document.getElementById('customerName').value = 'MD Shamsuzzaman';
      document.getElementById('customerAddress').value = '3 no road, Shyamoli';
      while (document.querySelectorAll('#itemsTableBody tr').length < ${n}) { addItemRow(); }
      while (document.querySelectorAll('#itemsTableBody tr').length > ${n}) { document.querySelector('#itemsTableBody tr').remove(); }
      Array.from(document.querySelectorAll('#itemsTableBody tr')).forEach((row, i) => {
        row.querySelector('.item-desc').value = 'Item ' + (i+1);
        row.querySelector('.item-quantity').value = String(100 + i);
        row.querySelector('.item-rate').value = '50';
        calculateRowAmount(row);
      });
      document.getElementById('laborBill').value = '200';
      document.getElementById('transportBill').value = '3000';
      document.getElementById('billVatMode').value = '${AIT ? "include" : "exclude"}';
      document.getElementById('billVatMode').dispatchEvent(new Event('change'));
      document.getElementById('billVatAmount').value = '20';
      document.getElementById('billAitMode').value = '${AIT ? "include" : "exclude"}';
      document.getElementById('billAitMode').dispatchEvent(new Event('change'));
      document.getElementById('billAitAmount').value = '${AIT ? "500" : ""}';
      generateChalan();
      return 'ok';
    })()`);
    await sleep(180);
    const domDist = await cdp.evaluate(`(function(){
      const sheets = document.querySelectorAll('.bill-sheet');
      const dist = Array.from(sheets).map(s => {
        const it = Array.from(s.querySelectorAll('tbody tr')).filter(tr => !tr.classList.contains('chalan-total-row'));
        return it.length + (s.querySelector('tr.chalan-total-row') ? '*' : '');
      });
      return JSON.stringify({ pages: dist.length, dist });
    })()`);
    const res = await cdp.evaluate(`(async function(){
      const origExpand = window.triggerPdfDownload;
      let captured = null;
      window.triggerPdfDownload = function(blob, name){
        blob.arrayBuffer().then(function(ab){
          const str = new TextDecoder('latin1').decode(new Uint8Array(ab));
          const counts = [...str.matchAll(/\\/Count\\s+(\\d+)/g)].map(m => +m[1]);
          const pageCount = counts.length ? Math.max(...counts) : 0;
          const boxes = [...str.matchAll(/\\/MediaBox\\s*\\[\\s*([\\d.\\s]+)\\s*\\]/g)].map(m => m[1].trim().split(/\\s+/).map(Number));
          captured = { name: name, bytes: ab.byteLength, pageCount: pageCount,
            sizes: boxes.map(b => ({ w: Math.round((b[2]-b[0])*100)/100, h: Math.round((b[3]-b[1])*100)/100 })) };
        });
        origExpand(blob, name);
      };
      const origErr = console.error; let errCap = null;
      console.error = function(...a){ errCap = (a[0] && a[0].stack) ? a[0].stack : String(a[0]); origErr.apply(console, a); };
      const origAlert = window.alert; let alertMsgs = [];
      window.alert = function(m){ alertMsgs.push(m); };
      downloadPdf();
      await new Promise(r => setTimeout(function(){ console.error = origErr; window.alert = origAlert; r(); }, 4000));
      return JSON.stringify({ captured: captured, err: errCap, alertMsgs: alertMsgs });
    })()`, true);
    const cap = JSON.parse(res);
    console.log(JSON.stringify({
      scenario: `n=${n}${AIT ? ' AIT' : ''}`,
      dom: JSON.parse(domDist),
      pdfParams: cap.captured ? { pages: cap.captured.pageCount, sizes: cap.captured.sizes, bytes: cap.captured.bytes, name: cap.captured.name } : null,
      error: cap.err,
      alerts: cap.alertMsgs
    }));
  } finally {
    chrome.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });