// Server-side read of a finished scan, for the report email. It runs the same
// assessment the page runs (shared/assess.mjs), so the email matches the page.

import { sign } from './verify.mjs';
import { assess, letterFor } from '../../shared/assess.mjs';

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

export function summarize(audit, crawl = null) {
  const a = assess(audit, crawl);
  const c = audit._meta?.competitors;
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
      max: Math.max(...p.rows.slice(0, 6).map((r) => r.rate)),
      checkIn: p.night
        ? new Date(`${p.night}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        : '',
    } : null,
    ads: a.ads && a.ads.rivals.length >= 2 ? [{ ...a.ads.you, you: true }, ...a.ads.rivals] : null,
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
