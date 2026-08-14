import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9361;
const URL = 'file:///F:/My_projects/Cansat_accountant/chalan-generator/index.html';

const SCENARIOS = [
  { n: 1, a: false }, { n: 4, a: false }, { n: 5, a: false },
  { n: 6, a: false }, { n: 7, a: false }, { n: 8, a: false },
  { n: 12, a: false }, { n: 13, a: false }, { n: 17, a: false },
  { n: 18, a: false }, { n: 20, a: false }, { n: 25, a: false },
  { n: 29, a: false },
  { n: 1, a: true }, { n: 4, a: true }, { n: 5, a: true },
  { n: 8, a: true }, { n: 12, a: true }, { n: 13, a: true },
  { n: 16, a: true }, { n: 20, a: true }, { n: 25, a: true },
  { n: 28, a: true }, { n: 29, a: true }
];

const CHALAN_SCENARIOS = [
  { n: 1 }, { n: 7 }, { n: 8 }, { n: 9 }, { n: 10 }, { n: 12 },
  { n: 13 }, { n: 16 }, { n: 17 }, { n: 20 }, { n: 24 }, { n: 25 }, { n: 30 }, { n: 33 }
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
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[uncaught]', JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
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
    '--user-data-dir=C:/Windows/Temp/cdp-fullmatrix-profile',
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
        while (document.querySelectorAll('#itemsTableBody tr').length > ${sc.n}) {
          document.querySelector('#itemsTableBody tr').remove();
        }
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
        while (document.querySelectorAll('#itemsTableBody tr').length > ${sc.n}) {
          document.querySelector('#itemsTableBody tr').remove();
        }
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

    const check = async (label) => {
      const domDist = await cdp.evaluate(`(function(){
        const sheets = document.querySelectorAll('.bill-sheet');
        const dist = Array.from(sheets).map(s => {
          const it = Array.from(s.querySelectorAll('tbody tr')).filter(tr => !tr.classList.contains('chalan-total-row'));
          return it.length + (s.querySelector('tr.chalan-total-row') ? '*' : '');
        });
        const heights = Array.from(sheets).map(s => {
          const r = s.getBoundingClientRect();
          return { h: Math.round(r.height * 100) / 100, css: getComputedStyle(s).height };
        });
        return JSON.stringify({ pages: dist.length, dist, heights });
      })()`);
      const dom = JSON.parse(domDist);

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
        await new Promise(r => setTimeout(function(){ console.error = origErr; window.alert = origAlert; r(); }, 4000));
        let info = null;
        if (captured) { const str = new TextDecoder('latin1').decode(new Uint8Array(captured.buf));
          const counts = [...str.matchAll(/\\/Count\\s+(\\d+)/g)].map(m => +m[1]);
          const boxes = [...str.matchAll(/\\/MediaBox\\s*\\[\\s*([\\d.\\s]+)\\s*\\]/g)].map(m => m[1].trim().split(/\\s+/).map(Number));
          info = { pages: counts.length ? Math.max(...counts) : 0, bytes: captured.bytes,
            sizes: boxes.map(b => ({ w: Math.round((b[2]-b[0])*100)/100, h: Math.round((b[3]-b[1])*100)/100 })) };
        }
        return JSON.stringify({ info, err: errCap, alerts: alertMsgs });
      })()`, true);
      const cap = JSON.parse(res);
      console.log(JSON.stringify({
        scenario: label,
        dom: dom,
        pdf: cap.info ? { pages: cap.info.pages, sizes: cap.info.sizes, bytes: cap.info.bytes } : null,
        err: cap.err ? cap.err.slice(0, 200) : null,
        alerts: cap.alerts
      }));
    };

    for (const sc of SCENARIOS) {
      await runBill(sc);
      await check(`bill n=${sc.n}${sc.a ? ' AIT' : ''}`);
    }

    await cdp.evaluate('(function(){ switchMode("chalan"); return "ok"; })()');
    await sleep(120);
    for (const sc of CHALAN_SCENARIOS) {
      await runChalan(sc);
      await check(`chalan n=${sc.n}`);
    }
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });