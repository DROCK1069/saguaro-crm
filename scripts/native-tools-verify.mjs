import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:8081'
const OUT = 'C:/Users/Public/saguaro-deploy/_shots'
fs.mkdirSync(OUT, { recursive: true })
const wait = ms => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2 } })
const pg = await b.newPage()
const clickContains = async (sub) => pg.evaluate((s) => {
  const els = [...document.querySelectorAll('div,span,a,button,[role=button]')].filter(e => (e.textContent || '').trim().includes(s))
  els.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
  if (els[0]) { els[0].click(); return true } return false
}, sub)

await pg.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {})
await pg.waitForSelector('input', { timeout: 180000 }); await wait(2500)
const inputs = await pg.$$('input')
await inputs[0].click(); await inputs[0].type('tntcybersolutions@gmail.com', { delay: 15 })
await inputs[1].click(); await inputs[1].type('Saltlife69!', { delay: 15 })
await clickContains('Sign In'); await wait(7000)
await clickContains('Commerce'); await wait(4500)
const overviewUrl = pg.url()
console.log('overview =', overviewUrl)

// Module labels exactly as they appear on the grouped project overview
const mods = ['Daily Logs', 'Punch List', 'Photos', 'Safety', 'Drawings', 'RFIs', 'Inspections', 'Schedule', 'Financials']
const report = []
for (const label of mods) {
  const errs = []
  const onErr = e => errs.push(e.message.slice(0, 110))
  pg.on('pageerror', onErr)
  try {
    // make sure we're on the overview
    if (pg.url() !== overviewUrl) { await pg.goto(overviewUrl, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {}); await wait(2500) }
    const clicked = await clickContains(label)
    await wait(3800)
    const info = await pg.evaluate(() => {
      const txt = document.body.innerText || ''
      return { len: txt.trim().length, hasErr: /something went wrong|couldn't load|cannot read|undefined is not|TypeError|is not a function|NaN/i.test(txt), sample: txt.replace(/\s+/g, ' ').slice(0, 100) }
    })
    const name = label.toLowerCase().replace(/[^a-z]/g, '')
    await pg.screenshot({ path: `${OUT}/tool_${name}.png`, fullPage: true })
    report.push(`${label}: clicked=${clicked} len=${info.len} ${info.hasErr ? '*** ERROR-TEXT ***' : 'ok'} ${errs.length ? 'JS:' + errs[0] : ''} | ${info.sample}`)
  } catch (e) { report.push(`${label}: FAIL ${e.message.slice(0, 60)}`) }
  pg.off('pageerror', onErr)
  await pg.goBack().catch(() => {}); await wait(2500)
}
console.log('\n=== TOOL SCREENS ===')
report.forEach(r => console.log(r))
await b.close()
