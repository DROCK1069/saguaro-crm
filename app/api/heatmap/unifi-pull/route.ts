/**
 * Pull adopted device inventory + status from a UniFi controller.
 * UniFi Network Integration API (API-key auth): GET {host}/proxy/network/integration/v1/sites
 * then /sites/{id}/devices. Key: controller UI → Settings → Control Plane → Integrations.
 *
 * Security: auth-gated (getUser). The user-supplied host is validated, and every outbound
 * request goes through the SSRF guard in lib/ssrf.ts — which (a) blocks private/internal/
 * metadata targets at CONNECT time (closes DNS-rebind TOCTOU), and (b) never follows
 * redirects, so the controller can't 30x us to an internal address with the X-API-Key
 * header replayed. Controllers must be reachable over the public internet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { ipBlocked, safeGetJson } from '@/lib/ssrf';
import { lookup } from 'dns/promises';

export const runtime = 'nodejs';

interface PulledDevice { name: string; model: string; type: string; ip?: string; mac?: string; online: boolean }

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;

  let host = '', apiKey = '';
  try { const b = await req.json(); host = String(b.host || '').trim(); apiKey = String(b.apiKey || '').trim(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  if (!host || !apiKey) return NextResponse.json({ error: 'Controller URL and API key are required.' }, { status: 400 });
  if (!/^https?:\/\//i.test(host)) host = 'https://' + host;

  let u: URL;
  try { u = new URL(host); } catch { return NextResponse.json({ error: 'Invalid controller URL.' }, { status: 400 }); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return NextResponse.json({ error: 'Only http/https controllers are supported.' }, { status: 400 });
  if (u.username || u.password) return NextResponse.json({ error: 'Credentials in the URL are not allowed.' }, { status: 400 });
  u.hash = '';
  const hostname = u.hostname.replace(/^\[|\]$/g, '');
  if (hostname.toLowerCase() === 'localhost' || hostname.toLowerCase().endsWith('.localhost')) {
    return NextResponse.json({ error: 'Controller must be reachable over the public internet.' }, { status: 400 });
  }
  // Pre-flight resolve for a friendly error. The AUTHORITATIVE block is enforced again at
  // connect time inside safeGetJson (guardedLookup) — this pre-check can't be raced.
  try {
    const addrs = await lookup(hostname, { all: true });
    if (!addrs.length || addrs.some((a) => ipBlocked(a.address))) {
      return NextResponse.json({ error: "That host resolves to a private/internal address. Use your controller's public (remote-access) address." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not resolve that host.' }, { status: 400 });
  }

  const base = `${u.origin}/proxy/network/integration/v1`;
  const headers = { 'X-API-Key': apiKey, Accept: 'application/json' };

  try {
    const sitesRes = await safeGetJson(`${base}/sites`, headers, 8000);
    if (sitesRes.blocked) return NextResponse.json({ error: 'Controller address is not reachable (blocked as private/internal).' }, { status: 400 });
    if (sitesRes.redirected) return NextResponse.json({ error: 'Controller redirected the request; for security we do not follow redirects. Point directly at the controller API URL.' }, { status: 200 });
    if (sitesRes.status === 401 || sitesRes.status === 403) return NextResponse.json({ error: 'API key rejected. Create a Network Integration key in the controller and confirm the URL.' }, { status: 200 });
    if (sitesRes.status < 200 || sitesRes.status >= 300) return NextResponse.json({ error: `Controller returned ${sitesRes.status}.` }, { status: 200 });

    const sitesJson = sitesRes.json as { data?: { id: string }[] } | { id: string }[] | undefined;
    const sites: { id: string }[] = Array.isArray((sitesJson as { data?: unknown })?.data)
      ? (sitesJson as { data: { id: string }[] }).data
      : Array.isArray(sitesJson) ? (sitesJson as { id: string }[]) : [];
    if (!sites.length) return NextResponse.json({ error: 'No sites returned by the controller.' }, { status: 200 });

    const devices: PulledDevice[] = [];
    for (const site of sites.slice(0, 4)) {
      const dRes = await safeGetJson(`${base}/sites/${encodeURIComponent(site.id)}/devices`, headers, 8000);
      if (dRes.redirected || dRes.blocked || dRes.status < 200 || dRes.status >= 300) continue;
      const dJson = dRes.json as { data?: unknown[] } | unknown[] | undefined;
      const list: Record<string, unknown>[] = Array.isArray((dJson as { data?: unknown })?.data)
        ? (dJson as { data: Record<string, unknown>[] }).data
        : Array.isArray(dJson) ? (dJson as Record<string, unknown>[]) : [];
      for (const d of list) {
        const state = (d.state ?? d.status) as string | number | undefined;
        devices.push({
          name: (d.name || d.model || 'device') as string,
          model: (d.model || '') as string,
          type: (d.type || '') as string,
          ip: (d.ipAddress || d.ip || undefined) as string | undefined,
          mac: (d.macAddress || d.mac || undefined) as string | undefined,
          online: state != null ? String(state).toLowerCase().includes('online') || state === 1 : false,
        });
      }
    }
    const online = devices.filter((d) => d.online).length;
    return NextResponse.json({ devices, summary: `${sites.length} site(s) · ${devices.length - online} offline`, sites: sites.length });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === 'SSRF_BLOCKED') return NextResponse.json({ error: 'Controller address is not reachable (blocked as private/internal).' }, { status: 400 });
    const msg = err?.code === 'TIMEOUT'
      ? 'Timed out reaching the controller (8s). It must be reachable from this server.'
      : 'Could not reach the controller.';
    return NextResponse.json({ error: msg }, { status: 200 });
  }
}
