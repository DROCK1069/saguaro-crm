/**
 * Blueprint Processor — bulletproof fallback chain
 *
 * NEVER throws an unhandled error. Every path returns a result or a friendly error.
 *
 * PDF fallback chain:
 *   1. pdf-lib trims to first 8 pages → base64 → document type
 *   2. pdf-lib fails → send raw PDF as-is (up to 20MB)
 *   3. Over 20MB → convert first page to image via sharp → image type
 *
 * Image fallback chain:
 *   4. sharp resizes to max 2000×2000 JPEG → image type
 *   5. sharp fails → send original if under 5MB
 *   6. Over 5MB with no sharp → friendly error
 *
 * Special cases:
 *   7. DWG → friendly error with instructions
 *   8. Unknown type → attempt as PDF, log warning
 *   9. ANY error → catch, log, use original buffer, never crash
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const MB = 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'];

// Dimension legibility: plans carry tiny dimension callouts, so we rasterize at a
// higher ceiling than a typical photo. 2600px on the long edge keeps 1/8" text
// readable to the vision model without exploding token cost.
const MAX_IMAGE_DIM = 2600;
const PDF_RASTER_DENSITY = 300; // DPI when sharp rasterizes a PDF page to an image

// ── Sharp: lazy-load (no auto-install — sharp is in package.json) ────────────

let sharpModule: any = null;
let sharpUnavailable = false;

async function getSharp(): Promise<any> {
  if (sharpUnavailable) return null;
  if (sharpModule) return sharpModule;

  try {
    sharpModule = (await import('sharp' as any)).default;
    return sharpModule;
  } catch {
    sharpUnavailable = true;
    console.warn('[blueprint-processor] sharp not available — image fallbacks limited');
    return null;
  }
}

// ── PDF: trim to first N pages ───────────────────────────────────────────────

async function trimPdf(buffer: Buffer, maxPages = 8): Promise<{ buffer: Buffer; pageCount: number; trimmed: boolean }> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageCount = src.getPageCount();

    if (pageCount <= maxPages) {
      return { buffer, pageCount, trimmed: false };
    }

    const dest = await PDFDocument.create();
    const pages = await dest.copyPages(src, Array.from({ length: maxPages }, (_, i) => i));
    pages.forEach((p) => dest.addPage(p));
    const trimmedBytes = await dest.save();
    console.log(`[blueprint-processor] PDF trimmed: ${pageCount} → ${maxPages} pages`);
    return { buffer: Buffer.from(trimmedBytes), pageCount, trimmed: true };
  } catch (err) {
    console.warn('[blueprint-processor] pdf-lib trim failed:', err instanceof Error ? err.message : err);
    throw err; // let caller handle fallback
  }
}

// ── PDF: convert first page to image via sharp ───────────────────────────────

async function pdfFirstPageToImage(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const sharp = await getSharp();
  if (!sharp) return null;

  try {
    const resized = await sharp(buffer, { density: PDF_RASTER_DENSITY, pages: 1 })
      .resize(MAX_IMAGE_DIM, MAX_IMAGE_DIM, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    console.log(`[blueprint-processor] PDF→image: ${(buffer.byteLength / MB).toFixed(1)}MB → ${(resized.byteLength / MB).toFixed(1)}MB`);
    return { buffer: resized, mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('[blueprint-processor] PDF→image failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Image: resize ────────────────────────────────────────────────────────────

async function resizeImage(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const sharp = await getSharp();
  if (!sharp) return null;

  try {
    const resized = await sharp(buffer)
      .resize(MAX_IMAGE_DIM, MAX_IMAGE_DIM, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return { buffer: resized, mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('[blueprint-processor] sharp resize failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── PDF page count (non-throwing) ────────────────────────────────────────────

export async function getPdfPageCount(buffer: Buffer | ArrayBuffer): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return src.getPageCount();
  } catch {
    return 0;
  }
}

// ── Multi-sheet: extract a subset of PDF pages (pure JS, always available) ───

/**
 * Copy a specific set of pages (0-based indices, in the given order) out of a PDF
 * into a new, smaller PDF. Pure pdf-lib — no native deps, works everywhere the
 * runtime does. Returns null if the source can't be parsed (encrypted/corrupt) or
 * none of the requested indices are valid, so callers can fall back gracefully.
 */
