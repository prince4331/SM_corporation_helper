import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9366;
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

async function runPdf(cdp) {
  const res = await cdp.evaluate(`(async function(){
    const origExpand = window.triggerPdfDownload;
    let captured = null;
    window.triggerPdfDownload = function(blob, name){
      blob.arrayBuffer().then(function(ab){ captured = { name, bytes: ab.byteLength, buf: ab }; });
    };
    const origErr = console.error; let errCap = null;
    console.error = function(...a){ errCap = (a[0] && a[0].stack) ? a[0].stack : String(a[0]); origErr.apply(console, a); };
    const origAlert = window.alert; let alerts = [];
    window.alert = function(m){ alerts.push(m); };
    downloadPdf();
    await new Promise(r => setTimeout(function(){ console.error = origErr; window.alert = origAlert; r(); }, 4000));
    let info = null;
    if (captured) { const str = new TextDecoder('latin1').decode(new Uint8Array(captured.buf));
      const counts = [...str.matchAll(/\\/Count\\s+(\\d+)/g)].map(m => +m[1]);
      info = { pages: counts.length ? Math.max(...counts) : 0, bytes: captured.bytes };
    }
    return JSON.stringify({ info, err: errCap, alerts });
  })()`, true);
  return JSON.parse(res);
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*', '--window-size=1000,1600',
    '--user-data-dir=C:/Windows/Temp/cdp-misc-profile',
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

    // === Large money values: single-line, no wrap ===
    await cdp.evaluate(`(function(){
      document.getElementById('date').value = '2026-08-13';
      document.getElementById('customerName').value = 'MD Shamsuzzaman';
      document.getElementById('customerAddress').value = '3 no road, Shyamoli';
      while (document.querySelectorAll('#itemsTableBody tr').length < 1) { }
      document.querySelector('.item-desc').value = 'Bulk item';
      document.querySelector('.item-quantity').value = '20000000';
      document.querySelector('.item-rate').value = '1';
      calculateRowAmount(document.querySelector('.item-quantity').closest('tr'));
      document.getElementById('laborBill').value = '200';
      document.getElementById('transportBill').value = '3000';
      document.getElementById('billVatMode').value = 'include';
      document.getElementById('billVatMode').dispatchEvent(new Event('change'));
      document.getElementById('billVatAmount').value = '20';
      document.getElementById('billAitMode').value = 'include';
      document.getElementById('billAitMode').dispatchEvent(new Event('change'));
      document.getElementById('billAitAmount').value = '500';
      generateChalan();
      return 'ok';
    })()`);
    await sleep(150);
    const money = await cdp.evaluate(`(function(){
      const last = document.querySelector('.bill-sheet:last-child');
      const spans = Array.from(last.querySelectorAll('.money-value')).map(m => {
        const r = m.getBoundingClientRect();
        const txt = m.textContent.trim();
        const inLine = txt.indexOf('\\n') === -1 && txt.split('/=').length === 2;
        return { txt, w: Math.round(r.width), h: Math.round(r.height), inLine };
      });
      const totalRow = Array.from(last.querySelectorAll('tr.chalan-total-row')).find(tr => tr.textContent.indexOf('Total') === 0);
      const totalTd = totalRow ? totalRow.querySelectorAll('td')[1] : null;
      const tdRect = totalTd ? totalTd.getBoundingClientRect() : null;
      const totalSpan = totalRow ? totalRow.querySelector('.money-value') : null;
      const sRect = totalSpan ? totalSpan.getBoundingClientRect() : null;
      const fits = tdRect && sRect ? (sRect.width <= tdRect.width + 1) : null;
      return JSON.stringify({ spans, totalFits: fits, totalTxt: totalSpan ? totalSpan.textContent.trim() : null });
    })()`);
    const moneyData = JSON.parse(money);
    console.log('LARGE_MONEY=' + money);

    // === Quotation: repeated generation must not duplicate AIT/VAT terms ===
    await cdp.evaluate('(function(){ switchMode("quotation"); return "ok"; })()');
    await sleep(80);
    await cdp.evaluate(`(function(){
      document.getElementById('date').value = '2026-08-13';
      document.getElementById('quoteTo').value = 'ACME Corp';
      document.querySelector('.item-quote-product').value = 'Rice';
      document.querySelector('.item-quote-packing').value = '50kg';
      document.querySelector('.item-quote-origin').value = 'Bangladesh';
      document.querySelector('.item-quote-price').value = '100';
      document.getElementById('quoteIncludeVat').value = 'include';
      document.getElementById('quoteIncludeAit').value = 'include';
      generateChalan();
      return 'ok';
    })()`);
    await sleep(100);
    await cdp.evaluate('(function(){ generateChalan(); return "ok"; })()');
    await sleep(100);
    await cdp.evaluate('(function(){ generateChalan(); return "ok"; })()');
    await sleep(100);
    const quoteDup = await cdp.evaluate(`(function(){
      const items = Array.from(document.querySelectorAll('.quotation-terms li')).map(li => li.textContent);
      const aitCount = items.filter(t => t.indexOf('AIT') !== -1).length;
      const vatCount = items.filter(t => t.indexOf('VAT') !== -1).length;
      return JSON.stringify({ items, aitCount, vatCount });
    })()`);
    console.log('QUOTE_DUP=' + quoteDup);

    const quotePdf = await runPdf(cdp);
    console.log('QUOTE_PDF=' + JSON.stringify(quotePdf));

    // === Chalan PDF ===
    await cdp.evaluate('(function(){ switchMode("chalan"); return "ok"; })()');
    await sleep(80);
    await cdp.evaluate(`(function(){
      document.getElementById('date').value = '2026-08-13';
      document.getElementById('customerName').value = 'ACME Corp';
      document.getElementById('customerAddress').value = 'Dhaka';
      document.querySelector('.item-desc').value = 'Rice';
      document.querySelector('.item-origin').value = 'Bangladesh';
      document.querySelector('.item-packaging').value = '50kg';
      document.querySelector('.item-quantity').value = '10';
      generateChalan();
      return 'ok';
    })()`);
    await sleep(120);
    const chalanPdf = await runPdf(cdp);
    console.log('CHALAN_PDF=' + JSON.stringify(chalanPdf));
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });