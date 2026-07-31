/**
 * Node proof for lib/heatmap/vector-pdf.ts
 *
 *   npx tsx scripts/vector-pdf.test.mjs
 *
 * Generates tiny vector PDFs with KNOWN geometry (pdf-lib), parses them with the
 * real parser, and asserts geometry + scale + the scanned-image fallback path.
 * Pure/deterministic — no network, no fixtures.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { parseVectorPdf, parseArchLength, parseScaleNote } from '../lib/heatmap/vector-pdf.ts';

let passed = 0;
let total = 0;
function check(name, cond, extra) {
  total++;
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name}${extra != null ? '  →  ' + extra : ''}`);
  }
}

/* ── Fixture 1: a dimensioned room ───────────────────────────────────────────
 * page 500×400 pt. rectangle room 400×300 at (50,50). interior wall at x=250.
 * dimension "20'-0\"" centered under the 400pt bottom edge → pxPerFt = 20.
 */
async function buildRoomPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 400]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 50, y: 50, width: 400, height: 300, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  page.drawLine({ start: { x: 250, y: 50 }, end: { x: 250, y: 350 }, thickness: 1, color: rgb(0, 0, 0) });
  page.drawText("20'-0\"", { x: 240, y: 30, size: 10, font });
  return new Uint8Array(await doc.save());
}

/* ── Fixture 2: raster-only (a scanned-style page: one image, no vectors) ── */
async function buildRasterPdf() {
  const png = await sharp({
    create: { width: 24, height: 24, channels: 3, background: { r: 210, g: 210, b: 210 } },
  }).png().toBuffer();
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  const img = await doc.embedPng(png);
  page.drawImage(img, { x: 0, y: 0, width: 300, height: 200 });
  return new Uint8Array(await doc.save());
}

/* ── Fixture 3: a page carrying an explicit SCALE note (1/4"=1'-0" → 18 px/ft) */
async function buildScaleNotePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 300]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawLine({ start: { x: 40, y: 150 }, end: { x: 360, y: 150 }, thickness: 1, color: rgb(0, 0, 0) });
  page.drawText('SCALE: 1/4"=1\'-0"', { x: 40, y: 40, size: 10, font });
  return new Uint8Array(await doc.save());
}

async function main() {
  /* ---- unit: length + scale-note parsers (pure) ---- */
  check('parseArchLength 20\'-0"', parseArchLength("20'-0\"") === 20, parseArchLength("20'-0\""));
  check('parseArchLength 10\'-6"', Math.abs(parseArchLength("10'-6\"") - 10.5) < 1e-9, parseArchLength("10'-6\""));
  check('parseArchLength 24\'', parseArchLength("24'") === 24, parseArchLength("24'"));
  check('parseArchLength 3.5 m', Math.abs(parseArchLength('3.5 m') - 11.4829) < 0.01, parseArchLength('3.5 m'));
  check('parseArchLength junk → null', parseArchLength('Room 101') === null);
  check('parseScaleNote 1/4"=1\'-0" → 18', Math.abs(parseScaleNote('1/4"=1\'-0"') - 18) < 1e-6, parseScaleNote('1/4"=1\'-0"'));
  check('parseScaleNote 1"=20\' → 3.6', Math.abs(parseScaleNote('1"=20\'') - 3.6) < 1e-6, parseScaleNote('1"=20\''));

  /* ---- Fixture 1: dimensioned room ---- */
  const room = await parseVectorPdf(await buildRoomPdf());
  console.log('\n[room] ok=%s dims=%sx%s segs=%d texts=%d scale=%o',
    room.ok, room.pageWidthPt, room.pageHeightPt, room.segments.length, room.texts.length, room.detectedScale);

  check('room ok', room.ok === true, room.error);
  check('room pageWidthPt ≈ 500', Math.abs(room.pageWidthPt - 500) < 0.5, room.pageWidthPt);
  check('room pageHeightPt ≈ 400', Math.abs(room.pageHeightPt - 400) < 0.5, room.pageHeightPt);
  check('room segment count 5 (4 rect edges + 1 wall)',
    room.segments.length >= 5 && room.segments.length <= 6, room.segments.length);

  const horiz = room.segments.filter((s) => Math.abs(s.y1 - s.y2) < 1);
  const vert = room.segments.filter((s) => Math.abs(s.x1 - s.x2) < 1);
  const longH = horiz.reduce((m, s) => Math.max(m, s.len), 0);
  const longV = vert.reduce((m, s) => Math.max(m, s.len), 0);
  check('room long horizontal edge ≈ 400pt', Math.abs(longH - 400) < 1.5, longH);
  check('room vertical edge ≈ 300pt', Math.abs(longV - 300) < 1.5, longV);
  check('room has ≥2 horizontal + ≥3 vertical edges', horiz.length >= 2 && vert.length >= 3,
    `h=${horiz.length} v=${vert.length}`);

  check('room texts include the dimension "20\'-0\""',
    room.texts.some((t) => t.str.includes("20'-0\"") || /20'\s*-?\s*0"/.test(t.str)),
    JSON.stringify(room.texts.map((t) => t.str)));

  // detectedScale: hard requirement is null-or-positive (never negative/NaN).
  const ds = room.detectedScale;
  check('room detectedScale is null OR positive-finite',
    ds === null || (Number.isFinite(ds.pxPerFt) && ds.pxPerFt > 0), JSON.stringify(ds));
  // and (engineered) it should fire at pxPerFt ≈ 20 from the dimension.
  check('room detectedScale fired ≈ 20 px/ft from dimension',
    ds !== null && Math.abs(ds.pxPerFt - 20) < 1 && ds.source === 'dimension', JSON.stringify(ds));

  /* ---- Fixture 2: raster-only ---- */
  const raster = await parseVectorPdf(await buildRasterPdf());
  console.log('\n[raster] ok=%s error=%s segs=%d', raster.ok, raster.error, raster.segments.length);
  check('raster-only PDF → ok:false', raster.ok === false, raster.ok);
  check('raster-only error mentions scanned image',
    typeof raster.error === 'string' && /scanned image|No vector geometry/i.test(raster.error), raster.error);
  check('raster-only detectedScale is null', raster.detectedScale === null);

  /* ---- Fixture 3: explicit scale note ---- */
  const noted = await parseVectorPdf(await buildScaleNotePdf());
  console.log('\n[scale-note] ok=%s scale=%o', noted.ok, noted.detectedScale);
  check('scale-note ok', noted.ok === true, noted.error);
  check('scale-note detectedScale ≈ 18 px/ft via scale-note',
    noted.detectedScale !== null &&
      Math.abs(noted.detectedScale.pxPerFt - 18) < 0.5 &&
      noted.detectedScale.source === 'scale-note',
    JSON.stringify(noted.detectedScale));

  /* ---- guard: page-out-of-range clamps, never throws ---- */
  const clamped = await parseVectorPdf(await buildRoomPdf(), { page: 99 });
  check('out-of-range page clamps to a valid page (no throw)', clamped.ok === true, clamped.error);

  console.log(`\nPASS ${passed}/${total}`);
  if (passed !== total) process.exit(1);
}

main().catch((e) => {
  console.error('TEST HARNESS ERROR', e);
  process.exit(1);
});
