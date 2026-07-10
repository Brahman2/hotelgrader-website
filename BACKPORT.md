# BACKPORT.md — carrying the marketing-site design system into the hotelgrader app

The marketing site (this repo) is the design lead; the app follows. This spec
lists what to port, component by component, with the data each piece needs from
the real audit payload. Components are React (`src/components/*.tsx`) with plain
CSS values, so most port with a copy and a data adapter.

---

## 1. Design tokens

| Token | Value | Job |
|---|---|---|
| bone | `#F7F4F0` | page canvas, never pure white |
| paper | `#FBF9F6` | raised surfaces, alternating section bands |
| ink | `#0B1220` | text |
| ink-60 / ink-40 | 60% / 40% ink | secondary / tertiary text |
| indigo | `#5B5BD6` | **"you" + brand**: labels, your position markers, active states, CTA bands |
| cta orange | `#D9531C` (hover `#C24716`, press `#A93D12`) | **the one primary action per view** |
| good / warn / attention | `#1E7F4B` / `#D98A1C` / `#C6453D` | grades and deltas only, never decoration |
| edge / edge-strong | `#E6E6E1` / `#D5D4CE` | hairline borders. No shadows, ever |
| radius | 6px (4px small) | hard edges, nothing rounder |

**Type**: Source Serif 4 for grades, display headlines (weight 600, `-0.015em`,
italic `<em>` accents), and big numerals. Inter for everything else. Mono
(ui-monospace) for `.meta` labels: 11px, uppercase, `0.08em` tracking.
`font-feature-settings: "tnum"` on every number.

**Motion**: `cubic-bezier(0.2, 0, 0, 1)`, 120–200ms fades and ≤4px rises; bar
fills 400–700ms. Grades never animate — they appear. Everything honors
`prefers-reduced-motion`.

**Color semantics (the rule that makes dashboards legible):**
orange = act · indigo = you/brand · green-amber-red = verdicts · bone/paper = chrome.

---

## 2. Components to port (priority order)

### 2.1 Scan theater → replace the "Queued / PENDING" analyze screen
`HeroDemo.tsx`. Rows flip QUEUED → RUN → score with per-section fill bars, a
terminal log narrates each source, master grade fades in, banded scale slides.
**Data contract**: ordered section list `{ short, name, score, tone, position }`,
log line per stage, overall `{ grade, score, rank, total }`. In the app, drive it
from real scan-stage events instead of a timer. The wait is the highest-attention
moment in the product; spend it showing work.

### 2.2 Banded position scale
`BenchmarkBar.tsx`. Five tinted F–A bands, active band outlined in ink, indigo
"you" dot on the top edge, captions `significantly below / at market / top tier`.
**Data**: `position` (0–100), `compMedian`. Replaces plain progress bars anywhere
position-vs-comp is shown.

### 2.3 Comp-set skyline with TODAY / AFTER FIXES
`CompSet.tsx`. 74-bar skyline sorted by score, hover tooltip per blind
competitor (`#23 · B · 79`), indigo you-bar, toggle that slides your rank and
reprices the upside. **Data**: array of `{ rank, score }`, `todayRank`,
`modeledRank`, upside string. In-app, AFTER FIXES = modeled position if the
action queue is executed — this toggle *is* the upgrade pitch.

### 2.4 Evidence exhibits with THE FIX
`EvidenceTabs.tsx`. Auto-advancing tabs (progress hairline, pause on hover),
one exhibit per section: typewriter AI prompt with `not mentioned` verdict,
SERP mock, reviews panel, engagement bars vs dashed comp line. Verdict rail:
grade, punch line, stat, delta, and a **THE FIX** teaser. **Data**: per-section
`{ grade, punch, stat, delta, fix }` + exhibit payloads (real screenshots or
structured findings). Free report should show fixes as teasers; Pro unlocks the
full queue.

### 2.5 Dashboard tour patterns
`DashboardTour.tsx` — the app Overview/Action Plan/Competitors/HotelIQ surfaces,
redesigned: score rows with `NN/100` + delta, payback-ranked queue rows with
`OWNER · IMPACT · EFFORT · STATUS` chips, comp ladder with indigo you-row,
HotelIQ answers that end in a citation line (`CITES: AI 45/100 · ADS 62/100`).

### 2.6 Chrome details
- Status cell: pulsing dot + `SYSTEMS OPERATIONAL · 38 SOURCES` (in-app: real
  per-scan source health).
- Verification footnotes on every report: `verified by N of 38 sources · as of {date}`.
- Ticker strip (marketing-only flavor; optional in-app).
- Indigo CTA band: full-bleed `#5B5BD6`, white serif headline with italic turn,
  bone-button form. One or two per page, always the closer.
- Paper banding: alternate bone/paper full-bleed sections to chunk long pages.

---

## 3. Copy rules (feed these to the report generator)

1. No em dashes. Periods, commas, `·` separators.
2. No invented abbreviations. BKG, MoM, SoV are out; "vs last month",
   "share of voice" are in. ADR / RevPAR / occupancy / OTA / comp set are fine.
3. "Top 25%", never "quartile". Plain words over stats-class words.
4. Vary cadence. Not every line is a two-beat "X. Y." punch.
5. Numbers are exact and tabular. `45/100`, `#18 of 74`, `+22%`, `$1.42M`.
6. Every diagnosis carries a fix hint and, where possible, a payback figure
   priced at the property's ADR and occupancy.
7. Banned: delve, leverage, seamless, robust, unlock, harness, transformative.
   No emoji. No exclamation marks.

---

## 4. Pricing surface (from /pricing, proposed not final)

Audit $0 · Pro $129/mo per property ($99 annual) · Portfolio $399/mo up to 5
then $69 each · Enterprise custom. Break-even instrument: ADR presets → "Pro
pays for itself with N recovered direct bookings a year." Ethics block: "The
grade is never for sale." The app's /upgrade page should adopt the tier cards,
comparison table, and break-even math.
