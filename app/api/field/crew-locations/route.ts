import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('crew_locations')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', user.tenantId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch crew locations', details: error.message }, { status: 500 });
    }

    const rows = data || [];

    // crew_locations has no FK to profiles, so PostgREST cannot auto-embed.
    // Fetch the matching profiles separately and attach them under `profiles`
    // to preserve the response shape consumers expect.
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    let profilesById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('tenant_id', user.tenantId)
        .in('id', userIds);
      for (const p of profiles || []) {
        profilesById[(p as any).id] = {
          full_name: (p as any).full_name,
          email: (p as any).email,
          avatar_url: (p as any).avatar_url,
        };
      }
    }

    const locations = rows.map((r: any) => ({
      ...r,
      profiles: profilesById[r.user_id] || null,
    }));

    return NextResponse.json({ locations });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { project_id, latitude, longitude, accuracy, heading, speed } = body;

    if (!project_id || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'project_id, latitude, and longitude are required' }, { status: 400 });
    }

    const db = createServerClient();

    const payload = {
      tenant_id: user.tenantId,
      project_id,
      user_id: user.id,
      latitude,
      longitude,
      accuracy_meters: accuracy || null,
      heading: heading || null,
      speed: speed || null,
      updated_at: new Date().toISOString(),
    };

    // crew_locations has no unique constraint on (tenant_id, project_id, user_id),
    // so an ON CONFLICT upsert would fail at runtime. Emulate "one row per
    // user/project/tenant" with an explicit find-then-update-or-insert.
    const { data: existing, error: lookupError } = await db
      .from('crew_locations')
      .select('id')
      .eq('tenant_id', user.tenantId)
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: 'Failed to update location', details: lookupError.message }, { status: 500 });
    }

    let data: any;
    let error: any;
    if (existing) {
      ({ data, error } = await db
        .from('crew_locations')
        .update(payload)
        .eq('id', (existing as any).id)
        .select()
        .single());
    } else {
      ({ data, error } = await db
        .from('crew_locations')
        .insert(payload)
        .select()
        .single());
    }

    if (error) {
      return NextResponse.json({ error: 'Failed to update location', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ location: data });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
