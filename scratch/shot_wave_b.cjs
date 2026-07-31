const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  const url = 'file://' + path.resolve('scratch/wave_b_estimate.html').replace(/\\/g, '/');
  await p.setViewport({ width: 960, height: 1400, deviceScaleFactor: 2 });
  await p.goto(url, { waitUntil: 'load' });
  await p.screenshot({ path: 'scratch/wave_b_cover.png' });
  await p.screenshot({ path: 'scratch/wave_b_full.png', fullPage: true });
  await b.close();
  console.log('shots written');
})().catch((e) => { console.error('ERR:', String(e).slice(0, 200)); process.exit(1); });
