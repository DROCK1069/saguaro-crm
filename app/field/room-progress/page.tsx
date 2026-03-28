'use client';
/**
 * Saguaro Field — Room-by-Room Progress Tracking
 * List rooms, edit progress %, status, trades. Add new rooms. Offline queue.
 */
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
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

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  not_started: { color: '#6B7280', label: 'Not Started' },
  in_progress: { color: BLUE, label: 'In Progress' },
  complete: { color: GREEN, label: 'Complete' },
  blocked: { color: RED, label: 'Blocked' },
};

interface Room {
  id: string;
  project_id: string;
  name: string;
  floor: string;
  building?: string;
  percent_complete: number;
  status: string;
  active_trades: string[];
  notes?: string;
  photos?: string[];
  updated_at: string;
}

type View = 'list' | 'edit' | 'add';

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

const TRADE_OPTIONS = [
  'Electrical', 'Plumbing', 'HVAC', 'Drywall', 'Framing', 'Painting',
  'Flooring', 'Tile', 'Cabinetry', 'Millwork', 'Fire Protection',
  'Insulation', 'Roofing', 'Masonry', 'Concrete', 'Steel',
];

function RoomProgressPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState(paramProjectId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View>('list');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form fields
  const [formName, setFormName] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formBuilding, setFormBuilding] = useState('');
  const [formPercent, setFormPercent] = useState(0);
  const [formStatus, setFormStatus] = useState('not_started');
  const [formTrades, setFormTrades] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

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

  const fetchRooms = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/field/room-progress?projectId=${projectId}`);
      if (res.ok) {
        const d = await res.json();
        setRooms(d.rooms || d.data || []);
      }
    } catch { /* offline */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const openEdit = (room: Room) => {
    setSelectedRoom(room);
    setFormName(room.name);
    setFormFloor(room.floor);
    setFormBuilding(room.building || '');
    setFormPercent(room.percent_complete);
    setFormStatus(room.status);
    setFormTrades(room.active_trades || []);
    setFormNotes(room.notes || '');
    setPhotoPreview('');
    setPhotoFile(null);
    setView('edit');
  };

  const openAdd = () => {
    setSelectedRoom(null);
    setFormName('');
    setFormFloor('');
    setFormBuilding('');
    setFormPercent(0);
    setFormStatus('not_started');
    setFormTrades([]);
    setFormNotes('');
    setPhotoPreview('');
    setPhotoFile(null);
    setView('add');
  };

  const toggleTrade = (trade: string) => {
    setFormTrades(prev => prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(String(ev.target?.result || ''));
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);

    let photoUrls: string[] = [];
    if (photoFile && online) {
      try {
        const fd = new FormData();
        fd.append('file', photoFile);
        fd.append('projectId', projectId);
        fd.append('category', 'Room Progress');
        fd.append('caption', `Room: ${formName.trim()}`);
        const res = await fetch('/api/photos/upload', { method: 'POST', body: fd });
        if (res.ok) {
          const d = await res.json();
          if (d.photo?.url) photoUrls = [d.photo.url];
        }
      } catch { /* continue */ }
    }

    const payload: Record<string, unknown> = {
      projectId,
      name: formName.trim(),
      floor: formFloor.trim(),
      building: formBuilding.trim(),
      percent_complete: formPercent,
      status: formStatus,
      active_trades: formTrades,
      notes: formNotes.trim(),
      photoUrls,
    };

    const isEdit = view === 'edit' && selectedRoom;
    const url = '/api/field/room-progress';
    const method = isEdit ? 'PUT' : 'POST';
    if (isEdit) payload.id = selectedRoom.id;

    try {
      if (!online) throw new Error('offline');
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      const savedRoom = d.room || { id: `local-${Date.now()}`, ...payload, updated_at: new Date().toISOString() };

      if (isEdit) {
        setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, ...savedRoom } : r));
      } else {
        setRooms(prev => [savedRoom as Room, ...prev]);
      }
    } catch {
      await enqueue({ url, method, body: JSON.stringify(payload), contentType: 'application/json', isFormData: false });
      const localRoom = { id: `local-${Date.now()}`, project_id: projectId, ...payload, active_trades: formTrades, updated_at: new Date().toISOString() } as unknown as Room;
      if (isEdit) {
        setRooms(prev => prev.map(r => r.id === selectedRoom!.id ? { ...r, ...localRoom } : r));
      } else {
        setRooms(prev => [localRoom, ...prev]);
      }
    }

    setView('list');
    setSaving(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
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

  const filteredRooms = filterStatus === 'all' ? rooms : rooms.filter(r => r.status === filterStatus);

  const overallProgress = rooms.length > 0
    ? Math.round(rooms.reduce((sum, r) => sum + (r.percent_complete || 0), 0) / rooms.length)
    : 0;

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

      <button onClick={() => view !== 'list' ? setView('list') : router.back()} style={{ background: 'none', border: 'none', color: DIM, fontSize: 14, cursor: 'pointer', padding: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}><line x1={19} y1={12} x2={5} y2={12}/><polyline points="12 19 5 12 12 5"/></svg>
        {view !== 'list' ? 'Rooms' : 'Back'}
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>Room Progress</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: DIM }}>{rooms.length} room{rooms.length !== 1 ? 's' : ''} &middot; {overallProgress}% overall</p>
        </div>
        {view === 'list' && (
          <button onClick={openAdd} style={{ background: GOLD, border: 'none', borderRadius: 10, padding: '10px 16px', color: '#000', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            + Room
          </button>
        )}
      </div>

      {/* Overall progress bar */}
      {view === 'list' && rooms.length > 0 && (
        <div style={{ ...glass, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>Overall Progress</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: overallProgress >= 100 ? GREEN : GOLD }}>{overallProgress}%</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(overallProgress, 100)}%`, background: `linear-gradient(90deg, ${BLUE}, ${overallProgress >= 100 ? GREEN : GOLD})`, borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* Filter bar */}
          {rooms.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
              <button onClick={() => setFilterStatus('all')} style={{ ...glass, padding: '6px 12px', fontSize: 12, fontWeight: filterStatus === 'all' ? 700 : 400, color: filterStatus === 'all' ? GOLD : DIM, cursor: 'pointer', whiteSpace: 'nowrap', background: filterStatus === 'all' ? `rgba(${hr(GOLD)},0.15)` : 'rgba(26,31,46,0.7)' }}>
                All ({rooms.length})
              </button>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = rooms.filter(r => r.status === key).length;
                if (count === 0) return null;
                return (
                  <button key={key} onClick={() => setFilterStatus(key)} style={{ ...glass, padding: '6px 12px', fontSize: 12, fontWeight: filterStatus === key ? 700 : 400, color: filterStatus === key ? cfg.color : DIM, cursor: 'pointer', whiteSpace: 'nowrap', background: filterStatus === key ? `rgba(${hr(cfg.color)},0.15)` : 'rgba(26,31,46,0.7)' }}>
                    {cfg.label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ ...glass, padding: 16, height: 80, animation: 'pulse 1.5s ease-in-out infinite' }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, height: 16, width: '50%', marginBottom: 8 }} />
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, height: 10, width: '100%' }} />
                </div>
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div style={{ ...glass, padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{'\u{1F3D7}\u{FE0F}'}</div>
              <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: TEXT }}>
                {rooms.length === 0 ? 'No Rooms Added' : 'No Matching Rooms'}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: DIM }}>
                {rooms.length === 0 ? 'Tap "+ Room" to start tracking room-by-room progress.' : 'Try a different filter.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredRooms.map(room => {
                const sCfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.not_started;
                return (
                  <button key={room.id} onClick={() => openEdit(room)} style={{ ...glass, padding: 14, cursor: 'pointer', width: '100%', textAlign: 'left', color: TEXT }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: DIM }}>{room.floor}{room.building ? ` \u00B7 ${room.building}` : ''}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sCfg.color, background: `rgba(${hr(sCfg.color)},0.12)`, padding: '3px 8px', borderRadius: 6 }}>
                        {sCfg.label}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(room.percent_complete || 0, 100)}%`, background: sCfg.color, borderRadius: 3, transition: 'width 0.4s ease' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: sCfg.color, minWidth: 36, textAlign: 'right' }}>{room.percent_complete || 0}%</span>
                    </div>
                    {/* Active trades */}
                    {room.active_trades && room.active_trades.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {room.active_trades.map(t => (
                          <span key={t} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 8px', fontSize: 10, color: DIM, fontWeight: 600 }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── ADD / EDIT FORM ── */}
      {(view === 'add' || view === 'edit') && (
        <form onSubmit={submit}>
          <div style={{ ...glass, padding: '14px 14px 6px', marginBottom: 12 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>Room Info</p>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, color: DIM, marginBottom: 4 }}>Room Name *</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Suite 201, Lobby, Mechanical Room" style={inp} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, color: DIM, marginBottom: 4 }}>Floor</label>
                <input value={formFloor} onChange={e => setFormFloor(e.target.value)} placeholder="e.g. 1st Floor" style={inp} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, color: DIM, marginBottom: 4 }}>Building</label>
                <input value={formBuilding} onChange={e => setFormBuilding(e.target.value)} placeholder="e.g. Building A" style={inp} />
              </div>
            </div>
          </div>

          {/* Progress */}
          <div style={{ ...glass, padding: '14px 14px 6px', marginBottom: 12 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>Progress</p>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: DIM }}>Percent Complete</label>
                <span style={{ fontSize: 14, fontWeight: 800, color: formPercent >= 100 ? GREEN : GOLD }}>{formPercent}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={5} value={formPercent}
                onChange={e => setFormPercent(Number(e.target.value))}
                style={{ width: '100%', accentColor: GOLD }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM, marginTop: 2 }}>
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div style={{ ...glass, padding: '14px 14px 6px', marginBottom: 12 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>Status</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key} type="button" onClick={() => setFormStatus(key)}
                  style={{
                    background: formStatus === key ? `rgba(${hr(cfg.color)},0.15)` : 'transparent',
                    border: `2px solid ${formStatus === key ? cfg.color : BORDER}`,
                    borderRadius: 10, padding: '12px 8px', color: formStatus === key ? cfg.color : DIM,
                    fontSize: 13, fontWeight: formStatus === key ? 800 : 400, cursor: 'pointer',
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Trades */}
          <div style={{ ...glass, padding: '14px 14px 6px', marginBottom: 12 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>Active Trades</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {TRADE_OPTIONS.map(trade => (
                <button
                  key={trade} type="button" onClick={() => toggleTrade(trade)}
                  style={{
                    background: formTrades.includes(trade) ? `rgba(${hr(BLUE)},0.15)` : 'transparent',
                    border: `1.5px solid ${formTrades.includes(trade) ? BLUE : BORDER}`,
                    borderRadius: 8, padding: '6px 10px', color: formTrades.includes(trade) ? BLUE : DIM,
                    fontSize: 12, fontWeight: formTrades.includes(trade) ? 700 : 400, cursor: 'pointer',
                  }}
                >
                  {trade}
                </button>
              ))}
            </div>
          </div>

          {/* Notes & Photo */}
          <div style={{ ...glass, padding: '14px 14px 6px', marginBottom: 12 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>Notes & Photos</p>
            <div style={{ marginBottom: 10 }}>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Progress notes, issues, etc..." rows={3} style={inp} />
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            {!photoPreview ? (
              <button type="button" onClick={() => fileRef.current?.click()} style={{ width: '100%', background: 'transparent', border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '14px', color: DIM, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                {'\u{1F4F7}'} Add Progress Photo
              </button>
            ) : (
              <div style={{ position: 'relative', marginBottom: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Room" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10 }} />
                <button type="button" onClick={() => { setPhotoPreview(''); setPhotoFile(null); }} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>{'\u2715'} Remove</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setView('list')} style={{ flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px', color: DIM, fontSize: 15, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, background: saving ? BORDER : GOLD, border: 'none', borderRadius: 12, padding: '16px', color: saving ? DIM : '#000', fontSize: 15, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving...' : view === 'edit' ? 'Update Room' : 'Add Room'}
            </button>
          </div>
        </form>
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

export default function FieldRoomProgressPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: '#8BAAC8', textAlign: 'center' }}>Loading...</div>}>
      <RoomProgressPage />
    </Suspense>
  );
}
