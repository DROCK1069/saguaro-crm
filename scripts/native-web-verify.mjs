import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const URL = 'http://localhost:8081'
const OUT = 'C:/Users/Public/saguaro-deploy/_shots'
fs.mkdirSync(OUT, { recursive: true })
const wait = ms => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2 } })
const pg = await b.newPage()
const errs = []
pg.on('pageerror', e => errs.push('[pageerror] ' + e.message.slice(0, 160)))
pg.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 160)) })

const clickText = async (txt) => pg.evaluate((t) => {
  const els = [...document.querySelectorAll('div,span,a,button,[role=button]')]
  const el = els.reverse().find(e => (e.textContent || '').trim() === t || (e.getAttribute && e.getAttribute('aria-label') === t))
  if (el) { el.click(); return true } return false
}, txt)

const clickContains = async (sub) => pg.evaluate((s) => {
  const els = [...document.querySelectorAll('div,span,a,button,[role=button]')]
  // smallest element whose text contains the substring (the actual card/row)
  const matches = els.filter(e => (e.textContent || '').includes(s))
  matches.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
  if (matches[0]) { matches[0].click(); return true } return false
}, sub)

try {
  console.log('loading', URL)
  await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(e => console.log('goto note:', e.message.slice(0, 60)))
  // Metro compiles the web bundle on first load; give it time and wait for the rendered login input.
  await pg.waitForSelector('input', { timeout: 180000 })
  await wait(2500)
  await pg.screenshot({ path: `${OUT}/native_01_login.png`, fullPage: false })
  console.log('login screen shot')

  // Fill credentials
  const inputs = await pg.$$('input')
  if (inputs[0]) { await inputs[0].click(); await inputs[0].type('tntcybersolutions@gmail.com', { delay: 20 }) }
  if (inputs[1]) { await inputs[1].click(); await inputs[1].type('Saltlife69!', { delay: 20 }) }
  await wait(500)
  await (await clickText('Sign In')) || await clickContains('Sign In')
  console.log('tapped sign in')
  await wait(7000)
  await pg.screenshot({ path: `${OUT}/native_02_afterlogin.png`, fullPage: false })

  // Go to Projects tab
  await clickText('Projects'); await wait(3000)
  await pg.screenshot({ path: `${OUT}/native_03_projects.png`, fullPage: false })

  // Open a project (Mesa / Commerce / DEMO)
  let opened = await clickContains('Commerce') || await clickContains('Mesa') || await clickContains('DEMO')
  await wait(5000)
  await pg.screenshot({ path: `${OUT}/native_04_project_overview.png`, fullPage: true })
  console.log('project overview shot, opened=' + opened)
} catch (e) {
  console.log('SCRIPT ERROR:', e.message.slice(0, 200))
  try { await pg.screenshot({ path: `${OUT}/native_error.png` }) } catch {}
}
console.log('JS_ERRORS:', errs.length ? errs.slice(0, 8).join(' | ') : 'none')
await b.close()
