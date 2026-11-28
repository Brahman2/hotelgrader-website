// Server-side read of a finished scan, for the report email. It runs the same
// assessment the page runs (shared/assess.mjs), so the email matches the page.

import { sign } from './verify.mjs';
import { assess, compSet, letterFor } from '../../shared/assess.mjs';

export { letterFor };

const API = process.env.PUBLIC_HG_API || 'https://web-production-13e22.up.railway.app';

/** The finished scan for a hotel, or null if the API has none ready. */
export async function fetchAudit(hotel, city, state) {
  const res = await fetch(`${API}/api/analyze-hotel-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hotel_name: hotel, city, state, force_refresh: false, role: 'general_manager' }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body && body.cached && body.data ? body.data : null;
}

const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

export function summarize(audit, crawl = null, live = null) {
  const a = assess(audit, crawl, live);
  const c = compSet(audit, live) ?? audit._meta?.competitors;
  const p = a.prices;
  return {
    hotel: audit.hotelName,
    place: a.identity.place,
    graded: a.graded,
    score: a.score,
    letter: a.letter,
    coverage: Math.round(a.coverage * 100),
    version: a.version,
    keyFinding: a.headline,
    rank: c?.rating_rank != null && c?.total_in_set != null ? { place: c.rating_rank, total: c.total_in_set } : null,
    market: a.choice ? {
      own: a.choice.rows.find((r) => r.you),
      rivals: a.choice.rows.filter((r) => !r.you).slice(0, 5),
    } : null,
    sections: a.functions.filter((f) => f.score != null).map((f) => ({ name: f.name, score: f.score, letter: letterFor(f.score), weight: f.weight, seen: Math.round(f.coverage * 100) })),
    fixes: a.priorities.map((x) => ({ name: x.title, kind: x.type === 'fix' ? 'Fix' : x.type === 'investigate' ? 'Check first' : 'Operations', step: x.evidence, owner: x.owner })),
    prices: p ? {
      direct: p.direct ? p.direct.rate : null,
      cheaper: p.cheaper,
      total: p.others,
      lowest: p.lowest,
      rows: p.rows.slice(0, 6),
      second: p.nights.length >= 2 ? p.nights[1] : null,
      max: Math.max(...p.rows.slice(0, 6).map((r) => r.rate)),
      checkIn: p.night
        ? new Date(`${p.night}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        : '',
    } : null,
    // The hotel's own ads only.
    ads: a.ads && (a.ads.you.google != null || a.ads.you.meta != null) ? [{ ...a.ads.you, you: true }] : null,
    // Where the hotel shows for the searches travellers type. Shown, not graded.
    searches: a.visibility ? a.visibility.rows.map((r) => ({
      query: r.query, brand: r.kind === 'brand',
      hotel: r.kind === 'brand' ? (r.panel ? 'your panel shows' : 'no panel shown') : !r.boxShown ? 'not read' : r.box != null ? `${nth(r.box)} of ${r.boxSize}` : 'not on first page',
      web: r.organic != null ? nth(r.organic) : r.organicKnown ? 'not in top 10' : "couldn't tell",
      good: { hotel: r.kind === 'brand' ? !!r.panel : r.boxShown ? r.box != null : null, web: r.organic != null ? true : r.organicKnown ? false : null },
    })) : null,
    // The newest Google reviews and whether each got a reply.
    reviews: a.recent ? {
      total: a.recent.total, replied: a.recent.replied, low: a.recent.low, lowUnanswered: a.recent.lowUnanswered,
      rows: a.recent.rows.slice(0, 3).map((r) => ({ rating: r.rating, when: r.when, replied: r.replied, text: r.text.length > 170 ? `${r.text.slice(0, 170).replace(/\s+\S*$/, '')}…` : r.text })),
    } : null,
    // What guests keep saying, grouped from those reviews.
    themes: a.themes && (a.themes.positive.length || a.themes.negative.length) ? {
      reviews: a.themes.reviews,
      positive: a.themes.positive.slice(0, 4).map((t) => ({ theme: t.theme, mentions: t.mentions, quote: t.quote || '' })),
      negative: a.themes.negative.slice(0, 4).map((t) => ({ theme: t.theme, mentions: t.mentions, quote: t.quote || '', serious: t.severity === 'serious' })),
      max: Math.max(1, ...a.themes.positive.map((t) => t.mentions), ...a.themes.negative.map((t) => t.mentions)),
    } : null,
    // Where the hotel is listed: the booking sites that showed a rate, and the ratings on its Google listing.
    listings: a.listings && a.listings.total > 0 ? {
      total: a.listings.total, own: a.listings.own, nights: a.listings.nights,
      majors: a.listings.majors.map((m) => ({ name: m.name, listed: m.listed, low: m.low })),
      resellers: a.listings.others.length,
      ratings: [
        ...(a.listings.google ? [{ source: 'Google', rating: a.listings.google.rating, max: 5, reviews: a.listings.google.reviews }] : []),
        ...a.listings.reviewSites.slice(0, 3),
      ],
    } : null,
    // The page speed test on a phone, and what real visitors measured.
    speed: a.speed && (a.speed.mobile || a.speed.desktop) ? {
      mobile: a.speed.mobile?.score ?? null, desktop: a.speed.desktop?.score ?? null,
      lcp: (a.speed.mobile ?? a.speed.desktop).lcp, tbt: (a.speed.mobile ?? a.speed.desktop).tbt,
      bytes: (a.speed.mobile ?? a.speed.desktop).bytes,
      field: a.speed.field ? { overall: a.speed.field.overall, origin: a.speed.field.origin, lcp: a.speed.field.lcp?.value ?? null } : null,
    } : null,
    flags: a.identity.flags,
  };
}

/** Signature that lets an emailed link open one hotel's report without the gate. */
export function linkKey(secret, hotel, city, state) {
  return sign(secret, 'open', String(hotel).toLowerCase(), String(city).toLowerCase(), String(state).toLowerCase()).slice(0, 32);
}

export function reportLink(secret, hotel, city, state) {
  const base = (process.env.URL || 'https://hotelgrader.com').replace(/\/$/, '');
  const q = new URLSearchParams({ hotel, city, state, k: linkKey(secret, hotel, city, state) });
  return `${base}/grade/?${q.toString()}`;
}
