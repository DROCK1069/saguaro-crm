import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { getPdfPageCount, generateThumbnail } from '@/lib/blueprint-processor';
import { signUrl } from '@/lib/storage-signing';
import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';

type SheetRow = Database['public']['Tables']['takeoff_sheets']['Row'];
type SheetUpdate = Database['public']['Tables']['takeoff_sheets']['Update'];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/**
 * Lazy sharp loader — sharp is in package.json. Returns null if unavailable so
 * the caller can fall back gracefully (mirrors lib/blueprint-processor.ts).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
let sharpModule: any = null;
async function getSharp(): Promise<any> {
  if (sharpModule) return sharpModule;
  try {
    sharpModule = (await import('sharp' as any)).default;
    return sharpModule;
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sheetId: string }> },
) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, sheetId } = await params;
    const supabase = createServerClient();

    // Verify the sheet belongs to the tenant AND to the takeoff project in the URL.
    const { data: sheet } = await supabase
      .from('takeoff_sheets')
      .select('id, tenant_id, takeoff_project_id')
      .eq('id', sheetId)
      .eq('takeoff_project_id', id)
      .eq('tenant_id', user.tenantId)
      .single<Pick<SheetRow, 'id' | 'tenant_id' | 'takeoff_project_id'>>();

    if (!sheet || sheet.tenant_id !== user.tenantId) {
      return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      return NextResponse.json(
        { error: `Unsupported file type "${file.type || 'unknown'}". Upload a PDF or image.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File is too large (${formatSize(file.size)}). Maximum size is ${formatSize(MAX_SIZE)}.` },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1) Upload the ORIGINAL file.
    const ext = (file.name.split('.').pop()?.toLowerCase() || (isPdf ? 'pdf' : 'jpg')).replace(/[^a-z0-9]/g, '') || 'bin';
    const basePath = `takeoff-sheets/${id}/${sheetId}`;
    const originalPath = `${basePath}/original.${ext}`;

    const { error: originalErr } = await supabase.storage
      .from('blueprints')
      .upload(originalPath, buffer, { contentType: file.type, upsert: true });
    if (originalErr) throw originalErr;

    // 2) Render the DISPLAY IMAGE for page 1 (rasterize PDF or resize image).
    const sharp = await getSharp();
    if (!sharp) {
      return NextResponse.json(
        { error: 'Image processing is unavailable on the server. Please try again later.' },
        { status: 500 },
      );
    }

    const displayBuffer: Buffer = isPdf
      ? await sharp(buffer, { density: 200, pages: 1 })
          .resize(2200, 2200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
      : await sharp(buffer)
          .resize(2200, 2200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();

    const meta = await sharp(displayBuffer).metadata();
    const widthPx = meta.width ?? null;
    const heightPx = meta.height ?? null;

    const pagePath = `${basePath}/page.jpg`;
    const { error: pageErr } = await supabase.storage
      .from('blueprints')
      .upload(pagePath, displayBuffer, { contentType: 'image/jpeg', upsert: true });
    if (pageErr) throw pageErr;

    // 3) Thumbnail (400px).
    let thumbUrl: string | null = null;
    const thumb = await generateThumbnail(buffer, file.type);
    if (thumb) {
      const thumbPath = `${basePath}/thumb.jpg`;
      const { error: thumbErr } = await supabase.storage
        .from('blueprints')
        .upload(thumbPath, thumb, { contentType: 'image/jpeg', upsert: true });
      if (!thumbErr) {
        thumbUrl = supabase.storage.from('blueprints').getPublicUrl(thumbPath).data.publicUrl;
      }
    }

    // 4) Public URL for the display image (this is what the viewer renders).
    const pageUrl = supabase.storage.from('blueprints').getPublicUrl(pagePath).data.publicUrl;

    // PDF page count is captured for completeness; page_number stays 1.
    if (isPdf) await getPdfPageCount(buffer);

    // 5) Update the sheet row.
    const updatePayload: SheetUpdate = {
      file_url: pageUrl,
      thumbnail_url: thumbUrl,
      page_number: 1,
      width_px: widthPx,
      height_px: heightPx,
    };

    const { data: updated, error: updateErr } = await supabase
      .from('takeoff_sheets')
      .update(updatePayload)
      .eq('id', sheetId)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // `blueprints` is a private bucket: we persist the canonical public-style URL
    // but must hand the client a signed URL it can actually render.
    const signed = updated
      ? {
          ...updated,
          file_url: await signUrl(updated.file_url),
          thumbnail_url: await signUrl(updated.thumbnail_url),
        }
      : updated;

    return NextResponse.json({ sheet: signed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[takeoff-sheets/upload]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
