'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/hooks/useProjects';
import { useStakeholders, addStakeholder, removeStakeholder } from '@/lib/hooks/useFranchise';
import { C, font, useFranchiseGate, GateLoading, PageHeader, Tile, Chip, SearchInput, EmptyState } from '@/components/franchise/kit';

const ROLES = ['Owner / Franchisee', 'PM / Franchisor Rep', 'Saguaro Coordinator', 'General Contractor', 'Project Superintendent', 'Architect / Engineer', 'Municipality / City', 'Material / Equipment Vendor', 'Golf Simulator (Full-Swing)', 'IT / AV', 'Signage'];
const roleColor = (r: string) => {
  const s = String(r || '').toLowerCase();
  if (s.includes('owner') || s.includes('franchis')) return C.gold;
  if (s.includes('contractor') || s.includes('superintendent')) return '#FF9500';
  if (s.includes('architect') || s.includes('engineer')) return C.blue;
  if (s.includes('full-swing') || s.includes('simulator')) return C.green;
  if (s.includes('city') || s.includes('municipal')) return '#AF52DE';
  return C.dim;
};

export default function DirectoryPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { stakeholders, loading } = useStakeholders();
  const { projects } = useProjects();
  const [site, setSite] = useState<'all' | string>('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [removed, setRemoved] = useState<Record<string, boolean>>({});

  const list = (stakeholders as any[]).filter((s) => !removed[s.id]);
  const summary = useMemo(() => ({ total: list.length, sites: new Set(list.map((s) => s.project_id)).size }), [list]);

  const filtered = list.filter((s) =>
    (site === 'all' || s.project_id === site) &&
    (!q || `${s.name || ''} ${s.company || ''} ${s.role || s.role_label || ''} ${s.email || ''}`.toLowerCase().includes(q.toLowerCase())));

  async function remove(id: string) {
    setRemoved((r) => ({ ...r, [id]: true }));
    try { await removeStakeholder(id); } catch { setRemoved((r) => { const n = { ...r }; delete n[id]; return n; }); }
  }

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1200, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader title="Stakeholder Directory" subtitle="The team behind every location — Owner, GC, Architect, City, Full-Swing, IT/AV, Signage. One roster, every site."
        right={<button onClick={() => setAdding((v) => !v)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.gold, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{adding ? 'Close' : '+ Add Stakeholder'}</button>} />

      {adding && <AddForm projects={projects} onDone={() => setAdding(false)} />}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile label="Stakeholders" value={summary.total} />
        <Tile label="Sites Covered" value={summary.sites} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <Chip active={site === 'all'} onClick={() => setSite('all')} count={list.length}>All Sites</Chip>
        {(projects as any[]).map((p) => {
          const n = list.filter((s) => s.project_id === p.id).length;
          if (!n) return null;
          return <Chip key={p.id} active={site === p.id} onClick={() => setSite(p.id)} count={n}>{p.name}</Chip>;
        })}
        <SearchInput value={q} onChange={setQ} placeholder="Search name, company, role…" />
      </div>

      {loading ? <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading…</div>
      : filtered.length === 0 ? (
        list.length === 0 ? <EmptyState icon="👥" title="No stakeholders yet" body="Build the roster for each location — every trade, vendor, and authority in one place so anyone in the org knows who to call."
          action={<button onClick={() => setAdding(true)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: C.gold, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Add your first</button>} />
        : <EmptyState title="Nothing matches" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtered.map((s) => {
            const role = s.role || s.role_label || 'Stakeholder'; const col = roleColor(role);
            return (
              <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 15px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{s.name}</div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: col, background: `${col}18`, padding: '2px 8px', borderRadius: 6, marginTop: 4 }}>{role}</span>
                  </div>
                  <button onClick={() => remove(s.id)} aria-label="remove" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {s.company && <span>🏢 {s.company}</span>}
                  {s.email && <a href={`mailto:${s.email}`} style={{ color: C.blue, textDecoration: 'none' }}>✉ {s.email}</a>}
                  {s.phone && <a href={`tel:${s.phone}`} style={{ color: C.blue, textDecoration: 'none' }}>📞 {s.phone}</a>}
                  {s.project_name && <Link href={`/app/projects/${s.project_id}`} style={{ color: C.dim, textDecoration: 'none', marginTop: 2 }}>📍 {s.project_name}</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddForm({ projects, onDone }: { projects: any[]; onDone: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ role: ROLES[0] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', background: '#16243A', width: '100%' };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, display: 'block' };

  async function submit() {
    if (!f.project_id || !f.name) { setErr('Site and name are required.'); return; }
    setBusy(true); setErr('');
    try { await addStakeholder(f); onDone(); } catch (e: any) { setErr(e?.message || 'Failed'); } finally { setBusy(false); }
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Add stakeholder</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <div><label style={lbl}>Name *</label><input style={inp} value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label style={lbl}>Site *</label><select style={inp} value={f.project_id || ''} onChange={(e) => set('project_id', e.target.value)}><option value="">Select site…</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label style={lbl}>Role</label><select style={inp} value={f.role} onChange={(e) => set('role', e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        <div><label style={lbl}>Company</label><input style={inp} value={f.company || ''} onChange={(e) => set('company', e.target.value)} /></div>
        <div><label style={lbl}>Email</label><input style={inp} value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label style={lbl}>Phone</label><input style={inp} value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
      </div>
      {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={submit} disabled={busy} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: busy ? C.dim : C.gold, color: '#fff', fontWeight: 800, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Saving…' : 'Add'}</button>
        <button onClick={onDone} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#0F172A', color: C.dim, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}
