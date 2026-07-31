const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1560, height: 950, deviceScaleFactor: 2 });
  await p.goto('http://localhost:3016/tracer-demo', { waitUntil: 'networkidle0', timeout: 120000 });
  await new Promise(r => setTimeout(r, 3500));
  const errs = await p.evaluate(() => (window.__nextErr || null));
  await p.screenshot({ path: 'scratch/tracer2.png' });
  console.log('title:', await p.title());
  await b.close();
})().catch(e => { console.error('SHOT_ERR', e.message); process.exit(1); });
