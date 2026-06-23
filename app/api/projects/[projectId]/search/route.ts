import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';

/**
 * GET /api/projects/[projectId]/search?q=...&modules=id1,id2
 *
 * Cross-module field search. The `modules` param carries the stable module
 * IDS the field search UI sends (rfis, punch, daily_logs, …) — the same ids
 * used below, so filtering actually matches (the old code compared ids to
 * human labels and silently returned nothing).
 *
 * Project-scoped modules are filtered by project_id. The Trade Knowledge Base
 * (`trade_guide`) is GLOBAL — its rows have no project_id, so it's queried by
 * tenant-or-global instead.
 */

type Entry = {
  id: string;        // stable module id (matches the field search UI)
  label: string;     // human label
  table: string;     // db table
  route: string;     // field route that opens the record
  title: string;     // primary title column
  fields: string[];  // columns to match against
};

const SEARCHABLE: Entry[] = [
  { id: 'rfis',           label: 'RFIs',           table: 'rfis',             route: '/field/rfis',           title: 'subject',        fields: ['subject', 'question'] },
  { id: 'punch',          label: 'Punch List',     table: 'punch_list',       route: '/field/punch',          title: 'title',          fields: ['title', 'description'] },
  { id: 'daily_logs',     label: 'Daily Logs',     table: 'daily_logs',       route: '/field/log',            title: 'work_performed', fields: ['work_performed', 'notes'] },
  { id: 'inspections',    label: 'Inspections',    table: 'inspections',      route: '/field/inspect',        title: 'type',           fields: ['type', 'notes'] },
  { id: 'change_orders',  label: 'Change Orders',  table: 'change_orders',    route: '/field/change-orders',  title: 'title',          fields: ['title', 'description'] },
  { id: 'submittals',     label: 'Submittals',     table: 'submittals',       route: '/field/submittals',     title: 'title',          fields: ['title', 'description'] },
  { id: 'safety',         label: 'Safety',         table: 'safety_incidents', route: '/field/safety',         title: 'description',    fields: ['description', 'location'] },
  { id: 'meetings',       label: 'Meetings',       table: 'meetings',         route: '/field/meetings',       title: 'title',          fields: ['title', 'notes'] },
  { id: 'tm_tickets',     label: 'T&M Tickets',    table: 'tm_tickets',       route: '/field/tm-tickets',     title: 'description',    fields: ['description'] },
  { id: 'observations',   label: 'Observations',   table: 'observations',     route: '/field/observations',   title: 'description',    fields: ['description', 'location'] },
  { id: 'correspondence', label: 'Correspondence', table: 'correspondence',   route: '/field/correspondence', title: 'subject',        fields: ['subject', 'body'] },
];

const TRADE_GUIDE_ID = 'trade_guide';

/** Build a short, match-centered excerpt from the first field that contains q. */
function excerptFrom(item: Record<string, unknown>, fields: string[], q: string): string {
  for (const f of fields) {
    const v = item[f];
    if (typeof v === 'string' && q && v.toLowerCase().includes(q)) {
      const i = v.toLowerCase().indexOf(q);
      const start = Math.max(0, i - 40);
      return (start > 0 ? '…' : '') + v.slice(start, start + 160).trim();
    }
  }
  const first = fields.map(f => item[f]).find(v => typeof v === 'string' && v) as string | undefined;
  return first ? first.slice(0, 160) : '';
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() || '';
  const modules = url.searchParams.get('modules')?.split(',').map(s => s.trim()).filter(Boolean) || [];

  if (!q) return NextResponse.json({ results: [] });

  const wants = (id: string) => modules.length === 0 || modules.includes(id);
  const safe = q.replace(/[%,()]/g, ' ');

  try {
    const supabase = createServerClient();
    const results: Array<Record<string, unknown>> = [];

    await Promise.allSettled([
      // ── Project-scoped modules ──
      ...SEARCHABLE.filter(e => wants(e.id)).map(async (e) => {
        try {
          const orExpr = e.fields.map(f => `${f}.ilike.%${safe}%`).join(',');
          const { data } = await supabase
            .from(e.table as keyof Database['public']['Tables'] & 'rfis')
            .select('*')
            .eq('project_id', params.projectId)
            .or(orExpr)
            .limit(10);
          (data || []).forEach((item: Record<string, unknown>) => {
            results.push({
              module: e.id,
              id: String(item.id || ''),
              title: String(item[e.title] || item.title || item.description || 'Untitled'),
              number: item.number ?? item.rfi_number ?? item.co_number ?? undefined,
              status: String(item.status || ''),
              date: String(item.created_at || item.date || ''),
              excerpt: excerptFrom(item, e.fields, safe),
              route: e.route,
            });
          });
        } catch { /* table/columns may differ — skip */ }
      }),

      // ── Global Trade Knowledge Base (not project-scoped) ──
      (async () => {
        if (!wants(TRADE_GUIDE_ID)) return;
        try {
          const { data } = await supabase
            .from('trade_knowledge')
            .select('id, title, trade, content, created_at')
            .or(`tenant_id.eq.${user.tenantId},is_global.eq.true`)
            .or(`title.ilike.%${safe}%,content.ilike.%${safe}%,trade.ilike.%${safe}%`)
            .limit(10);
          (data || []).forEach((item: Record<string, unknown>) => {
            results.push({
              module: TRADE_GUIDE_ID,
              id: String(item.id || ''),
              title: String(item.title || 'Untitled'),
              number: undefined,
              status: String(item.trade || ''),
              date: String(item.created_at || ''),
              excerpt: typeof item.content === 'string' ? item.content.slice(0, 160) : '',
              route: '/field/trade-guide',
            });
          });
        } catch { /* ignore */ }
      })(),
    ]);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
