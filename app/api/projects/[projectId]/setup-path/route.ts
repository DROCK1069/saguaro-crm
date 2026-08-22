import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any -- heatmap_designs/takeoff_line_items not yet in generated DB types */

/**
 * GET /api/projects/[projectId]/setup-path — the pre-construction path, computed
 * from REAL rows (never checkbox theater), in ONE round trip.
 *
 * Steps, in the order a GC actually sets up a project:
 *   1. scope   — projects.building_type/project_type/type/address
 *   2. takeoff — takeoffs.conditions + takeoff_line_items for the project
 *   3. signal  — heatmap_designs rows with devices placed (Signal Studio)
 *   4. bids    — bid_packages rows; when takeoff/signal outputs exist but no
 *                package, exposes the signal-to-bid handoff metadata so the UI
 *                can call the EXISTING /api/heatmap/to-bid-package engine
 *                (verified shape: POST { projectId, name?, project: HeatmapProject }
 *                 or { projectId, name?, floors: [{ name, proj }] } →
 *                 { ok, bidPackageId, budget, lineItems }; design payload comes
 *                 from GET /api/heatmap/designs/{id} → design.data, which is a
 *                 HeatmapProject or { multifloor: true, floors: [...] })
 *   5. award   — bid_packages.status === 'awarded' / awarded_amount (the award
 *                route also writes the committed-cost draft PO)
 *   6. budget  — budget_lines rows; when takeoff line items exist but the budget
 *                is empty, exposes the takeoff-to-budget handoff with the seed
 *                lines ALREADY computed server-side from takeoff_line_items
 *                (Σ quantity × (unit_material + unit_labor + unit_equipment +
 *                unit_sub) per cost code — same math as the cost-control merge;
 *                waste is already baked into quantity by the takeoff engine).
 *                Target: POST /api/projects/{projectId}/budget, one line per row
 *                ({ cost_code, division, description, category, original_budget }).
 *
 * Response: { projectId, projectName, steps: [{ key, title, done, detail, href,
 * action? }], nextKey, pctComplete }. All money Number()'d (TEXT-typed columns
 * exist) and shown as real counts + dollars in each step's detail.
 *
 * Every source is failure-tolerant: a broken sub-query empties its section
 * instead of failing the whole path.
 */

type Step = {
  key: 'scope' | 'takeoff' | 'signal' | 'bids' | 'award' | 'budget';
  title: string;
  done: boolean;
  detail: string;
  href: string;
  action?: Record<string, unknown>;
};

