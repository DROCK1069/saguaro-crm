const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const p = await b.newPage();
  const msgs = [];
  p.on('console', async m => {
    if (m.type() === 'error' || m.type() === 'warning') {
      const args = await Promise.all(m.args().map(a => a.jsonValue().catch(() => '?')));
      msgs.push('[' + m.type() + '] ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' | ').slice(0, 900));
    }
  });
  await p.goto('http://localhost:3011/tkhai', { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise(r => setTimeout(r, 3000));
  await b.close();
  console.log(msgs.join('\n\n====\n\n'));
})().catch(e => { console.error(String(e).slice(0, 300)); process.exit(1); });
