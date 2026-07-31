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
  await p.setViewport({ width: 1280, height: 1700, deviceScaleFactor: 1.5 });
  await p.goto('http://localhost:3011/tkhpreview', { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(2500);
  console.log('skip wizard:', await clickText(p, 'Skip')); await sleep(600);
  // condition 1 — area (slab), real value
  await setInput(p, 'Measured SF', '2400'); await sleep(200);
  console.log('add 1:', await clickText(p, 'Add condition manually')); await sleep(500);
  // condition 2 — area again, tagged to Building A / Level 2 via advanced
  await setInput(p, 'Measured SF', '1600'); await sleep(150);
  console.log('open advanced:', await clickText(p, 'Advanced — typical')); await sleep(400);
  await setInput(p, 'Building', 'A'); await setInput(p, 'Level', '2'); await setInput(p, '1', '3'); await sleep(150);
  console.log('add 2:', await clickText(p, 'Add condition manually')); await sleep(500);
  // condition 3 — linear partition as an ADD alternate
  console.log('linear:', await clickText(p, 'Linear · LF')); await sleep(300);
  await setInput(p, 'Measured LF', '180'); await setInput(p, 'Height ft', '9');
  await setInput(p, 'Alternate label (e.g. ALT-1 upgrade flooring)', 'ALT-1 upgrade partitions'); await sleep(200);
  console.log('add 3:', await clickText(p, 'Add condition manually')); await sleep(700);
  // set a couple markups so the full stack shows
  await setInput(p, '', ''); // no-op safety
  await sleep(400);
  await p.screenshot({ path: 'scratch/tkh_populated.png', fullPage: true });
  console.log('populated screenshot written');
  // also a focused shot of just the estimate panel (top ~1100px)
  await p.screenshot({ path: 'scratch/tkh_panel.png', clip: { x: 130, y: 0, width: 900, height: 1150 } });
  await b.close();
})().catch((e) => { console.error('ERR:', String(e).slice(0, 300)); process.exit(1); });
