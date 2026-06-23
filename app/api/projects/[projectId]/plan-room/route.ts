import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Plan room: GET lists this project's share links; POST mints a public,
 * token-gated link subs can use to browse drawings without an account.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createServerClient() as any;
  const { data, error } = await db.from('plan_room_tokens').select('*')
    .eq('project_id', projectId).eq('tenant_id', user.tenantId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const db = createServerClient() as any;
  const token = randomBytes(18).toString('base64url');
  const { data, error } = await db.from('plan_room_tokens').insert({
    tenant_id: user.tenantId,
    project_id: projectId,
    bid_package_id: body.bid_package_id || null,
    token,
    label: body.label || 'Plan Room',
    expires_at: body.expires_at || null,
    created_by: user.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data, url: `/plan-room/${token}` }, { status: 201 });
}
