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
  await p.setViewport({ width: 1000, height: 1700, deviceScaleFactor: 1.5 });
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
  // scroll the estimate panel into view and grab the waterfall + rollups region
  const box = await p.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find((e) => e.textContent.trim().startsWith('Estimate — computed live'));
    if (el) { const r = el.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 20); }
    return { y: window.scrollY };
  });
  await sleep(500);
  await p.screenshot({ path: 'scratch/tkh_waterfall.png', clip: { x: 120, y: 260, width: 760, height: 1250 } });
  // scroll to the conditions list to capture badges
  await p.evaluate(() => { const el = [...document.querySelectorAll('*')].find((e) => /CONDITIONS/i.test(e.textContent) && e.children.length > 2 && e.textContent.length < 4000); });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(500);
  await p.screenshot({ path: 'scratch/tkh_full2.png', fullPage: true });
  console.log('shots written');
  await b.close();
})().catch((e) => { console.error('ERR:', String(e).slice(0, 300)); process.exit(1); });
