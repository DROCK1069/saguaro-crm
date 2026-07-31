const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  const msgs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') msgs.push('[' + m.type() + '] ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => msgs.push('[pageerror] ' + String(e).slice(0, 300)));
  await p.goto('http://localhost:3011/tkhai', { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise(r => setTimeout(r, 3000));
  await b.close();
  console.log(msgs.length ? msgs.join('\n') : 'NO ERRORS/WARNINGS');
})().catch(e => { console.error(String(e).slice(0, 300)); process.exit(1); });
