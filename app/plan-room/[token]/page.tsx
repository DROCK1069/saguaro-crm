'use client';
/**
 * Public Plan Room — token-gated, no login. Invited subs browse current
 * drawings for a project. Reads /api/plan-room/[token].
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const GOLD = '#C8881C', BASE = '#0E1726', CARD = '#15203218', BORDER = '#E5E5EA', TEXT = '#1C1C1E', DIM = '#6E6E73';

interface Sheet { id: string; sheet_number: string; sheet_title: string; discipline?: string; revision_label?: string; thumbnail_url?: string; file_url?: string }

export default function PlanRoomPage() {
  const params = useParams();
  const token = String(params.token || '');
  const [data, setData] = useState<{ project_name: string; label: string; sheet_count: number; sheets: Sheet[] } | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/plan-room/${token}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || 'Unavailable'); return r.json(); })
      .then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: '#F2F2F7' }}>
      <header style={{ background: '#0E1726', color: '#fff', padding: '18px 20px' }}>
        <div style={{ color: GOLD, fontWeight: 800, letterSpacing: 1, fontSize: 13 }}>SAGUARO · PLAN ROOM</div>
        {data && <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{data.project_name}</div>}
        {data && <div style={{ fontSize: 13, opacity: 0.7 }}>{data.label} · {data.sheet_count} sheets</div>}
      </header>
      <div style={{ padding: 16 }}>
        {loading && <div style={{ color: DIM }}>Loading drawings…</div>}
        {err && <div style={{ color: '#B91C1C', background: '#FEE2E2', padding: 14, borderRadius: 10 }}>{err}</div>}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
            {data.sheets.map(s => (
              <a key={s.id} href={s.file_url || '#'} target="_blank" rel="noreferrer"
                style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', textDecoration: 'none', color: TEXT }}>
                <div style={{ height: 110, background: '#E5E7EB', backgroundImage: s.thumbnail_url ? `url(${s.thumbnail_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div style={{ padding: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{s.sheet_number}</div>
                  <div style={{ fontSize: 12, color: DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sheet_title}</div>
                  {s.revision_label && <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>Rev {s.revision_label}</div>}
                </div>
              </a>
            ))}
            {data.sheets.length === 0 && <div style={{ color: DIM }}>No drawings published yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
