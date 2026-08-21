'use client';
/**
 * Materials Catalog — cross-vendor price + stock comparison per vertical.
 *
 * The GC walks in and immediately sees what the system knows: how many items
 * are priced, which vendors quote them, how much picking the best offer saves,
 * and how fresh the snapshot is. Pricing is HONESTLY labeled as reference
 * data — live vendor API feeds connect here when accounts are linked.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Storefront,
  MagnifyingGlass,
  Stack,
  Percent,
  CalendarBlank,
  Truck,
} from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, StatStrip, PremiumEmpty } from '@/components/ui/premium';

const GOLD = '#F59E0B', DARK = '#0a0a0a', BORDER = 'rgba(255,255,255,0.12)', DIM = '#CBD5E1', TEXT = '#FFFFFF', GREEN = '#3dd68c', AMBER = '#FBBF24', RED = '#c03030';

const fmtMoney = (n: number) => '$' + ((Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = String(d).includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

interface Offer {
  vendor: string;
  vendorKind: string | null;
  price: number;
  unit: string | null;
  stockStatus: string | null;
  qtyInStock: number | null;
  leadTimeDays: number | null;
  asOf: string | null;
  bestPrice: boolean;
}
interface CatalogItem {
  id: string;
  vertical: string;
  category: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  skuHint: string | null;
  prices: Offer[];
}
interface CatalogData {
  items: CatalogItem[];
  verticals: string[];
  vendors: { id: string; name: string; kind: string | null; isNational: boolean }[];
  asOfMax: string | null;
}

const INP: React.CSSProperties = { padding: '9px 12px 9px 34px', background: DARK, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, outline: 'none', width: 260, boxSizing: 'border-box' };
const TH: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: DIM, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap', background: DARK };

/** Stock badge — in stock green / limited amber / order dim. */
function StockBadge({ status }: { status: string | null }) {
  const s = String(status || '').toLowerCase();
  const [label, color, bg] =
    s === 'in_stock' ? ['In stock', GREEN, 'rgba(34,197,94,0.12)'] :
    s === 'limited' ? ['Limited', AMBER, 'rgba(245,158,11,0.14)'] :
    s ? ['Order', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.06)'] :
    ['—', 'rgba(255,255,255,0.35)', 'transparent'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 999, background: bg, color, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.04, whiteSpace: 'nowrap' }}>{label}</span>
  );
}

