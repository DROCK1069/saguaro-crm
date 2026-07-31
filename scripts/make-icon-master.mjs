import sharp from 'sharp'
const SRC = 'C:/Users/ChadDerocher/Downloads/image-1781545521614.png'
const NAVY = { r: 0x1b, g: 0x1f, b: 0x3b } // brand deep navy (matches pasted bg)

const base = sharp(SRC).ensureAlpha()
const { width, height } = await base.metadata()
const { data } = await base.raw().toBuffer({ resolveWithObject: true })
const aAt = (x, y) => data[(y * width + x) * 4 + 3]

// Per-row opaque counts -> find vertical content bands (hexagon vs text).
const rowThr = width * 0.04
const rowCount = []
for (let y = 0; y < height; y++) { let c = 0; for (let x = 0; x < width; x++) if (aAt(x, y) > 40) c++; rowCount[y] = c }
const bands = []; let start = -1
for (let y = 0; y < height; y++) {
  if (rowCount[y] > rowThr) { if (start < 0) start = y }
  else { if (start >= 0) { bands.push([start, y - 1]); start = -1 } }
}
if (start >= 0) bands.push([start, height - 1])
const hex = bands[0] // top band = the hexagon badge
// Horizontal bounds within the hexagon band.
let minX = width, maxX = 0
for (let y = hex[0]; y <= hex[1]; y++) for (let x = 0; x < width; x++) if (aAt(x, y) > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x }
const bx = minX, by = hex[0], bw = maxX - minX + 1, bh = hex[1] - hex[0] + 1
console.log('bands:', JSON.stringify(bands), '| hex bbox:', bx, by, bw, bh)

// Extract the badge, upscale it, and center on a navy square at ~78% scale.
const SIZE = 1024
const target = Math.round(SIZE * 0.80)
const scale = target / Math.max(bw, bh)
const badge = await sharp(SRC).extract({ left: bx, top: by, width: bw, height: bh })
  .resize({ width: Math.round(bw * scale), height: Math.round(bh * scale), fit: 'fill', kernel: 'lanczos3' })
  .png().toBuffer()
const bMeta = await sharp(badge).metadata()

const master = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { ...NAVY, alpha: 1 } } })
  .composite([{ input: badge, left: Math.round((SIZE - bMeta.width) / 2), top: Math.round((SIZE - bMeta.height) / 2) }])
  .png().toBuffer()

await sharp(master).toFile('C:/Users/Public/saguaro-deploy/_icon_master.png')           // opaque navy, for iOS
await sharp(badge).toFile('C:/Users/Public/saguaro-deploy/_icon_badge.png')             // transparent badge, for favicons/adaptive
// preview at small sizes to judge legibility
await sharp(master).resize(120, 120).toFile('C:/Users/Public/saguaro-deploy/_icon_preview120.png')
await sharp(master).resize(32, 32).toFile('C:/Users/Public/saguaro-deploy/_icon_preview32.png')
console.log('wrote _icon_master.png (1024 navy), _icon_badge.png (transparent), previews')
