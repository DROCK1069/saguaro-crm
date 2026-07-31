import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'https://www.saguarocontrol.net'
const PID = '11111111-1111-1111-1111-111111111104'
const { user, pass } = JSON.parse(fs.readFileSync('D:/saguaro-mobile/.democreds.json', 'utf8'))
const OUT = 'C:/Users/Public/saguaro-deploy/_shots'
fs.mkdirSync(OUT, { recursive: true })
const wait = ms => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2 } })
const pg = await b.newPage()
await pg.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 })
await pg.waitForSelector('input', { timeout: 15000 })
const es = await pg.$('input[type=email]') ? 'input[type=email]' : 'input[name=email]'
const ps = await pg.$('input[type=password]') ? 'input[type=password]' : 'input[name=password]'
await pg.type(es, user, { delay: 6 }); await pg.type(ps, pass, { delay: 6 })
await Promise.all([pg.keyboard.press('Enter'), pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {})])
await wait(2500)
// Visit field pages. Do NOT neutralize anything — test the deployed behavior as a real user.
const pages = ['/field', '/field/permits', '/field/daily-log']
for (const u of pages) {
  const url = `${BASE}${u}?projectId=${PID}`
  const name = 'v_' + (u.replace(/[\/?=&]/g, '_').replace(/^_+/, '') || 'home')
  await pg.goto(url, { waitUntil: 'networkidle2', timeout: 40000 }); await wait(3000)
  // detect: is the install bottom-sheet visible? is a marketing-chat FAB present?
  const probe = await pg.evaluate(() => {
    const txt = document.body.innerText || ''
    const installVisible = /Install Saguaro Field/.test(txt)
    // marketing chat widget renders a fixed bottom-right launcher; look for any fixed el near bottom-right that isn't the nav
    const fixedBottomRight = [...document.querySelectorAll('*')].filter(el => {
      const s = getComputedStyle(el); if (s.position !== 'fixed') return false
      const r = el.getBoundingClientRect()
      return r.right > window.innerWidth - 90 && r.bottom > window.innerHeight - 110 && r.width < 90 && r.height < 90 && r.width > 20
    }).length
    return { installVisible, fixedBottomRight }
  })
  await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log(`${name}: installPopup=${probe.installVisible} fabLikeFixed=${probe.fixedBottomRight}`)
}
await b.close()
console.log('done')
