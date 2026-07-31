'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/hooks/useProjects';
import { usePortals, createPortal, revokePortal } from '@/lib/hooks/useFranchise';
import { C, font, fmtDate, useFranchiseGate, GateLoading, PageHeader, Tile, EmptyState } from '@/components/franchise/kit';
import { LinkSimple, CheckCircle } from '@phosphor-icons/react';

export default function PortalsPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { portals, loading } = usePortals();
  const { projects } = useProjects();
  const [f, setF] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const [gone, setGone] = useState<Record<string, boolean>>({});

  const list = (portals as any[]).filter((p) => !gone[p.id] && p.is_active);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  async function create() {
    if (!f.project_id) { setErr('Pick a site.'); return; }
    setBusy(true); setErr('');
    try { await createPortal(f); setF({}); } catch (e: any) { setErr(e?.message || 'Failed'); } finally { setBusy(false); }
  }
  async function copy(url: string, id: string) {
    try { await navigator.clipboard.writeText(origin + url); setCopied(id); setTimeout(() => setCopied(''), 1800); } catch { /* noop */ }
  }
  async function revoke(id: string) {
    setGone((g) => ({ ...g, [id]: true }));
    try { await revokePortal(id); } catch { setGone((g) => { const n = { ...g }; delete n[id]; return n; }); }
  }

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1000, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader title="Franchisee Portals" subtitle="A private, read-only link for each Owner/Franchisee to watch their location come together — no login, always current." />

      {/* Create */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 220px' }}>
          <label style={lbl}>Site</label>
          <select style={inp} value={f.project_id || ''} onChange={(e) => setF((p) => ({ ...p, project_id: e.target.value }))}>
            <option value="">Select site…</option>
            {(projects as any[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}><label style={lbl}>Owner name</label><input style={inp} value={f.owner_name || ''} onChange={(e) => setF((p) => ({ ...p, owner_name: e.target.value }))} /></div>
        <div style={{ flex: '1 1 160px' }}><label style={lbl}>Owner email</label><input style={inp} value={f.owner_email || ''} onChange={(e) => setF((p) => ({ ...p, owner_email: e.target.value }))} /></div>
        <button onClick={create} disabled={busy} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: busy ? C.dim : C.gold, color: '#fff', fontWeight: 800, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Creating…' : 'Generate Link'}</button>
      </div>
      {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile label="Active Portals" value={list.length} />
        <Tile label="Sites" value={new Set(list.map((p) => p.project_id)).size} />
      </div>

      {loading ? <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading…</div>
      : list.length === 0 ? (
        <EmptyState icon={<LinkSimple size={34} weight="regular" color={C.dim} />} title="No owner portals yet" body="Generate a private link for each franchisee — they'll see live progress, milestones, and budget status for their location without touching your operations." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((p) => (
            <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{p.project_name || 'Site'}</div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                    {p.owner_name ? `${p.owner_name}${p.owner_email ? ` · ${p.owner_email}` : ''}` : 'No owner named'}
                    {p.last_accessed_at ? ` · last viewed ${fmtDate(p.last_accessed_at)}` : ' · not viewed yet'}
                  </div>
                  <code style={{ fontSize: 11, color: C.faint, wordBreak: 'break-all' }}>{origin}{p.url}</code>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link href={p.url} target="_blank" style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#1c1c1e', color: C.blue, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Preview</Link>
                  <button onClick={() => copy(p.url, p.id)} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: copied === p.id ? C.green : C.gold, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{copied === p.id ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}><CheckCircle size={14} weight="fill" color="#fff" />Copied</span> : 'Copy Link'}</button>
                  <button onClick={() => revoke(p.id)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#1c1c1e', color: C.red, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Revoke</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: '#1c1c1e', width: '100%' };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, display: 'block' };
