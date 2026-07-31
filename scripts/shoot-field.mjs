import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'https://www.saguarocontrol.net'
const PID = '11111111-1111-1111-1111-111111111104'
const { user, pass } = JSON.parse(fs.readFileSync('D:/saguaro-mobile/.democreds.json', 'utf8'))
const OUT = 'C:/Users/Public/saguaro-deploy/_shots'
fs.mkdirSync(OUT, { recursive: true })
const wait = ms => new Promise(r => setTimeout(r, ms))
// iPhone-ish viewport since field is a mobile PWA
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2 } })
const pg = await b.newPage()
// neutralize the PWA install auto-popup so shots show the real UI
await pg.evaluateOnNewDocument(() => {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); e.stopImmediatePropagation() }, true)
})
await pg.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 })
await pg.waitForSelector('input', { timeout: 15000 })
const es = await pg.$('input[type=email]') ? 'input[type=email]' : 'input[name=email]'
const ps = await pg.$('input[type=password]') ? 'input[type=password]' : 'input[name=password]'
await pg.type(es, user, { delay: 6 }); await pg.type(ps, pass, { delay: 6 })
await Promise.all([pg.keyboard.press('Enter'), pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {})])
await wait(2500)
// suppress the install prompt so shots show the actual UI
await pg.evaluate(() => { try { localStorage.setItem('sag_install_dismissed', '1') } catch (e) {} })
const pages = process.argv.slice(2)
for (const u of pages) {
  const url = `${BASE}${u}${u.includes('?') ? '' : `?projectId=${PID}`}`
  const name = u.replace(/[\/?=&]/g, '_').replace(/^_+/, '') || 'home'
  try {
    await pg.goto(url, { waitUntil: 'networkidle2', timeout: 40000 }); await wait(2000)
    // dismiss the install bottom-sheet if it popped (production still unconditional)
    await pg.evaluate(() => {
      const el = [...document.querySelectorAll('button,div,span,a')].find(e => (e.textContent || '').trim() === 'Not now')
      if (el) el.click()
    })
    await wait(600)
    await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
    console.log(`  shot ${name}.png`)
  } catch (e) { console.log(`  FAIL ${name}: ${e.message.slice(0, 60)}`) }
}
await b.close()
console.log('done')
