'use client';
import { useMemo, useState } from 'react';
import SaguaroDatePicker from '@/components/SaguaroDatePicker';
import Link from 'next/link';
import { Package, ArrowRight } from '@phosphor-icons/react';
import { useProjects } from '@/lib/hooks/useProjects';
import { useLongLead, createLongLead, advanceLongLead } from '@/lib/hooks/useFranchise';
import { computeLongLead, lifecycleStage, LONGLEAD_LIFECYCLE, SEVERITY_ORDER, num, type Severity } from '@/lib/franchise';
import {
  C, font, fmtDate, fmtMoney, fmtDays, useFranchiseGate, GateLoading,
  PageHeader, Tile, SevDot, SevBadge, Chip, SearchInput, EmptyState, AttentionBanner, Metric, LiftCard,
} from '@/components/franchise/kit';

const SEV_LABEL: Record<Severity, string> = { red: 'Critical', yellow: 'At Risk', green: 'On Track' };

export default function LongLeadPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { items: raw, loading } = useLongLead();
  const { projects } = useProjects();
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  async function advance(it: any) {
    if (busy[it.id]) return;
    setBusy((b) => ({ ...b, [it.id]: true }));
    try { await advanceLongLead(it.id); } catch { /* noop */ } finally { setBusy((b) => ({ ...b, [it.id]: false })); }
  }

  const rows = useMemo(() => {
    const list = ((raw as any[]) || []).map((it) => ({ it, h: computeLongLead(it) }));
    // Worst-first, then by the tightest order-by date.
    list.sort((a, b) =>
      SEVERITY_ORDER[a.h.severity] - SEVERITY_ORDER[b.h.severity] ||
      (a.h.daysToOrderBy ?? 9999) - (b.h.daysToOrderBy ?? 9999));
    return list;
  }, [raw]);

  const summary = useMemo(() => {
    const s = { green: 0, yellow: 0, red: 0, value: 0, total: rows.length };
    rows.forEach(({ it, h }) => {
      s[h.severity]++;
      const cost = (num(it.unit_cost) ?? 0) * (num(it.quantity) ?? 1);
      s.value += cost;
    });
    return s;
  }, [rows]);

  const filtered = rows.filter(({ it, h }) =>
    (filter === 'all' || h.severity === filter) &&
    (!q || `${it.item_description || ''} ${it.project_name || ''} ${it.po_number || ''}`.toLowerCase().includes(q.toLowerCase())));

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1280, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader
        title="Long-Lead Tracker"
        subtitle="Every long-lead item across all sites, ordered by drop-dead order date. Protect the schedule — order the red ones now."
        right={
          <button onClick={() => setAdding((v) => !v)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.gold, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            {adding ? 'Close' : '+ Add Item'}
          </button>
        }
      />

      {adding && <AddItemForm projects={projects} onDone={() => setAdding(false)} />}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile label="Long-Lead Items" value={summary.total} />
        <Tile label="On Track" value={summary.green} color={C.green} />
        <Tile label="At Risk" value={summary.yellow} color={C.yellow} />
        <Tile label="Critical" value={summary.red} color={C.red} />
        <Tile label="Committed Value" value={fmtMoney(summary.value)} />
      </div>

      <AttentionBanner red={summary.red} yellow={summary.yellow} noun="item" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {(['all', 'red', 'yellow', 'green'] as const).map((f) => (
          <Chip key={f} active={filter === f} color={f === 'all' ? C.text : ({ red: C.red, yellow: C.yellow, green: C.green } as any)[f]}
            onClick={() => setFilter(f)} count={f === 'all' ? summary.total : (summary as any)[f]}>
            {f !== 'all' && <SevDot sev={f as Severity} size={8} />}
            {f === 'all' ? 'All' : SEV_LABEL[f as Severity]}
          </Chip>
        ))}
        <SearchInput value={q} onChange={setQ} placeholder="Search item, site, PO…" />
      </div>

      {loading ? (
        <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading procurement…</div>
      ) : filtered.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState icon={<Package size={34} color={C.dim} />} title="No long-lead items yet"
            body="Track switchgear, rooftop units, elevators, simulator bays — anything with a long lead time. The tracker computes each item's drop-dead order date and flags what to order now."
            action={<button onClick={() => setAdding(true)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: C.gold, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Add your first item</button>} />
        ) : (
          <EmptyState title="Nothing matches this filter" />
        )
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map(({ it, h }) => (
            <LiftCard key={it.id} sev={h.severity}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.item_description || 'Untitled item'}</div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                    {it.project_id ? (
                      <Link href={`/app/projects/${it.project_id}`} style={{ color: C.blue, textDecoration: 'none' }}>{it.project_name || 'Project'}</Link>
                    ) : 'Unassigned'}
                    {it.project_city ? ` · ${it.project_city}, ${it.project_state}` : ''}
                  </div>
                </div>
                <SevBadge sev={h.severity} label={h.label} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 13 }}>
                <Metric label="Order By" value={fmtDate(h.orderByDate)} color={h.daysToOrderBy != null && h.daysToOrderBy <= 0 ? C.red : h.daysToOrderBy != null && h.daysToOrderBy <= 14 ? C.yellow : C.text} />
                <Metric label="Need On Site" value={fmtDate(it.needed_by_date)} />
                <Metric label="Lead Time" value={it.lead_time_days != null ? `${it.lead_time_days}d` : '—'} />
                <Metric label="ETA" value={fmtDate(h.eta)} />
                <Metric label="Qty" value={it.quantity != null ? `${num(it.quantity)}${it.unit ? ' ' + it.unit : ''}` : '—'} />
                <Metric label="Status" value={it.status || '—'} />
              </div>

              {/* 6-stage procurement lifecycle: Ordered → Released → Manufactured → Shipped → Delivered → Installed */}
              {(() => {
                const lc = lifecycleStage(it.status);
                const isLast = lc.index >= LONGLEAD_LIFECYCLE.length - 1;
                const fill = lc.index >= 5 ? C.green : C.gold;
                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.dim }}>{lc.label} · stage {lc.index + 1}/6</span>
                      {!isLast && (
                        <button onClick={() => advance(it)} disabled={busy[it.id]} style={{ fontSize: 11, fontWeight: 700, color: busy[it.id] ? C.dim : C.blue, background: 'none', border: 'none', cursor: busy[it.id] ? 'default' : 'pointer' }}>Advance <ArrowRight size={12} weight="regular" color={busy[it.id] ? C.dim : C.blue} style={{ verticalAlign: 'middle' }} /></button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {LONGLEAD_LIFECYCLE.map((s, i) => (
                        <div key={i} title={s} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= lc.index ? fill : '#1c1c1e' }} />
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12, alignItems: 'center' }}>
                {it.po_number && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#1c1c1e', color: C.dim }}>PO {it.po_number}</span>}
                {it.unit_cost != null && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#1c1c1e', color: C.dim }}>{fmtMoney((num(it.unit_cost) ?? 0) * (num(it.quantity) ?? 1))}</span>}
                {h.daysToOrderBy != null && h.severity !== 'green' && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.dim, marginLeft: 'auto' }}>Order {fmtDays(h.daysToOrderBy)}</span>
                )}
              </div>
            </LiftCard>
          ))}
        </div>
      )}
    </div>
  );
}

