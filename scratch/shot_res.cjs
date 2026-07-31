const puppeteer = require('puppeteer');
const out = process.argv[2] || 'ai_results';
const w = Number(process.argv[3] || 1280);
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: w, height: 1600, deviceScaleFactor: 1.5 });
  await p.goto('http://localhost:3011/tkres', { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise(r => setTimeout(r, 3800));
  await p.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach(e => e.remove());
    ['[class*="MarketingChat"]', '[id*="chat"]', 'button[aria-label*="chat" i]'].forEach(sel => document.querySelectorAll(sel).forEach(e => { e.style.display = 'none'; }));
  });
  await new Promise(r => setTimeout(r, 150));
  await p.screenshot({ path: `C:/Users/Public/saguaro-deploy/scratch/${out}.png`, fullPage: true });
  await b.close();
  console.log('shot: ' + out + ' @' + w);
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
