const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function setInput(p, ph, v) {
  return p.evaluate((ph, v) => {
    const el = [...document.querySelectorAll('input, textarea')].find((e) => e.placeholder === ph);
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, ph, v);
}
async function clickText(p, t) {
  return p.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, summary')].find((e) => e.textContent.trim().includes(t));
    if (el) { el.click(); return true; } return false;
  }, t);
}
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1000, height: 2200, deviceScaleFactor: 2 });
  await p.goto('http://localhost:3011/tkhpreview', { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(2500);
  await clickText(p, 'Skip'); await sleep(500);
  await setInput(p, 'Measured SF', '2400'); await clickText(p, 'Add condition manually'); await sleep(400);
  await setInput(p, 'Measured SF', '1600'); await clickText(p, 'Advanced — typical'); await sleep(300);
  await setInput(p, 'Building', 'A'); await setInput(p, 'Level', '2'); await setInput(p, '1', '3');
  await clickText(p, 'Add condition manually'); await sleep(400);
  await clickText(p, 'Linear · LF'); await sleep(250);
  await setInput(p, 'Measured LF', '180'); await setInput(p, 'Height ft', '9');
  await setInput(p, 'Alternate label (e.g. ALT-1 upgrade flooring)', 'ALT-1 upgrade partitions');
  await clickText(p, 'Add condition manually'); await sleep(800);
  // clip the estimate panel precisely by its bounding rect
  const top = await p.evaluate(() => { const h=[...document.querySelectorAll("div")].find(e=>e.textContent.trim()==="Estimate — computed live"); return h ? h.getBoundingClientRect().top : 0; });
  const rect = { x: 44, y: Math.max(0, top - 8), width: 900, height: 1040 };
  console.log('panel rect', JSON.stringify(rect));
  await p.screenshot({ path: 'scratch/tkh_estpanel.png', clip: rect });
  console.log('estpanel written');
  await b.close();
})().catch((e) => { console.error('ERR:', String(e).slice(0, 300)); process.exit(1); });
