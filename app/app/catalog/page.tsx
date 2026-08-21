'use client';
/**
 * Materials Catalog — cross-vendor price + stock comparison per vertical,
 * with a Procore-style ordering flow: search + logical sort, select products
 * with quantities, pick a project, and issue vendor-grouped purchase orders
 * in one action (each PO commits into the CSI budget automatically).
 *
 * Pricing is HONESTLY labeled as reference data — live vendor API feeds
 * connect here when accounts are linked.
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
  Plus,
  Minus,
  ShoppingCartSimple,
  CheckCircle,
  X,
} from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, StatStrip, PremiumEmpty, goldButtonStyle, ghostButtonStyle } from '@/components/ui/premium';

const GOLD = '#F59E0B', DARK = '#0a0a0a', BORDER = 'rgba(255,255,255,0.12)', DIM = '#CBD5E1', TEXT = '#FFFFFF', GREEN = '#3dd68c', AMBER = '#FBBF24', RED = '#c03030';

const fmtMoney = (n: number) => '$' + ((Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = String(d).includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

/** Vertical -> CSI cost code, so catalog POs commit into the right budget line. */
const VERTICAL_COST_CODE: Record<string, string> = {
  'Low Voltage & Networking': '27 00 00', 'Electrical': '26 00 00', 'Plumbing': '22 00 00',
  'HVAC': '23 00 00', 'Flooring & Carpet': '09 00 00', 'Drywall': '09 00 00', 'Paint': '09 00 00',
  'Framing & Lumber': '06 00 00', 'Concrete': '03 00 00', 'Roofing': '07 00 00',
  'Doors & Windows': '08 00 00', 'Insulation': '07 00 00',
};

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

type SortMode = 'name' | 'price' | 'category';

