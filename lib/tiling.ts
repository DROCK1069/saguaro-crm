/**
 * lib/tiling.ts — Deep Zoom (DZI) tile-pyramid generation for huge sheets.
 *
 * Procore tiles giant drawings so pan/zoom is instant instead of loading a
 * 50MB image. This uses sharp/libvips `.tile()` to build a DZI pyramid
 * (descriptor + per-level 256px tiles), returned as a flat file list the
 * route uploads to storage; the viewer (OpenSeadragon) streams only the tiles
 * in view.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'fs';
import { join, relative } from 'path';
import { tmpdir } from 'os';

export interface TileFile { rel: string; buffer: Buffer; contentType: string }
export interface DziResult { files: TileFile[]; dziXml: string; levels: number; tileCount: number; width: number; height: number }

function walk(dir: string, base: string, out: TileFile[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { walk(full, base, out); continue; }
    // libvips writes a per-level vips-properties.xml the viewer never requests — skip it
    if (name === 'vips-properties.xml') continue;
    const ct = name.endsWith('.dzi') ? 'application/xml'
      : name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    out.push({ rel: relative(base, full).split('\\').join('/'), buffer: readFileSync(full), contentType: ct });
  }
}

export async function generateDziTiles(image: Buffer, opts?: { size?: number }): Promise<DziResult> {
  const sharp = (await import('sharp' as string)).default;
  const meta = await sharp(image).metadata();
  const work = mkdtempSync(join(tmpdir(), 'dzi-'));
  // libvips appends ".dzi" to the stem and writes "<stem>_files/<level>/<x>_<y>.jpeg".
  // Pass the bare stem so we get clean "sheet.dzi" + "sheet_files/..." names the proxy/viewer can predict.
  const stem = join(work, 'sheet');
  try {
    // format (jpeg quality) must be set BEFORE .tile() so it applies to tiles
    await sharp(image).jpeg({ quality: 82 }).tile({ size: opts?.size || 256, overlap: 1, layout: 'dz' }).toFile(stem);
    const files: TileFile[] = [];
    walk(work, work, files);
    const dzi = files.find((f) => f.rel.endsWith('.dzi'));
    const tiles = files.filter((f) => f.rel.endsWith('.jpg') || f.rel.endsWith('.jpeg') || f.rel.endsWith('.png'));
    // count distinct levels = subdirectories under sheet_files
    const levels = new Set(tiles.map((t) => t.rel.split('/').slice(-2, -1)[0])).size;
    return {
      files,
      dziXml: dzi ? dzi.buffer.toString('utf8') : '',
      levels,
      tileCount: tiles.length,
      width: meta.width || 0,
      height: meta.height || 0,
    };
  } finally {
    try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
