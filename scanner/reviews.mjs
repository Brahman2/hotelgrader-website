// Reviews collector. The most recent Google reviews on the hotel's listing,
// and whether the hotel replied to each. One search.
//
// Google's listing also gathers reviews from other travel sites, but it only
// carries the hotel's replies for its own, so we read Google's alone: counting
// a Tripadvisor review as unanswered would be a guess.

import { search } from './serpapi.mjs';

/** "2 weeks ago" as a rough number of days, or null. Google gives no exact date. */
export function daysAgo(text) {
  const t = String(text ?? '').toLowerCase();
  const m = t.match(/(\d+|an?)\s+(day|week|month|year)s?\s+ago/);
  if (!m) return /today|hours? ago|minutes? ago|yesterday/.test(t) ? 1 : null;
  const n = /^an?$/.test(m[1]) ? 1 : Number(m[1]);
  return n * { day: 1, week: 7, month: 30, year: 365 }[m[2]];
}

const row = (r) => {
  const best = Number(r.best_rating) || 5;
  const rating = typeof r.rating === 'number' ? r.rating : null;
  const reply = r.response && (r.response.snippet || r.response.date) ? { when: String(r.response.date ?? ''), text: String(r.response.snippet ?? '').slice(0, 400) } : null;
  return {
    source: String(r.source ?? 'Google'),
    // Every site's score on a five-point scale, so they can be read together.
    rating: rating != null ? Math.round((rating / best) * 50) / 10 : null,
    when: String(r.date ?? ''), days: daysAgo(r.date),
    text: String(r.snippet ?? '').replace(/\|{2,}/g, ' ').replace(/^\(Translated by Google\)\s*/i, '').replace(/\(Original\)[\s\S]*$/i, '').replace(/\s+/g, ' ').trim().slice(0, 600),
    reply,
    sub: r.subratings && typeof r.subratings === 'object' ? r.subratings : null,
  };
};

/** The newest reviews for one listing. `token` is the Google hotel listing id from the price reading. */
export async function recentReviews({ token }) {
  if (!token) return { ok: false, error: 'no-listing', searches: 0 };
  const r = await search({ engine: 'google_hotels_reviews', property_token: token, sort_by: '2', source_number: '-1', hl: 'en' });
  if (!r.ok) return { ok: false, error: r.error, searches: 0 };
  const reviews = (r.data.reviews ?? []).map(row).filter((x) => x.rating != null || x.text);
  const replied = reviews.filter((x) => x.reply).length;
  return {
    ok: reviews.length > 0, error: reviews.length ? '' : 'none', searches: 1,
    fetchedAt: new Date().toISOString(), source: 'Google reviews, newest first',
    reviews, total: reviews.length, replied,
    more: !!r.data.serpapi_pagination?.next_page_token,
  };
}
