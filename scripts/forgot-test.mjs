import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'https://www.saguarocontrol.net'
const EMAIL = 'tntcybersolutions@gmail.com'
const wait = ms => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 420, height: 900 } })
const pg = await b.newPage()
const errs = []
pg.on('pageerror', e => errs.push('[pageerror] ' + e.message.slice(0, 120)))
pg.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 120)) })
await pg.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle2', timeout: 45000 })
await wait(1200)
// Find the email input
const sel = (await pg.$('input[type=email]')) ? 'input[type=email]' : 'input'
const before = await pg.$eval(sel, el => ({ disabled: el.disabled, readOnly: el.readOnly, value: el.value }))
// Try to type like a user
await pg.click(sel).catch(() => {})
await pg.type(sel, EMAIL, { delay: 25 }).catch(e => errs.push('[type] ' + e.message.slice(0, 80)))
const after = await pg.$eval(sel, el => el.value)
console.log('input disabled=' + before.disabled + ' readOnly=' + before.readOnly)
console.log('typed value now: "' + after + '"  (expected: ' + EMAIL + ')')
console.log('TYPING_WORKS=' + (after === EMAIL))
if (after === EMAIL) {
  // Submit to actually send the reset email
  await Promise.all([
    pg.click('button[type=submit]').catch(() => {}),
  ])
  await wait(3500)
  const body = await pg.evaluate(() => document.body.innerText)
  const sent = /Check your email|reset link/i.test(body)
  console.log('RESET_SENT=' + sent)
  const errLine = (body.match(/.*(error|invalid|wrong|failed).*/i) || [])[0]
  if (!sent && errLine) console.log('page message: ' + errLine.slice(0, 120))
}
console.log('JS_ERRORS=' + (errs.length ? errs.join(' | ') : 'none'))
await pg.screenshot({ path: 'C:/Users/Public/saguaro-deploy/_shots/forgot.png' })
await b.close()