export async function extractPdfPages(
  buffer: Buffer | ArrayBuffer,
  pageIndices: number[],
): Promise<Buffer | null> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const total = src.getPageCount();
    const valid = pageIndices.filter((i) => Number.isInteger(i) && i >= 0 && i < total);
    if (valid.length === 0) return null;
    const dest = await PDFDocument.create();
    const copied = await dest.copyPages(src, valid);
    copied.forEach((p) => dest.addPage(p));
    const bytes = await dest.save();
    return Buffer.from(bytes);
  } catch (err) {
    console.warn('[blueprint-processor] extractPdfPages failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Discipline classification ────────────────────────────────────────────────

export type Discipline =
  | 'general' | 'civil' | 'architectural' | 'structural'
  | 'mechanical' | 'electrical' | 'plumbing' | 'fire_protection' | 'landscape';

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  general: 'General',
  civil: 'Civil / Site',
  architectural: 'Architectural',
  structural: 'Structural',
  mechanical: 'Mechanical (HVAC)',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  fire_protection: 'Fire Protection',
  landscape: 'Landscape',
};

/**
 * Trade scope hint for each discipline — the CSI divisions a discipline "owns".
 * Used to keep multi-pass extraction scopes DISJOINT so the same material is not
 * counted twice across passes.
 */
export const DISCIPLINE_SCOPE: Record<Discipline, string> = {
  general:         'CSI Division 01 general requirements only. Do NOT price physical materials here.',
  civil:           'CSI Divisions 02 (demolition/existing conditions), 31 (earthwork), 32 (exterior improvements/paving), 33 (utilities).',
  architectural:   'CSI Divisions 04 (masonry veneer), 07 (thermal & moisture / roofing / insulation), 08 (doors, windows, storefront), 09 (drywall, flooring, ceilings, paint), 10 (specialties), 12 (furnishings). Non-structural partitions.',
  structural:      'CSI Divisions 03 (cast-in-place concrete + reinforcing steel), 05 (structural + misc steel), 06 (structural rough carpentry), foundations, footings, framing.',
  mechanical:      'CSI Division 23 (HVAC: equipment, ductwork, piping, controls) only.',
  electrical:      'CSI Divisions 26 (electrical power/lighting), 27 (communications), 28 (electronic safety) only.',
  plumbing:        'CSI Division 22 (plumbing fixtures, domestic water, sanitary, gas piping) only.',
  fire_protection: 'CSI Division 21 (fire suppression / sprinkler) only.',
  landscape:       'CSI Division 32 (planting, irrigation, site furnishings) landscape scope only.',
};

/**
 * Priority order in which disciplines are analyzed when the analysis budget can't
 * cover every sheet — highest construction cost / most estimating value first.
 */
export const DISCIPLINE_PRIORITY: Discipline[] = [
  'architectural', 'structural', 'civil',
  'mechanical', 'electrical', 'plumbing', 'fire_protection', 'landscape', 'general',
];

const PREFIX_TO_DISCIPLINE: Array<[RegExp, Discipline]> = [
  [/^FP/i, 'fire_protection'],
  [/^FA/i, 'fire_protection'],
  [/^FS/i, 'fire_protection'],
  [/^AD/i, 'architectural'],
  [/^ID/i, 'architectural'],
  [/^SD/i, 'structural'],
  [/^CD/i, 'civil'],
  [/^MD/i, 'mechanical'],
  [/^ED/i, 'electrical'],
  [/^PD/i, 'plumbing'],
  [/^LS/i, 'landscape'],
  [/^TS/i, 'general'],
  [/^GI/i, 'general'],
  [/^A/i, 'architectural'],
  [/^I/i, 'architectural'],   // interiors
  [/^S/i, 'structural'],
  [/^C/i, 'civil'],
  [/^D/i, 'civil'],           // demolition / site demo
  [/^M/i, 'mechanical'],
  [/^H/i, 'mechanical'],      // HVAC
  [/^E/i, 'electrical'],
  [/^P/i, 'plumbing'],
  [/^L/i, 'landscape'],
  [/^G/i, 'general'],
  [/^T/i, 'general'],         // title / cover
];

/**
 * Deterministically map a title-block sheet number (e.g. "A-101", "S2.1", "M401")
 * to a discipline. Returns null when the prefix isn't recognized so a vision-model
 * hint can be used as the fallback.
 */
export function disciplineFromSheetNumber(sheetNumber?: string | null): Discipline | null {
  if (!sheetNumber) return null;
  const s = String(sheetNumber).trim().toUpperCase();
  if (!s) return null;
  for (const [re, disc] of PREFIX_TO_DISCIPLINE) {
    if (re.test(s)) return disc;
  }
  return null;
}

/** Normalize a free-text discipline hint (from the vision model) to a canonical key. */
export function normalizeDiscipline(raw?: string | null): Discipline | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (/arch|interior|finish/.test(s)) return 'architectural';
  if (/struct|found|framing|concrete|steel/.test(s)) return 'structural';
  if (/civil|site|grad|paving|utilit|earth/.test(s)) return 'civil';
  if (/mech|hvac|duct/.test(s)) return 'mechanical';
  if (/elec|power|light/.test(s)) return 'electrical';
  if (/plumb|sanitar|domestic water/.test(s)) return 'plumbing';
  if (/fire|sprinkler|suppress/.test(s)) return 'fire_protection';
  if (/landscap|planting|irrigation/.test(s)) return 'landscape';
  if (/general|cover|title|index/.test(s)) return 'general';
  // single-letter hint
  const oneLetter = disciplineFromSheetNumber(s.charAt(0).toUpperCase());
  return oneLetter;
}

