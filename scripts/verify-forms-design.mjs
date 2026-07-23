import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:8081'
const OUT = 'C:/Users/Public/saguaro-deploy/_shots'
fs.mkdirSync(OUT, { recursive: true })
const wait = ms => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2 } })
const pg = await b.newPage()
const errs = []
pg.on('pageerror', e => errs.push(e.message.slice(0, 110)))
const click = async (sub, exact = false) => pg.evaluate(({ s, ex }) => {
  const els = [...document.querySelectorAll('div,span,a,button,[role=button]')].filter(e => {
    const t = (e.textContent || '').trim(); return ex ? t === s : t.includes(s)
  })
  els.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
  if (els[0]) { els[0].click(); return true } return false
}, { s: sub, ex: exact })

await pg.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {})
await pg.waitForSelector('input', { timeout: 180000 }); await wait(2500)
const ins = await pg.$$('input')
await ins[0].click(); await ins[0].type('tntcybersolutions@gmail.com', { delay: 12 })
await ins[1].click(); await ins[1].type('Saltlife69!', { delay: 12 })
await click('Sign In'); await wait(7000)
await pg.screenshot({ path: `${OUT}/v2_home.png`, fullPage: true })
console.log('home shot')

await click('Commerce'); await wait(4500)
const overviewUrl = pg.url()
await pg.screenshot({ path: `${OUT}/v2_overview.png`, fullPage: true })
console.log('overview shot, url=', overviewUrl)

const openForm = async (moduleLabel, btnTexts, shot) => {
  if (pg.url() !== overviewUrl) { await pg.goto(overviewUrl, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {}); await wait(2500) }
  await click(moduleLabel); await wait(3500)
  let opened = false
  for (const t of btnTexts) { if (await click(t)) { opened = true; break } }
  await wait(3000)
  await pg.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true })
  console.log(`${shot}: openedBtn=${opened}`)
  await pg.goBack().catch(() => {}); await wait(2000)
}

await openForm('RFIs', ['Draft with AI', 'New RFI', 'New', 'Add', '+'], 'v2_rfi_form')
await openForm('Punch List', ['Add', '+ Add', 'New', '+'], 'v2_punch_form')
await openForm('Safety', ['Report Incident', 'Report', 'New', '+'], 'v2_safety_form')

console.log('JS_ERRORS:', errs.length ? errs.slice(0, 6).join(' | ') : 'none')
await b.close()
