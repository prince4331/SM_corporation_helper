import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9381;
const URL = 'file:///F:/My_projects/Cansat_accountant/chalan-generator/index.html';
const OUTDIR = 'F:/My_projects/Cansat_accountant/chalan-generator/.pdfout';

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
function analyzePdf(buf) {
  const str = Buffer.from(buf).toString('latin1');
  const counts = [...str.matchAll(/\/Count\s+(\d+)/g)].map(m => +m[1]);
  const pages = counts.length ? Math.max(...counts) : 0;
  const boxes = [...str.matchAll(/MediaBox\s*\[([^\]]+)\]/g)].map(m => m[1].trim());
  // Image XObjects: /Width /Height immediately inside image dicts
  const widths = [...str.matchAll(/\/Width\s+(\d+)/g)].map(m => +m[1]);
  const heights = [...str.matchAll(/\/Height\s+(\d+)/g)].map(m => +m[1]);
  // per-image pairs: scan /Image ... /Width W /Height H ... /Image
  const imgDicts = [];
  const imgRe = /\/Subtype\s*\/Image[^>]*?\/Width\s+(\d+)[^>]*?\/Height\s+(\d+)/g;
  let m;
  while ((m = imgRe.exec(str)) !== null) {
    imgDicts.push({ w: +m[1], h: +m[2] });
  }
  // filter filters present?
  const filterRe = /\/Subtype\s*\/Image[^>]*?\/Filter\s*\/(\w+)/g;
  const filters = [];
  while ((m = filterRe.exec(str)) !== null) filters.push(m[1]);
  // raw JPEG scan for SOF dims
  const jpegs = [];
  const jpegRe = /\xff\xd8[\s\S]*?\xff\xc0[\s\S]{5}(\x00\x02)[\s\S]{2}/g;
  return { pages, boxes, widths, heights, imgDicts, filters };
}
async function main() {
  fs.rmSync(OUTDIR, { recursive: true, force: true });
  fs.mkdirSync(OUTDIR, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*', '--window-size=1400,2000',
    '--user-data-dir=C:/Windows/Temp/cdp-inspect-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    const wsUrl = await getWsUrl();
    const cdp = await CDP.connect(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: URL });
    await sleep(1800);

    const fillItems = (count, mode) => `(function(){
      document.getElementById('date').value = '2026-08-13';
      ${mode === 'quotation'
        ? `document.getElementById('quoteTo').value = 'ACME Corp';`
        : `document.getElementById('customerName').value = 'ACME Corp'; document.getElementById('customerAddress').value = 'Dhaka';`}
      const tbody = document.getElementById('itemsTableBody');
      tbody.innerHTML = '';
      for (let i = 0; i < ${count}; i++) {
        ${mode === 'quotation' ? `
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><input class="item-quote-product" value="Product '+i+'"></td><td><input class="item-quote-packing" value="50kg"></td><td><input class="item-quote-origin" value="Bangladesh"></td><td><input class="item-quote-price" value="100"></td><td></td>';
          tbody.appendChild(tr);
        ` : `
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><input class="item-desc" value="Item '+i+'"></td><td><input class="item-origin" value="Bangladesh"></td><td><input class="item-packaging" value="50kg"></td><td><input class="item-quantity" value="1"></td><td><input class="item-rate" value="100"></td><td></td>';
          tbody.appendChild(tr);
        `}
      }
      generateChalan();
      return 'ok';
    })()`;

    const capture = `(async function(){
      const orig = window.triggerPdfDownload;
      const res = {};
      window.triggerPdfDownload = function(blob, name){
        res.name = name;
        blob.arrayBuffer().then(function(ab){
          const u8 = new Uint8Array(ab);
          res.bytes = u8.byteLength;
          let bin = '';
          for (let i = 0; i < u8.length; i += 0x8000) {
            bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          }
          res.base64 = btoa(bin);
        });
      };
      downloadPdf();
      await new Promise(r => setTimeout(r, 5000));
      return JSON.stringify(res);
    })()`;

    const scenarios = [
      { label: 'bill-1', mode: 'bill', n: 1 },
      { label: 'bill-3', mode: 'bill', n: 3 },
      { label: 'bill-13', mode: 'bill', n: 13 },
      { label: 'bill-20', mode: 'bill', n: 20 },
      { label: 'bill-16-ait', mode: 'bill', n: 16, ait: true },
      { label: 'chalan-1', mode: 'chalan', n: 1 },
      { label: 'chalan-3', mode: 'chalan', n: 3 },
      { label: 'chalan-13', mode: 'chalan', n: 13 },
      { label: 'chalan-20', mode: 'chalan', n: 20 },
      { label: 'quotation-1', mode: 'quotation', n: 1 }
    ];

    for (const sc of scenarios) {
      await cdp.evaluate(`switchMode('${sc.mode}');`); await sleep(50);
      if (sc.ait) {
        await cdp.evaluate(`document.getElementById('billAitMode').value='include'; document.getElementById('billAitAmount').value='500'; document.getElementById('billAitAmountGroup').style.display='';`);
      }
      await cdp.evaluate(fillItems(sc.n, sc.mode)); await sleep(250);
      const raw = await cdp.evaluate(capture, true);
      const data = JSON.parse(raw);
      if (data.base64) {
        const buf = Buffer.from(data.base64, 'base64');
        fs.writeFileSync(`${OUTDIR}/${sc.label}.pdf`, buf);
        const a = analyzePdf(buf);
        const firstBox = a.boxes[0] || '';
        const boxNums = (firstBox.match(/[\d.]+/g) || []).map(Number);
        const pageWmm = boxNums[2] ? boxNums[2] / 72 * 25.4 : 0;
        const pageHmm = boxNums[3] ? boxNums[3] / 72 * 25.4 : 0;
        const img = a.imgDicts[0] || { w: 0, h: 0 };
        const dpix = img.w ? Math.round(img.w / (pageWmm / 25.4)) : 0;
        const dpiy = img.h ? Math.round(img.h / (pageHmm / 25.4)) : 0;
        console.log(`${sc.label}: pages=${a.pages} bytes=${data.bytes} mediaBox=${a.boxes[0]} pageMM=${Math.round(pageWmm)}x${Math.round(pageHmm)} img=${img.w}x${img.h} dpi~${dpix}x${dpiy} filters=${a.filters}`);
      } else {
        console.log(`${sc.label}: CAPTURE FAILED ${raw}`);
      }
    }
  } finally {
    chrome.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });