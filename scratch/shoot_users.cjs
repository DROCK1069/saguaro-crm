const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE.ERR: ' + m.text()); });
  try {
    await page.goto('http://localhost:3011/tkusers', { waitUntil: 'networkidle2', timeout: 120000 });
  } catch (e) {
    console.log('GOTO WARN: ' + e.message);
  }
  await new Promise(r => setTimeout(r, 13000));
  await page.screenshot({ path: 'scratch/users_access.png', fullPage: true });
  const bodyText = (await page.evaluate(() => document.body.innerText || '')).slice(0, 1200);
  console.log('=== CONSOLE/PAGE ERRORS ===');
  console.log(errs.length ? errs.join('\n') : '(none)');
  console.log('=== BODY TEXT (first 1200 chars) ===');
  console.log(bodyText);
  await browser.close();
})();
