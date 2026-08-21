import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions';

/**
 * GET ?projectId= — TODAY'S jobsite weather, fully automatic.
 *
 * GCs never type a temperature: daily logs auto-fill from this endpoint on
 * BOTH surfaces (web + mobile call the same route — one brain, no drift).
 *
 * Sources (free, keyless, reliable):
 *  - US National Weather Service (api.weather.gov) — public-domain forecasts.
 *  - US Census geocoder — resolves a project address to coordinates once;
 *    the coordinates are cached back onto the project row.
 *
 * Graceful: anything missing (no address, non-US, NWS hiccup) returns
 * { available: false } and the form simply stays manual for that day.
 */

const UA = { 'User-Agent': 'SaguaroControl (support@saguarocontrol.net)' };

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json();
    const m = d?.result?.addressMatches?.[0]?.coordinates;
    if (m?.y != null && m?.x != null) return { lat: Number(m.y), lng: Number(m.x) };
  } catch { /* fall through */ }
  return null;
}

export async function GET(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'View');
  if (!g.ok) return g.res;
  try {
    const db = g.db;
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    const { data: project } = await db
      .from('projects')
      .select('id, latitude, longitude, address, city, state, zip')
      .eq('id', projectId)
      .eq('tenant_id', g.user.tenantId)
      .single();
    const p = project as any;
    if (!p) return NextResponse.json({ available: false, reason: 'project not found' });

    let lat = Number(p.latitude) || null;
    let lng = Number(p.longitude) || null;

    // One-time geocode from the address; cache the pin on the project.
    if ((lat == null || lng == null) && (p.address || p.zip)) {
      const oneLine = [p.address, p.city, p.state, p.zip].filter(Boolean).join(', ');
      const geo = await geocode(oneLine);
      if (geo) {
        lat = geo.lat; lng = geo.lng;
        db.from('projects').update({ latitude: lat, longitude: lng } as never).eq('id', projectId).then(() => {}, () => {});
      }
    }
    if (lat == null || lng == null) return NextResponse.json({ available: false, reason: 'no location on project' });

    // NWS two-step: point metadata -> forecast URL -> today's periods.
    const pt = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, { headers: UA, signal: AbortSignal.timeout(6000) });
    if (!pt.ok) return NextResponse.json({ available: false, reason: 'outside NWS coverage' });
    const ptd = await pt.json();
    const fUrl = ptd?.properties?.forecast;
    if (!fUrl) return NextResponse.json({ available: false, reason: 'no forecast for point' });
    const fc = await fetch(fUrl, { headers: UA, signal: AbortSignal.timeout(6000) });
    if (!fc.ok) return NextResponse.json({ available: false, reason: 'forecast unavailable' });
    const fcd = await fc.json();
    const periods: any[] = fcd?.properties?.periods || [];
    if (!periods.length) return NextResponse.json({ available: false, reason: 'empty forecast' });

    // Today = first daytime period (or first period overnight) + its night.
    const day = periods.find((x) => x.isDaytime) || periods[0];
    const night = periods.find((x) => !x.isDaytime) || null;
    const temps = [day?.temperature, night?.temperature].filter((t) => typeof t === 'number') as number[];
    const high = temps.length ? Math.max(...temps) : null;
    const low = temps.length ? Math.min(...temps) : null;
    const precipPct = day?.probabilityOfPrecipitation?.value ?? null;

    const res = NextResponse.json({
      available: true,
      source: 'nws',
      conditions: day?.shortForecast ?? null,
      highTemp: high != null ? String(high) : null,
      lowTemp: low != null ? String(low) : null,
      wind: [day?.windSpeed, day?.windDirection].filter(Boolean).join(' ') || null,
      precipitation: precipPct != null ? `${precipPct}% chance` : null,
      raw: { point: { lat, lng }, period: { name: day?.name, detailed: day?.detailedForecast } },
    });
    // Forecasts change slowly — 20 min of private cache keeps repeat opens instant.
    res.headers.set('Cache-Control', 'private, max-age=1200');
    return res;
  } catch {
    return NextResponse.json({ available: false, reason: 'weather lookup failed' });
  }
}
