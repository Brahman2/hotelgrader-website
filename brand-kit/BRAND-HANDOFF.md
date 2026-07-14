# hotelgrader — brand handoff

The design system as shipped on hotelgrader.com (July 2026), packaged for
application to other surfaces — first target: the report + dashboard app
(`hotelgrade-insight`). Written to be consumed cold by a developer or an
agent with no other context.

**This document supersedes `BRAND.md`**, which predates the final passes
(Fraunces, Archivo Black grades, the abstract-art system, motion).

---

## 1. What to copy

From this repo, copy verbatim:

| Asset | Path |
|---|---|
| Display serif (variable) | `public/fonts/Fraunces-Variable.woff2` + `-Italic` |
| Body sans (variable) | `public/fonts/SourceSans3Variable.woff2` + `-Italic` |
| Data mono | `public/fonts/IBMPlexMono-400/500/600.woff2` |
| Grade face | `public/fonts/ArchivoBlack.woff2` |
| Art motifs (5) | `public/images/abstract-{burst,burst-2,rings,blobs,waves}.svg` |
| Art generator | `brand-kit/generate-art.mjs` (mint new in-palette variants) |
| Tokens + signature CSS | `brand-kit/tokens.css` (framework-free) |
| Brand marks | `public/assets/favicon.svg`, `favicon-white.svg`, `wordmark.svg` |

`tokens.css` is plain CSS custom properties + classes; it works under
Tailwind, shadcn, or vanilla. If the target app uses Tailwind, mirror the
custom properties into the theme rather than duplicating hexes.

## 2. Palette

Foundation (warm, never pure black/white):

- `--hg-paper: #FCFBF7` — page ground
- `--hg-paper-deep: #F4F2EC` — cards, alternation
- `--hg-ink: #26221B` — text (never `#000`)
- `--hg-ink-soft: #6B6355` — secondary text, captions
- `--hg-edge: #E6E6E1` / `--hg-edge-strong: #D5D4CE` — hairlines

Brand accents, each with ONE job:

- `--hg-iris: #5B5BD6` (hover/active `#4646B0`) — **interactive only**:
  links, primary CTAs, focus, selection, "you" in data. Not decoration.
- `--hg-teal: #0D9488` (strong `#0F766E`) — **verification & live data**:
  "verified by 38 sources", live dots, standout stats (used sparingly — one
  or two teal numbers per screen, no more).
- `--hg-sun: #D98A1C` — warm secondary accent; grade-adjacent emphasis.

Grade spectrum (semantic, never remapped):

- A `#3E7C4F` · B `#7C9A3E` · C `#C9922A` · D `#C0622F` · F `#A83232`
- Status shorthand: good `#1E7F4B` · warn `#D98A1C` · attention `#C6453D`

Art palette (only inside the abstract motifs): `#8480D9 #3AAFA4 #E87A54
#C6D95E` over deep bases `#241E52 / #1B2440 / #221B47 / #4A47C9`.

## 3. Type system

Four faces, four jobs. All self-hosted (no font CDNs).

1. **Fraunces** (variable) — display only. Headlines and page titles.
   `font-optical-sizing: auto; font-variation-settings: 'SOFT' 40, 'WONK' 1;
   font-weight: 600; letter-spacing: -0.015em; line-height: 1.05.`
   Emphasis inside headlines stays **upright** (`em { font-style: normal }`)
   — the italic-serif look is explicitly banned.
2. **Source Sans 3** (variable) — everything else. Body 15px/1.5.
3. **IBM Plex Mono** — data captions, scores ("87 / 100"), timestamps,
   scan-log voice. Weights 400/500/600.
4. **Archivo Black** — the letter grade, nothing else. See §4.

Numerals: `font-variant-numeric: tabular-nums` everywhere digits align.
Labels/eyebrows: 12px, weight 600, sentence case (never all-caps tracking
except tiny meta rows that already exist in the product).

## 4. The grade (signature element)

The letter grade is the brand's stamp. Render it in **Archivo Black**,
weight 400 (the face is inherently black), `letter-spacing -0.03em`,
`line-height 0.9`, colored by the grade spectrum.

**Modifier markup** — the +/− is smaller and raised, and must never shift
the letter. Always split:

```html
<span class="grade grade--b">B<span class="grade-mod">+</span></span>
```

- `.grade-mod`: `font-size: .52em; position: relative; top: -.55em;`
  (relative positioning, NOT vertical-align — that inflates the line box
  and causes vertical drift between rows).
- In right-aligned grade columns add `.grade-mod--slot` (fixed `.6em`
  width, always rendered even when empty) so letters form one clean
  vertical line.
- Large hero/placard grades get the letterpress shadow:
  `text-shadow: 0 1px 0 rgba(252,251,247,.7), 0 -0.5px 0 rgba(38,34,27,.1)`.

## 5. Abstract art (energy layer)

Five halftone motifs share one recipe: bright shapes over a deep base +
white focal glow + edge vignette + 9px halftone dot grid + fractal grain.
Regenerate or mint variants with `generate-art.mjs`.

Usage rules — **art frames, it never wallpapers**:

- **Frame**: a card floats over an art mat with 12–24px of art visible
  around it (marketing hero move — use at most once per screen).
- **Floor**: a full-width band of art closes a page (the footer move).
- **Seam**: a 6–12px sliver of art marks a section boundary.
- **Band backing**: art behind a solid-color conversion band, with a dark
  scrim (`rgba(38,34,80,.38)`) so white text passes contrast.

**Dashboard adaptation (important):** the product UI is operated, not
read. Transfer the identity, not the drama — prefer seams, one floor, and
at most one framed hero card (e.g., the grade placard). Data tables and
action queues stay on paper/bone with hairlines. When in doubt, quieter.

## 6. Motion contract

Every effect sits inside `@media (prefers-reduced-motion: no-preference)`
or collapses to static via the `.is-in` fallback. Never animate layout.

- **Reveal**: rise 16px + fade, 620ms `cubic-bezier(.16,1,.3,1)`, on
  IntersectionObserver entry, once.
- **Stamp**: grades press in, scale 1.14→1, 520ms
  `cubic-bezier(.2,.85,.25,1)`. Use on grade entry; the hero placard uses
  the same easing on scan-complete.
- **Count-up**: numbers roll 0→value in ~900ms cubic ease-out on entry.
  Use for headline stats only, not table cells.
- **Ambient**: art floors drift (`background-position` pan, ~70s,
  alternate); framed art mats breathe (scale 1→1.05, ~16s, alternate).
  Ambient motion belongs on at most two elements per page.
- Micro: CTA arrows nudge 2px on hover; logo/list rows lift ≤3px.

## 7. Voice

- Short, confident, human sentences. No em-dash crutches, no
  fragment-staccato ("X. Y. Z.") headline patterns, no italic emphasis.
- Sentence case almost everywhere; the grade does the shouting.
- Numbers are the proof: prefer "Ranked #18 in a field of 74" over
  adjectives. Money in direct-booking terms.
- Established lines to reuse verbatim: "Your hotel has a grade." ·
  "Where the grade turns into bookings." · "Your comp set already ran
  this." · "The independent grade for hotel marketing."

## 8. Do / don't

**Do**: warm paper grounds · hairline borders (no drop-shadow cards except
floating-over-art) · 6px radii (`--hg-radius`) · tabular numerals ·
Archivo Black grades with raised modifiers · art as frame/seam/floor ·
reduced-motion parity.

**Don't**: pure black or pure white · iris as decoration · more than two
teal accents per screen · italic serif emphasis · full-bleed art behind
body text · new fonts · new grade colors · motion without the
reduced-motion guard.
