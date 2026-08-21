import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions';

/** GET ?vertical=&q= — Materials Catalog price-comparison snapshot.
 *
 *  Returns catalog items (optionally filtered by vertical and/or a search
 *  term) with every vendor offer embedded, sorted cheapest-first, and the
 *  cheapest IN-STOCK offer flagged bestPrice. Also returns the distinct
 *  vertical list and the full vendor roster so the page can build its pill
 *  tabs and comparison columns without extra round-trips.
 *
 *  Pricing is REFERENCE data (seeded snapshots, `as_of` stamped) — live
 *  vendor API feeds connect here when accounts are linked.
 */
export async function GET(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'View');
  if (!g.ok) return g.res;
  try {
    // Catalog tables are a shared reference dataset (no tenant scoping) and
    // newer than the generated Database types — hence the `as any` idiom used
    // by other routes that touch post-typegen tables.
    const db = g.db as any;
    const vertical = req.nextUrl.searchParams.get('vertical');
    const q = (req.nextUrl.searchParams.get('q') || '').trim();

    let itemsQ = db
      .from('catalog_items')
      .select('id, vertical, category, name, description, unit, sku_hint')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (vertical) itemsQ = itemsQ.eq('vertical', vertical);
    if (q) {
      // Strip PostgREST or-filter metacharacters before interpolating.
      const safe = q.replace(/[%_,()."\\]/g, ' ').trim();
      if (safe) itemsQ = itemsQ.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`);
    }
    const { data: items, error: itemsErr } = await itemsQ;
    if (itemsErr) throw itemsErr;

    // Offers for the matched items, vendor embedded via the FK join.
    const ids = ((items as any[]) || []).map((it) => it.id);
    let priceRows: any[] = [];
    if (ids.length > 0) {
      const { data, error: priceErr } = await db
        .from('catalog_vendor_prices')
        .select('item_id, price, unit, qty_in_stock, stock_status, lead_time_days, source, as_of, catalog_vendors(name, kind)')
        .in('item_id', ids);
      if (priceErr) throw priceErr;
      priceRows = (data as any[]) || [];
    }

    // Vendor roster + distinct verticals (independent of the current filter,
    // so the tabs never collapse while searching).
    const [vendorRes, vertRes] = await Promise.all([
      db.from('catalog_vendors').select('id, name, kind, verticals, website, is_national').order('name', { ascending: true }),
      db.from('catalog_items').select('vertical'),
    ]);
    const verticals: string[] = Array.from(
      new Set((((vertRes.data as any[]) || []).map((r) => r.vertical) as string[]).filter(Boolean))
    ).sort();

    // Group offers per item. Prices can round-trip as strings — Number() first.
    const byItem = new Map<string, any[]>();
    let asOfMax: string | null = null;
    for (const r of priceRows) {
      if (r.as_of) {
        const s = String(r.as_of);
        if (!asOfMax || s > asOfMax) asOfMax = s; // ISO strings compare lexicographically
      }
      const offer = {
        vendor: r.catalog_vendors?.name || 'Unknown vendor',
        vendorKind: r.catalog_vendors?.kind || null,
        price: Number(r.price) || 0,
        unit: r.unit || null,
        stockStatus: r.stock_status || null,
        qtyInStock: r.qty_in_stock != null ? Number(r.qty_in_stock) || 0 : null,
        leadTimeDays: r.lead_time_days != null ? Number(r.lead_time_days) || 0 : null,
        source: r.source || null,
        asOf: r.as_of || null,
        bestPrice: false,
      };
      const list = byItem.get(r.item_id) || [];
      list.push(offer);
      byItem.set(r.item_id, list);
    }

    const outItems = ((items as any[]) || []).map((it) => {
      const prices = (byItem.get(it.id) || []).sort((a, b) => a.price - b.price);
      // BEST PRICE = cheapest in-stock offer; if nothing is in stock, the
      // cheapest quote still gets the flag so the page always has an anchor.
      const best = prices.find((p) => p.stockStatus === 'in_stock') || prices[0];
      if (best) best.bestPrice = true;
      return {
        id: it.id,
        vertical: it.vertical,
        category: it.category,
        name: it.name,
        description: it.description,
        unit: it.unit,
        skuHint: it.sku_hint,
        prices,
      };
    });

    return NextResponse.json({
      items: outItems,
      verticals,
      vendors: (((vendorRes.data as any[]) || [])).map((v) => ({
        id: v.id,
        name: v.name,
        kind: v.kind,
        verticals: v.verticals,
        website: v.website,
        isNational: !!v.is_national,
      })),
      asOfMax,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
