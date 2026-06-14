import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import {
  buildCsv,
  buildXlsx,
  buildPdf,
  safeFilename,
  todayStamp,
  EXPORT_CONTENT_TYPE,
  type ReportColumn,
} from '@/lib/report-export';

export const runtime = 'nodejs';

interface ExportBody {
  format: 'csv' | 'xlsx' | 'pdf';
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
  logoUrl?: string;
  companyName?: string;
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: ExportBody = await req.json().catch(() => ({} as ExportBody));
    const {
      format = 'csv',
      title = 'Report',
      columns = [],
      rows = [],
      totals,
      logoUrl,
      companyName,
    } = body;

    const safeTitle = safeFilename(title);
    const dateStamp = todayStamp();

    if (format === 'csv') {
      const csv = buildCsv(columns, rows, title, totals, companyName);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': EXPORT_CONTENT_TYPE.csv,
          'Content-Disposition': `attachment; filename="${safeTitle}-${dateStamp}.csv"`,
        },
      });
    }

    if (format === 'xlsx') {
      const xlsxBuffer = buildXlsx(columns, rows, title, totals, companyName);
      return new NextResponse(xlsxBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': EXPORT_CONTENT_TYPE.xlsx,
          'Content-Disposition': `attachment; filename="${safeTitle}-${dateStamp}.xlsx"`,
        },
      });
    }

    if (format === 'pdf') {
      const pdfBytes = await buildPdf(columns, rows, title, totals, logoUrl, companyName);
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': EXPORT_CONTENT_TYPE.pdf,
          'Content-Disposition': `attachment; filename="${safeTitle}-${dateStamp}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 });
  } catch {
    console.error('[reports/export] export failed');
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
