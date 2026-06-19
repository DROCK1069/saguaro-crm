import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';

type TableName = keyof Database['public']['Tables'];

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { module, item_id, items, include_photos, include_signatures } = body;

    const supabase = createServerClient();

    // Fetch the item(s) data based on module
    const tableMap: Record<string, TableName> = {
      'rfis': 'rfis',
      'punch': 'punch_list',
      'inspections': 'inspections',
      'daily_logs': 'daily_logs',
      'change_orders': 'change_orders',
      'safety': 'safety_incidents',
      'submittals': 'submittals',
      'observations': 'observations',
      'tm_tickets': 'tm_tickets',
      'meetings': 'meetings',
      'correspondence': 'correspondence',
    };

    const table = tableMap[module];
    if (!table) return NextResponse.json({ error: 'Invalid module' }, { status: 400 });

    // `table` is a runtime-resolved table name from a fixed allow-list (tableMap).
    // Passing a union-typed table name to the typed client triggers TS2589
    // (excessively deep instantiation) because the return type distributes over
    // every table in the schema. Use an untyped client reference for this
    // dynamic-table query path; the table list and `id`/`project_id` filters are
    // verified against the live schema, so the runtime shape is correct.
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>;
    };

    let data;
    if (item_id) {
      const result = await db.from(table).select('*').eq('id', item_id).single();
      data = result.data ? [result.data] : [];
    } else if (items && Array.isArray(items)) {
      const result = await db.from(table).select('*').in('id', items);
      data = result.data || [];
    } else {
      const result = await db.from(table).select('*').eq('project_id', params.projectId).limit(100);
      data = result.data || [];
    }

    // Return the data as JSON (client generates PDF) or generate server-side
    return NextResponse.json({
      success: true,
      module,
      data,
      generated_at: new Date().toISOString(),
      project_id: params.projectId,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
  }
}