function AddItemForm({ projects, onDone }: { projects: any[]; onDone: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ status: 'pending', is_long_lead: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', background: '#1c1c1e', width: '100%' };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, display: 'block' };

  async function submit() {
    if (!f.project_id || !f.item_description) { setErr('Site and item description are required.'); return; }
    setBusy(true); setErr('');
    try { await createLongLead(f); onDone(); }
    catch (e: any) { setErr(e?.message || 'Failed to save'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Add long-lead item</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl}>Item description *</label>
          <input style={inp} placeholder="e.g. 2000A switchgear, Trackman sim bays" value={f.item_description || ''} onChange={(e) => set('item_description', e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Site *</label>
          <select style={inp} value={f.project_id || ''} onChange={(e) => set('project_id', e.target.value)}>
            <option value="">Select site…</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Vendor / PO #</label><input style={inp} value={f.po_number || ''} onChange={(e) => set('po_number', e.target.value)} /></div>
        <div><label style={lbl}>Needed on site</label><SaguaroDatePicker style={inp} value={f.needed_by_date || ''} onChange={(v) => set('needed_by_date', v)} /></div>
        <div><label style={lbl}>Lead time (days)</label><input type="number" style={inp} value={f.lead_time_days || ''} onChange={(e) => set('lead_time_days', e.target.value)} /></div>
        <div><label style={lbl}>Expected delivery</label><SaguaroDatePicker style={inp} value={f.expected_delivery_date || ''} onChange={(v) => set('expected_delivery_date', v)} /></div>
        <div><label style={lbl}>Qty</label><input type="number" style={inp} value={f.quantity || ''} onChange={(e) => set('quantity', e.target.value)} /></div>
        <div><label style={lbl}>Unit</label><input style={inp} placeholder="ea / lot" value={f.unit || ''} onChange={(e) => set('unit', e.target.value)} /></div>
        <div><label style={lbl}>Unit cost</label><input type="number" style={inp} value={f.unit_cost || ''} onChange={(e) => set('unit_cost', e.target.value)} /></div>
        <div>
          <label style={lbl}>Status</label>
          <select style={inp} value={f.status || 'pending'} onChange={(e) => set('status', e.target.value)}>
            {['pending', 'quoted', 'ordered', 'in production', 'shipped', 'delivered'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={submit} disabled={busy} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: busy ? C.dim : C.gold, color: '#fff', fontWeight: 800, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Saving…' : 'Save item'}</button>
        <button onClick={onDone} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#141416', color: C.dim, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}
