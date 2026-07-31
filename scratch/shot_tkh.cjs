const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 1.5 });
  p.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text().slice(0, 140)); });
  console.log('navigating (first compile can take ~30s)...');
  await p.goto('http://localhost:3011/tkhpreview', { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 3500));
  const bodyText = await p.evaluate(() => document.body.innerText.slice(0, 400));
  console.log('--- body text ---\n' + bodyText + '\n---');
  await p.screenshot({ path: 'scratch/tkh_initial.png', fullPage: true });
  console.log('initial screenshot written');
  await b.close();
})().catch((e) => { console.error('ERR:', String(e).slice(0, 300)); process.exit(1); });
