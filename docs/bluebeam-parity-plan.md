# Bluebeam-Class Functionality — Gap Analysis & Build Plan

*Drafted 2026-08-22. Grounded in what Saguaro already ships — every phase builds
on a real, existing asset. No stubs: each phase is shippable and useful alone.*

## What Bluebeam Revu actually is (the parts GCs pay for)

1. **Markup** — text, clouds, callouts, stamps, measurements ON the PDF, saved as layers
2. **Measure** — calibrated length/area/count takeoffs on the sheet
3. **Overlay / Compare** — two drawing revisions diffed visually (the killer feature)
4. **Studio Sessions** — multiple people marking up the same set live
5. **Tool chest + statuses** — reusable markup tools; punch symbols that carry status
6. **Flatten / publish** — markups burned into issued sets

## What Saguaro already has (the honest inventory)

| Asset | Where | Bluebeam relevance |
|---|---|---|
| Multi-sheet PDF drawing viewer w/ drawing + photo markup | mobile webview viewer (field-1.3.0+), web drawings module | Markup foundation exists |
| Measured takeoff tracer w/ scale calibration | Takeoff Studio (web + iOS, shared engine) | Measure exists — *better* than Revu for pricing (it explodes to a bid) |
| Vector PDF parsing | `lib/heatmap/vector-pdf.ts` (walls + scale extraction) | The hard tech for overlay/compare already runs |
| pdf-lib generation + merge | `lib/pdf-engine.ts` (mergePDFs, saveDocument) | Flatten/publish pipeline exists |
| Document Library + versioned files | documents module, `document-versions` page | Set management exists |
| Realtime infra | Supabase realtime (Radio uses postgres_changes) | Studio-Session transport exists |
| Punch w/ photos + statuses | punch modules both surfaces | Status-carrying symbols exist |

## The plan — four phases, each independently shippable

### Phase B1 — Unified Markup Layer (2–3 waves)
One `drawing_markups` table: `{sheet_id, page, kind (cloud|arrow|text|callout|stamp|punch), geometry jsonb (normalized page coords), style, author, status, created_at}`.
- Web: SVG overlay editor on the existing drawings viewer (pan/zoom already there) — cloud, arrow, text, callout, 6 standard stamps (APPROVED / REJECTED / RFI / VERIFY / AS-BUILT / PUNCH)
- Mobile: same tools on the existing webview viewer (postMessage bridge already used for markup today — extend its vocabulary)
- Markups render from DB on every open; author + timestamp chips; per-discipline color
- **Punch-from-drawing:** the PUNCH stamp creates a real `punch_list` row linked back to sheet + coordinates — tap the punch item, it opens the sheet zoomed to the cloud. This beats Revu (their punch doesn't feed a punch-list workflow).

### Phase B2 — Measure Everywhere (1 wave)
Lift the Takeoff tracer's calibrated measure tools (length/area/count, scale from the title block or two-tap) into the drawings viewer as read-only measure — every sheet becomes measurable without opening Takeoff Studio. "Send to Takeoff" promotes measurements into priced conditions. One engine, two surfaces (anti-drift sync already governs `lib/heatmap`; same pattern).

### Phase B3 — Revision Overlay / Compare (1–2 waves) — the differentiator
- Raster diff v1: render rev A and rev B pages to canvas (pdf.js already in the stack via the viewer), tint A red / B blue, composite — the classic Bluebeam slip-sheet view, ~2 days of real work because rendering exists
- Vector assist v2: `vector-pdf.ts` extracts line work — highlight *added/removed geometry* as lists ("14 new walls on A-201"), which Revu doesn't summarize
- Wire into `document-versions`: any two versions of the same sheet → Compare button

### Phase B4 — Live Sessions (1 wave, after B1)
Supabase realtime channel per sheet: markup inserts broadcast to every open viewer (the Radio dispatch feed pattern, verbatim). Presence chips ("Chad is viewing A-201"). Guest access via the existing portal-token pattern for owner/architect review sessions — reusing the radio guest-link infra.

## What we do NOT build (honesty)
- Full PDF text editing / form authoring — out of scope, not what GCs use Revu for daily
- Offline desktop app — we are web + native mobile; the mobile viewer already caches

## Sequencing recommendation
B1 → B2 ship fast on existing viewers and create daily-use value (markup + punch-from-drawing).
B3 is the sales-demo weapon ("watch me diff two revisions"). B4 last — it needs B1's data model.
Slot after the Takeoff capstone: B2 reuses whatever the capstone improves in the tracer.
