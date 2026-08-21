# Saguaro platform — architecture & runbook

One product, two deployables, one database. This file is the single answer to
"where does X live and how do I ship it." A copy lives in BOTH repos — treat the
mobile repo's copy as canonical (like everything else shared).

## The map

| Piece | Repo | Checkout on Chad's PC | Deploys via |
|---|---|---|---|
| **Mobile app** (iOS/Android, Expo SDK 56) | `DROCK1069/saguaro-field` | `D:\Saguaro-Field` | EAS Update (OTA) |
| **Web app** (Next.js) | `DROCK1069/saguaro-crm` | `D:\saguaro-web` ← worktree of `D:\Live-Code-Saguaro` | merge → `main` → hosted deploy |
| **Database** | Supabase project `jddfvugsaosvgllbkzch` | — | migrations via Supabase MCP/dashboard |

`D:\Live-Code-Saguaro` is a WIP checkout (branch `fix/winansi-standalone-generators`).
It is **never** the deploy source — build and merge from `D:\saguaro-web`.

## Accounts — who is allowed to do what

| Service | Account | Used for |
|---|---|---|
| GitHub (owner) | **DROCK1069** | Owns both repos. Chad logs in in Chrome; sudo prompts are typed by Chad only. |
| GitHub (CLI) | **tntcybersolutions-lgtm** | What `git push`/`gh` on this PC authenticates as. Must be a collaborator on both repos. |
| Expo/EAS | **tntcybersolutions@gmail.com** (org `tntadmin`) | The ONLY account that can publish the mobile app (project `9dc1f8d7-2616-448e-9d8c-0979bf028aa9`). The `chad@tntcyber.com` ("drock") Expo account has **no access** — publishing with it fails with "Entity not authorized". |
| Supabase | project `jddfvugsaosvgllbkzch` | Both apps hit the same DB. `takeoff_line_items` RLS = profiles-subquery only; `takeoffs` adds `get_tenant_id()`. |

## Shared code — the anti-drift contract

`lib/heatmap/**` (the Signal Studio engine) is **canonical in the mobile repo**
and mirrored byte-for-byte into the web repo. `share.ts` and `vector-pdf.ts` are
web-only I/O and exempt.

- **Never edit `lib/heatmap` in the web repo.** Edit in `D:\Saguaro-Field`, then:

  ```
  npm run engine:sync    # copy canonical → web mirror
  npm run engine:check   # verify (web `npm run build` runs this automatically)
  npm run engine:test    # 8-test engine proof — runs identically in both repos
  ```

- The check SKIPS (with a notice) when the peer repo isn't on this machine
  (CI/Vercel), so hosted builds never break on it. Set `SAGUARO_PEER_DIR` if the
  repos aren't in the standard `D:\` locations.
- UI parity is a product mandate: the guided Field Mode flow
  (Plan → Scale → Walls → Devices → Heatmap → Bid, door-tap 3-ft scale, capped
  dead-zone fixes) must look and behave the same on web and mobile. If you
  change the flow on one surface, change the other in the same PR/OTA.

## Ship it — the three runbooks

**Mobile (JS-only change → OTA, no store review):**
```
cd D:\Saguaro-Field
npx eas-cli whoami          # must say tntcybersolutions@gmail.com
npx eas-cli update --channel field-production --environment production --message "<what changed>"
```
Runtime is `field-1.4.0` — the phone build must match or the update won't attach.
Native-module changes need `eas build` + store submission instead.

**Web:**
```
cd D:\saguaro-web
npm run build               # runs engine:check first; needs .env.local
git checkout main && git merge <branch> && git push origin main   # push = deploy
```

**Database:** migrations through Supabase (never raw prod DDL from the apps).

## Known sharp edges

- `git push` from this PC fails with 403/"not found" until
  `tntcybersolutions-lgtm` is added as collaborator on BOTH repos (owner action,
  needs Chad's GitHub sudo).
- Never commit: `android/*.keystore` (release signing), `.env.local`, `*.tgz`.
- A stale `.git/index.lock` once blocked `D:\Live-Code-Saguaro` for 3 weeks —
  if git ops hang with no git running, check for a 0-byte lock file dated days ago.
