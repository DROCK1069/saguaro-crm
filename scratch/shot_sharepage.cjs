const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true });
  // live deployed share page — invalid token → renders the "unavailable" state, which still
  // exercises the responsive header + shell layout at mobile width (the v5 fix).
  await p.goto('https://saguarocontrol.net/share/takeoff/00000000-0000-0000-0000-000000000000?t=x&e=0', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1500));
  await p.screenshot({ path: 'scratch/sharepage_mobile.png' });
  // check the body never scrolls horizontally (the real responsive test)
  const overflow = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log('mobile viewport 375 → scrollWidth', overflow.sw, 'clientWidth', overflow.cw, overflow.sw <= overflow.cw + 1 ? 'NO horizontal overflow ✓' : 'HORIZONTAL OVERFLOW');
  await b.close();
})().catch((e) => { console.error('ERR:', String(e).slice(0, 200)); process.exit(1); });
