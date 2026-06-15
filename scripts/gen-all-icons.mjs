import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'node:fs'

const SRC = 'C:/Users/ChadDerocher/Downloads/image-1781545521614.png'
const BBOX = { left: 126, top: 65, width: 229, height: 220 } // hexagon badge in the 491x508 source
const NAVY = { r: 0x1b, g: 0x1f, b: 0x3b, alpha: 1 }
const WEB = 'C:/Users/Public/saguaro-deploy/public'
const NATIVE = 'D:/saguaro-mobile/assets'

// Badge re-extracted from the ORIGINAL at a given max dimension (avoids double-upscaling).
async function badge(maxPx) {
  const s = maxPx / Math.max(BBOX.width, BBOX.height)
  return sharp(SRC).extract(BBOX)
    .resize({ width: Math.round(BBOX.width * s), height: Math.round(BBOX.height * s), kernel: 'lanczos3' })
    .png().toBuffer()
}
// Badge centered on a navy square of `size`, badge occupying `frac` of it.
async function onNavy(size, frac) {
  const b = await badge(Math.round(size * frac))
  const m = await sharp(b).metadata()
  return sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
    .composite([{ input: b, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }])
    .png().toBuffer()
}
// Badge centered on a TRANSPARENT square (for Android adaptive / splash).
async function onClear(size, frac) {
  const b = await badge(Math.round(size * frac))
  const m = await sharp(b).metadata()
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: b, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }])
    .png().toBuffer()
}

const paddedMaster = await onNavy(1024, 0.80) // app icons (premium padding)
const tightMaster = await onNavy(1024, 0.92)  // small favicons (max legibility)
const write = (p, buf) => { fs.writeFileSync(p, buf); console.log('  ' + p.replace(/.*\/(public|assets)\//, '$1/')) }
const resize = (master, size) => sharp(master).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer()

console.log('WEB:')
// padded PWA / touch icons
for (const s of [72, 96, 120, 144, 152, 167, 180, 192, 256, 384, 512]) write(`${WEB}/icons/icon-${s}x${s}.png`, await resize(paddedMaster, s))
write(`${WEB}/apple-touch-icon.png`, await resize(paddedMaster, 180))
// tight favicons
write(`${WEB}/icons/icon-48x48.png`, await resize(tightMaster, 48))
write(`${WEB}/favicon-32x32.png`, await resize(tightMaster, 32))
write(`${WEB}/favicon-16x16.png`, await resize(tightMaster, 16))
// classic favicon.ico (16/32/48 from tight)
const ico = await pngToIco([await resize(tightMaster, 16), await resize(tightMaster, 32), await resize(tightMaster, 48)])
write(`${WEB}/favicon.ico`, ico)

console.log('NATIVE:')
// iOS app icon — MUST be opaque (no alpha). flatten over navy.
write(`${NATIVE}/icon.png`, await sharp(paddedMaster).flatten({ background: NAVY }).png().toBuffer())
// Android adaptive foreground — logo within ~62% safe zone, transparent bg (navy set in app.json)
write(`${NATIVE}/adaptive-icon.png`, await onClear(1024, 0.62))
// Expo web favicon
write(`${NATIVE}/favicon.png`, await resize(tightMaster, 48))
// Splash — badge on transparent, modest size, shown on splash bg color
write(`${NATIVE}/splash-icon.png`, await onClear(1024, 0.42))

// keep a master copy for reference / future App Store hi-res replacement
write(`${WEB}/icons/icon-1024-master.png`, paddedMaster)
console.log('done')