const INP: React.CSSProperties = { padding: '9px 12px 9px 34px', background: DARK, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 13, outline: 'none', width: 260, boxSizing: 'border-box' };
const SEL: React.CSSProperties = { padding: '8px 10px', background: DARK, border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, fontSize: 12.5, outline: 'none', cursor: 'pointer' };
const TH: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: DIM, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap', background: DARK };

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
  const [sort, setSort] = useState<SortMode>('name');

  // ── Order cart: item id -> qty. The visible, Procore-style add flow. ──
  const [cart, setCart] = useState<Record<string, number>>({});
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<{ pos: number; total: number } | null>(null);
  const [placeErr, setPlaceErr] = useState('');

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
    (async () => {
      try {
        const r = await fetch('/api/projects/list');
        const d = await r.json();
        const list = (d.projects || []).map((p: any) => ({ id: p.id, name: p.name || 'Untitled' }));
        setProjects(list);
        if (list.length === 1) setProjectId(list[0].id);
      } catch {}
    })();
  }, []);

  const allItems = data?.items || [];
  const verticalsSorted = useMemo(() => [...(data?.verticals || [])].sort((a, b) => a.localeCompare(b)), [data]);

  const scoped = useMemo(
    () => (vertical === 'all' ? allItems : allItems.filter((it) => it.vertical === vertical)),
    [allItems, vertical]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = !needle ? [...scoped] : scoped.filter((it) =>
      [it.name, it.description, it.category, it.skuHint, ...it.prices.map((p) => p.vendor)]
        .some((f) => (f || '').toLowerCase().includes(needle))
    );
    const best = (it: CatalogItem) => Number(it.prices.find((p) => p.bestPrice)?.price ?? it.prices[0]?.price) || Infinity;
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'price') list.sort((a, b) => best(a) - best(b));
    else list.sort((a, b) => (a.category || 'zz').localeCompare(b.category || 'zz') || a.name.localeCompare(b.name));
    return list;
  }, [scoped, q, sort]);

  const vendorCols = useMemo(() => {
    const present = new Set<string>();
    for (const it of filtered) for (const p of it.prices) present.add(p.vendor);
    return Array.from(present).sort((a, b) => a.localeCompare(b));
  }, [filtered]);

  const stats = useMemo(() => {
    const vendorsQuoting = new Set<string>();
    let priced = 0, spreadSum = 0, spreadN = 0;
    for (const it of scoped) {
      if (it.prices.length > 0) priced++;
      for (const p of it.prices) vendorsQuoting.add(p.vendor);
      if (it.prices.length >= 2) {
        const lo = Number(it.prices[0].price) || 0;
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

  // ── Cart derivations ──
  const itemById = useMemo(() => new Map(allItems.map((it) => [it.id, it])), [allItems]);
  const cartLines = useMemo(() => Object.entries(cart)
    .map(([id, qty]) => ({ item: itemById.get(id), qty }))
    .filter((l): l is { item: CatalogItem; qty: number } => !!l.item && l.qty > 0), [cart, itemById]);
  const cartTotal = cartLines.reduce((s, l) => {
    const best = l.item.prices.find((p) => p.bestPrice) || l.item.prices[0];
    return s + (Number(best?.price) || 0) * l.qty;
  }, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);

  const setQty = (id: string, qty: number) => {
    setPlaced(null); setPlaceErr('');
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id]; else next[id] = qty;
      return next;
    });
  };

  /** Issue vendor-grouped POs from the cart — each at the item's best offer. */
  async function placeOrders() {
    if (!projectId || cartLines.length === 0) return;
    setPlacing(true); setPlaceErr('');
    try {
      const byVendor = new Map<string, { line: typeof cartLines[number]; offer: Offer }[]>();
      for (const l of cartLines) {
        const offer = l.item.prices.find((p) => p.bestPrice) || l.item.prices[0];
        if (!offer) continue;
        const arr = byVendor.get(offer.vendor) || [];
        arr.push({ line: l, offer });
        byVendor.set(offer.vendor, arr);
      }
      let made = 0, grand = 0;
      for (const [vendor, rows] of Array.from(byVendor.entries())) {
        const line_items = rows.map(({ line, offer }) => ({
          description: line.item.name + (line.item.skuHint ? ` (SKU ${line.item.skuHint})` : ''),
          quantity: line.qty,
          unit: line.item.unit || offer.unit || 'EA',
          unit_price: Number(offer.price) || 0,
          total: (Number(offer.price) || 0) * line.qty,
        }));
        const subtotal = line_items.reduce((s, li) => s + li.total, 0);
        const costCounts = new Map<string, number>();
        for (const { line } of rows) {
          const cc = VERTICAL_COST_CODE[line.item.vertical] || '';
          if (cc) costCounts.set(cc, (costCounts.get(cc) || 0) + 1);
        }
        const cost_code = Array.from(costCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        const r = await fetch('/api/purchase-orders/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId, vendor_name: vendor, status: 'draft',
            description: `Materials Catalog order — ${rows.length} item${rows.length === 1 ? '' : 's'} at best reference pricing`,
            line_items, subtotal, total: subtotal, cost_code,
            notes: `Created from the Materials Catalog (reference pricing as of ${fmtDate(data?.asOfMax)}).`,
          }),
        });
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        made++; grand += subtotal;
      }
      setPlaced({ pos: made, total: grand });
      setCart({});
    } catch (e: any) {
      setPlaceErr(e?.message || 'Could not create the purchase orders. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  const nationalCount = (data?.vendors || []).filter((v) => v.isNational).length;
  const verticalCount = verticalsSorted.length;

  return (
    <PremiumSurface maxWidth={1600}>
      <style>{`
        .catAdd:active{transform:translateY(1px)!important;filter:brightness(.94)!important;box-shadow:0 1px 4px rgba(245,158,11,0.18),inset 0 1px 0 rgba(255,255,255,0.22)!important}
        .catPill:active{transform:translateY(1px)!important;filter:brightness(.94)!important}
        .catStep:hover{transform:none!important;filter:none!important;background:rgba(245,158,11,0.20)!important}
        .catStep:active{background:rgba(245,158,11,0.28)!important}
        @media (prefers-reduced-motion: reduce){.catAdd:active,.catPill:active{transform:none!important}}
      `}</style>
      <ModuleHero
        eyebrow="Pre-Construction"
        eyebrowIcon={<Storefront size={13} weight="fill" color={GOLD} />}
        title="Materials"
        accent="Catalog"
        subtitle="Compare big-box, wholesale, and supply-house pricing — select products and issue vendor-grouped purchase orders in one flow."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <MagnifyingGlass size={15} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items, SKUs, vendors…" style={INP} />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} style={SEL} className="pmBtn">
              <option value="name">Sort: Name A–Z</option>
              <option value="price">Sort: Best Price</option>
              <option value="category">Sort: Category</option>
            </select>
          </div>
        }
      />

      {error && (
        <div style={{ background: 'rgba(192,48,48,.12)', border: '1px solid rgba(192,48,48,.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: RED, fontSize: 13 }}>
          {error}
        </div>
      )}

      {placed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <CheckCircle size={18} weight="fill" color={GREEN} />
          <span style={{ color: GREEN, fontSize: 13, fontWeight: 700 }}>
            {placed.pos} purchase order{placed.pos === 1 ? '' : 's'} drafted for {fmtMoney(placed.total)} — committed into the project budget.
          </span>
          <a href={`/app/projects/${projectId}/purchase-orders`} style={{ ...ghostButtonStyle, padding: '6px 12px', fontSize: 12 }} className="pmBtn">View POs</a>
        </div>
      )}

      {/* Vertical pill tabs — alphabetical */}
      {verticalsSorted.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 5, border: '1px solid rgba(255,255,255,0.08)', width: 'fit-content', maxWidth: '100%' }}>
          {['all', ...verticalsSorted].map((v) => {
            const active = vertical === v;
            const count = v === 'all' ? allItems.length : allItems.filter((it) => it.vertical === v).length;
            return (
              <button
                key={v}
                onClick={() => setVertical(v)}
                className="pmBtn catPill"
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap',
                  background: active ? `linear-gradient(180deg,#FBBF24,${GOLD} 60%,#D97706)` : 'transparent',
                  color: active ? '#1A1206' : DIM, transition: 'all .15s',
                  boxShadow: active ? '0 2px 10px rgba(245,158,11,0.28), inset 0 1px 0 rgba(255,255,255,0.35)' : 'none',
                }}
              >
                {v === 'all' ? 'All Verticals' : titleCase(v)}
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 900, opacity: active ? 0.75 : 0.55 }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {data && (
        <StatStrip items={[
          { label: 'Items Priced', value: String(stats.items), sub: vertical === 'all' ? `across ${verticalCount} vertical${verticalCount === 1 ? '' : 's'}` : `in ${titleCase(vertical)}`, icon: <Package size={11} color={GOLD} /> },
          { label: 'Vendors Quoting', value: String(stats.vendors), sub: nationalCount > 0 ? `${nationalCount} national chain${nationalCount === 1 ? '' : 's'} on file` : 'regional + wholesale', icon: <Storefront size={11} color={GOLD} /> },
          { label: 'Price Coverage', value: `${stats.coverage}%`, accent: stats.coverage >= 80 ? GREEN : undefined, sub: 'items with at least one quote', icon: <Percent size={11} color={GOLD} /> },
          { label: 'Best-Price Savings', value: `${stats.avgSavings}%`, accent: stats.avgSavings > 0 ? GREEN : undefined, sub: 'avg best vs highest quote', icon: <Percent size={11} color={GOLD} /> },
          { label: 'In Your Order', value: String(cartCount), accent: cartCount > 0 ? GOLD : undefined, sub: cartCount > 0 ? `${fmtMoney(cartTotal)} at best pricing` : 'select products below', icon: <ShoppingCartSimple size={11} color={GOLD} /> },
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
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12, minWidth: 780 + vendorCols.length * 130 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, minWidth: 132 }}>Add to Order</th>
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
                  for (const p of it.prices) if (!byVendor.has(p.vendor)) byVendor.set(p.vendor, p);
                  const prevCat = idx > 0 ? filtered[idx - 1].category : null;
                  const showCat = sort === 'category' && ((it.category || '') !== (prevCat || '') || idx === 0);
                  const qty = cart[it.id] || 0;
                  return (
                    <React.Fragment key={it.id}>
                      {showCat && it.category && (
                        <tr>
                          <td colSpan={4 + vendorCols.length} style={{ padding: '10px 12px 5px', fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' as const, letterSpacing: 1.5, borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
                            {titleCase(it.category)}
                          </td>
                        </tr>
                      )}
                      <tr
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: qty > 0 ? 'rgba(245,158,11,0.05)' : 'transparent' }}
                        onMouseEnter={(e) => { if (!qty) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={(e) => { if (!qty) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' as const }}>
                          {qty === 0 ? (
                            <button
                              onClick={() => setQty(it.id, 1)}
                              disabled={it.prices.length === 0}
                              className="pmBtn catAdd"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px',
                                background: it.prices.length ? `linear-gradient(180deg,#FBBF24,${GOLD} 60%,#D97706)` : 'rgba(255,255,255,0.06)',
                                border: 'none', borderRadius: 8, color: it.prices.length ? '#1A1206' : 'rgba(255,255,255,0.3)',
                                fontSize: 11.5, fontWeight: 900, cursor: it.prices.length ? 'pointer' : 'not-allowed',
                                boxShadow: it.prices.length ? '0 2px 8px rgba(245,158,11,0.22), inset 0 1px 0 rgba(255,255,255,0.35)' : 'none',
                              }}
                            >
                              <Plus size={12} weight="bold" /> Add
                            </button>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0, border: `1px solid rgba(245,158,11,0.35)`, borderRadius: 8, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(245,158,11,0.10), rgba(245,158,11,0.04))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 12px rgba(245,158,11,0.10)' }}>
                              <button onClick={() => setQty(it.id, qty - 1)} className="pmBtn catStep" style={{ padding: '5px 9px', background: 'rgba(245,158,11,0.12)', border: 'none', boxShadow: 'inset -1px 0 0 rgba(245,158,11,0.25)', color: AMBER, cursor: 'pointer' }}><Minus size={11} weight="bold" /></button>
                              <input
                                value={qty}
                                onChange={(e) => setQty(it.id, Math.max(0, parseInt(e.target.value) || 0))}
                                style={{ width: 42, textAlign: 'center', background: 'transparent', border: 'none', color: AMBER, fontWeight: 800, fontSize: 12.5, outline: 'none', fontVariantNumeric: 'tabular-nums' }}
                              />
                              <button onClick={() => setQty(it.id, qty + 1)} className="pmBtn catStep" style={{ padding: '5px 9px', background: 'rgba(245,158,11,0.12)', border: 'none', boxShadow: 'inset 1px 0 0 rgba(245,158,11,0.25)', color: AMBER, cursor: 'pointer' }}><Plus size={11} weight="bold" /></button>
                            </div>
                          )}
                        </td>
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
                              <span style={{ fontWeight: 800, color: GOLD, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(best.price)}</span>
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
                                background: isBest ? 'linear-gradient(160deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06))' : 'transparent',
                                border: isBest ? '1px solid rgba(245,158,11,0.45)' : '1px solid transparent',
                                boxShadow: isBest ? '0 0 14px rgba(245,158,11,0.14), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                              }}>
                                <div style={{ fontWeight: isBest ? 800 : 600, color: isBest ? '#FBBF24' : TEXT, fontSize: 12.5, whiteSpace: 'nowrap' as const, fontVariantNumeric: 'tabular-nums' }}>
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

      {/* ── Sticky order bar — appears the moment anything is selected ── */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 5000,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0) 46%), rgba(12,12,13,0.97)',
          borderTop: `1px solid rgba(245,158,11,0.4)`,
          boxShadow: '0 -8px 32px rgba(245,158,11,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          animation: 'pmRise .2s cubic-bezier(.2,.7,.3,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingCartSimple size={20} weight="fill" color={GOLD} />
            <div>
              <div style={{ fontWeight: 800, color: TEXT, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>{cartCount} item{cartCount === 1 ? '' : 's'} · {fmtMoney(cartTotal)}</div>
              <div style={{ fontSize: 11, color: DIM }}>Best offer per item · POs grouped by vendor · commits to the CSI budget</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ ...SEL, minWidth: 220 }} className="pmBtn">
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={placeOrders}
            disabled={!projectId || placing}
            className="pmBtn"
            style={{ ...goldButtonStyle, opacity: !projectId || placing ? 0.55 : 1, cursor: !projectId || placing ? 'not-allowed' : 'pointer' }}
          >
            {placing ? 'Creating POs…' : `Create Purchase Order${cartLines.length > 1 ? 's' : ''}`}
          </button>
          <button onClick={() => { setCart({}); setPlaceErr(''); }} className="pmBtn" style={{ ...ghostButtonStyle, padding: '9px 12px' }} title="Clear selection">
            <X size={14} weight="bold" />
          </button>
          {placeErr && <div style={{ width: '100%', color: RED, fontSize: 12 }}>{placeErr}</div>}
        </div>
      )}
    </PremiumSurface>
  );
}
