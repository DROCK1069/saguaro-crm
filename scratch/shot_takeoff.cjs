const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950, deviceScaleFactor: 2 });
  const url = 'http://localhost:3013/takeoff';
  console.log('navigating', url, '(first hit compiles — may take a while)');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 4500)); // let the cinematic scan settle
  await page.screenshot({ path: 'scratch/takeoff_hero.png' });
  await page.screenshot({ path: 'scratch/takeoff_hero_full.png', fullPage: true });
  const title = await page.title();
  console.log('OK — title:', title);
  await browser.close();
})().catch((e) => { console.error('SHOT_ERR', e.message); process.exit(1); });
