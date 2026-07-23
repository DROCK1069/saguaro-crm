import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:8081'
const OUT = 'C:/Users/Public/saguaro-deploy/_shots'
const wait = ms => new Promise(r => setTimeout(r, ms))
const NAME = 'ZZWIRECHECK Tower'
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2 } })
const pg = await b.newPage()
const errs = []
pg.on('pageerror', e => errs.push(e.message.slice(0, 120)))
const click = async (s) => pg.evaluate((s) => {
  const els = [...document.querySelectorAll('div,span,a,button,[role=button]')].filter(e => {
    const t = (e.textContent || '').trim(), al = e.getAttribute('aria-label') || ''
    return t === s || al === s || al.includes(s) || (t.includes(s) && t.length < s.length + 14)
  })
  els.sort((a, b) => (a.textContent || a.getAttribute('aria-label') || '').length - (b.textContent || b.getAttribute('aria-label') || '').length)
  if (els[0]) { els[0].click(); return true } return false
}, s)
const typeInto = async (placeholderSub, value) => pg.evaluate(({ p, v }) => {
  const inp = [...document.querySelectorAll('input,textarea')].find(i => (i.placeholder || '').toLowerCase().includes(p.toLowerCase()))
  if (!inp) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  setter.call(inp, v)
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}, { p: placeholderSub, v: value })

await pg.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {})
await pg.waitForSelector('input', { timeout: 180000 }); await wait(2500)
const ins = await pg.$$('input')
await ins[0].click(); await ins[0].type('tntcybersolutions@gmail.com', { delay: 12 })
await ins[1].click(); await ins[1].type('Saltlife69!', { delay: 12 })
await click('Sign In'); await wait(7000)
await click('Projects'); await wait(3000)
const opened = (await click('New project')) || (await click('Create project')) || (await click('New Project'))
await wait(2500)
const n = await typeInto('Riverside', NAME) || await typeInto('Office Tower', NAME)
await typeInto('Street', '123 Verify Ave, Phoenix, AZ')
await click('Industrial'); await wait(300)
await click('Precon'); await wait(300)
await typeInto('0', '7654321')
await typeInto('YYYY-MM-DD', '2026-03-15')
await wait(500)
await pg.screenshot({ path: `${OUT}/db_create_filled.png`, fullPage: true })
const submitted = await click('Create project')
await wait(5000)
const body = await pg.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120))
console.log('opened=' + opened + ' nameTyped=' + n + ' submitted=' + submitted)
console.log('after-submit body:', body)
console.log('JS_ERRORS:', errs.length ? errs.slice(0, 5).join(' | ') : 'none')
await b.close()
