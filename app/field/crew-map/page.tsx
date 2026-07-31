'use client';
/**
 * Saguaro Control Systems — Live Crew GPS Dashboard
 * List crew locations, share your own GPS, trade summary. Offline queue.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Broadcast, UsersThree, Circle, MapPinLine } from '@phosphor-icons/react';
import { enqueue } from '@/lib/field-db';
import FieldPageHeader from '../FieldPageHeader';
import { scopedFieldIcon } from '../field-icons';

const GOLD = '#F59E0B';
const CARD = '#141416';
const BASE = '#0a0a0a';
const TEXT = '#FFFFFF';
const DIM = '#CBD5E1';
const GREEN = '#22C55E';
const BLUE = '#F59E0B';
const RED = '#EF4444';
const AMBER = '#F59E0B';
const BORDER = 'rgba(255,255,255,0.12)';

function hr(hex: string): string {
  const r = parseInt((hex || '#888').slice(1, 3), 16);
  const g = parseInt((hex || '#888').slice(3, 5), 16);
  const b = parseInt((hex || '#888').slice(5, 7), 16);
  return `${r},${g},${b}`;
}

interface CrewMember {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  trade: string;
  lat: number;
  lng: number;
  accuracy?: number;
  status: string;
  updated_at: string;
}

type ActivityStatus = 'active' | 'stale' | 'inactive';

function getActivityStatus(updatedAt: string): ActivityStatus {
  const now = Date.now();
  const updated = new Date(updatedAt).getTime();
  const diffMin = (now - updated) / 60000;
  if (diffMin < 15) return 'active';
  if (diffMin < 60) return 'stale';
  return 'inactive';
}

const ACTIVITY_CONFIG: Record<ActivityStatus, { color: string; label: string }> = {
  active: { color: GREEN, label: 'Active' },
  stale: { color: AMBER, label: 'Stale' },
  inactive: { color: '#6B7280', label: 'Inactive' },
};

const glass: React.CSSProperties = {
  background: 'rgba(20,20,22,0.7)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 16,
};

/* ── Geographic map projection helpers ───────────────────────────────────── */
const FT_PER_M = 3.28084;

