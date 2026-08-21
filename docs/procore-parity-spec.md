# THE ROUND-2 GAP SPEC — Procore Parity & Beyond

**Goal of this wave:** GCs who have used Procore say Saguaro is EASIER, FASTER, and SMOOTHER — not "almost as good."
**Repos:** web = `D:/saguaro-web` (Next.js App Router + SWR 2.4 installed) · mobile = `D:/Saguaro-Field` (Expo + react-query with AsyncStorage persistence + SQLite offline queue).
**Sources:** four independent audits (Procore playbook, web speed, mobile speed, flows/wayfinding), merged and deduped. All file:line references verified read-only against both repos.

**The three root causes this spec kills:**
1. **Web:** zero client-side caching on ~109 raw-fetch pages (SWR is installed and proven in `lib/hooks/useProjects.ts` + `useDashboard`, used by only ~21 files) + the write-then-`await load()` full-refetch mutation pattern. Server latency is fine (API routes are internally `Promise.all`'d); the sin is client refetch frequency and serialization.
2. **Mobile:** the durable SQLite offline queue exists (`lib/sync/*`) but **nothing writes optimistically into the react-query cache** — all 261 `invalidateQueries` calls race the fire-and-forget `drain()`, so saves never look instant online and are invisible offline.
3. **Both:** no single module anatomy — two web design systems, 29 of 40 web list pages with no search/filter toolbar, inconsistent create entry points, and bare "empty box + lone button" zero states.

---

## 1. THE STANDARD MODULE ANATOMY (the law every page follows)

Every module screen on both platforms follows ONE skeleton. Learn one module, know all of them. A new module must be usable by someone who has only seen a different module. No module may invent its own list header, detail layout, or create affordance.

### 1.1 List screen (web)

Top-to-bottom, always in this order:

1. **Module hero strip** — eyebrow + title (premium.tsx `ModuleHero`), breadcrumb `Project > Tool`.
2. **Stat cards** (module KPIs) — each independently skeleton-loaded.
3. **ListToolbar** (new shared primitive in `premium.tsx`): keyword **Search** input · **Add Filter** dropdown that stacks removable filter chips inline (applied instantly, no "Apply" button, no full-screen filter modal; multiple filters AND together; live result count; one-tap "Clear all") · **Group By** select · sort select · **Export/Reports** menu · the gold **+ Create** button pinned top-right. Column visibility/pin/order behind a vertical-ellipsis (⋮) menu on every table.
4. **Content** — table/grid with total count in the header ("Showing 1–150 of 763"), server pagination + infinite scroll.

Filter state **persists per user per module** (local storage/profile) and is restored on return. Named saved filter sets ("My Open RFIs") become view tabs.

### 1.2 List screen (mobile)

1. `ScreenHeader` (already consistent app-wide) with titled back ("← Punch List").
2. Search + filter chips row (same chip semantics as web).
3. Virtualized `FlatList` (never `ScrollView + .map`), header content in `ListHeaderComponent`, memoized rows.
4. **Create = bottom-right FAB**, plus the global quick-create sheet reachable from the tab bar listing the 5-6 core record types (Punch, Daily Log, Photo, RFI, Time, Delivery). Never put create behind an overflow menu.

### 1.3 Record detail (both platforms) — `RecordDetail` template

Header: **record number + title**, colored **status pill** (Draft grey / Open / Closed), **ball-in-court owner**, key dates. Body sections in fixed order: **Fields → Discussion/activity thread → Attachments → Related Items → Change History** (immutable audit log on every record type). Edit is one pencil action that flips the same layout into edit mode — fields stay in identical positions, nothing jumps. Prev/next arrows walk the currently filtered list. Back restores list state (filters, sort, scroll offset) from cache — never refetch-and-reset.

### 1.4 Record numbering

Every record auto-assigns a **per-project sequential number at creation (drafts included)**: RFI #047, Punch #233, Pay App #012. The number is the first token in every list row, detail title, notification subject, and PDF export. Global search matches bare numbers.

### 1.5 Related Items (flagship linking)

One polymorphic `related_items` join (`record_a`, `record_b`, `link_context` e.g. drawing x/y pin), written once, rendered on **both** records automatically. Every record detail has a Related Items section with an "Add link" search-by-number-or-title picker. Drawing pins: tap a pin on the plan → the record; open the record → the pinned plan location.

### 1.6 Forms (both platforms)

- **≤3 required fields** per create form (enough to save a useful draft), marked with asterisk; required/optional/hidden per-field admin-configurable per project (fieldset config) — rigor is a company choice, not a UX tax.
- **Smart defaults, three layers:** (1) context — creating from a drawing/photo/record pre-fills location + related links; (2) recency — last-used location/trade/company/cost-code per user; (3) configuration — due-date offsets (RFI due = today + configured days), default distribution, trade→sub assignee maps. A field with a computable default never opens empty. "Created by" is never asked.
- **Validation on blur**, error text under the offending field, submit scrolls to first error, user input is NEVER lost on failed save (including network failure — retain form state, offer retry).
- **Two commit actions** on every high-volume form: "Save" (returns to list) and "Save & New" (clears per-item fields, keeps sticky context: location, trade, assignee, date). Mobile capture flows loop automatically.
- **Draft is a first-class status:** grey pill in lists, no notifications until explicitly submitted/issued, in-progress form state auto-serialized to local storage on app background/kill and restored.
- **One shared Picker** for people/companies/locations/cost codes: typeahead, recents-first per user, name+company subtitle, multi-select chips, sourced from the project directory. Any `SelectField` with >12 options gets a search input (mobile `pickers.tsx:238-256` currently has none).

### 1.7 Navigation law

- **Project is sticky context, not a parameter.** Persist selected project (server profile + local cache); app opens into last project's home; one switcher control in the header, recents-first, typeahead, ≤2 taps to switch. No screen re-asks for the project.
- **Flat tool switcher**, grouped one level deep, pinnable favorites on top, any tool ≤2 clicks from anywhere. Mobile project home = grid of tools with badge counts (open items assigned to me).
- **Every notification (email/push) deep-links to the exact record** with project context auto-set, cold-start included. Never land on a dashboard and re-navigate.

---

## 2. SPEED CONTRACT

### 2.1 The rules (non-negotiable)

1. **No blank first paint anywhere.** A screen the user has visited before paints data from cache in **<100ms**; a first-ever visit paints a **skeleton shaped like the real rows** (same row height, same column blocks — number/title/pill positions) in <100ms. Full-screen spinners and "Loading…" text gates are banned. Buttons show their own inline spinner + disabled state while in flight.
2. **Stale-while-revalidate everywhere.** Render cached data immediately with a subtle refresh indicator, reconcile in background. The blank-skeleton state appears only on the first-ever visit.
3. **Optimistic saves.** Create/edit/toggle commits to local state first (temp/client ID), closes the form immediately, inserts/patches the row optimistically with a per-row sync glyph (pending → synced → error-with-retry-tap), rollback + toast on failure. Never `await` a full-list refetch before updating the UI.
4. **Caching mechanism — web:** shared SWR hooks with one key per resource (`useProjects()`, new `useProjectContext(projectId)` with `dedupingInterval` ~30s + `keepPreviousData`). Raw `fetch` in `useEffect` is banned for any data SWR can key.
5. **Caching mechanism — mobile:** react-query + `PersistQueryClientProvider` (already configured: 5-min staleTime, 24h gcTime, AsyncStorage) is mandatory for all reads; the **write path goes through `lib/sync/mutations.ts` which write-through-updates the query cache** (`setQueriesData` keyed on table name using the existing client UUID) and `syncEngine` invalidates the table's keys after `markDone`/`markConflict` so server truth reconciles. Offline: writes go to the SQLite queue always — network success is a sync detail, not a save precondition; queued rows render in lists with a "waiting to sync" pill; persistent offline banner with queued-changes count; "Download project for offline" (drawings, open punch/RFI lists, directory).
6. **Independent panels.** Any panel needing >500ms gets its own skeleton and loads independently — one slow widget never blocks the screen. Drawings/PDF: tiled progressive rendering (low-res first, sharpen in place).
7. **No API route ships without appropriate `Cache-Control`** (currently zero routes send any).

### 2.2 Prioritized fix list — WEB (D:/saguaro-web)

**P0 — the compounding wins**

| # | Fix | Evidence (file:line) |
|---|-----|----------------------|
| W-1 | Project open is blank-frame + extra hop: `[projectId]/page.tsx` renders `null` then client-redirects in `useEffect`; project cards link to the stub. Link cards (and dashboard/command-palette entries) straight to `/app/projects/{id}/overview`; convert the stub to a server component `redirect()`. | `app/app/projects/[projectId]/page.tsx:8-11`; `app/app/projects/page.tsx:173` |
| W-2 | Project entry request storm (5 requests, 2 exact duplicates): sidebar layout fetches the full 10-table `/api/projects/{id}` aggregate for name/number/%; overview fetches it again + `/api/project-context` (14 queries); GettingStartedRail refetches list AND context sequentially. One SWR key per resource; Rail takes ctx as prop or shares the key. | `app/app/projects/[projectId]/layout.tsx:128-142`; `overview/page.tsx:38,67`; `components/GettingStartedRail.tsx:44-60`; `app/api/projects/[projectId]/route.ts:24-34` |
| W-3 | **46 files** raw-fetch `/api/project-context` (14-query aggregate) in `useEffect` with zero caching — every module hop re-pays it. Build `lib/hooks/useProjectContext.ts` (`useSWR`, dedupingInterval ~30s, keepPreviousData); 46 mechanical replacements. | e.g. `budget/page.tsx:69`, `pay-apps/page.tsx:94`, `rfis/page.tsx:94`, `schedule/page.tsx:211`, `punch-list/page.tsx:85`, `bid-packages/page.tsx:440`; `app/api/project-context/route.ts:32`; no Cache-Control on the route |
| W-4 | **25 files** bypass the existing `useProjects()` SWR hook with raw fetch — projects page shows skeletons on EVERY visit though the dashboard just filled the cache. Swap all to `useProjects()`. | `app/app/projects/page.tsx:49-62` vs `lib/hooks/useProjects.ts:23-36`; `catalog/page.tsx:123`; `components/ProjectSwitcher.tsx:80`; `components/GettingStartedRail.tsx:44`; +21 more |
| W-5 | Punch checkbox: `toggleComplete` does PUT then `await load()` before the checkbox flips — two round-trips of dead air on the most-tapped field control. Optimistic `setItems()` flip with rollback (copy the house pattern at `budget/page.tsx:158-176`); same for save/delete; skeleton rows instead of "Loading punch list…". | `punch-list/page.tsx:157-167` (toggle), `:152`, `:179` (save/delete), `:290` (text loading) |
| W-6 | Schedule mutations: save/delete/% complete each `await load()` full-refetch before the panel closes — multi-second interaction. Close panel + patch `tasks` optimistically; kill or un-await the post-write refetch. | `schedule/page.tsx:287` (save), `:299` (delete), `:314` (updatePct) |
| W-7 | Daily logs: `await load(); closePanel()` makes Save hang; text loading. Close immediately, optimistic insert, background revalidate, skeleton rows. | `daily-logs/page.tsx:167`, `:180`, `:282` |
| W-8 | Pay-app detail (G702) + bid-package detail are full-blank until fetch resolves; pay-app detail runs THREE serial awaited fetches (context → pay-apps list → lien waivers). `Promise.all` the enrichment; render SOV table shell + skeleton rows immediately; seed header fields from the pay-apps list SWR cache. | `pay-apps/[id]/page.tsx:100-118` (3 serial awaits), `:263-268` (blank gate); `bid-packages/[id]/page.tsx:239-242` (blank gate) |

**P1**

| # | Fix | Evidence |
|---|-----|----------|
| W-9 | App shell waterfall: `await fetch('/api/auth/refresh')` completes before `me` + projects even start, on every hard load. Fire all three concurrently (refresh only gates the 401 redirect; retry once on 401); cache `me` + project names in sessionStorage. | `app/app/layout.tsx:83` then `:94-97` |
| W-10 | Pay-apps list: text loading under real StatCards; mount fetches ctx THEN waivers serially; bulk approve is a serial awaited PATCH loop, non-optimistic. SkeletonRow ×5 (house pattern `rfis/page.tsx:448-455`); `Promise.all` mounts; optimistic status flips + `Promise.allSettled`. | `pay-apps/page.tsx:326-330`, `:91-111`, `:133-144` |
| W-11 | Bid packages list: text loading, then N+1 stampede — up to 20 parallel `/api/bid-packages/{id}` fetches to compute invited/responded/low per row; cards navigate via `onClick router.push` (no prefetch). Return aggregates from the list endpoint (one grouped query), delete `enrichDetail`, skeleton rows, wrap cards in `<Link>`. | `bid-packages/page.tsx:578-580`, `:447-473`, `:610` |
| W-12 | Skeleton sweep — blank-area/spinner gates on money + high-traffic pages: invoices "Loading...", cash-flow full-page spinner, plus intelligence, estimate-builder, invoicing/[id], daily-logs/[id], schedule/[id], sub-portal, and all 8 network/* pages. Adopt Skeleton/SkeletonRow as the default; detail pages render shell + header from the list-page cache. | `invoices/page.tsx:393`; `cash-flow/page.tsx:142-148`; `app/app/intelligence/page.tsx:223-228`; grep: pages with `if(loading)` and no Skeleton import |
| W-13 | ProjectSwitcher modal fetches `/api/projects/list` fresh on EVERY open. Use `useProjects()`. | `components/ProjectSwitcher.tsx:74-88` |
| W-14 | Bid intelligence: blank "Loading projects..." gate; each project selection re-fetches the 10-table aggregate uncached. `useProjects()` for the list; SWR-key per-project metrics; skeleton scorecards. | `app/app/intelligence/page.tsx:79`, `:107`, `:223-228`, `:311` |
| W-15 | RFIs mutations: create/answer/status-change all `await load()` — answer submission visibly stalls. Optimistic `setRfis` patch + background revalidate. (The page's SkeletonKPI + SkeletonRow loading treatment is the pattern to copy elsewhere.) | `rfis/page.tsx:180`, `:204`, `:236` |

**P2**

| # | Fix | Evidence |
|---|-----|----------|
| W-16 | Takeoff first paint: module-top-level `import * as XLSX from 'xlsx'` (~400KB) in the route's initial chunk though first use is inside a file-input handler; PlanTracer (1,162 lines) statically imported. Dynamic-import both (pdfjs is already lazy at `PlanTracer.tsx:430` — pattern proven). | `app/app/takeoff/measured/page.tsx:18` (first use `:511`) |
| W-17 | Hot-path prefetch: notifications deep links set `prefetch={false}` ×4 (lien-waivers/RFIs/bid-packages — exactly where an alerted user goes next); card grids navigate via `onClick router.push` on divs, skipping viewport prefetch. Drop `prefetch={false}`; wrap cards in `<Link>`. | `app/app/notifications/page.tsx:266-286`; `bid-packages/page.tsx:610`; `intelligence/command-center/page.tsx:364`; `app/app/bids/page.tsx:446` |
| W-18 | Takeoff hub: sequential dependent fetch (list awaited, then newest takeoff's full detail). `?include=latestDetail` on the list endpoint (or `/api/takeoff/latest-with-detail`); render hub shell meanwhile. | `takeoff/page.tsx:263` then `:273` |

### 2.3 Prioritized fix list — MOBILE (D:/Saguaro-Field)

**P0 — critical (the single highest-leverage change in this spec)**

| # | Fix | Evidence |
|---|-----|----------|
| M-1 | **Zero optimistic cache updates app-wide** (0 matches for onMutate/placeholderData/initialData). Every mutation: `mutate()` → enqueue → fire-and-forget `drain()`; the screen's immediate `invalidateQueries` refetch RACES the drain and SELECTs before the INSERT commits — just-saved records don't appear even online; offline they're invisible until reconnect + manual refresh; `syncEngine` never touches the query cache. Fix centrally: `mutate()` write-through via `queryClient.setQueriesData({predicate: q => q.queryKey[0] === input.table})` inserting/patching the row (client UUID already exists as stable key — promised in the comment at `mutations.ts:22-24`); `syncEngine` invalidates the table's keys after `markDone`/`markConflict`. Screens drop their racing `invalidateQueries`. **Upgrades all ~77 mutating screens at once.** | `lib/sync/mutations.ts:55-57`; `lib/sync/syncEngine.ts:69-120`; `app/punch.tsx:687` |
| M-2 | Time clock: Clock In enqueues two mutations then refetches; the giant header (`clockedIn` derived only from server rows) stays "Clocked out" until a racing refetch — offline it NEVER flips; foreman can't tell if they're on the clock. Clock-out, crew loop, manual entry same. Optimistically write the `time_entries` row into `['time_entries', employeeId]` cache. | `app/time.tsx:425-449` (clockIn), `:451-481` (clockOut), `:762` (status from entriesQ only), `:607-641` (crew loop) |
| M-3 | Photo capture: rows queue with `url` set later by the upload; grid shows NOTHING until upload + later refetch (offline: nothing until reconnect). Optimistically insert a grid cell rendering the local `asset.uri` (`{id: clientId, url: localUri, _pending: true}`); swap to storage URL when the queue item completes. | `app/photos.tsx:502-535`; `app/punch.tsx:801-840` (quick capture) |
| M-4 | Punch add/edit + one-tap Mark done/Verify don't update the card until the racing refetch; todo checkbox doesn't check on tap; `archiveRecord` toasts "archived" while the card stays (used by ~30 screens via RowMenu); daily-log save closes the form but the log is absent. All covered by M-1's central fix; archive additionally: `setQueryData` filtering the id out (restore = re-insert) — 3-line win covering every module. | `app/punch.tsx:645-694`, `:701-756`; `app/daily.tsx:613-641`; `app/todos.tsx:302-317`; `lib/archive.ts:23-41` |
| M-5 | Offline saves never LOOK instant despite the queue: banner says "3 pending" while punch list/daily list/photo grid/time entries show none of the three records; queue visible only on a drill-down screen. With M-1, tag cache rows `_pending:true` and render a "waiting to sync" pill until syncEngine confirms. | `lib/sync/syncEngine.ts:69-120`; `components/ui.tsx:257+` (aggregate-only banner); `app/sync-queue.tsx` |

**P1**

| # | Fix | Evidence |
|---|-----|----------|
| M-6 | bid-intelligence: only screen (with cost-catalog) not on react-query — useState/useEffect + direct supabase, spinner every visit, blank offline, even though the same data is cached under `['overview','win-rate']` / `['overview','trade-win-factors']`. Convert to shared useQuery hooks with the same keys. | `app/bid-intelligence.tsx:33-55`, `:78-79`; `app/(tabs)/overview.tsx:278-297` |
| M-7 | Cache-key fragmentation: Command Center fetches the identical four datasets Overview just fetched under `'command-center'` vs `'overview'` prefixes — loading states + network for cached data. Extract shared hooks, one canonical key per dataset (or derive from `['project-context']`). | `app/command-center.tsx:95-175`, `:186` vs `app/(tabs)/overview.tsx:136-297` |
| M-8 | cost-catalog: useState/useEffect + authedFetch, spinner every visit, nothing offline, full rate book as `ScrollView + list.map` (100+ Cards mounted); every edit re-fetches all. `useQuery(['cost-rates'])` + FlatList. | `app/cost-catalog.tsx:21-29`, `:53-77` (Loading gate `:59`) |

**P2**

| # | Fix | Evidence |
|---|-----|----------|
| M-9 | Non-virtualized stragglers (70+ screens do it right): people maps whole roster (search re-renders every card per keystroke); fleet recomputes `assetHealth(asset, allRecords, allDocs)` per row per render; time mounts up to 60 entry cards in ScrollView; forms maps template groups + submissions. FlatList + memoized rows + `useMemo` health Map. | `app/people.tsx:82-105`; `app/fleet.tsx:84-109`; `app/time.tsx:754`, `:874`; `app/forms.tsx:674-740` |
| M-10 | Image pipeline: per-mount signUrl round-trip per thumbnail; in-memory-only signed-URL cache (re-signs everything each cold start); token in query string defeats OS HTTP cache (grid re-downloads every launch); RN core `<Image>` everywhere, expo-image unused. Adopt expo-image `cachePolicy:'disk'` keyed on storage path (recyclingKey = bucket/path, not token); persist sign cache to AsyncStorage; batch-sign visible rows in the query layer. | `app/punch.tsx:307-314`; `lib/storage-signing.ts:8-9`; zero expo-image/FastImage matches |
| M-11 | Typing jank: punch create/edit form + SmartCreate strip live in `ListHeaderComponent` with inline `renderItem` closure — every Title keystroke re-renders all visible cards (normalizePhotos + chip tallies re-run per key). Same shape on daily + several cc-* screens; exact class fixed in takeoff commit `9ff3220`. BottomSheet the form or `React.memo` rows + `useCallback` renderItem + `useMemo([items])` tallies. | `app/punch.tsx:1163-1207`, `:1062`, `:917-978` |
| M-12 | Redundant queries + key churn: daily/photos run standalone project-name queries for data already in `['project-context']`; punch/daily linked-photo-count keys embed `items.map(id).join(',')` — key churns on any list change, guaranteed refetch waterfall. Read name from context; key counts by `[projectId]`. | `app/daily.tsx:170-182`; `app/photos.tsx:300-301`; `app/punch.tsx:448`; `app/daily.tsx:284` |
| M-13 | Cold start: splash held up to 3.5s by `checkForUpdateAsync` even when no update exists; projectId hydrates async after first render so modules can flash "No project selected". 800ms update budget then open + background fetch/apply-on-next-foreground (listener exists); fold PROJECT_KEY read into the existing `ready` gate. | `app/_layout.tsx:58-75`, `:94`; `components/AppProvider.tsx:54`; `app/punch.tsx:502-509` |
| M-14 | cc-kpis: full-screen `<Loading/>` while the 11-table aggregate loads (cold path only — key + persistence make revisits instant). Chrome + skeleton tiles; consider splitting the aggregate so cached slices paint first. | `app/cc-kpis.tsx:123-135`, `:278-285` |

---

## 3. TAP-ECONOMY TARGETS (per core job)

Counting rules: taps/clicks from app open (mobile opens on Home tab per `app/(tabs)/_layout.tsx:19`) or module open (web). Typing excluded; iOS "Use Photo" confirm = 1; SelectField/DateField (mobile) = 2 taps (open + pick); native `<select>` (web) = 1.

### 3.1 Mobile (D:/Saguaro-Field)

| Job | Current | Target | Exact steps to remove |
|-----|---------|--------|----------------------|
| **Clock in/out with cost code** | **Impossible in-flow**; ~10 taps via after-the-fact edit (clock in 1 + clock out 1 + reopen /time 2 + find/tap entry 1 + division 2 + cost code 2 + Save 1) — crews never do the second half; labor goes unallocated | **3** | `clockIn()`/`clockOut()` write no `cost_code_id` (`app/time.tsx:425-449`, `:451-481`; home-hub also code-less `app/(tabs)/index.tsx:377-414`); pickers exist only in the manual/edit BottomSheet (`time.tsx:948-960`). Put an optional cost-code chip row (or SelectField defaulting to last-used per employee+project) on the clock-in card in both time.tsx and the Field-hub Time card; or prompt once at clock-out. Kills the entire second session. |
| **Punch item w/ trade+assignee+photo** | ~9 taps + 2 scrolls | **6** | (a) Home quick action opens bare list → route to `/punch?new=1` or straight to Quick Capture (removes the header-'+' tap; `app/(tabs)/overview.tsx:87-92`, `punch.tsx:1629`); (b) SmartCreate StatStrip + Recent-items push Title below fold → collapse to one dismissible line (`punch.tsx:1174-1207`); (c) FlowSteps block between Photos and Save forces a scroll → move below Save or behind disclosure (`punch.tsx:1361-1372`, Save `:1375`); (d) 48-option CSI trade picker has no type-ahead → add search when options>12 (`punch.tsx:1260-1266`; `pickers.tsx:238-256`). Keep: trade→assignee auto-suggest (`punch.tsx:594-603`) and +7d due default — 0 taps when right. |
| **Raise an RFI (actually submitted)** | ~6-7 taps (create writes `status:'draft'`; submitting requires reopening the row + "Submit RFI"; drafts silently left unsent) | **3-4** | Primary button becomes "Create & submit" (assignee already defaulted to architect), "Save draft" secondary (`rfis.tsx:400` draft-on-create; `:969-980` + `:1280` submitDraft only in detail; `:858` send flow); support `/rfis?new=1` (only `?focus=` parsed at `:284`; home routes bare `/rfis` at `overview.tsx:94`). |
| **Capture a photo** | 4 taps (quick action → shutter → Use Photo → Save) | **3** | The compose BottomSheet is mandatory though all 6 fields are optional, category defaults, and single uncaptioned captures already get AI auto-tagged (`photos.tsx:442-452` startCompose always opens sheet; `:1468-1626` the sheet; `:534` pendingAutoTagRef). Single camera capture: save immediately on "Use Photo" with toast + "Add details" action; keep the sheet for library multi-select batches. Auto-camera on `?capture=1` already good (`:380-408`; `overview.tsx:91`). |
| **Today's daily log** | ~2 taps + typing — already beats Procore (`overview.tsx:90` `/daily?new=1`; `daily.tsx:309-353` auto-open + prefill) | keep 2 | (a) "Auto weather" is a manual tap → fire `autoWeather()` best-effort inside `openCreate`, never block on GPS (`daily.tsx:1074-1084`); (b) Save and Submit separate → "Save & submit" primary when PM approver resolved (approverQ already on screen; `:1293-1295`). |
| **Timecard, whole crew** (build per Procore playbook) | per-person forms | handful of taps | Saved crews, bulk-apply hours + cost code, per-person exception editing, defaults from previous submission, "copy yesterday." Crew loop exists (`time.tsx:607-641`) — build the bulk UX on top. |
| **Field RFI from drawing** (build) | n/a | capture-only | Drawing pin/camera → Question (dictation-friendly) + auto-linked context → Draft into the RFI manager's queue. Full routing is a web/office step. Never show the field user a 15-field form. |

### 3.2 Web (D:/saguaro-web)

| Job | Current | Target | Exact steps to remove |
|-----|---------|--------|----------------------|
| **Create a bid package** | 5-6 clicks (forced 4-step wizard: Create → Next → Next → Next → Create, even when skipping line items and accepting pre-checked suggested subs) | **3** | Collapse to 2 steps: "Scope & Subs" (trade, scope, due, suggested subs inline) with line items behind an "Add line items" disclosure; Create available from step 1 once trade set; review step → inline summary above the button (`bid-packages/page.tsx:98-417` WizardModal, STEPS=4 footer-gated `:402-412`, step list `:207`; keep pre-checked subs `:134-135` + the +14d due default). |
| **Create a pay app** | 3 clicks (already parity: SOV roll-forward + auto period/contract/retainage) | **2** | On roll-forward with all AUTO flags set, every Step-1 field is prefilled yet the wizard lands on Step 1 → open directly on Step 2 with the period in a click-to-edit banner (`pay-apps/new/page.tsx:61-96` auto+roll-forward, `:208-215` tabs, `:291-293` Next, `:396-408` Save/Submit on step 2 only). |
| **Add a budget line** | ~4 clicks (at target) but the just-opened form can be off-viewport | 4, visible | Hero "Add Line" renders the form BELOW the 7-tile KPI grid, no scroll-into-view (laptop heights hide it) — `budget/page.tsx:314` toggle, `:381-393` KPI grid first, `:396` form after, contrast `:126` seedFromPackage's `window.scrollTo`. Scroll into view on open (or render under the hero); surface "Seed from bid package" in the table header when unseeded packages remain. |
| **Log a bill** | 2 clicks (at target: vendor autocomplete, due +30d, optional cost-code) | keep 2 | Fix the wayfinding twin instead — see §5. |
| **Add a schedule task** | 2 clicks (at target: name-only required, predecessor auto-sets start) | 2, no pickers | `openCreate` seeds an EMPTY form — no default start/duration, so a dated task still costs 2 date-picker interactions (`schedule/page.tsx:218` `{...EMPTY}`, `:232-263` SmartCreate only after manual input, `:265-266` name-only validation). Default start = max(task ends)+1 else today, duration 5d with AutoChips — dated task becomes name+save. |

---

## 4. DEAD-SPACE KILL LIST

Rule: no empty state is a box with a one-liner and (at best) a lone button. Every empty state states what the module automates, seeds from existing data where possible, and embeds the composer/create action inline. House pattern to copy: pay-apps, budget, lien-waivers, messages, team, compliance, files, insurance, invoices, daily-logs, drawings, specs, inspections, estimate (already enriched).

### 4.1 Web — bare `PremiumEmpty` sites (D:/saguaro-web/app/app/projects/[projectId])

| Page | Evidence | Replacement |
|------|----------|-------------|
| Schedule ("No tasks yet") | `schedule/page.tsx:443-447` | Seed tasks from bid-package trades + inline first-task composer with defaulted dates (§3.2) |
| Selections | `selections/page.tsx:300-304` | Explain the approval flow + inline add form |
| Change orders | `change-orders/page.tsx:489-493` | Seed from budget variances / contract; inline CO composer |
| Bills | `bills/page.tsx:404-408` | Inline bill form (it's already 2 clicks — embed it) + AR/AP cross-link banner (§5) |
| Contracts | `contracts/page.tsx:410-414` | **Seed from awarded bid packages** + inline composer |
| Subs | `subs/page.tsx:319-323` | Seed from directory/bid invitees; inline invite |
| Timesheets | `timesheets/page.tsx:310-314` | **Seed from the team roster**; crew-based first entry |
| Submittals | `submittals/page.tsx:346-350` | Seed submittal register from spec sections; inline composer |
| Network/devices | `network/devices/page.tsx:373-377` | Inline add-device + what the module automates |
| Network/firewall | `network/firewall/page.tsx:309-315` | Same pattern |
| Network/reports | `network/reports/page.tsx:277-280` | Same pattern |
| **Safety corrective-actions — NO action at all** | `safety/page.tsx:730` | Give it its obvious "Add corrective action" button + inline composer |
| **Bid-package detail "No subs invited yet" — NO action** (text tells user to use "Invite More" elsewhere) | `bid-packages/[id]/page.tsx:486-489` | Embed the Invite control right in the empty state |

### 4.2 Mobile — zero states missing the Add affordance (D:/Saguaro-Field)

One-line fixes using the existing `Empty` action slot (pattern: `daily.tsx:1377-1380`, `rfis.tsx:470-473`):

| Screen | Evidence | Fix |
|--------|----------|-----|
| Photos "No photos yet" | `app/photos.tsx:1344-1346` | `action={<Btn title='Take photo' onPress={takePhoto}/>}` |
| Punch "Tap the + button…" (instructs a hunt instead of rendering the button) | `app/punch.tsx:1615-1617` | `action` = "Add punch item" → `openCreate` |
| Deliveries "No deliveries yet" | `app/deliveries.tsx:291-293` | `action` = "Log delivery" |

---

## 5. WAYFINDING FIXES (nonconforming pages)

1. **Two design systems on web.** Budget + Project Overview are built on `cinematic.tsx` (CinematicPage/HeroButton/EmptyStatePremium/CIN tokens) while ~38 other project pages use `premium.tsx` (PremiumSurface/ModuleHero/PremiumEmpty/goldButtonStyle) — the feel changes on the two most-visited pages. `premium.tsx` is canonical: port budget + overview (`budget/page.tsx:12-14`, 7-9 Cinematic usages) or wrap CIN as an alias theme. **Takeoff uses neither** — no ModuleHero at all (`takeoff/page.tsx`, full-custom canvas header): give it at least the standard eyebrow/title strip above the canvas.
2. **Missing toolbar on 29 of 40 web list pages.** Only ~11 pages have any search affordance (daily-logs, drawings, files, photos, punch-list, schedule, selections, specs, submittals). The **entire FINANCIAL group** — pay-apps, client invoices, bills, change-orders, purchase-orders, contracts, lien-waivers, payroll, w9 — plus **rfis** (a direct Procore regression), todos, timesheets, inspections, insurance, team, subs, messages have no search box and no status-filter toolbar (grep verified: `setSearch`/`placeholder="Search"` = 0 on 29 pages incl. rfis/, pay-apps/, invoices/, bills/, change-orders/ — only client-side `.filter()` computations, no UI input). Build the shared **ListToolbar** primitive (§1.1) in `premium.tsx` and drop it above every table/grid, wired to the existing client-side arrays — no API changes needed.
3. **Project sidebar scale.** 45+ links in 9 always-expanded sections on every project, incl. a 9-item LOW VOLTAGE/IT section irrelevant to most GC jobs; FIELD and COMMUNICATION sit ~25 rows deep below the laptop fold; only whole-sidebar collapse exists (`layout.tsx:18-110` NAV_SECTIONS, flat-mapped `:174-218`). Collapsible sections with remembered state, hide Network unless the project has network scope (or behind "More"), type-to-filter box at the top.
4. **AR/AP twin trap.** "Client Invoices" and "Bills" sit adjacent in the FINANCIAL sidebar (`layout.tsx:44-45`) with near-identical forms, both using `vendor_name` (`invoices/page.tsx:11-23` = the OWNER/bill-to; `bills/page.tsx:12-24` = the supplier) — a sub's invoice logged into Client Invoices corrupts AR KPIs silently. Rename in-form language ("Bill To (owner)" vs "Vendor"), add cross-link banners on each page ("Billing the owner? → Client Invoices" / "Received a supplier invoice? → Bills"), consider one "Invoicing" page with AR/AP tabs.
5. **Inconsistent mobile home quick actions.** Of 5 quick actions only Daily log (`?new=1`) and Photo (`?capture=1`) deep-link into create; Punch, Time, RFI land on bare lists — identical buttons, different powers, 1-2 silent extra taps (`app/(tabs)/overview.tsx:87-94`; `punch.tsx:432` and `rfis.tsx:284` parse only `?focus`; time.tsx parses no params). The Field tab's cards are MORE capable (one-tap Clock in/out, `(tabs)/index.tsx:537-547`) than home for the same jobs. Support `?new=1` on punch + rfis (mirror `daily.tsx:309-312`); make the home Time quick action a live clock toggle like the Field-hub card.
6. **Project-open dead hop** (also W-1): the `[projectId]` stub page paints blank then client-redirects — every stale deep link and every project card pays it (`app/app/projects/[projectId]/page.tsx:8-11`; `projects/page.tsx:173`). Server-side `redirect()`.
7. **Breadcrumbs + list-state back (law, §1.7):** detail pages get `Project > Tool > Record #` breadcrumbs on web, titled back on mobile; back restores filters/sort/scroll from cache; prev/next arrows walk the filtered list.

---

## WAVE PLAN — suggested agent grouping for the build wave

Order matters: infra agents (W1-W3, M1) land first — most downstream agents consume their hooks/patterns. Everything else can run in parallel. Each agent's scope is sized for one focused session; every file:line above is its work order.

### Web (14 agents, D:/saguaro-web)

| Agent | Scope |
|-------|-------|
| **W1 — useProjectContext infra** | Create `lib/hooks/useProjectContext.ts` (SWR, dedupingInterval 30s, keepPreviousData); mechanically replace all 46 raw-fetch call sites (W-3). Add Cache-Control to `/api/project-context`. |
| **W2 — useProjects adoption** | Swap all 25 raw `/api/projects/list` fetches to `useProjects()` (W-4), including ProjectSwitcher (W-13) and GettingStartedRail. |
| **W3 — project open path + shell** | Server-redirect the `[projectId]` stub, link cards/dashboard/palette straight to `/overview` (W-1); dedupe the entry request storm via shared SWR keys / light header (W-2); parallelize app-shell auth init + sessionStorage cache (W-9). |
| **W4 — optimistic mutations A** | Punch-list toggle/save/delete (W-5) + schedule save/delete/pct (W-6), copying the `budget/page.tsx:158-176` pattern; skeleton rows on both. |
| **W5 — optimistic mutations B** | Daily-logs save/delete (W-7); RFIs create/answer/status (W-15); pay-apps bulk approve → optimistic + `Promise.allSettled` (W-10). |
| **W6 — skeleton sweep** | Replace every text/spinner gate with layout-true Skeleton/SkeletonRow (house pattern `rfis/page.tsx:448-455`): pay-apps list, invoices, cash-flow, intelligence, estimate-builder, invoicing/[id], daily-logs/[id], schedule/[id], sub-portal, network/* (W-10, W-12, W-14). Ban full-screen spinners repo-wide. |
| **W7 — money detail shells** | Pay-app [id]: `Promise.all` the 3 serial fetches, SOV shell + skeletons, seed header from list cache; bid-package [id] shell (W-8). |
| **W8 — bid packages module** | List aggregates from the API (kill the 20-request N+1), skeleton rows, `<Link>` cards (W-11); collapse the wizard 4→2 steps (§3.2). |
| **W9 — ListToolbar primitive + FINANCIAL rollout** | Build ListToolbar in `premium.tsx` (search + filter chips + group-by + sort + ⋮ column menu per §1.1); roll out to pay-apps, invoices, bills, change-orders, purchase-orders, contracts, lien-waivers, payroll, w9. |
| **W10 — ListToolbar rollout 2** | rfis, todos, timesheets, inspections, insurance, team, subs, messages + any remaining of the 29; per-user filter persistence + saved views groundwork. |
| **W11 — dead-space kill list** | All 13 web empty states in §4.1, incl. the two action-less boxes; seeding flows (schedule←bid-package trades, contracts←awarded packages, timesheets←roster). |
| **W12 — design-system unification** | Port budget + overview from cinematic→premium (or alias CIN); standard eyebrow/title strip on takeoff (§5.1). |
| **W13 — sidebar + prefetch + nav polish** | Collapsible remembered sections, Network gating, type-to-filter (§5.3); drop `prefetch={false}` in notifications, `<Link>`-wrap card grids (W-17); AR/AP disambiguation banners + form language (§5.4). |
| **W14 — flow polish + takeoff perf** | Pay-app wizard skip-to-step-2; budget add-line scrollIntoView + "Seed from bid package" entry; schedule task date defaults (§3.2); takeoff hub single round-trip (W-18); dynamic-import XLSX + PlanTracer (W-16). |

*Deferred to Round 3 (schema + cross-cutting):* per-project record numbering (§1.4), RecordDetail template swap (§1.3), polymorphic `related_items` + drawing pins (§1.5), admin fieldset config (§1.6), notification deep-links (§1.7). This wave gets every page conforming to the toolbar/skeleton/optimistic law so the Round-3 template swap is mechanical.

### Mobile (7 agents, D:/Saguaro-Field)

| Agent | Scope |
|-------|-------|
| **M1 — optimistic write-through (THE fix)** | `lib/sync/mutations.ts` setQueriesData write-through keyed on table + client UUID; syncEngine post-drain invalidation; `_pending` flag + "waiting to sync" pill component; archive optimistic filter-out in `lib/archive.ts`; remove racing invalidateQueries from screens (M-1, M-4, M-5). Lands first — every other mobile agent inherits it. |
| **M2 — time clock** | Optimistic clock-in/out status (M-2); cost-code chip row at clock-in on time.tsx + Field-hub card with last-used default per employee+project (§3.1); home Time quick action → live clock toggle (§5.5); time.tsx ScrollView→FlatList (M-9). |
| **M3 — punch** | `/punch?new=1` + quick-capture routing; form → BottomSheet or memoized rows/renderItem/tallies (M-11); SelectField type-ahead when options>12; FlowSteps below Save; SmartCreate collapse; empty-state action button (§3.1, §4.2). |
| **M4 — photos + image pipeline** | Instant-save single capture with "Add details" follow-up (§3.1); local-URI placeholder tiles with pending state (M-3); expo-image disk cache keyed on storage path + persisted sign cache + batch signing (M-10); empty-state action (§4.2). |
| **M5 — query-key unification** | bid-intelligence + cost-catalog → react-query on shared keys with overview (M-6, M-8); command-center ↔ overview canonical keys (M-7); project-name from `['project-context']`; fix id-join key churn (M-12). |
| **M6 — RFI + daily flow** | "Create & submit" primary + `/rfis?new=1` (§3.1); daily auto-weather in openCreate + "Save & submit" primary (§3.1); deliveries empty-state action (§4.2). |
| **M7 — lists + cold start** | people/fleet/forms FlatList conversions with memoized health Map (M-9); update-gate 800ms budget + background OTA apply; PROJECT_KEY in the `ready` gate (M-13); cc-kpis skeleton tiles (M-14). |

**Definition of done for the wave:** every previously-visited screen paints in <100ms from cache on both platforms; every save/toggle/archive reflects instantly (online AND offline, with sync pills); the five core mobile jobs hit their tap targets (§3.1); no text/spinner loading gate and no bare empty box remains; all list pages share the ListToolbar anatomy; one design system on web.