const N = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0);
const money = (dollars: number) => '$' + Math.round(dollars).toLocaleString('en-US');
const plural = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : (many || one + 's')}`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await requirePermission(req, 'Projects', 'View');
  if (!g.ok) return g.res;
  const user = g.user;
  const db = g.db as any;
  const t = user.tenantId;

  const safe = async <T,>(p: PromiseLike<T>): Promise<T | null> => {
    try { return await p; } catch { return null; }
  };

  const [projectQ, takeoffsQ, lineItemsQ, designsQ, packagesQ, budgetQ] = await Promise.all([
    safe(db.from('projects').select('*').eq('id', projectId).eq('tenant_id', t).single()),
    // conditions ride along only to COUNT them (limit keeps traced-geometry payloads bounded)
    safe(db.from('takeoffs').select('id, name, status, conditions, total_cost, sell_price, grand_total, created_at')
      .eq('project_id', projectId).eq('tenant_id', t).order('created_at', { ascending: false }).limit(12)),
    safe(db.from('takeoff_line_items')
      .select('takeoff_id, csi_code, category, description, quantity, unit_material_cost, unit_labor_cost, unit_equipment_cost, unit_sub_cost')
      .eq('project_id', projectId).eq('tenant_id', t).limit(500)),
    safe(db.from('heatmap_designs').select('id, name, device_count, coverage_percent, active_type, updated_at')
      .eq('project_id', projectId).eq('tenant_id', t).order('updated_at', { ascending: false }).limit(50)),
    safe(db.from('bid_packages').select('id, name, trade, status, budget_estimate, awarded_amount, awarded_to')
      .eq('project_id', projectId).eq('tenant_id', t)),
    safe(db.from('budget_lines').select('id, cost_code, division, original_budget')
      .eq('project_id', projectId).eq('tenant_id', t)),
  ]);

  const p = (projectQ as any)?.data ?? null;
  if (!p) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const takeoffs = ((takeoffsQ as any)?.data ?? []) as any[];
  const lineItems = ((lineItemsQ as any)?.data ?? []) as any[];
  const designs = ((designsQ as any)?.data ?? []) as any[];
  const packages = ((packagesQ as any)?.data ?? []) as any[];
  const budgetLines = ((budgetQ as any)?.data ?? []) as any[];

  // ── 1. scope — real project definition fields, not a flag ──
  const scopeType = p.building_type || p.project_type || p.type || null;
  const scopeDone = Boolean(scopeType || p.address);
  const scopeBits = [scopeType, p.address].filter(Boolean) as string[];

  // ── 2. takeoff — conditions on takeoffs + priced line items ──
  const conditionsTotal = takeoffs.reduce((s, tk) => s + (Array.isArray(tk.conditions) ? tk.conditions.length : 0), 0);
  const takeoffDone = conditionsTotal > 0 || lineItems.length > 0 || takeoffs.some((tk) => N(tk.total_cost) > 0);
  const latestTakeoff = takeoffs[0] ?? null;
  const latestTakeoffValue = latestTakeoff ? (N(latestTakeoff.sell_price) || N(latestTakeoff.grand_total) || N(latestTakeoff.total_cost)) : 0;
  const takeoffBits: string[] = [];
  if (takeoffs.length) takeoffBits.push(plural(takeoffs.length, 'takeoff'));
  if (conditionsTotal) takeoffBits.push(`${conditionsTotal} conditions priced`);
  else if (lineItems.length) takeoffBits.push(`${lineItems.length} line items priced`);
  if (latestTakeoffValue > 0) takeoffBits.push(money(latestTakeoffValue));

  // ── 3. signal — a saved design with devices actually placed ──
  const designsWithDevices = designs.filter((d) => N(d.device_count) > 0);
  const signalDone = designsWithDevices.length > 0;
  const bestDesign = designsWithDevices[0] ?? designs[0] ?? null;
  const signalBits: string[] = [];
  if (designs.length) signalBits.push(plural(designs.length, 'design'));
  if (bestDesign && N(bestDesign.device_count) > 0) signalBits.push(plural(N(bestDesign.device_count), 'device'));
  if (bestDesign && bestDesign.coverage_percent != null) signalBits.push(`${Math.round(N(bestDesign.coverage_percent))}% coverage`);

  // ── 4. bids — bid_packages rows; handoff metadata when upstream outputs exist ──
  const bidsDone = packages.length > 0;
  const estimatedTotal = packages.reduce((s, b) => s + N(b.budget_estimate), 0);
  const bidsBits: string[] = [];
  if (packages.length) {
    bidsBits.push(plural(packages.length, 'package'));
    if (estimatedTotal > 0) bidsBits.push(`${money(estimatedTotal)} estimated`);
  }
  let bidsAction: Record<string, unknown> | undefined;
  if (!bidsDone && signalDone && bestDesign) {
    bidsAction = {
      handoff: 'signal-to-bid',
      method: 'POST',
      endpoint: '/api/heatmap/to-bid-package',
      designId: bestDesign.id,
      designEndpoint: `/api/heatmap/designs/${bestDesign.id}`,
      // Verified against app/api/heatmap/to-bid-package/route.ts:
      bodyShape: '{ projectId, name?, project: HeatmapProject } | { projectId, name?, floors: [{ name, proj: HeatmapProject }] }',
      responseShape: '{ ok, bidPackageId, budget, lineItems }',
      note: 'GET the design first; design.data is a HeatmapProject (single floor) or { multifloor: true, floors: [{ name, proj }] } — pass it through as project/floors.',
    };
  } else if (!bidsDone && takeoffDone && latestTakeoff) {
    bidsAction = {
      handoff: 'takeoff-to-bid',
      method: 'POST',
      endpoint: '/api/bid-packages/create',
      takeoffId: latestTakeoff.id,
      // Verified against app/api/bid-packages/create/route.ts (also seeds a
      // budget_lines row from budget_estimate + csi_codes[0], idempotent):
      bodyShape: '{ project_id, name, trade?, budget_estimate?, csi_codes?, lineItems?: [{ description, quantity, unit, unitPrice, totalAmount, csiCode }] }',
      responseShape: '{ success, bidPackage }',
    };
  }

  // ── 5. award — the award route writes status/awarded_amount on bid_packages ──
  const awarded = packages.filter((b) => String(b.status || '') === 'awarded' || N(b.awarded_amount) > 0);
  const awardDone = awarded.length > 0;
  const committedTotal = awarded.reduce((s, b) => s + N(b.awarded_amount), 0);
  const awardBits: string[] = [];
  if (packages.length) awardBits.push(`${awarded.length} of ${packages.length} packages awarded`);
  if (committedTotal > 0) awardBits.push(`${money(committedTotal)} committed`);

  // ── 6. budget — budget_lines rows; seed lines computed HERE when empty ──
  const budgetDone = budgetLines.length > 0;
  const budgetOriginal = budgetLines.reduce((s, b) => s + N(b.original_budget), 0);
  const budgetBits: string[] = [];
  if (budgetLines.length) {
    budgetBits.push(plural(budgetLines.length, 'budget line'));
    if (budgetOriginal > 0) budgetBits.push(`${money(budgetOriginal)} original`);
  }
  let budgetAction: Record<string, unknown> | undefined;
  if (!budgetDone && lineItems.length > 0) {
    // Latest takeoff that actually has priced line items (newest first).
    const byTakeoff = new Map<string, any[]>();
    for (const li of lineItems) {
      const arr = byTakeoff.get(li.takeoff_id) || [];
      arr.push(li);
      byTakeoff.set(li.takeoff_id, arr);
    }
    const seedTakeoff = takeoffs.find((tk) => byTakeoff.has(tk.id)) ?? null;
    const seedItems = seedTakeoff ? (byTakeoff.get(seedTakeoff.id) as any[]) : lineItems;
    // Same math as the cost-control takeoff merge: Σ qty × (unit costs), per cost
    // code. The engine already baked waste into quantity (waste_factor_pct = 0).
    const byCode = new Map<string, { dollars: number; category: string }>();
    for (const li of seedItems) {
      const code = String(li.csi_code || li.category || 'Other');
      const perUnit = N(li.unit_material_cost) + N(li.unit_labor_cost) + N(li.unit_equipment_cost) + N(li.unit_sub_cost);
      const cur = byCode.get(code) || { dollars: 0, category: String(li.category || code) };
      cur.dollars += N(li.quantity) * perUnit;
      byCode.set(code, cur);
    }
    const seedLines = [...byCode.entries()]
      .map(([code, v]) => ({
        cost_code: code,
        division: code.slice(0, 2),
        description: v.category,
        category: 'subcontract',
        original_budget: Math.round(v.dollars * 100) / 100,
      }))
      .filter((l) => l.original_budget > 0)
      .sort((a, b) => a.cost_code.localeCompare(b.cost_code));
    if (seedLines.length) {
      budgetAction = {
        handoff: 'takeoff-to-budget',
        method: 'POST',
        endpoint: `/api/projects/${projectId}/budget`,
        // Verified against app/api/projects/[projectId]/budget/route.ts — one
        // POST per line; columns outside its allowlist are dropped server-side.
        bodyShape: '{ cost_code, division, description, category, original_budget } per line',
        takeoffId: seedTakeoff?.id ?? null,
        seedTotal: Math.round(seedLines.reduce((s, l) => s + l.original_budget, 0) * 100) / 100,
        lines: seedLines,
      };
    }
  }

  const steps: Step[] = [
    {
      key: 'scope', title: 'Define the project', done: scopeDone,
      detail: scopeDone ? scopeBits.join(' · ') : 'Add a building type or address so takeoff and design tools can size the work.',
      href: `/app/projects/${projectId}`,
    },
    {
      key: 'takeoff', title: 'Measure the plans', done: takeoffDone,
      detail: takeoffDone ? takeoffBits.join(' · ') : 'Trace conditions on the plans — the engine prices them and everything downstream reuses the numbers.',
      href: `/app/projects/${projectId}/takeoff`,
    },
    {
      key: 'signal', title: 'Design low voltage', done: signalDone,
      detail: signalDone ? signalBits.join(' · ') : (designs.length ? `${plural(designs.length, 'design')} saved, but no devices placed yet.` : 'Place devices in Signal Studio — coverage, BOM, and cabling are computed for you.'),
      href: `/app/signal-studio?projectId=${encodeURIComponent(projectId)}`,
    },
    {
      key: 'bids', title: 'Send bid packages', done: bidsDone,
      detail: bidsDone ? bidsBits.join(' · ')
        : (bidsAction ? (bidsAction.handoff === 'signal-to-bid'
            ? 'Your coverage design can become a priced low-voltage bid package in one call.'
            : 'Your takeoff numbers can seed a bid package (and its budget line) in one call.')
          : 'Create bid packages so subs can price the work.'),
      href: `/app/projects/${projectId}/bid-packages`,
      ...(bidsAction ? { action: bidsAction } : {}),
    },
    {
      key: 'award', title: 'Award subs', done: awardDone,
      detail: awardDone ? awardBits.join(' · ')
        : (packages.length ? `${plural(packages.length, 'package')} open — awarding writes the committed cost automatically.` : 'Award winning bids — each award auto-creates the committed-cost subcontract PO.'),
      href: `/app/projects/${projectId}/bid-packages`,
    },
    {
      key: 'budget', title: 'Seed the budget', done: budgetDone,
      detail: budgetDone ? budgetBits.join(' · ')
        : (budgetAction ? `Your takeoff can seed ${plural((budgetAction.lines as unknown[]).length, 'budget line')} (${money(N(budgetAction.seedTotal))}) — real engine numbers, no re-typing.` : 'Add budget lines (or run a takeoff first and seed them automatically).'),
      href: `/app/projects/${projectId}/budget`,
      ...(budgetAction ? { action: budgetAction } : {}),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const nextKey = steps.find((s) => !s.done)?.key ?? null;

  return NextResponse.json({
    projectId,
    projectName: p.name ?? null,
    steps,
    nextKey,
    pctComplete: Math.round((doneCount / steps.length) * 100),
  });
}
