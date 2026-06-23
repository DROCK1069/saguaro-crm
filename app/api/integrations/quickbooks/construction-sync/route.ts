import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { commitmentToBill, costEntryToBill, subcontractorToVendor, qboBillToCostEntry, type QboRefMap } from '@/lib/qbo-mapping';

export const runtime = 'nodejs';
/* eslint-disable @typescript-eslint/no-explicit-any */

const QBO_BASE = 'https://quickbooks.api.intuit.com/v3/company';

async function ensureToken(db: any, conn: any): Promise<string | null> {
  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (exp > Date.now() + 60_000) return conn.access_token;
  // refresh
  const id = process.env.QBO_CLIENT_ID, secret = process.env.QBO_CLIENT_SECRET;
  if (!id || !secret || !conn.refresh_token) return conn.access_token || null;
  try {
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
    });
    if (!res.ok) return conn.access_token || null;
    const j = await res.json();
    await db.from('qbo_connections').update({
      access_token: j.access_token, refresh_token: j.refresh_token || conn.refresh_token,
      token_expires_at: new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString(),
    }).eq('id', conn.id);
    return j.access_token;
  } catch { return conn.access_token || null; }
}

async function qbo(token: string, realm: string, path: string, method = 'GET', body?: any): Promise<any> {
  const res = await fetch(`${QBO_BASE}/${realm}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`QBO ${path} ${res.status}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let b: { direction?: 'push' | 'pull'; entities?: string[]; projectId?: string; refs?: QboRefMap; defaultAccount?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const direction = b.direction === 'pull' ? 'pull' : 'push';
  const entities = b.entities && b.entities.length ? b.entities : ['commitments'];

  try {
    const db = createServerClient();
    const { data: conn } = await db.from('qbo_connections').select('*').eq('tenant_id', user.tenantId).single();
    if (!conn) return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 404 });

    const token = await ensureToken(db, conn);
    if (!token) return NextResponse.json({ error: 'QuickBooks token unavailable — reconnect' }, { status: 409 });
    const realm = (conn as any).realm_id;
    const refs: QboRefMap = b.refs || { accountByCode: {}, defaultAccount: b.defaultAccount || '' };

    const results: Record<string, { count: number; errors: number }> = {};
    const tally = (k: string, ok: boolean) => { results[k] ??= { count: 0, errors: 0 }; if (ok) results[k].count++; else results[k].errors++; };

    if (direction === 'push') {
      if (entities.includes('vendors')) {
        const { data } = await db.from('subcontractors').select('*').eq('tenant_id', user.tenantId);
        for (const s of data || []) { try { await qbo(token, realm, 'vendor', 'POST', subcontractorToVendor(s)); tally('vendors', true); } catch { tally('vendors', false); } }
      }
      if (entities.includes('commitments')) {
        let q = db.from('commitments').select('*');
        if (b.projectId) q = q.eq('project_id', b.projectId);
        const { data } = await q;
        for (const c of data || []) { try { await qbo(token, realm, 'bill', 'POST', commitmentToBill(c, refs)); tally('commitments', true); } catch { tally('commitments', false); } }
      }
      if (entities.includes('costs')) {
        let q = db.from('cost_entries').select('*').eq('tenant_id', user.tenantId);
        if (b.projectId) q = q.eq('project_id', b.projectId);
        const { data } = await q;
        for (const e of data || []) { try { await qbo(token, realm, 'bill', 'POST', costEntryToBill(e, refs)); tally('costs', true); } catch { tally('costs', false); } }
      }
    } else {
      // pull QBO bills → cost_entries
      if (entities.includes('bills') || entities.includes('costs')) {
        const r = await qbo(token, realm, `query?query=${encodeURIComponent('select * from Bill maxresults 200')}`);
        const bills = r?.QueryResponse?.Bill || [];
        for (const bill of bills) {
          try {
            const row = qboBillToCostEntry(bill, { tenantId: user.tenantId, projectId: b.projectId });
            await db.from('cost_entries').insert(row);
            tally('bills', true);
          } catch { tally('bills', false); }
        }
      }
    }

    const totalSynced = Object.values(results).reduce((s, r) => s + r.count, 0);
    const totalErr = Object.values(results).reduce((s, r) => s + r.errors, 0);
    await db.from('qbo_sync_log').insert({ tenant_id: user.tenantId, direction, sync_type: entities.join(','), records_synced: totalSynced, errors: totalErr, synced_at: new Date().toISOString() });
    await db.from('qbo_connections').update({ last_sync_at: new Date().toISOString(), sync_status: totalErr > 0 ? 'partial' : 'ok' }).eq('id', conn.id);

    return NextResponse.json({ direction, results, totalSynced, totalErrors: totalErr });
  } catch (err) {
    console.error('[qbo/construction-sync]', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
