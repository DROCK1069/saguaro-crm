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
pg.on('pageerror', e => errs.push('[pageerror] ' + e.message.slice(0, 180)))
pg.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 180)) })

const clickText = async (txt) => pg.evaluate((t) => {
  const els = [...document.querySelectorAll('div,span,a,button,[role=button]')]
  const el = els.reverse().find(e => (e.textContent || '').trim() === t || (e.getAttribute && e.getAttribute('aria-label') === t))
  if (el) { el.click(); return true } return false
}, txt)
const clickContains = async (sub) => pg.evaluate((s) => {
  const els = [...document.querySelectorAll('div,span,a,button,[role=button]')]
  const matches = els.filter(e => (e.textContent || '').includes(s))
  matches.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
  if (matches[0]) { matches[0].click(); return true } return false
}, sub)
const clickAria = async (label) => pg.evaluate((l) => {
  const el = [...document.querySelectorAll('[aria-label]')].find(e => e.getAttribute('aria-label') === l)
  if (el) { el.click(); return true } return false
}, label)

try {
  await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(e => console.log('goto note:', e.message.slice(0, 60)))
  await pg.waitForSelector('input', { timeout: 180000 })
  await wait(2500)
  const inputs = await pg.$$('input')
  if (inputs[0]) { await inputs[0].click(); await inputs[0].type('tntcybersolutions@gmail.com', { delay: 15 }) }
  if (inputs[1]) { await inputs[1].click(); await inputs[1].type('Saltlife69!', { delay: 15 }) }
  await wait(400)
  await (await clickText('Sign In')) || await clickContains('Sign In')
  console.log('signed in')
  await wait(8000)

  await clickText('Projects'); await wait(3000)
  let opened = await clickContains('Commerce') || await clickContains('Mesa') || await clickContains('DEMO') || await clickContains('Test')
  console.log('project opened=' + opened)
  await wait(5000)

  // Into RFIs
  let toRfi = await clickContains('RFI')
  console.log('navigated to RFI=' + toRfi)
  await wait(4000)
  await pg.screenshot({ path: `${OUT}/rfi_00_list.png`, fullPage: false })

  // Open create modal — gold header button is exactly "Draft with AI"
  let fab = await clickText('Draft with AI') || await clickContains('Draft with AI')
  console.log('opened create=' + fab)
  await wait(2800)
  await pg.screenshot({ path: `${OUT}/rfi_01_describe.png`, fullPage: false })

  // Type a description into the AI field (multiline TextInput). Try textarea, then any input.
  let tas = await pg.$$('textarea')
  if (!tas.length) tas = await pg.$$('input')
  console.log('input-likes found=' + tas.length)
  const tagInfo = await pg.evaluate(() => [...document.querySelectorAll('textarea,input,[contenteditable=true]')].map(e => e.tagName + (e.getAttribute('placeholder') ? ':' + e.getAttribute('placeholder').slice(0, 24) : '')))
  console.log('FIELDS:', JSON.stringify(tagInfo))
  if (tas[0]) { await tas[0].click(); await tas[0].type('The lobby ceiling fire-rated assembly on A-101 conflicts with the finish schedule. Need confirmation of the correct rated assembly and material before framing.', { delay: 6 }) }
  await wait(600)
  await pg.screenshot({ path: `${OUT}/rfi_02_described.png`, fullPage: false })

  // Tap Draft with AI
  await (await clickAria('Generate draft')) || await clickContains('Draft with AI')
  console.log('tapped draft')
  await wait(9000) // live AI call
  await pg.screenshot({ path: `${OUT}/rfi_03_review_top.png`, fullPage: false })
  // scroll the modal to show the rest of the prefilled form
  await pg.evaluate(() => { const sc = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible'); if (sc) sc.scrollTop = sc.scrollHeight * 0.45 })
  await wait(800)
  await pg.screenshot({ path: `${OUT}/rfi_04_review_mid.png`, fullPage: false })
  await pg.evaluate(() => { const sc = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible'); if (sc) sc.scrollTop = sc.scrollHeight })
  await wait(800)
  await pg.screenshot({ path: `${OUT}/rfi_05_review_bottom.png`, fullPage: false })

  // capture the subject value to prove prefill happened
  const filled = await pg.evaluate(() => {
    const vals = [...document.querySelectorAll('input,textarea')].map(e => e.value).filter(Boolean)
    return vals.slice(0, 6)
  })
  console.log('PREFILLED_VALUES:', JSON.stringify(filled))

  // Tap "File RFI" to persist, then capture the list (should now show the new RFI)
  await (await clickAria('File RFI')) || await clickContains('File RFI')
  console.log('tapped File RFI')
  await wait(6000)
  await pg.screenshot({ path: `${OUT}/rfi_06_after_file.png`, fullPage: false })
} catch (e) {
  console.log('SCRIPT ERROR:', e.message.slice(0, 200))
  try { await pg.screenshot({ path: `${OUT}/rfi_error.png` }) } catch {}
}
console.log('JS_ERRORS:', errs.length ? errs.slice(0, 8).join(' | ') : 'none')
await b.close()
