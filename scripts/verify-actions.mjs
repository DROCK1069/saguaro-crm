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
// click by visible text OR aria-label OR title (smallest match)
const click = async (s) => pg.evaluate((s) => {
  const els = [...document.querySelectorAll('div,span,a,button,[role=button]')].filter(e => {
    const t = (e.textContent || '').trim(), al = e.getAttribute('aria-label') || '', ti = e.getAttribute('title') || ''
    return t === s || t.includes(s) || al === s || al.includes(s) || ti.includes(s)
  })
  els.sort((a, b) => (a.textContent || a.getAttribute('aria-label') || '').length - (b.textContent || b.getAttribute('aria-label') || '').length)
  if (els[0]) { els[0].click(); return true } return false
}, s)

await pg.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {})
await pg.waitForSelector('input', { timeout: 180000 }); await wait(2500)
const ins = await pg.$$('input')
await ins[0].click(); await ins[0].type('tntcybersolutions@gmail.com', { delay: 12 })
await ins[1].click(); await ins[1].type('Saltlife69!', { delay: 12 })
await click('Sign In'); await wait(7000)

// 1) Create Project form (Projects tab -> New project)
await click('Projects'); await wait(3000)
let opened = (await click('New project')) || (await click('Create project')) || (await click('New Project'))
await wait(2500)
await pg.screenshot({ path: `${OUT}/act_create_project.png`, fullPage: true })
console.log('create_project: opened=' + opened)
await pg.keyboard.press('Escape').catch(() => {}); await wait(1500)

// reach a project overview
await click('Projects'); await wait(2000)
await click('Commerce'); await wait(4500)
const overviewUrl = pg.url()

const sub = async (mod, btns, shot) => {
  if (pg.url() !== overviewUrl) { await pg.goto(overviewUrl, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {}); await wait(2500) }
  await click(mod); await wait(3500)
  let o = false; for (const t of btns) { if (await click(t)) { o = true; break } }
  await wait(2800)
  await pg.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true })
  console.log(`${shot}: opened=${o}`)
  await pg.goBack().catch(() => {}); await wait(2000)
}
// 2) Punch item detail (edit/delete) — tap a real item
await sub('Punch List', ['Light switch', 'Touch-up', 'Stair handrail', 'Exterior'], 'act_punch_detail')
// 3) Schedule add task
await sub('Schedule', ['Add task', '+ Add task', 'New task', 'Add'], 'act_schedule_add')
// 4) Financials -> tap a pay app / change order row
await sub('Financials', ['App #', 'Change Order', 'CO-', 'Period'], 'act_financials_detail')

console.log('JS_ERRORS:', errs.length ? errs.slice(0, 6).join(' | ') : 'none')
await b.close()
