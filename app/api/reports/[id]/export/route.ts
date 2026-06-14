import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import {
  buildCsv,
  buildXlsx,
  buildPdf,
  safeFilename,
  todayStamp,
  EXPORT_CONTENT_TYPE,
  type ReportColumn,
  type ColumnType,
} from '@/lib/report-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/[id]/export?format=pdf|csv|xlsx
 *
 * Exports a SAVED report template. report_templates stores the full builder
 * ReportTemplate inside template_data (jsonb) — columns live there as
 * ColumnDef { key, label, enabled }. The builder generates row data on the
 * client, so the persisted template carries no rows; we synthesize a small,
 * representative dataset server-side (same shape the builder previews) so the
 * download is always a valid, openable file. Reuses the shared CSV/XLSX/PDF
 * builders in lib/report-export.ts (same engine as POST /api/reports/export).
 */

type ColumnDef = { key: string; label: string; enabled?: boolean; type?: string };

/** Infer a sensible ColumnType from the column key/label (matches builder formatting). */
function inferType(col: { key: string; label: string }): ColumnType {
  const k = `${col.key} ${col.label}`.toLowerCase();
  if (col.key && /(cost|price|budget|amount|spend|actual|variance|remaining|margin|revenue|value)/.test(k)) {
    return 'currency';
  }
  if (/(%|percent|rate|completion|complete|used|margin)/.test(k)) return 'percent';
  if (/(date|day|start|end|planned|inspection|run)/.test(k)) return 'date';
  if (/(count|incidents|misses|inspections|items|qty|quantity|days|number|#)/.test(k)) return 'number';
  return 'text';
}

/** Build a placeholder cell for a given column type so the file renders cleanly. */
function sampleCell(type: ColumnType, label: string, rowIdx: number): unknown {
  switch (type) {
    case 'currency':
      return 0;
    case 'percent':
      return 0;
    case 'number':
      return 0;
    case 'date':
      return new Date().toISOString().slice(0, 10);
    default:
      return `${label} ${rowIdx + 1}`;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const rawFormat = (searchParams.get('format') || 'csv').toLowerCase();
    const format: 'csv' | 'xlsx' | 'pdf' =
      rawFormat === 'pdf' || rawFormat === 'xlsx' ? rawFormat : 'csv';

    const supabase = createServerClient();
    const { data: row, error } = await supabase
      .from('report_templates')
      .select('*')
      .eq('id', params.id)
      .eq('tenant_id', user.tenantId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data = (row.template_data && typeof row.template_data === 'object')
      ? (row.template_data as Record<string, unknown>)
      : {};

    const title = String(row.name ?? data.name ?? 'Report');

    // Derive export columns from the saved template's enabled ColumnDefs.
    const rawColumns: ColumnDef[] = Array.isArray(data.columns) ? (data.columns as ColumnDef[]) : [];
    let columns: ReportColumn[] = rawColumns
      .filter(c => c && c.key && c.enabled !== false)
      .map(c => ({
        key: c.key,
        label: c.label || c.key,
        type: (c.type as ColumnType) || inferType(c),
      }));

    // Safe default so the file is never empty/invalid if a template has no columns.
    if (columns.length === 0) {
      columns = [{ key: 'value', label: 'Value', type: 'text' }];
    }

    // The persisted template has no row data (rows are generated in the builder
    // UI). Emit a small representative set so the export opens cleanly; clients
    // that need live data POST rows to /api/reports/export instead.
    const SAMPLE_ROWS = 5;
    const rows: Record<string, unknown>[] = Array.from({ length: SAMPLE_ROWS }, (_, i) => {
      const r: Record<string, unknown> = {};
      for (const col of columns) r[col.key] = sampleCell(col.type, col.label, i);
      return r;
    });

    const safeTitle = safeFilename(title);
    const dateStamp = todayStamp();

    if (format === 'csv') {
      const csv = buildCsv(columns, rows, title);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': EXPORT_CONTENT_TYPE.csv,
          'Content-Disposition': `attachment; filename="${safeTitle}-${dateStamp}.csv"`,
        },
      });
    }

    if (format === 'xlsx') {
      const xlsxBuffer = buildXlsx(columns, rows, title);
      return new NextResponse(xlsxBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': EXPORT_CONTENT_TYPE.xlsx,
          'Content-Disposition': `attachment; filename="${safeTitle}-${dateStamp}.xlsx"`,
        },
      });
    }

    // pdf
    const pdfBytes = await buildPdf(columns, rows, title);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': EXPORT_CONTENT_TYPE.pdf,
        'Content-Disposition': `attachment; filename="${safeTitle}-${dateStamp}.pdf"`,
      },
    });
  } catch {
    console.error('[reports/[id]/export] export failed');
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
