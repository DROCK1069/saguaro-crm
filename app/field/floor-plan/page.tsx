'use client';
/**
 * Saguaro Field — Floor Plan Viewer with GPS Pins
 * View project drawings, place pins, show existing pins, GPS locate.
 */
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { enqueue } from '@/lib/field-db';

const GOLD = '#D4A017';
const CARD = '#1A1F2E';
const BASE = '#0F1419';
const TEXT = '#F0F4FF';
const DIM = '#8BAAC8';
const GREEN = '#22C55E';
const BLUE = '#3B82F6';
const RED = '#EF4444';
const BORDER = '#1E3A5F';

function hr(hex: string): string {
  const r = parseInt((hex || '#888').slice(1, 3), 16);
  const g = parseInt((hex || '#888').slice(3, 5), 16);
  const b = parseInt((hex || '#888').slice(5, 7), 16);
  return `${r},${g},${b}`;
}

const PIN_TYPES: Record<string, { color: string; icon: string; label: string }> = {
  location: { color: BLUE, icon: '\u{1F4CD}', label: 'Location' },
  photo: { color: GREEN, icon: '\u{1F4F7}', label: 'Photo' },
  punch: { color: RED, icon: '\u{26A0}\u{FE0F}', label: 'Punch' },
  rfi: { color: '#8B5CF6', icon: '\u{2753}', label: 'RFI' },
  note: { color: GOLD, icon: '\u{1F4DD}', label: 'Note' },
};

interface Drawing {
  id: string;
  sheet: string;
  name: string;
  description: string;
  file_url: string;
  thumbnail_url?: string;
}

interface FloorPin {
  id: string;
  drawing_id: string;
  x_pct: number;
  y_pct: number;
  label: string;
  pin_type: string;
  linked_item_type?: string;
  linked_item_id?: string;
  note?: string;
  created_at: string;
}

type View = 'list' | 'viewer';

const glass: React.CSSProperties = {
  background: 'rgba(26,31,46,0.7)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
};

const inp: React.CSSProperties = {
  width: '100%', background: BASE, border: `1px solid ${BORDER}`,
  borderRadius: 10, padding: '11px 14px', color: TEXT, fontSize: 15, outline: 'none',
  boxSizing: 'border-box',
};

function FloorPlanPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState(paramProjectId);

  const imgRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('list');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null);
  const [pins, setPins] = useState<FloorPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pin placement
  const [placingPin, setPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x_pct: number; y_pct: number } | null>(null);
  const [pinLabel, setPinLabel] = useState('');
  const [pinType, setPinType] = useState('location');
  const [pinNote, setPinNote] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // GPS
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

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

  const fetchDrawings = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/drawings/list?projectId=${projectId}`);
      if (res.ok) {
        const d = await res.json();
        setDrawings(d.drawings || d.data || []);
      }
    } catch { /* offline */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchDrawings(); }, [fetchDrawings]);

  const fetchPins = useCallback(async (drawingId?: string) => {
    if (!projectId) return;
    try {
      let url = `/api/field/floor-plan-pins?projectId=${projectId}`;
      if (drawingId) url += `&drawingId=${drawingId}`;
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setPins(d.pins || d.data || []);
      }
    } catch { /* offline */ }
  }, [projectId]);

  const openDrawing = (d: Drawing) => {
    setSelectedDrawing(d);
    setView('viewer');
    fetchPins(d.id);
  };

  const handleImageTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingPin || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x_pct = ((e.clientX - rect.left) / rect.width) * 100;
    const y_pct = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x_pct, y_pct });
  };

  const savePin = async () => {
    if (!pendingPin || !selectedDrawing || !pinLabel.trim()) return;
    setSavingPin(true);

    const payload = {
      projectId,
      drawing_id: selectedDrawing.id,
      x_pct: pendingPin.x_pct,
      y_pct: pendingPin.y_pct,
      label: pinLabel.trim(),
      pin_type: pinType,
      note: pinNote.trim(),
    };

    try {
      if (!online) throw new Error('offline');
      const res = await fetch('/api/field/floor-plan-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setPins(prev => [...prev, d.pin || { id: `local-${Date.now()}`, ...payload, created_at: new Date().toISOString() }]);
    } catch {
      await enqueue({
        url: '/api/field/floor-plan-pins',
        method: 'POST',
        body: JSON.stringify(payload),
        contentType: 'application/json',
        isFormData: false,
      });
      setPins(prev => [...prev, { id: `local-${Date.now()}`, ...payload, created_at: new Date().toISOString() } as FloorPin]);
    }

    setPendingPin(null);
    setPinLabel('');
    setPinType('location');
    setPinNote('');
    setPlacingPin(false);
    setSavingPin(false);
  };

  const getGPS = () => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported'); return; }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      (err) => { setGpsError(err.message); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDrawings();
    if (selectedDrawing) await fetchPins(selectedDrawing.id);
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

  const drawingPins = pins.filter(p => p.drawing_id === selectedDrawing?.id);

  return (
    <div
      style={{ padding: '18px 16px', minHeight: '100%' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 10 && (
        <div style={{ textAlign: 'center', padding: '8px 0', color: DIM, fontSize: 12, transition: 'opacity .2s', opacity: pullDistance > 30 ? 1 : 0.5 }}>
          {pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}

      {refreshing && <div style={{ textAlign: 'center', padding: '8px 0', color: GOLD, fontSize: 12 }}>Refreshing...</div>}

      <button onClick={() => view === 'viewer' ? setView('list') : router.back()} style={{ background: 'none', border: 'none', color: DIM, fontSize: 14, cursor: 'pointer', padding: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><line x1={19} y1={12} x2={5} y2={12}/><polyline points="12 19 5 12 12 5"/></svg>
        {view === 'viewer' ? 'Drawings' : 'Back'}
      </button>

      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: TEXT }}>Floor Plans</h1>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: DIM }}>
        {view === 'list' ? `${drawings.length} drawing${drawings.length !== 1 ? 's' : ''} available` : selectedDrawing?.name}
      </p>

      {/* ── Drawing List ── */}
      {view === 'list' && (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ ...glass, padding: 16, height: 88, animation: 'pulse 1.5s ease-in-out infinite' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, height: 16, width: '60%', marginBottom: 8 }} />
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, height: 12, width: '40%' }} />
              </div>
            ))}
          </div>
        ) : drawings.length === 0 ? (
          <div style={{ ...glass, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{'\u{1F5FA}\u{FE0F}'}</div>
            <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: TEXT }}>No Floor Plans Yet</p>
            <p style={{ margin: 0, fontSize: 13, color: DIM }}>Upload drawings from the web app to view and pin them here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {drawings.map(d => (
              <button key={d.id} onClick={() => openDrawing(d)} style={{ ...glass, padding: 14, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', width: '100%', textAlign: 'left', color: TEXT }}>
                {d.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumbnail_url} alt={d.name} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.06)' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{'\u{1F4D0}'}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: DIM }}>{d.sheet || d.description || 'Floor Plan'}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: DIM }}>
                    {pins.filter(p => p.drawing_id === d.id).length} pin{pins.filter(p => p.drawing_id === d.id).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke={DIM} strokeWidth={2} width={18} height={18}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        )
      )}

      {/* ── Drawing Viewer ── */}
      {view === 'viewer' && selectedDrawing && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setPlacingPin(!placingPin)}
              style={{
                ...glass, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                color: placingPin ? BASE : GOLD,
                background: placingPin ? GOLD : 'rgba(26,31,46,0.7)',
                border: placingPin ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {'\u{1F4CC}'} {placingPin ? 'Cancel Pin' : 'Place Pin'}
            </button>

            <button
              onClick={getGPS}
              disabled={gpsLoading}
              style={{
                ...glass, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                color: gpsLoading ? DIM : GREEN,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {'\u{1F4E1}'} {gpsLoading ? 'Locating...' : 'GPS'}
            </button>
          </div>

          {/* GPS Result */}
          {gpsPosition && (
            <div style={{ ...glass, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
              <p style={{ margin: 0, fontWeight: 700, color: GREEN }}>{'\u{1F4CD}'} You are approximately here</p>
              <p style={{ margin: '4px 0 0', color: DIM, fontSize: 12 }}>
                Lat: {gpsPosition.lat.toFixed(6)} / Lng: {gpsPosition.lng.toFixed(6)}
              </p>
            </div>
          )}
          {gpsError && (
            <div style={{ ...glass, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: RED }}>
              GPS Error: {gpsError}
            </div>
          )}

          {placingPin && (
            <div style={{ ...glass, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: GOLD, fontWeight: 600 }}>
              Tap on the drawing below to place a pin
            </div>
          )}

          {/* Drawing Image with Pins */}
          <div
            ref={imgRef}
            onClick={handleImageTap}
            style={{
              position: 'relative', borderRadius: 12, overflow: 'hidden',
              border: placingPin ? `2px solid ${GOLD}` : '1px solid rgba(255,255,255,0.06)',
              cursor: placingPin ? 'crosshair' : 'default',
              marginBottom: 12,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedDrawing.file_url}
              alt={selectedDrawing.name}
              style={{ width: '100%', display: 'block' }}
            />
            {/* Existing pins */}
            {drawingPins.map(pin => {
              const pType = PIN_TYPES[pin.pin_type] || PIN_TYPES.note;
              return (
                <div
                  key={pin.id}
                  style={{
                    position: 'absolute',
                    left: `${pin.x_pct}%`, top: `${pin.y_pct}%`,
                    transform: 'translate(-50%, -100%)',
                    zIndex: 10,
                  }}
                  title={`${pin.label} (${pType.label})`}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50% 50% 50% 0',
                    background: pType.color, transform: 'rotate(-45deg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 2px 8px rgba(${hr(pType.color)}, 0.5)`,
                    border: '2px solid rgba(255,255,255,0.3)',
                  }}>
                    <span style={{ transform: 'rotate(45deg)', fontSize: 12 }}>{pType.icon}</span>
                  </div>
                  <div style={{
                    position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.85)', borderRadius: 6, padding: '2px 8px',
                    whiteSpace: 'nowrap', fontSize: 10, color: TEXT, fontWeight: 600,
                  }}>
                    {pin.label}
                  </div>
                </div>
              );
            })}

            {/* Pending pin */}
            {pendingPin && (
              <div style={{
                position: 'absolute',
                left: `${pendingPin.x_pct}%`, top: `${pendingPin.y_pct}%`,
                transform: 'translate(-50%, -100%)', zIndex: 20,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50% 50% 50% 0',
                  background: GOLD, transform: 'rotate(-45deg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 2px 12px rgba(${hr(GOLD)}, 0.6)`,
                  border: '2px solid #fff',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}>
                  <span style={{ transform: 'rotate(45deg)', fontSize: 14 }}>{'\u{1F4CC}'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pin form when pending */}
          {pendingPin && (
            <div style={{ ...glass, padding: 16, marginBottom: 12 }}>
              <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: TEXT }}>New Pin Details</p>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, color: DIM, marginBottom: 4 }}>Label *</label>
                <input value={pinLabel} onChange={e => setPinLabel(e.target.value)} placeholder="e.g. Column A3, Junction Box" style={inp} required />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, color: DIM, marginBottom: 4 }}>Pin Type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(PIN_TYPES).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPinType(key)}
                      style={{
                        background: pinType === key ? `rgba(${hr(cfg.color)}, 0.2)` : 'transparent',
                        border: `1.5px solid ${pinType === key ? cfg.color : BORDER}`,
                        borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                        color: pinType === key ? cfg.color : DIM, fontSize: 12, fontWeight: pinType === key ? 700 : 400,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: DIM, marginBottom: 4 }}>Note</label>
                <textarea value={pinNote} onChange={e => setPinNote(e.target.value)} placeholder="Optional note..." rows={2} style={inp} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { setPendingPin(null); setPlacingPin(false); }} style={{ flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px', color: DIM, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={savePin} disabled={savingPin || !pinLabel.trim()} style={{ flex: 2, background: savingPin ? BORDER : GOLD, border: 'none', borderRadius: 12, padding: '12px', color: savingPin ? DIM : '#000', fontSize: 14, fontWeight: 800, cursor: savingPin ? 'wait' : 'pointer' }}>
                  {savingPin ? 'Saving...' : 'Save Pin'}
                </button>
              </div>
            </div>
          )}

          {/* Pin legend */}
          {drawingPins.length > 0 && (
            <div style={{ ...glass, padding: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>Pins on this drawing</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {drawingPins.map(pin => {
                  const pType = PIN_TYPES[pin.pin_type] || PIN_TYPES.note;
                  return (
                    <div key={pin.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: pType.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{pin.label}</p>
                        {pin.note && <p style={{ margin: '2px 0 0', fontSize: 11, color: DIM }}>{pin.note}</p>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: pType.color }}>{pType.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
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

export default function FieldFloorPlanPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: '#8BAAC8', textAlign: 'center' }}>Loading...</div>}>
      <FloorPlanPage />
    </Suspense>
  );
}
