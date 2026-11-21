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

export function summarize(audit) {
  const c = audit._meta?.competitors;
  const all = SECTIONS.flatMap(([key]) => audit.categories?.[key]?.metrics ?? []).filter(measured);
  const fixes = [...all].sort((a, b) => a.score - b.score).filter((m) => m.score < 85).slice(0, 3).map((m) => {
    const step = (m.actionSteps ?? []).find((s) => s.action);
    return { name: m.name, score: m.score, letter: letterFor(m.score), step: step ? String(step.action).replace(/[.:]\s*$/, '') + '.' : '' };
  });
  return {
    hotel: audit.hotelName,
    place: [audit.city, audit.state].filter(Boolean).join(', '),
    score: audit.overallScore,
    letter: letterFor(audit.overallScore),
    keyFinding: audit.executiveSummary?.keyFinding || '',
    rank: c?.rating_rank != null && c?.total_in_set != null ? { place: c.rating_rank, total: c.total_in_set } : null,
    sections: SECTIONS.map(([key, name]) => {
      const score = audit.categories?.[key]?.score ?? null;
      return { name, score, letter: letterFor(score) };
    }),
    fixes,
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
