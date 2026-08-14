import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9363;
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
    '--remote-allow-origins=*', '--window-size=1000,1600',
    '--user-data-dir=C:/Windows/Temp/cdp-content-profile',
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

    // === Bill Include AIT with 5 items (final page capacity test with AIT) ===
    await cdp.evaluate(`(function(){
      document.getElementById('date').value = '2026-08-13';
      document.getElementById('customerName').value = 'MD Shamsuzzaman';
      document.getElementById('customerAddress').value = '3 no road, Shyamoli';
      while (document.querySelectorAll('#itemsTableBody tr').length < 5) { addItemRow(); }
      while (document.querySelectorAll('#itemsTableBody tr').length > 5) { document.querySelector('#itemsTableBody tr').remove(); }
      Array.from(document.querySelectorAll('#itemsTableBody tr')).forEach((row, i) => {
        row.querySelector('.item-desc').value = 'Item ' + (i+1);
        row.querySelector('.item-quantity').value = String(100 + i);
        row.querySelector('.item-rate').value = '50';
        calculateRowAmount(row);
      });
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
    const billAitIncl = await cdp.evaluate(`(function(){
      document.body.classList.add('pdf-export');
      const sheets = Array.from(document.querySelectorAll('.bill-sheet'));
      const sheet = sheets[sheets.length - 1];
      const srect = sheet.getBoundingClientRect();
      const sheetH = srect.height;
      const sheetBottom = srect.bottom;
      const content = sheet.querySelector('.bill-page');
      const contentRect = content.getBoundingClientRect();
      const lastEl = sheet.querySelector('.bill-page-no') || content;
      const lastBottom = lastEl.getBoundingClientRect().bottom;
      const overflow = Math.round((lastBottom - sheetBottom) * 100) / 100;
      const rows = Array.from(sheet.querySelectorAll('tbody tr')).map(tr => {
        const tds = tr.querySelectorAll('td');
        const label = tds.length ? tds[0].textContent : '';
        const val = tds.length > 1 ? tds[1].textContent : '';
        return label + '|' + val;
      });
      const taka = sheet.querySelector('.chalan-taka-row span') ? sheet.querySelector('.chalan-taka-row span').textContent : null;
      const sign = sheet.querySelector('.chalan-signatory') ? sheet.querySelector('.chalan-signatory').textContent.trim() : null;
      const water = sheet.querySelector('.table-watermark');
      const waterRect = water.getBoundingClientRect();
      const wm = { w: Math.round(waterRect.width), opacity: getComputedStyle(water).opacity, z: getComputedStyle(water).zIndex };
      const moneySpans = Array.from(sheet.querySelectorAll('.money-value')).map(m => m.textContent);
      const pageNos = sheets.map(s => s.querySelector('.bill-page-no') ? s.querySelector('.bill-page-no').textContent : null);
      document.body.classList.remove('pdf-export');
      return JSON.stringify({
        domSheets: sheets.length,
        sheetH: Math.round(sheetH), contentH: Math.round(contentRect.height),
        contentOverflow: overflow, // + means content exceeds sheet
        rows, taka, sign, wm, moneySpans, pageNos
      });
    })()`);

    // === Bill Exclude AIT: stale 500 must not contribute ===
    await cdp.evaluate(`(function(){
      document.getElementById('billAitMode').value = 'exclude';
      document.getElementById('billAitMode').dispatchEvent(new Event('change'));
      generateChalan();
      return 'ok';
    })()`);
    await sleep(150);
    const billAitExcl = await cdp.evaluate(`(function(){
      const last = document.querySelector('.bill-sheet:last-child');
      const rows = Array.from(last.querySelectorAll('tbody tr')).map(tr => {
        const tds = tr.querySelectorAll('td');
        return tds.length ? tds[0].textContent + '|' + (tds[1] ? tds[1].textContent : '') : '';
      });
      const total = rows.find(r => r.indexOf('Total') === 0);
      const aitRow = rows.find(r => r.indexOf('AIT') === 0);
      const inputHidden = getComputedStyle(document.getElementById('billAitAmountGroup')).display === 'none';
      const inputVal = document.getElementById('billAitAmount').value;
      return JSON.stringify({ total, aitRow: aitRow || null, inputHidden, inputVal });
    })()`);

    // === Quotation AIT combinations ===
    await cdp.evaluate('(function(){ switchMode("quotation"); return "ok"; })()');
    await sleep(80);
    const quoteResults = [];
    for (const [vat, ait] of [['include','include'],['include','exclude'],['exclude','include'],['exclude','exclude']]) {
      await cdp.evaluate(`(function(){
        document.getElementById('date').value = '2026-08-13';
        document.getElementById('quoteTo').value = 'ACME Corp';
        document.querySelector('.item-quote-product').value = 'Rice';
        document.querySelector('.item-quote-packing').value = '50kg';
        document.querySelector('.item-quote-origin').value = 'Bangladesh';
        document.querySelector('.item-quote-price').value = '100';
        document.getElementById('quoteIncludeVat').value = '${vat}';
        document.getElementById('quoteIncludeAit').value = '${ait}';
        generateChalan();
        return 'ok';
      })()`);
      await sleep(120);
      const q = await cdp.evaluate(`(function(){
        const items = Array.from(document.querySelectorAll('.quotation-terms li')).map(li => li.textContent);
        return JSON.stringify({ items });
      })()`);
      quoteResults.push({ vat, ait, terms: JSON.parse(q).items });
    }

    // === Chalan regression (multi-page) ===
    await cdp.evaluate('(function(){ switchMode("chalan"); return "ok"; })()');
    await sleep(80);
    await cdp.evaluate(`(function(){
      document.getElementById('date').value = '2026-08-13';
      document.getElementById('customerName').value = 'ACME Corp';
      document.getElementById('customerAddress').value = 'Dhaka';
      document.getElementById('poNo').value = 'PO-77';
      const tb = document.getElementById('itemsTableBody');
      tb.innerHTML = '';
      for (let i = 0; i < 13; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><input class="item-desc" value="Item '+i+'"></td><td><input class="item-origin" value="Bangladesh"></td><td><input class="item-packaging" value="50kg"></td><td><input class="item-quantity" value="2"></td><td><input class="item-rate" value="100"></td><td></td>';
        tb.appendChild(tr);
      }
      generateChalan();
      return 'ok';
    })()`);
    await sleep(120);
    const chalan = await cdp.evaluate(`(function(){
      const paper = document.getElementById('chalan-preview');
      const multi = paper.classList.contains('multi-page-preview');
      const sheets = Array.from(paper.querySelectorAll('.bill-sheet'));
      const perSheet = sheets.map(s => {
        const table = s.querySelector('.chalan-items-table');
        const hasBillClass = table ? table.classList.contains('bill-items-table') : false;
        const cols = table ? Array.from(table.querySelectorAll('thead th')).map(th => th.textContent) : [];
        const badge = s.querySelector('.chalan-badge') ? s.querySelector('.chalan-badge').textContent : null;
        const wm = s.querySelector('.table-watermark');
        const taka = s.querySelector('.chalan-taka-row span') ? s.querySelector('.chalan-taka-row span').textContent : null;
        const sign = s.querySelector('.chalan-signatory') ? s.querySelector('.chalan-signatory').textContent.trim() : null;
        const pageNo = s.querySelector('.bill-page-no') ? s.querySelector('.bill-page-no').textContent : null;
        const realRows = Array.from(s.querySelectorAll('tbody tr')).filter(tr => !tr.classList.contains('chalan-total-row') && tr.querySelector('td').textContent.trim() !== '');
        const serials = realRows.map(tr => tr.querySelector('.col-sl').textContent.trim());
        return {
          hasBillClass, cols, badge,
          wmWidth: wm ? Math.round(wm.getBoundingClientRect().width) : null,
          taka, sign, pageNo, serials
        };
      });
      const totalCell = sheets[sheets.length-1].querySelector('.chalan-total-row .col-quantity').textContent.trim();
      return JSON.stringify({ multi, sheets: sheets.length, perSheet, totalCell });
    })()`);

    console.log('BILL_AIT_INCLUDE=' + billAitIncl);
    console.log('BILL_AIT_EXCLUDE=' + billAitExcl);
    console.log('QUOTE=' + JSON.stringify(quoteResults));
    console.log('CHALAN=' + chalan);
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });