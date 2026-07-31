const puppeteer = require('puppeteer');
async function texts(b, js) {
  const p = await b.newPage();
  await p.setJavaScriptEnabled(js);
  await p.goto('http://localhost:3011/tkhai', { waitUntil: 'networkidle2', timeout: 120000 });
  if (js) await new Promise(r => setTimeout(r, 2500));
  const res = await p.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { const t = (n.textContent || '').replace(/\s+/g, ' ').trim(); if (t) out.push(t.slice(0, 80)); }
    return out;
  });
  await p.close();
  return res;
}
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const s = await texts(b, false);
  const c = await texts(b, true);
  await b.close();
  const max = Math.max(s.length, c.length);
  console.log('server texts=' + s.length + ' client texts=' + c.length);
  for (let i = 0; i < max; i++) {
    if (s[i] !== c[i]) console.log('DIFF@' + i + '\n  S: ' + JSON.stringify(s[i]) + '\n  C: ' + JSON.stringify(c[i]));
  }
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
