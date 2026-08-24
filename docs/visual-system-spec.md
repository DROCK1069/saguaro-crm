# THE SAGUARO VISUAL SYSTEM — making it come to life

*Owner directive 2026-08-24: "what can u do for visual and feel for GC's — make the
entire app visually come to life looking NEW and Appealing."*

**The reframe.** This is not a polish list. A GC opens this app **outdoors, in
direct sun, wearing gloves, one-handed, needing ONE answer in three seconds.**
Design for that and "modern" is a by-product. Design for a dribbble screenshot
and you get something that fails on a jobsite.

**The diagnosis:** the app is *monochrome* and *static*. Everything is gold on
near-black and nothing responds. The dark theme is CORRECT for a jobsite — do
not change it. Change what the dark is carrying.

---

## TIER 0 — FOUNDATION
*Everything above this is lipstick until these land.*

### 0.1 An elevation ladder (currently 2 surfaces doing 4 jobs)
Today: canvas `#0a0a0a`, card `#141416`. Flat rectangles on black.
```
L0 canvas    #0B0B0D   (OLED-friendly near-black)
L1 card      #141417   + top hairline rgba(255,255,255,0.06)
L2 raised    #1A1A1E   sheets, sticky bars
L3 overlay   #212127   modals, popovers
```
Every level gets a **top-light hairline** and a soft bottom shadow. This one
change is what makes a card read as a physical object instead of a shape.

### 0.2 DEMOTE THE GOLD — highest impact, zero cost
Gold is currently on every icon, every chip, every accent — **so it means
nothing.** New law:
> **Gold = money, and the single primary action on screen. Nothing else.**

Everything else uses its module accent or neutral. Scarcity is what makes gold
read as premium.

### 0.3 A type ramp of ROLES, not sizes
So no one ever picks a font size again:
```
Display  30/34  screen title AT REST ONLY
Title    20/24  collapsed header, card titles
Body     17/22  content (17 is the sunlight floor — keep it)
Label    15/20  secondary
Eyebrow  11/13  SMALL CAPS, +0.8 tracking — module/section identity
Numeric  28-40  tabular-nums, for stat values only
```

### 0.4 A strict 4pt grid
Spacing `4 / 8 / 12 / 16 / 20 / 24 / 32`. Card padding **12 vertical / 14
horizontal** (from 16/16). Section gap **20** (from 32). Row min-height **56**.
Touch targets stay **≥44pt** — density comes from padding, never from targets.

---

## TIER 1 — INFORMATION (the three-second test)

### 1.1 Color as information
97 module accents exist; 20 screens use one. Thread each module's accent through
header, icon chip, empty medallion, pills, active states — **max 5 accent
placements per screen, never as a large fill.** Plus a 3px leading rail on cards.

### 1.2 Status as SHAPE + COLOR, never colour alone
~8% of men are colourblind and this industry is overwhelmingly male. Encode
state in form as well as hue:
- Overdue → red + **filled triangle**
- Due soon → amber + **half ring**
- Complete → green + **check**
- Blocked → grey + **slash**

Test: screenshot it in greyscale. If you cannot read status, it fails.

### 1.3 A live number in every header
86 of 91 screens show none. The number that matters for that module, coloured by
urgency, with a **trend arrow vs last week**. "12 open ↑3" beats "RFIs".

### 1.4 An insight band per module
It must answer **"should I worry?"** in one glance — not merely display data.
HONESTY RULE: computed from real rows or replaced by a truthful count. Never a
decorative chart. Under 3 rows of data, show nothing.

### 1.5 Numbers that explain themselves ← OWNER MANDATE
> *"ALWAYS CORRECT NUMBERS WITH REASONING WHY IT GAVE THE INFORMATION IT GAVE."*

Every computed figure gets the same tap-to-explain sheet:
**inputs → formula → the source rows → as-of timestamp → an Override action.**
One component, used identically everywhere. A number a GC cannot interrogate is
a number he will not trust — and he is right not to.

---

## TIER 2 — MOTION & RESPONSE
*The single biggest contributor to "new". The app has almost none.*

- **Collapsing headers** — 30pt → 20pt over 60pt of scroll, spring. Reclaims ~70pt everywhere.
- **Skeletons, never spinners** — shaped like the real content, 1.2s shimmer. Nothing spins for >200ms.
- **Staggered entry** — 30ms apart, first 8 rows only.
- **Press feedback** — scale 0.98 + brightness lift, spring (stiffness 300, damping 20).
- **Animated numerals** — money counts up over 300ms, ease-out. Makes a dashboard feel alive.
- **Sheets** — rubber-band, gesture-dismissible, never a hard cut.
- **ALL of it respects `prefers-reduced-motion` / Reduce Motion** and degrades to instant.

---

## TIER 3 — THE JOBSITE LAYER
*Nobody in this category designs for this. It is the differentiator.*

- **Sunlight mode** — manual toggle (and ambient-aware where the OS allows): pure-white text, thicker strokes, maximum-contrast accents. A GC in Phoenix at 2pm cannot read a #CBD5E1 label.
- **Glove mode platform-wide** — exists only in Radio today. 56pt targets, generous hit slop, simplified chrome.
- **One-handed reach** — primary actions live in the bottom third. The FAB and PTT coin already obey this; everything else should.
- **A sync visual language** — ONE consistent pending / syncing / failed chip used identically everywhere. Never a toast that vanishes before it is read.

---

## TIER 4 — CONSTRUCTION-NATIVE
*What makes it a construction app rather than a generic CRUD app.*

- **Evidence first.** Construction is visual; competitors are text-heavy. Photo and voice thumbnails belong in the LIST, not buried in a detail view. The radio evidence card is the model.
- **Trade / CSI colour coding** consistent across every module that touches a trade.
- **Plan and drawing thumbnails** in context, not behind two taps.

---

## TIER 5 — SYSTEM QUALITY

- **Accessibility** (also an enterprise sales requirement): Dynamic Type, VoiceOver labels, 4.5:1 contrast minimum, visible focus rings.
- **Density mode** — Comfortable (field, gloves) vs Compact (office, iPad). Let the GC choose.
- **60fps** — virtualised lists, memoised rows, cached images. "Feels new" is mostly "feels fast".
- **Micro-copy voice** — copy IS design. "No RFIs yet" teaches nothing; "Get the first question on the record — answers land here with author and timestamp" does.
- **Geometry audit** — one button-height ladder, one radius scale, one pill. Today they drift per screen.

---

## THE FIRST-RUN PROBLEM
An empty tenant currently shows a wall of `$0 / $0 / 0 / 0 / 0 HEALTH / 0%`.
Accurate, and it reads as broken. **Zeros are suppressed until they mean
something** — a new project shows its guided setup path instead, and stats
appear as they acquire values.

## THE BRAND MOMENT
The Sonoran identity should live somewhere memorable — the loading state, the
empty-state medallions — instead of being spent as generic gold on every icon.

---

## HOW IT SHIPS
Five screens first — **Me, Tools, Overview, Portfolio, Cost codes** — for the
owner to eyeball on his phone. Then batches of ~10 with gates between, web
parity in the same wave (same tokens, each platform's idiom). Reference
implementation for module anatomy stays `app/rfis.tsx` + `docs/module-pattern-spec.md`.
