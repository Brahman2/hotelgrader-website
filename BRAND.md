# hotelgrader brand brief

This file governs all visual and frontend work on hotelgrader.com. It overrides any
default aesthetic a model or component library would otherwise produce. When a choice
isn't covered here, derive it from the brand idea below - never from a template.

## Brand idea

hotelgrader is a rigorous inspection delivered by a warm, human company.

Think of the letter-grade placard in a restaurant window: a physical, instantly
understood artifact of accountability in hospitality. The marketing site is the warm,
sunlit shell (paper, photography, a human hand). The report and dashboard inside it
are precise and data-dense. Warmth builds trust with independent hotel owners;
rigor earns the right to grade them.

Audience: independent hotel owners and GMs, mostly 40-65, skeptical of both
agencies and AI hype. The site must read as trustworthy to them, not impressive
to designers.

## Reference DNA (why these three)

- granola.ai - human-made assets do the differentiation: commissioned illustration,
  a friendly editorial serif, product shown plainly. Steal: illustration as the brand
  carrier, restraint everywhere else.
- daylightcomputer.com - proof that warm and technical coexist. Paper and amber
  sunlight wrapped around dense, scientific content. Steal: the material metaphor
  (paper, ink, sun) and warm-but-serious diagrams.
- amie.so - one signature interaction, springy and product-tied, on an otherwise
  calm light page. Steal: motion budget spent in exactly one place.

## Color tokens

Clean paper, not cream. The beige/cream page background is a known AI tell
and is banned (2026-07 feedback). The base is a near-white with only a whisper
of warmth; color energy comes from the saturated accents, not the background.
Explicitly avoid terracotta/clay accents near #D97757 (a known AI-default accent).

- --paper: #FCFBF7 (page background, whisper-warm near-white)
- --paper-deep: #F4F2EC (cards, section alternation - light warm gray, not beige)
- --ink: #26221B (text, warm near-black - never pure #000)
- --ink-soft: #6B6355 (secondary text, captions)
- --sun: #D98A1C (brand accent, CTAs, grade emphasis - carried over from the
  current site)
- --iris: #5B5BD6 (the brand color, carried from the logo. Two sanctioned jobs:
  interactive states (links, hovers, focus rings, selected tabs/nav states, and
  the "you" series in comp-set charts) AND deliberate full-bleed brand moments:
  the page-closing conversion band on every page, plus at most one mid-page
  band. White text on iris. Hover/active shade: #4646B0. Granola-style color
  confidence: saturated, generous where it appears, absent everywhere else.)
- --teal: #0D9488 (the third brand color: verification and live-data accents
  only - the scan-complete dot, "verified by N sources" strings, live-status
  markers. Strong shade: #0F766E. Never for CTAs or links; that is iris's job.)
- Grade scale (functional only, muted like print): A #3E7C4F, B #7C9A3E,
  C #C9922A, D #C0622F, F #A83232

Rules: sun accent on no more than ~5% of any viewport. Iris appears as the
interactive color and as full-bleed band moments - nothing in between: never
as random tints, washes behind body copy, gradients, or scattered decorative
accents. Grade colors appear only on grades and grade-derived data.
No gradients on text or backgrounds. Dark sections allowed only inside
product/dashboard screenshots. The page must never read monotone cream:
every viewport should carry at least one saturated element (iris, sun, or a
grade color) doing real work.

## Typography

Two options, ranked. Buy, don't default - the license is the moat.

1. Display: Tiempos Headline (Klim, klim.co.nz, ~$50-60/style, verify current
   licensing). Body: Söhne (Klim) or system fallback stack. Data/numbers:
   Berkeley Mono (berkeleygraphics.com, [verify v2 license price]).
2. Free fallback pair: Fraunces (display, use low-optical sizes, soft settings,
   avoid the wonky high-contrast axes) + a quiet humanist sans for body.
   Data: IBM Plex Mono.

Rules:
- No Instrument Serif, no Inter, no Geist, in any weight or context.
- Italic serif emphasis inside headlines is banned (primary AI tell on the current site).
- Mono is for data values only: grades, scores, dollar figures, metric readouts.
  Never for labels, eyebrows, or navigation.
