import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import {
  buildCsv, buildXlsx, buildPdf,
  safeFilename, todayStamp, EXPORT_CONTENT_TYPE,
  type ReportColumn,
} from '@/lib/report-export';

export const runtime = 'nodejs';

/**
 * POST /api/certified-payroll/export
 * Body: { format: 'csv'|'xlsx'|'pdf', title?, rows: Record<string,unknown>[], totals?: Record<string,number> }
 * Returns the generated file as a download. Replaces the old alert() stub on
 * the certified-payroll page ("In production this would trigger a file download").
 */

const COLUMNS: ReportColumn[] = [
  { key: 'name',           label: 'Employee',       type: 'text' },
  { key: 'classification', label: 'Classification', type: 'text' },
  { key: 'st',             label: 'ST Hrs',         type: 'number' },
  { key: 'ot',             label: 'OT Hrs',         type: 'number' },
  { key: 'dt',             label: 'DT Hrs',         type: 'number' },
  { key: 'rate',           label: 'Base Rate',      type: 'currency' },
  { key: 'gross',          label: 'Gross Pay',      type: 'currency' },
  { key: 'fringe',         label: 'Fringe',         type: 'currency' },
  { key: 'deductions',     label: 'Deductions',     type: 'currency' },
  { key: 'net',            label: 'Net Pay',        type: 'currency' },
];

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { format?: string; title?: string; company?: string; rows?: Record<string, unknown>[]; totals?: Record<string, number> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const format = body.format === 'pdf' ? 'pdf' : body.format === 'csv' ? 'csv' : 'xlsx';
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const totals = body.totals && typeof body.totals === 'object' ? body.totals : undefined;
  const title = (body.title || 'Certified Payroll — WH-347').toString();
  const company = (body.company || 'Certified Payroll Report (WH-347)').toString();
  const fileBase = `${safeFilename(title)}-${todayStamp()}`;

  if (format === 'csv') {
    const csv = buildCsv(COLUMNS, rows, title, totals, company);
    return new NextResponse(csv, {
      headers: { 'Content-Type': EXPORT_CONTENT_TYPE.csv, 'Content-Disposition': `attachment; filename="${fileBase}.csv"` },
    });
  }

  if (format === 'pdf') {
    const pdf = await buildPdf(COLUMNS, rows, title, totals, undefined, company);
    return new NextResponse(Buffer.from(pdf), {
      headers: { 'Content-Type': EXPORT_CONTENT_TYPE.pdf, 'Content-Disposition': `attachment; filename="${fileBase}.pdf"` },
    });
  }

  const xlsx = buildXlsx(COLUMNS, rows, title, totals, company);
  return new NextResponse(new Uint8Array(xlsx), {
    headers: { 'Content-Type': EXPORT_CONTENT_TYPE.xlsx, 'Content-Disposition': `attachment; filename="${fileBase}.xlsx"` },
  });
}
