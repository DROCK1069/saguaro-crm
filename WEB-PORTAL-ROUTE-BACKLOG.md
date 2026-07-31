# Web / Portal API Route Backlog

From the full-stack wiring audit (2026-06-13). The **mobile app is fully wired**; these are remaining gaps where **web dashboard / portal pages** call `/api/*` routes that don't exist yet (would 404 on those pages). They do **not** affect the mobile app.

## ✅ Done in this batch (created + deployed)
- `GET /api/projects` (base) — `?limit`/`?status`/`?search`; unblocks app layout, daily-logs, invoicing, schedule, reports, customers
- `GET/POST /api/change-orders` (base) — field change-orders page
- `GET /api/portal/client/financials` — client portal financials tab (portal-token auth)
- `GET/POST /api/subcontractors` (base) — subcontractor list/create (resolves the `/api/subs` naming drift)

## P1 — admin & portal core (recommended next)
- **Client-portal user mgmt:** `/api/client-portal/users/bulk`, `/users/[id]`, `/users/[id]/resend`; `/api/customers/profiles`
- **Roles & permissions:** `/api/roles/assignments`, `/assignments/[id]`, `/audit`
- **RFI web actions:** `/api/rfis/[id]/respond`, `/status`, `/reassign`; `/api/projects/[projectId]/rfis`, `/api/rfis/export`
- **Reports:** `/api/reports/[id]`, `/[id]/export`, `/[id]/schedule`; `/api/dashboard-layout/list`, `/[id]`
- **safety-talks naming:** repoint the web/field page to the existing `/api/safety/talks`, or add a `/api/safety-talks` alias

## P2 — field-app advanced features
- **Resource planning:** `/api/projects/all/resource-planning(/[id])`; `/api/resource-planning/workers/[id]/{check-in,check-out,status,reassign}`; `/weather-notes`
- **Warranty claims:** `/api/warranty-claims(+/[id]/{status,resolve,assign})`; `/api/projects/[projectId]/contacts`
- **Potential change orders:** `/api/projects/[projectId]/change-orders`, `/potential-change-orders(/[id])`, `/api/change-orders/[id]/update`
- **Selections:** `/api/projects/[projectId]/selections/[itemId]`, `/[itemId]/select`, `/batch-status`
- **Prequal:** `/api/projects/[projectId]/prequalification/[id]/{rating,notes,flag}`
- **Proposals:** `/api/proposals/[id]/send`, `/upload`
- **Bid packages:** `/api/bid-packages/[id]/remind`

## P3 — exports / emails / misc (lowest urgency)
- **Field exports/emails:** `/api/projects/[projectId]/{daily-logs/export, daily-logs/email, meetings/export, meetings/[id]/email, safety/export, tm-tickets/export, schedule/[id]}`; the two change-order `…/export-pdf` variants
- **Takeoff:** `/api/takeoff-projects/[id]/export/{pdf,excel}`
- **Network:** `/api/network/access-points`, `/api/network/wizard/apply`
- **Sub-portal:** `/api/sub-portal/{status,permissions,doc-visibility,announce,resend}`
- **Misc:** `/api/notifications/push-subscribe`, `/api/trade-guide/articles`, `/api/punch-list/batch`, `/api/projects/[projectId]/correspondence/[id]/read-receipt`

## Healthy catch-alls (no action needed)
`/api/billing/[...path]`, `/api/ai/[...path]`, `/api/insurance/[...path]`, `/api/documents/[...path]`, `/api/portals/[...path]` resolve fine.

> Note: the audit flagged ~72 references; verify each against the live route tree + schema before building (the audit had a few mis-attributions). Build in batches by priority.
