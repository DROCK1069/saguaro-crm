'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useFinancials } from '@/lib/hooks/useFranchise';
import { C, font, fmtMoney, fmtMoneyShort, useFranchiseGate, GateLoading, PageHeader, Tile, EmptyState } from '@/components/franchise/kit';

export default function FinancialsPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { financials, loading } = useFinancials();

  const totals = useMemo(() => {
    const f = financials as any[];
    return {
      retainage: f.reduce((s, x) => s + x.retainageHeld, 0),
      lienCollected: f.reduce((s, x) => s + x.lienCollected, 0),
      lienTotal: f.reduce((s, x) => s + x.lienTotal, 0),
      tiReady: f.filter((x) => x.tiReady).length,
    };
  }, [financials]);

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1100, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader title="Financials — Retainage, Liens & TI" subtitle="Every dollar accounted for: 10% retainage held, lien releases on file, and TI-reimbursement readiness per location." />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <Tile label="Retainage Held (10%)" value={fmtMoneyShort(totals.retainage)} color={C.gold} />
        <Tile label="Lien Waivers Collected" value={`${totals.lienCollected}/${totals.lienTotal}`} />
        <Tile label="Sites TI-Ready" value={totals.tiReady} color={totals.tiReady ? C.green : C.dim} />
      </div>

      {loading ? <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading…</div>
      : (financials as any[]).length === 0 ? <EmptyState icon="🧾" title="No financial data yet" body="Retainage, lien releases, and TI-reimbursement readiness roll up here as work is billed and closed out." />
      : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {(financials as any[]).map((f) => (
            <div key={f.project_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <Link href={`/app/projects/${f.project_id}`} style={{ fontSize: 15, fontWeight: 800, color: C.text, textDecoration: 'none' }}>{f.project_name}</Link>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <Metric label="Retainage Held" value={fmtMoney(f.retainageHeld)} color={C.gold} />
                <Metric label="Work in Place" value={fmtMoneyShort(f.actual)} />
                <Metric label="Lien Releases" value={`${f.lienCollected}/${f.lienTotal}`} color={f.lienTotal && f.lienCollected < f.lienTotal ? C.yellow : C.text} />
                <Metric label="TI Reimbursement" value={f.tiTotal ? `${f.tiPct}%` : '—'} color={f.tiReady ? C.green : f.tiPct > 0 ? C.yellow : C.dim} />
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>Closeout / TI package readiness</div>
                <div style={{ height: 6, borderRadius: 3, background: '#EAEAEF', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${f.tiPct}%`, background: f.tiReady ? C.green : C.gold }} />
                </div>
              </div>
              {f.tiReady && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: C.green }}>✓ TI reimbursement package ready</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return <div>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: C.faint }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 800, color: color || C.text, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>;
}