// ── Generate thumbnail from first page ───────────────────────────────────────

export async function generateThumbnail(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
  const sharp = await getSharp();
  if (!sharp) return null;

  try {
    const input = mimeType === 'application/pdf'
      ? sharp(buffer, { density: 150, pages: 1 })
      : sharp(buffer);

    return await input
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
  } catch (err) {
    console.warn('[blueprint-processor] thumbnail generation failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Crop / rotate (user-facing image edit) ──────────────────────────────────

export interface CropRect { left: number; top: number; width: number; height: number }

/**
 * Extract a crop rectangle (pixels) and/or rotate an image. Used by
 * /api/files/crop. Returns a JPEG buffer, or null if sharp is unavailable or
 * the input isn't a processable image (never throws).
 */
export async function cropAndRotate(
  buffer: Buffer,
  rect?: CropRect | null,
  rotateDeg?: number | null,
): Promise<{ buffer: Buffer; mimeType: string; width?: number; height?: number } | null> {
  const sharp = await getSharp();
  if (!sharp) return null;
  try {
    let img = sharp(buffer, { failOn: 'none' });
    const meta = await img.metadata();
    if (rect && rect.width > 0 && rect.height > 0) {
      const left = Math.max(0, Math.round(rect.left));
      const top = Math.max(0, Math.round(rect.top));
      const width = Math.min(Math.round(rect.width), (meta.width || rect.left + rect.width) - left);
      const height = Math.min(Math.round(rect.height), (meta.height || rect.top + rect.height) - top);
      if (width > 0 && height > 0) img = img.extract({ left, top, width, height });
    }
    if (rotateDeg) img = img.rotate(rotateDeg);
    const outMeta = await img.clone().metadata().catch(() => null);
    const out = await img.jpeg({ quality: 90 }).toBuffer();
    return { buffer: out, mimeType: 'image/jpeg', width: outMeta?.width, height: outMeta?.height };
  } catch (err) {
    console.warn('[blueprint-processor] cropAndRotate failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface ProcessedBlueprint {
  base64: string;
  mimeType: string;
  /** True if the file was trimmed / resized */
  reduced: boolean;
  /** Friendly error — if set, do NOT send to Claude */
  error?: string;
}

/**
 * Process a blueprint file for Claude ingestion.
 * NEVER throws. Returns { error } for unsupported scenarios.
 */
export async function processBlueprint(
  rawBuffer: ArrayBuffer,
  mimeType: string
): Promise<ProcessedBlueprint> {
  const buffer = Buffer.from(rawBuffer);

  try {
    // ── DWG detection (rule 7) ─────────────────────────────────────────────
    if (
      mimeType === 'application/acad' ||
      mimeType === 'application/x-acad' ||
      mimeType === 'image/vnd.dwg' ||
      mimeType === 'application/dwg'
    ) {
      return {
        base64: '',
        mimeType,
        reduced: false,
        error: 'DWG files coming soon. Please export as PDF from AutoCAD first.',
      };
    }

    const isPdf = mimeType === 'application/pdf';
    const isImage = IMAGE_TYPES.includes(mimeType);

    // ── Unknown type → attempt as PDF with warning (rule 8) ────────────────
    if (!isPdf && !isImage) {
      console.warn(`[blueprint-processor] Unknown MIME "${mimeType}" — attempting as PDF`);
      return processPdf(buffer);
    }

    // ── PDF path (rules 1-3) ───────────────────────────────────────────────
    if (isPdf) {
      return processPdf(buffer);
    }

    // ── Image path (rules 4-6) ─────────────────────────────────────────────
    return processImage(buffer, mimeType);

  } catch (err) {
    // RULE 9: ANY error → catch, log, use original buffer, never crash
    console.error('[blueprint-processor] Unexpected error, using raw buffer:', err);
    return safeRawReturn(buffer, mimeType);
  }
}

// ── PDF processing with full fallback chain ──────────────────────────────────

async function processPdf(buffer: Buffer): Promise<ProcessedBlueprint> {
  const size = buffer.byteLength;

  // Rule 1: pdf-lib trim to 8 pages
  try {
    const { buffer: trimmed, trimmed: wasTrimmed } = await trimPdf(buffer, 8);

    // If trimmed result is under 20MB, send as document
    if (trimmed.byteLength <= 20 * MB) {
      return {
        base64: trimmed.toString('base64'),
        mimeType: 'application/pdf',
        reduced: wasTrimmed,
      };
    }
    // Trimmed but still over 20MB → fall to image conversion below
  } catch {
    // pdf-lib failed entirely → Rule 2: raw PDF if under 20MB
    if (size <= 20 * MB) {
      console.log(`[blueprint-processor] pdf-lib failed, sending raw PDF (${(size / MB).toFixed(1)}MB)`);
      return {
        base64: buffer.toString('base64'),
        mimeType: 'application/pdf',
        reduced: false,
      };
    }
  }

  // Rule 3: Over 20MB → convert first page to image via sharp
  const imageResult = await pdfFirstPageToImage(buffer);
  if (imageResult) {
    return {
      base64: imageResult.buffer.toString('base64'),
      mimeType: imageResult.mimeType,
      reduced: true,
    };
  }

  // Last resort: if under 20MB send raw, otherwise error
  if (size <= 20 * MB) {
    return {
      base64: buffer.toString('base64'),
      mimeType: 'application/pdf',
      reduced: false,
    };
  }

  return {
    base64: '',
    mimeType: 'application/pdf',
    reduced: false,
    error: `Blueprint PDF is too large (${Math.round(size / MB)}MB). Please reduce to under 20MB, or export fewer pages.`,
  };
}

// ── Image processing with full fallback chain ────────────────────────────────

async function processImage(buffer: Buffer, mimeType: string): Promise<ProcessedBlueprint> {
  const size = buffer.byteLength;

  // Rule 4: sharp resize to 2000×2000
  const resized = await resizeImage(buffer);
  if (resized) {
    return {
      base64: resized.buffer.toString('base64'),
      mimeType: resized.mimeType,
      reduced: resized.buffer.byteLength < size,
    };
  }

  // Rule 5: no sharp → send original if under 5MB
  if (size <= 5 * MB) {
    const safeMime = IMAGE_TYPES.includes(mimeType) ? mimeType : 'image/jpeg';
    return {
      base64: buffer.toString('base64'),
      mimeType: safeMime,
      reduced: false,
    };
  }

  // Rule 6: over 5MB, no sharp → friendly error
  return {
    base64: '',
    mimeType,
    reduced: false,
    error: `Image is too large (${Math.round(size / MB)}MB) and image processing is unavailable. Please resize to under 5MB, or export as PDF instead.`,
  };
}

// ── Safe raw return (rule 9 — never crash) ───────────────────────────────────

function safeRawReturn(buffer: Buffer, mimeType: string): ProcessedBlueprint {
  try {
    if (buffer.byteLength > 20 * MB) {
      return {
        base64: '',
        mimeType,
        reduced: false,
        error: `File is too large (${Math.round(buffer.byteLength / MB)}MB) for processing. Please reduce file size and try again.`,
      };
    }
    return {
      base64: buffer.toString('base64'),
      mimeType: mimeType || 'application/pdf',
      reduced: false,
    };
  } catch {
    return {
      base64: '',
      mimeType: mimeType || 'application/octet-stream',
      reduced: false,
      error: 'Failed to process file. Please try a different format (PDF or JPEG recommended).',
    };
  }
}