export default function CatalogPage() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vertical, setVertical] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/catalog');
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        setData(d);
      } catch {
        setError('Could not load the materials catalog. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allItems = data?.items || [];

  // Vertical scope (search-independent, so the stats describe the shelf, not the query)
  const scoped = useMemo(
    () => (vertical === 'all' ? allItems : allItems.filter((it) => it.vertical === vertical)),
    [allItems, vertical]
  );

  // Search on top of the vertical scope
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return scoped;
    return scoped.filter((it) =>
      [it.name, it.description, it.category, it.skuHint].some((f) => (f || '').toLowerCase().includes(needle))
    );
  }, [scoped, q]);

  // Vendor comparison columns — roster order, only vendors quoting in view
  const vendorCols = useMemo(() => {
    const present = new Set<string>();
    for (const it of filtered) for (const p of it.prices) present.add(p.vendor);
    const ordered = (data?.vendors || []).map((v) => v.name).filter((n) => present.has(n));
    for (const n of Array.from(present)) if (!ordered.includes(n)) ordered.push(n);
    return ordered;
  }, [filtered, data]);

  // Shelf intelligence for the StatStrip
  const stats = useMemo(() => {
    const vendorsQuoting = new Set<string>();
    let priced = 0, spreadSum = 0, spreadN = 0;
    for (const it of scoped) {
      if (it.prices.length > 0) priced++;
      for (const p of it.prices) vendorsQuoting.add(p.vendor);
      if (it.prices.length >= 2) {
        const lo = Number(it.prices[0].price) || 0; // API pre-sorts price asc
        const hi = Number(it.prices[it.prices.length - 1].price) || 0;
        if (hi > 0) { spreadSum += ((hi - lo) / hi) * 100; spreadN++; }
      }
    }
    return {
      items: scoped.length,
      vendors: vendorsQuoting.size,
      coverage: scoped.length > 0 ? Math.round((priced / scoped.length) * 100) : 0,
      avgSavings: spreadN > 0 ? Math.round(spreadSum / spreadN) : 0,
    };
  }, [scoped]);

  const nationalCount = (data?.vendors || []).filter((v) => v.isNational).length;
  const verticalCount = (data?.verticals || []).length;

  return (
    <PremiumSurface maxWidth={1600}>
      <ModuleHero
        eyebrow="Pre-Construction"
        eyebrowIcon={<Storefront size={13} weight="fill" color={GOLD} />}
        title="Materials"
        accent="Catalog"
        subtitle="Compare big-box, wholesale, and supply-house pricing per vertical — cheapest in-stock offer flagged on every item."
        actions={
          <div style={{ position: 'relative' }}>
            <MagnifyingGlass size={15} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items, categories, SKUs…"
              style={INP}
            />
          </div>
        }
      />

      {error && (
        <div style={{ background: 'rgba(192,48,48,.12)', border: '1px solid rgba(192,48,48,.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: RED, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Vertical pill tabs */}
      {(data?.verticals || []).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 5, border: '1px solid rgba(255,255,255,0.08)', width: 'fit-content', maxWidth: '100%' }}>
          {['all', ...(data?.verticals || [])].map((v) => {
            const active = vertical === v;
            const count = v === 'all' ? allItems.length : allItems.filter((it) => it.vertical === v).length;
            return (
              <button
                key={v}
                onClick={() => setVertical(v)}
                className="pmBtn"
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap',
                  background: active ? `linear-gradient(135deg,${GOLD},#FBBF24)` : 'transparent',
                  color: active ? '#1A1206' : DIM, transition: 'all .15s',
                }}
              >
                {v === 'all' ? 'All Verticals' : titleCase(v)}
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 900, opacity: active ? 0.75 : 0.55 }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* What the system knows about this shelf */}
      {data && (
        <StatStrip items={[
          { label: 'Items Priced', value: String(stats.items), sub: vertical === 'all' ? `across ${verticalCount} vertical${verticalCount === 1 ? '' : 's'}` : `in ${titleCase(vertical)}`, icon: <Package size={11} color={GOLD} /> },
          { label: 'Vendors Quoting', value: String(stats.vendors), sub: nationalCount > 0 ? `${nationalCount} national chain${nationalCount === 1 ? '' : 's'} on file` : 'regional + wholesale', icon: <Storefront size={11} color={GOLD} /> },
          { label: 'Verticals', value: String(verticalCount), sub: 'trade shelves tracked', icon: <Stack size={11} color={GOLD} /> },
          { label: 'Price Coverage', value: `${stats.coverage}%`, accent: stats.coverage >= 80 ? GREEN : undefined, sub: 'items with at least one quote', icon: <Percent size={11} color={GOLD} /> },
          { label: 'Best-Price Savings', value: `${stats.avgSavings}%`, accent: stats.avgSavings > 0 ? GREEN : undefined, sub: 'avg best vs highest quote', icon: <Percent size={11} color={GOLD} /> },
          { label: 'Priced As Of', value: fmtDate(data.asOfMax), sub: 'reference snapshot', icon: <CalendarBlank size={11} color={GOLD} /> },
        ]} />
      )}

      <SectionCard
        title={vertical === 'all' ? 'Price Comparison — All Verticals' : `Price Comparison — ${titleCase(vertical)}`}
        subtitle={`Reference pricing · as of ${fmtDate(data?.asOfMax)} · vendor API feeds connect here when accounts are linked`}
        icon={<Package size={17} weight="duotone" color={GOLD} />}
        flush
      >
        {loading ? (
          <div style={{ padding: 20 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="pmSkeleton" style={{ height: 40, borderRadius: 9, background: 'rgba(255,255,255,0.05)', marginBottom: 10, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PremiumEmpty
            icon={<Package size={34} weight="duotone" color={GOLD} />}
            title={q.trim() ? 'No items match your search' : 'Nothing on this shelf yet'}
            description={q.trim()
              ? `No catalog items match "${q.trim()}"${vertical === 'all' ? '' : ` in ${titleCase(vertical)}`}. Try a broader term or another vertical.`
              : `The ${vertical === 'all' ? 'catalog' : titleCase(vertical) + ' vertical'} has no priced items yet — seeded reference pricing lands here, and vendor API feeds connect when accounts are linked.`}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12, minWidth: 640 + vendorCols.length * 130 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, minWidth: 220 }}>Item</th>
                  <th style={{ ...TH, minWidth: 60 }}>Unit</th>
                  <th style={{ ...TH, minWidth: 150 }}>Best Offer</th>
                  {vendorCols.map((v) => (
                    <th key={v} style={{ ...TH, minWidth: 130, textAlign: 'right' as const }}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((it, idx) => {
                  const best = it.prices.find((p) => p.bestPrice);
                  const byVendor = new Map<string, Offer>();
                  for (const p of it.prices) if (!byVendor.has(p.vendor)) byVendor.set(p.vendor, p); // cheapest per vendor (pre-sorted asc)
                  const prevCat = idx > 0 ? filtered[idx - 1].category : null;
                  const showCat = (it.category || '') !== (prevCat || '') || idx === 0;
                  return (
                    <React.Fragment key={it.id}>
                      {showCat && it.category && (
                        <tr>
                          <td colSpan={3 + vendorCols.length} style={{ padding: '10px 12px 5px', fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' as const, letterSpacing: 0.9, borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
                            {titleCase(it.category)}
                          </td>
                        </tr>
                      )}
                      <tr
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '9px 12px', minWidth: 220 }}>
                          <div style={{ fontWeight: 700, color: TEXT, fontSize: 12.5, lineHeight: 1.3 }}>{it.name}</div>
                          {(it.description || it.skuHint) && (
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, lineHeight: 1.4 }}>
                              {it.description}{it.description && it.skuHint ? ' · ' : ''}{it.skuHint ? `SKU ${it.skuHint}` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', color: DIM, whiteSpace: 'nowrap' as const }}>{it.unit || '—'}</td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' as const }}>
                          {best ? (
                            <div>
                              <span style={{ fontWeight: 800, color: GOLD, fontSize: 13.5 }}>{fmtMoney(best.price)}</span>
                              <span style={{ fontSize: 10.5, color: DIM, marginLeft: 6 }}>{best.vendor}</span>
                              <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <StockBadge status={best.stockStatus} />
                                {best.leadTimeDays != null && best.leadTimeDays > 0 && (
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Truck size={10} color="rgba(255,255,255,0.45)" />{best.leadTimeDays}d lead
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>No quotes yet</span>
                          )}
                        </td>
                        {vendorCols.map((v) => {
                          const o = byVendor.get(v);
                          if (!o) return <td key={v} style={{ padding: '9px 12px', textAlign: 'right' as const, color: 'rgba(255,255,255,0.25)' }}>—</td>;
                          const isBest = !!o.bestPrice;
                          return (
                            <td key={v} style={{ padding: '6px 8px', textAlign: 'right' as const, verticalAlign: 'top' }}>
                              <div style={{
                                display: 'inline-block', textAlign: 'right', padding: '4px 8px', borderRadius: 8,
                                background: isBest ? 'rgba(245,158,11,0.12)' : 'transparent',
                                border: isBest ? '1px solid rgba(245,158,11,0.45)' : '1px solid transparent',
                              }}>
                                <div style={{ fontWeight: isBest ? 800 : 600, color: isBest ? '#FBBF24' : TEXT, fontSize: 12.5, whiteSpace: 'nowrap' as const }}>
                                  {fmtMoney(o.price)}
                                  {isBest && <span style={{ marginLeft: 5, fontSize: 8.5, fontWeight: 900, letterSpacing: 0.06, color: '#FBBF24' }}>BEST</span>}
                                </div>
                                <div style={{ marginTop: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 5 }}>
                                  <StockBadge status={o.stockStatus} />
                                  {o.leadTimeDays != null && o.leadTimeDays > 0 && (
                                    <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' as const }}>{o.leadTimeDays}d</span>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
