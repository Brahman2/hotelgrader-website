// Server-side read of a finished scan, for the report email. Same cutoffs and
// the same "measured" test the site uses, so the email matches the page.

import { sign } from './verify.mjs';

const API = process.env.PUBLIC_HG_API || 'https://web-production-13e22.up.railway.app';

const SECTIONS = [
  ['searchAndAI', 'GEO & AI Visibility'], ['digitalPresence', 'Website & Digital Presence'],
  ['reputation', 'Reputation Management'], ['socialMedia', 'Social Media'],
  ['advertising', 'Advertising & Brand'], ['booking', 'Booking & Distribution'],
  ['competitive', 'Competitive Intelligence'],
];
const CUTOFFS = [[95, 'A+'], [90, 'A'], [85, 'B+'], [80, 'B'], [75, 'C+'], [70, 'C'], [65, 'D+'], [60, 'D']];

export function letterFor(score) {
  if (score == null) return '-';
  for (const [min, l] of CUTOFFS) if (score >= min) return l;
  return 'F';
}
const measured = (m) => !!m.verified && m.score != null && !/not collected|no data/i.test(m.insight ?? '');

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

const same = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

export function summarize(audit) {
  const c = audit._meta?.competitors;
  const all = SECTIONS.flatMap(([key]) => audit.categories?.[key]?.metrics ?? []).filter(measured);
  const fixes = [...all].sort((a, b) => a.score - b.score).filter((m) => m.score < 85).slice(0, 5).map((m) => {
    const step = (m.actionSteps ?? []).find((s) => s.action);
    return { name: m.name, score: m.score, letter: letterFor(m.score), step: step ? String(step.action).replace(/[.:]\s*$/, '') + '.' : '' };
  });

  // The API sometimes writes a section's internal key into its summary sentence.
  let keyFinding = audit.executiveSummary?.keyFinding || '';
  for (const [key, name] of SECTIONS) keyFinding = keyFinding.split(key).join(name);

  // One night's price on the hotel's own site against the booking sites.
  const bp = audit._meta?.booking_pricing;
  const rates = (bp?.ota_rates ?? []).filter((r) => r && r.rate > 0 && r.source);
  let prices = null;
  if (rates.length >= 3) {
    const direct = rates.find((r) => same(r.source, bp?.matched_name) || same(r.source, audit.hotelName)) || null;
    const others = rates.filter((r) => r !== direct).sort((a, b) => a.rate - b.rate);
    const rows = [...(direct ? [{ ...direct, mine: true }] : []), ...others.slice(0, 5)].sort((a, b) => a.rate - b.rate);
    prices = {
      direct: direct ? direct.rate : null,
      cheaper: direct ? others.filter((r) => r.rate < direct.rate).length : 0,
      total: others.length,
      lowest: others[0] || null,
      rows,
      max: Math.max(...rows.map((r) => r.rate)),
      checkIn: bp?.identity?.check_in
        ? new Date(`${bp.identity.check_in}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        : '',
    };
  }

  // Which hotels in the set run ads.
  const adRivals = audit._meta?.compset_ads?.competitors ?? [];
  const mine = audit.categories?.advertising?.metrics ?? [];
  const g = mine.find((m) => /google ads/i.test(m.name))?.verified_data;
  const f = mine.find((m) => /meta ads/i.test(m.name))?.verified_data;
  const ads = adRivals.length >= 2 ? [
    { name: audit.hotelName, you: true, google: g?.registry?.checked ? !!(g.runs_ads_registry ?? g.registry.runs_ads_registry) : null, meta: f?.status === 'ok' ? !!f.running_ads : null },
    ...adRivals.map((r) => ({ name: r.name, google: r.google_ads ?? null, meta: r.meta_ads ?? null })),
  ] : null;

  return {
    hotel: audit.hotelName,
    place: [audit.city, audit.state].filter(Boolean).join(', '),
    score: audit.overallScore,
    letter: letterFor(audit.overallScore),
    keyFinding,
    rank: c?.rating_rank != null && c?.total_in_set != null ? { place: c.rating_rank, total: c.total_in_set } : null,
    tally: {
      fix: all.filter((m) => m.score < 70).length,
      improve: all.filter((m) => m.score >= 70 && m.score < 85).length,
      good: all.filter((m) => m.score >= 85).length,
    },
    market: c?.own_rating != null ? {
      own: { name: audit.hotelName, rating: c.own_rating, reviews: c.own_reviews },
      rivals: (c.top_competitors ?? []).slice(0, 5),
    } : null,
    sections: SECTIONS.map(([key, name]) => {
      const score = audit.categories?.[key]?.score ?? null;
      return { name, score, letter: letterFor(score) };
    }),
    fixes,
    prices,
    ads,
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
