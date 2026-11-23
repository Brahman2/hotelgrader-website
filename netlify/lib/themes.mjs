// The themes reading for one hotel, cached for a week against the reviews it
// was built from. The model call takes several seconds, so the scan only
// reads the cache; the page asks /api/themes to do the run on the side.

import { reviewThemes, hasThemesKey } from '../../scanner/themes.mjs';

const WEEK = 7 * 24 * 60 * 60 * 1000;

async function store() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore('review-themes-v1');
  } catch { return null; }
}

/** A cheap fingerprint of the newest reviews, so new reviews earn a new reading. */
const mark = (reviews) => { let h = 0; for (const r of reviews.slice(0, 5)) for (const c of `${r.rating}${r.text.slice(0, 60)}`) h = (h * 31 + c.charCodeAt(0)) | 0; return String(h); };

export async function themesFor(key, reviews, { fresh = false, why = null } = {}) {
  if (!key || !Array.isArray(reviews) || !reviews.length) { if (why) why.reason = 'no-reviews'; return null; }
  const s = await store();
  const stamp = mark(reviews);
  try {
    const hit = s ? await s.get(key, { type: 'json' }) : null;
    if (hit?.ok && hit.mark === stamp && Date.now() - Date.parse(hit.fetchedAt) < WEEK) return hit;
  } catch { /* cache miss */ }
  if (!fresh || !hasThemesKey()) { if (why) why.reason = fresh ? 'no-key' : 'not-cached'; return null; }
  const got = await reviewThemes(reviews);
  if (!got.ok) { if (why) why.reason = got.error || 'failed'; return null; }
  const reading = { ...got, mark: stamp };
  try { if (s) await s.setJSON(key, reading); } catch { /* the reading still stands */ }
  return reading;
}
