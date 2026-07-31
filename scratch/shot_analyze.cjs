const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 1.5 });
  await p.goto('http://localhost:3011/tkanalyze', { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise(r => setTimeout(r, 1500));
  // Upload a file to the hidden input to enable the Analyze button
  const input = await p.$('input[type=file]');
  if (input) await input.uploadFile('C:/Users/Public/saguaro-deploy/scratch/count_plan.png');
  await new Promise(r => setTimeout(r, 600));
  // Click the "Start AI Analysis" button
  const clicked = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const t = btns.find(b => /Start AI Analysis/i.test(b.textContent || ''));
    if (t) { t.click(); return true; } return false;
  });
  await new Promise(r => setTimeout(r, 1800));
  await p.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach(e => e.remove());
    ['[class*="MarketingChat"]', '[id*="chat"]', 'button[aria-label*="chat" i]'].forEach(sel => document.querySelectorAll(sel).forEach(e => { e.style.display = 'none'; }));
  });
  await new Promise(r => setTimeout(r, 150));
  await p.screenshot({ path: 'C:/Users/Public/saguaro-deploy/scratch/analyze_v1.png', fullPage: true });
  await b.close();
  console.log('clicked=' + clicked);
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