/** Round up to a "nice" 1/2/5 x 10^n value for grid + scale-bar sizing. */
function niceNumber(x: number): number {
  if (!(x > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / pow;
  const nf = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nf * pow;
}

function fmtDistanceFromFeet(ft: number): string {
  if (ft >= 5280) {
    const mi = ft / 5280;
    return `${Number.isInteger(mi) ? mi : mi.toFixed(mi < 10 ? 1 : 0)} mi`;
  }
  return `${ft >= 100 ? Math.round(ft) : ft} ft`;
}

const fmtLat = (v: number) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? 'N' : 'S'}`;
const fmtLng = (v: number) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? 'E' : 'W'}`;

interface Plotted { member: CrewMember; x: number; y: number; first: string; initials: string; }

/**
 * CrewSiteMap — a REAL map. Projects each crew member's lat/lng onto a local
 * tangent-plane (equirectangular, longitude scaled by cos(lat)) so distances and
 * bearings are true, fits the bounding box into the SVG viewport preserving
 * aspect ratio, and draws pins, a metric grid, a distance scale bar, lat/lng
 * axes and a north arrow. Tapping a pin selects that crew member.
 */
function CrewSiteMap({
  crew, selectedId, onSelect, timeAgo,
}: {
  crew: CrewMember[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  timeAgo: (dt: string) => string;
}) {
  const W = 1000, H = 620, PAD = 70;

  const geo = useMemo(() => {
    const pts = crew.filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));
    if (pts.length === 0) return null;

    const lats = pts.map(p => p.lat);
    const lngs = pts.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const cx = (minLng + maxLng) / 2;
    const cyLat = (minLat + maxLat) / 2;

    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(cyLat * Math.PI / 180);
    const rawSpanX = (maxLng - minLng) * mPerDegLng;
    const rawSpanY = (maxLat - minLat) * mPerDegLat;

    // Keep a lone crew member (or a tight cluster) from collapsing to a point.
    const MIN_SPAN = 60; // meters
    const spanX = Math.max(rawSpanX, MIN_SPAN);
    const spanY = Math.max(rawSpanY, MIN_SPAN);

    // Uniform scale (viewBox-units per meter) that fits the padded viewport.
    const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);

    // Center on the data centroid → content is automatically centered & padded.
    const project = (lat: number, lng: number) => ({
      x: W / 2 + (lng - cx) * mPerDegLng * scale,
      y: H / 2 - (lat - cyLat) * mPerDegLat * scale, // flip so north is up
    });

    const plotted: Plotted[] = pts.map(m => {
      const pr = project(m.lat, m.lng);
      const parts = (m.name || 'Crew').trim().split(/\s+/);
      const initials = (parts.map(w => w[0]).join('').toUpperCase().slice(0, 2)) || 'C';
      return { member: m, x: pr.x, y: pr.y, first: parts[0] || 'Crew', initials };
    });

    // Distance scale bar + metric grid: pick a nice real-world distance whose
    // on-screen length is ~1/5 of the plot width.
    const targetMeters = ((W - 2 * PAD) / 5) / scale;
    const niceFeet = niceNumber(targetMeters * FT_PER_M);
    const barMeters = niceFeet / FT_PER_M;
    const gridPx = barMeters * scale;
    const barVb = gridPx;

    // Grid lines anchored on the centroid, one cell = the scale-bar distance.
    const gridXs: number[] = [];
    for (let x = W / 2; x <= W; x += gridPx) gridXs.push(x);
    for (let x = W / 2 - gridPx; x >= 0; x -= gridPx) gridXs.push(x);
    const gridYs: number[] = [];
    for (let y = H / 2; y <= H; y += gridPx) gridYs.push(y);
    for (let y = H / 2 - gridPx; y >= 0; y -= gridPx) gridYs.push(y);

    // Data-extent screen positions (for axis labels).
    const xLeft = project(cyLat, minLng).x;
    const xRight = project(cyLat, maxLng).x;
    const yTop = project(maxLat, cx).y;
    const yBottom = project(minLat, cx).y;

    return {
      plotted, gridXs, gridYs, barVb, niceFeet,
      cx, cyLat, minLat, maxLat, minLng, maxLng,
      xLeft, xRight, yTop, yBottom,
      distinctLat: maxLat - minLat > 1e-7,
      distinctLng: maxLng - minLng > 1e-7,
    };
  }, [crew]);

  if (!geo) return null;

  const sel = geo.plotted.find(p => p.member.id === selectedId) || null;
  const selStatus = sel ? getActivityStatus(sel.member.updated_at) : null;
  const AX = 'rgba(148,163,184,0.75)';

  return (
    <div style={{ ...glass, padding: 12, marginBottom: 14 }}>
      {/* Legend + title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>Site Map</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(['active', 'stale', 'inactive'] as ActivityStatus[]).map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: DIM }}>
              <Circle size={11} weight="fill" color={ACTIVITY_CONFIG[s].color} />
              {ACTIVITY_CONFIG[s].label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12 }}
          onClick={() => onSelect(null)}
          role="img"
          aria-label={`Map of ${geo.plotted.length} crew location${geo.plotted.length !== 1 ? 's' : ''}`}
        >
          <defs>
            <linearGradient id="crewmap_bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d1626" />
              <stop offset="1" stopColor="#080d16" />
            </linearGradient>
          </defs>

          {/* Backdrop */}
          <rect x="0" y="0" width={W} height={H} fill="url(#crewmap_bg)" />

          {/* Metric grid — one cell = the scale-bar distance */}
          {geo.gridXs.map((x, i) => (
            <line key={`gx${i}`} x1={x} y1={0} x2={x} y2={H} stroke="rgba(148,163,184,0.09)" strokeWidth={1} />
          ))}
          {geo.gridYs.map((y, i) => (
            <line key={`gy${i}`} x1={0} y1={y} x2={W} y2={y} stroke="rgba(148,163,184,0.09)" strokeWidth={1} />
          ))}

          {/* Axis frame */}
          <line x1={PAD - 24} y1={PAD - 30} x2={PAD - 24} y2={H - (PAD - 30)} stroke="rgba(148,163,184,0.25)" strokeWidth={1.2} />
          <line x1={PAD - 24} y1={H - (PAD - 30)} x2={W - (PAD - 30)} y2={H - (PAD - 30)} stroke="rgba(148,163,184,0.25)" strokeWidth={1.2} />

          {/* Latitude axis labels (left) */}
          {geo.distinctLat ? (
            <>
              <text x={10} y={geo.yTop - 8} textAnchor="start" fontSize={12} fill={AX}>{fmtLat(geo.maxLat)}</text>
              <text x={10} y={geo.yBottom + 14} textAnchor="start" fontSize={12} fill={AX}>{fmtLat(geo.minLat)}</text>
            </>
          ) : (
            <text x={10} y={H / 2} textAnchor="start" dominantBaseline="middle" fontSize={12} fill={AX}>{fmtLat(geo.cyLat)}</text>
          )}

          {/* Longitude axis labels (bottom) */}
          {geo.distinctLng ? (
            <>
              <text x={geo.xLeft} y={H - (PAD - 30) + 20} textAnchor="middle" fontSize={12} fill={AX}>{fmtLng(geo.minLng)}</text>
              <text x={geo.xRight} y={H - (PAD - 30) + 20} textAnchor="middle" fontSize={12} fill={AX}>{fmtLng(geo.maxLng)}</text>
            </>
          ) : (
            <text x={W / 2} y={H - (PAD - 30) + 20} textAnchor="middle" fontSize={12} fill={AX}>{fmtLng(geo.cx)}</text>
          )}

          {/* North arrow */}
          <g transform={`translate(${W - 54},52)`}>
            <circle r={22} fill="rgba(8,13,22,0.72)" stroke="rgba(148,163,184,0.28)" strokeWidth={1} />
            <path d="M0,-14 L6,7 L0,2 L-6,7 Z" fill={GOLD} />
            <text y={-15} textAnchor="middle" fontSize={9} fontWeight={700} fill={DIM}>N</text>
          </g>

          {/* Distance scale bar */}
          <g transform={`translate(${PAD - 24},${H - 34})`}>
            <line x1={0} y1={0} x2={geo.barVb} y2={0} stroke="#E5EAF1" strokeWidth={2} />
            <line x1={0} y1={-5} x2={0} y2={5} stroke="#E5EAF1" strokeWidth={2} />
            <line x1={geo.barVb} y1={-5} x2={geo.barVb} y2={5} stroke="#E5EAF1" strokeWidth={2} />
            <text x={geo.barVb / 2} y={-8} textAnchor="middle" fontSize={12} fontWeight={600} fill="#E5EAF1">{fmtDistanceFromFeet(geo.niceFeet)}</text>
          </g>

          {/* Center coordinate readout */}
          <text x={W - 16} y={H - 16} textAnchor="end" fontSize={11} fill="rgba(148,163,184,0.7)">
            center {fmtLat(geo.cyLat)} {'·'} {fmtLng(geo.cx)}
          </text>

          {/* Pins (selected drawn last so it sits on top) */}
          {[...geo.plotted]
            .sort((a) => (a.member.id === selectedId ? 1 : -1))
            .map(p => {
              const st = getActivityStatus(p.member.updated_at);
              const color = ACTIVITY_CONFIG[st].color;
              const isSel = p.member.id === selectedId;
              return (
                <g
                  key={p.member.id}
                  transform={`translate(${p.x},${p.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); onSelect(isSel ? null : p.member.id); }}
                >
                  <g transform={`scale(${isSel ? 1.25 : 1})`} style={{ transition: 'transform 0.15s ease' }}>
                    <ellipse cx={0} cy={2} rx={9} ry={3.2} fill="rgba(0,0,0,0.4)" />
                    <path
                      d="M0 0 C -7 -12 -12 -16 -12 -24 A 12 12 0 1 1 12 -24 C 12 -16 7 -12 0 0 Z"
                      fill={color}
                      stroke="#0a0f18"
                      strokeWidth={1.5}
                    />
                    <circle cx={0} cy={-24} r={7.5} fill="#0a0f18" />
                    <text x={0} y={-24} dy="0.34em" textAnchor="middle" fontSize={9} fontWeight={800} fill={color}>{p.initials}</text>
                    {isSel && (
                      <path
                        d="M0 0 C -7 -12 -12 -16 -12 -24 A 12 12 0 1 1 12 -24 C 12 -16 7 -12 0 0 Z"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        opacity={0.9}
                      />
                    )}
                  </g>
                  <text
                    x={0}
                    y={18}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={700}
                    fill="#E5EAF1"
                    stroke="#0a0f18"
                    strokeWidth={3}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    {p.first}
                  </text>
                </g>
              );
            })}
        </svg>

        {/* Selected-crew callout (HTML overlay positioned over the pin) */}
        {sel && selStatus && (
          <div
            style={{
              position: 'absolute',
              left: `${(sel.x / W) * 100}%`,
              top: `${(sel.y / H) * 100}%`,
              transform: `translate(${sel.x / W < 0.22 ? '-8%' : sel.x / W > 0.78 ? '-92%' : '-50%'}, calc(-100% - 34px))`,
              minWidth: 168,
              maxWidth: 240,
              background: 'rgba(10,15,24,0.96)',
              border: `1px solid ${ACTIVITY_CONFIG[selStatus].color}`,
              borderRadius: 12,
              padding: '10px 12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>{sel.member.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: DIM }}>{sel.member.trade || 'Unassigned'}</p>
            <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 700, color: ACTIVITY_CONFIG[selStatus].color }}>
              {ACTIVITY_CONFIG[selStatus].label} {'·'} {timeAgo(sel.member.updated_at)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'rgba(148,163,184,0.85)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtLat(sel.member.lat)} {'·'} {fmtLng(sel.member.lng)}
            </p>
            {sel.member.accuracy != null && (
              <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'rgba(148,163,184,0.7)' }}>
                {'±'}{Math.round(sel.member.accuracy)}m accuracy
              </p>
            )}
          </div>
        )}
      </div>

      <p style={{ margin: '10px 2px 0', fontSize: 11, color: 'rgba(148,163,184,0.7)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <MapPinLine size={13} color="rgba(148,163,184,0.7)" />
        Tap a pin for crew details {'·'} grid cell = {fmtDistanceFromFeet(geo.niceFeet)}
      </p>
    </div>
  );
}

function CrewMapPage() {
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState(paramProjectId);

  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareInterval, setShareIntervalRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const [lastShared, setLastShared] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Pull to refresh
  const [touchStart, setTouchStart] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('sag_active_project') : null;
    if (!projectId && stored) setProjectId(stored);
  }, [projectId]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  const fetchCrew = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/field/crew-locations?projectId=${projectId}`);
      if (res.ok) {
        const d = await res.json();
        setCrew(d.crew || d.data || []);
      }
    } catch { /* offline */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchCrew(); }, [fetchCrew]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { if (projectId) fetchCrew(); }, 30000);
    return () => clearInterval(id);
  }, [projectId, fetchCrew]);

  const shareLocation = useCallback(async () => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported'); return; }
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const payload = {
          projectId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };

        try {
          if (!online) throw new Error('offline');
          await fetch('/api/field/crew-locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch {
          await enqueue({
            url: '/api/field/crew-locations',
            method: 'POST',
            body: JSON.stringify(payload),
            contentType: 'application/json',
            isFormData: false,
          });
        }
        setLastShared(new Date().toLocaleTimeString());
      },
      (err) => { setGpsError(err.message); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [projectId, online]);

  const toggleSharing = () => {
    if (sharing) {
      // Stop sharing
      if (shareInterval) clearInterval(shareInterval);
      setShareIntervalRef(null);
      setSharing(false);
    } else {
      // Start sharing
      setSharing(true);
      shareLocation();
      const id = setInterval(shareLocation, 60000); // every 60s
      setShareIntervalRef(id);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (shareInterval) clearInterval(shareInterval); };
  }, [shareInterval]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCrew();
    setRefreshing(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - touchStart;
    if (diff > 0 && diff < 120) setPullDistance(diff);
  };
  const handleTouchEnd = () => {
    if (pullDistance > 60) handleRefresh();
    setPullDistance(0);
    setTouchStart(0);
  };

  // Trade summary
  const tradeCounts: Record<string, number> = {};
  crew.forEach(c => {
    const trade = c.trade || 'Unassigned';
    tradeCounts[trade] = (tradeCounts[trade] || 0) + 1;
  });

  const activeCrew = crew.filter(c => getActivityStatus(c.updated_at) === 'active');
  const staleCrew = crew.filter(c => getActivityStatus(c.updated_at) === 'stale');
  const inactiveCrew = crew.filter(c => getActivityStatus(c.updated_at) === 'inactive');

  function timeAgo(dt: string): string {
    const diff = (Date.now() - new Date(dt).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div
      style={{ padding: '18px 16px', minHeight: '100%' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 10 && (
        <div style={{ textAlign: 'center', padding: '8px 0', color: DIM, fontSize: 12, opacity: pullDistance > 30 ? 1 : 0.5 }}>
          {pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
      {refreshing && <div style={{ textAlign: 'center', padding: '8px 0', color: GOLD, fontSize: 12 }}>Refreshing...</div>}

      <FieldPageHeader
        title="Crew Locations"
        subtitle={<>{crew.length} crew member{crew.length !== 1 ? 's' : ''} &middot; {activeCrew.length} active</>}
        icon={scopedFieldIcon('crewMap', 'ph')}
      />


      {/* Share my location toggle */}
      <div style={{ ...glass, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Broadcast size={17} color={GOLD} weight="fill" /> Share My Location
          </p>
          {sharing && lastShared && (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: GREEN }}>Sharing &middot; Last sent: {lastShared}</p>
          )}
          {!sharing && <p style={{ margin: '3px 0 0', fontSize: 11, color: DIM }}>Updates every 60 seconds when enabled</p>}
        </div>
        <button
          onClick={toggleSharing}
          style={{
            width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: sharing ? GREEN : 'rgba(255,255,255,0.15)',
            position: 'relative', transition: 'background 0.3s',
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 3,
            left: sharing ? 27 : 3,
            transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>

      {gpsError && (
        <div style={{ ...glass, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: RED }}>
          GPS Error: {gpsError}
        </div>
      )}

      {/* Live site map */}
      {!loading && crew.some(c => Number.isFinite(c.lat) && Number.isFinite(c.lng)) && (
        <CrewSiteMap crew={crew} selectedId={selectedId} onSelect={setSelectedId} timeAgo={timeAgo} />
      )}

      {/* Trade summary */}
      {Object.keys(tradeCounts).length > 0 && (
        <div style={{ ...glass, padding: '12px 14px', marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>Crew by Trade</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(tradeCounts).sort((a, b) => b[1] - a[1]).map(([trade, count]) => (
              <span key={trade} style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 8, padding: '4px 10px', fontSize: 12, color: BLUE, fontWeight: 600,
              }}>
                {trade}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Crew list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ ...glass, padding: 16, height: 64, animation: 'pulse 1.5s ease-in-out infinite' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 14, width: '50%', marginBottom: 6 }} />
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, height: 10, width: '30%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : crew.length === 0 ? (
        <div style={{ ...glass, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <UsersThree size={48} color={GOLD} weight="duotone" />
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: TEXT }}>No Crew Locations</p>
          <p style={{ margin: 0, fontSize: 13, color: DIM }}>
            Enable &quot;Share My Location&quot; above to start. Other crew members will appear here once they share theirs.
          </p>
        </div>
      ) : (
        <div>
          {/* Active */}
          {activeCrew.length > 0 && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Circle size={11} weight="fill" color={GREEN} /> Active ({activeCrew.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {activeCrew.map(c => (
                  <CrewCard key={c.id} member={c} activity="active" timeAgo={timeAgo} />
                ))}
              </div>
            </>
          )}

          {/* Stale */}
          {staleCrew.length > 0 && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: AMBER, textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Circle size={11} weight="fill" color={AMBER} /> Stale ({staleCrew.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {staleCrew.map(c => (
                  <CrewCard key={c.id} member={c} activity="stale" timeAgo={timeAgo} />
                ))}
              </div>
            </>
          )}

          {/* Inactive */}
          {inactiveCrew.length > 0 && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Circle size={11} weight="fill" color="#6B7280" /> Inactive ({inactiveCrew.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {inactiveCrew.map(c => (
                  <CrewCard key={c.id} member={c} activity="inactive" timeAgo={timeAgo} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function CrewCard({ member, activity, timeAgo }: { member: CrewMember; activity: ActivityStatus; timeAgo: (dt: string) => string }) {
  const cfg = ACTIVITY_CONFIG[activity];
  const initials = member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{
      background: 'rgba(20,20,22,0.7)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 16,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: `rgba(${hr(cfg.color)}, 0.15)`,
          border: `2px solid ${cfg.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: cfg.color,
        }}>
          {initials}
        </div>
        <div style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 12, height: 12, borderRadius: '50%',
          background: cfg.color, border: '2px solid rgba(255,255,255,0.12)',
          boxShadow: `0 0 4px ${cfg.color}`,
        }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#CBD5E1' }}>{member.trade || 'Unassigned'}</p>
      </div>

      {/* Time */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: '#CBD5E1' }}>{timeAgo(member.updated_at)}</p>
      </div>
    </div>
  );
}

export default function FieldCrewMapPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: '#CBD5E1', textAlign: 'center' }}>Loading...</div>}>
      <CrewMapPage />
    </Suspense>
  );
}
