const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  // Server HTML: disable JS so no hydration
  const p1 = await b.newPage();
  await p1.setJavaScriptEnabled(false);
  await p1.goto('http://localhost:3011/tkhai', { waitUntil: 'networkidle2', timeout: 120000 });
  const serverStyles = await p1.evaluate(() => Array.from(document.querySelectorAll('style')).map(s => (s.textContent || '').slice(0, 120)));
  // Client HTML: JS enabled
  const p2 = await b.newPage();
  await p2.goto('http://localhost:3011/tkhai', { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise(r => setTimeout(r, 2500));
  const clientStyles = await p2.evaluate(() => Array.from(document.querySelectorAll('style')).map(s => (s.textContent || '').slice(0, 120)));
  await b.close();
  console.log('SERVER style tags: ' + serverStyles.length);
  serverStyles.forEach((s, i) => console.log('  S' + i + ': ' + JSON.stringify(s)));
  console.log('CLIENT style tags: ' + clientStyles.length);
  clientStyles.forEach((s, i) => console.log('  C' + i + ': ' + JSON.stringify(s)));
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
