import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUser } from '@/lib/supabase-server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const QB_CLIENT_ID     = process.env.QB_CLIENT_ID ?? '';
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET ?? '';
const QB_REDIRECT_URI  = process.env.QB_REDIRECT_URI ?? '';
const QB_SANDBOX       = process.env.QB_SANDBOX === 'true';
const QB_BASE          = QB_SANDBOX
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com';
const AUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'status';

  if (action === 'connect') {
    // Redirect user to QuickBooks OAuth
    const scope = 'com.intuit.quickbooks.accounting';
    const state = crypto.randomUUID();
    const url = `${AUTH_BASE}?client_id=${QB_CLIENT_ID}&redirect_uri=${encodeURIComponent(QB_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
    return NextResponse.redirect(url);
  }

  if (action === 'status') {
    // Check if THIS tenant has a stored token (integration rows are per-tenant).
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data } = await getSupabase()
      .from('integrations')
      .select('id, settings')
      .eq('tenant_id', user.tenantId)
      .eq('provider', 'quickbooks')
      .maybeSingle();
    const connected = !!data?.settings?.access_token;
    const expiresAt = data?.settings?.expires_at ?? null;
    return NextResponse.json({ connected, expiresAt, sandbox: QB_SANDBOX });
  }

  if (action === 'sync_preview') {
    // Return what would be synced without actually syncing — scoped to this tenant.
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: invoices } = await getSupabase()
      .from('pay_applications')
      .select('id, app_number, net_payment_due, status, project_id')
      .eq('tenant_id', user.tenantId)
      .in('status', ['approved', 'submitted'])
      .limit(20);

    const { data: vendors } = await getSupabase()
      .from('subcontractors')
      .select('id, company_name')
      .eq('tenant_id', user.tenantId)
      .limit(20);

    return NextResponse.json({
      invoicesToSync:  (invoices ?? []).length,
      vendorsToSync:   (vendors ?? []).length,
      items: invoices ?? [],
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action } = body as { action: string };

  if (action === 'callback') {
    // Handle OAuth callback — exchange code for tokens. Must be authenticated so we
    // can store the integration against the caller's tenant (integrations.tenant_id
    // is NOT NULL and the service-role client can't auto-resolve it).
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { code, realmId } = body as { code: string; realmId: string };
    if (!code || !realmId) {
      return NextResponse.json({ error: 'Missing code or realmId' }, { status: 400 });
    }

    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: QB_REDIRECT_URI,
      }).toString(),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const settings = {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    expiresAt,
      realm_id:      realmId,
    };
    // Per-tenant upsert via check-then-write (no (tenant_id,provider) unique index exists
    // for onConflict). tenant_id is required and set explicitly under the service-role client.
    const db = getSupabase();
    const { data: existing } = await db
      .from('integrations')
      .select('id')
      .eq('tenant_id', user.tenantId)
      .eq('provider', 'quickbooks')
      .maybeSingle();
    if (existing?.id) {
      await db.from('integrations').update({ settings }).eq('id', existing.id);
    } else {
      await db.from('integrations').insert({ tenant_id: user.tenantId, provider: 'quickbooks', settings });
    }

    return NextResponse.json({ ok: true, expiresAt });
  }

  if (action === 'sync') {
    // Push approved pay apps as invoices to QuickBooks — scoped to this tenant.
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: integration } = await getSupabase()
      .from('integrations')
      .select('settings')
      .eq('tenant_id', user.tenantId)
      .eq('provider', 'quickbooks')
      .maybeSingle();

    if (!integration?.settings?.access_token) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 401 });
    }

    const realmId     = integration.settings.realm_id as string;
    const accessToken = integration.settings.access_token as string;

    const { data: payApps } = await getSupabase()
      .from('pay_applications')
      .select('id, app_number, net_payment_due, project_id, projects(name)')
      .eq('tenant_id', user.tenantId)
      .eq('status', 'approved')
      .is('qbo_invoice_id', null)
      .limit(50);

    let synced = 0;
    const errors: string[] = [];

    for (const pa of payApps ?? []) {
      // Create invoice in QB
      const invoicePayload = {
        Line: [{
          Amount: pa.net_payment_due,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: '1', name: 'Services' },
          },
        }],
        CustomerRef: { value: '1' }, // TODO: map to QB customer by project
        DocNumber: `PAY-${(pa as any).app_number}`,
        PrivateNote: `Saguaro Pay App #${(pa as any).app_number} | Project: ${(Array.isArray(pa.projects) ? (pa.projects as { name: string }[])[0]?.name : (pa.projects as unknown as { name: string } | null)?.name) ?? pa.project_id}`,
      };

      const res = await fetch(`${QB_BASE}/v3/company/${realmId}/invoice`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
          Accept:          'application/json',
        },
        body: JSON.stringify(invoicePayload),
      });

      if (res.ok) {
        const qbData = await res.json() as { Invoice?: { Id: string } };
        await getSupabase()
          .from('pay_applications')
          .update({ qbo_invoice_id: qbData.Invoice?.Id })
          .eq('id', pa.id);
        synced++;
      } else {
        const errText = await res.text();
        errors.push(`PayApp ${(pa as any).app_number}: ${errText.slice(0, 100)}`);
      }
    }

    return NextResponse.json({ ok: true, synced, errors, total: (payApps ?? []).length });
  }

  if (action === 'disconnect') {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await getSupabase().from('integrations').delete().eq('tenant_id', user.tenantId).eq('provider', 'quickbooks');
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