- Sentence case everywhere. No all-caps eyebrows or section labels.

## Signature element: the stamped grade

The one memorable thing. The grade renders as a large letterpress serif glyph
with its mono score beneath, pressed into the paper - no frame, card, badge,
or rotation (a framed placard read school-ish and was dropped, 2026-07
feedback). It appears in the hero scan demo, on report pages, and in OG
images. Everything else on the page stays quiet so the stamp owns the memory.

Motion budget (revised 2026-07): the scan->stamp remains the one hero moment.
In addition, gentle scroll reveals are allowed - section content rises + fades
in on entry (~600ms, ease-out, single pass, honors prefers-reduced-motion).
Still banned: scroll-jacking, parallax, pinned/scrubbed sections, and any
looping ambient animation.

## Imagery

- Real property photography, warm-graded (slight amber lift, film-like), full-bleed
  or in simple thin-keyline frames. Already a differentiator - competitors use
  stock or 3D renders. (Currently: warm interiors from Unsplash as placeholders -
  public/images/CREDITS.md - to be replaced with commissioned/owned shots.)
- Do NOT attach a stock-photo face to a named testimonial (misrepresents a real
  person); testimonials stay text-only until a real customer photo exists.
- Commissioned spot illustrations for concepts (comp set, AI engines, booking flow):
  single-weight ink line drawings of hospitality artifacts - room keys, luggage tags,
  bell, door hanger, placard. One illustrator, one style, ~8-12 spots.
  Budget [$X] via Dribbble/Folio hire.
- No AI-generated imagery, no 3D blobs, no abstract gradient meshes, no
  glassmorphism cards.

## Structure and layout

- Light page, but color-blocked (revised 2026-07, Granola-style energy):
  sections alternate across 3-4 soft full-bleed tints on the clean paper base -
  peach #FBF0DB, lavender #EDEDFB, mint/teal #E6F3F0, light gray #F4F2EC - plus
  the saturated iris bands. No two adjacent sections share a background.
- Big display type: hero headline 72-84px, section headlines 38-50px.
- Trust strip uses REAL brand logos (simple-icons, build-time inlined SVG):
  Google, Tripadvisor, Booking.com, Expedia, Gemini, Perplexity, Instagram.
- At least one big testimonial set large (30-42px), name + role + property.
- Colour panels are TEXTURED, not flat (Granola-style coloured paper): a fine
  soft-light grain is layered over each tint (.panel). Faded oversized brand
  marks - a ghost grade letter or the hg spiral - may sink into a panel
  background (.ghost-mark, ~5% ink), like Granola's ghost scribbles.
- Big footer wordmark: the full "hotelgrader" logotype set huge and cropped by
  the footer's bottom edge, with the hg mark. The one loud logo moment.
- Generous whitespace. Max content width ~1100px, asymmetry allowed.
- Numbered markers (01/02/03) only where order is real (the 3-step method qualifies;
  the seven grade sections do not - they get placard-style tabs instead).
- Middle-dot separators, "FIG." captions, EXHIBITS/METHOD-style caps labels: banned.
  Replace with plain sentence-case captions in ink-soft.
- Report/dashboard UI keeps density and mono numerals - rigor lives there.
  The warm shell never bleeds into fake-print gimmicks inside the actual product UI.

## Banned list (AI tells)

Dark hero, purple gradients, violet-on-dark, iris scattered as random tints
(it is either interactive or a full-bleed band - nothing in between),
monotone cream pages with no saturated color, beige/cream page backgrounds,
framed grade cards or badge-style placards (school-ish), gradient text, glassmorphism,
bento grids,
Instrument Serif, italic-serif headline emphasis, all-caps mono eyebrows,
middle-dot separators, FIG. captions, terracotta #D97757-range accents,
scroll-jacking, decorative particle/orb effects, 21st.dev visual tokens
(component behavior may be used, all styling replaced with these tokens).

## Claude Code session rules

- Load this file at the start of every design session. If a generated section
  would look at home on a generic AI-built site, regenerate against this file.
- impeccable + taste-skill enforce craft; this file supplies direction. Direction wins
  on any conflict.
- Screenshot and self-critique before presenting. One accessory removed per pass.
