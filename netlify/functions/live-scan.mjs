// POST /api/live-scan  { hotel, city, state }
// Our own readings that cost a search each: Google's hotel prices on two
// nights, the lowest rate shown for hotels nearby, and the brand search.
// Only runs for a hotel that already has a finished scan, so the search
// budget can't be spent on arbitrary text.

import { clean, json } from '../lib/verify.mjs';
import { fetchAudit } from '../lib/report.mjs';
import { liveFor } from '../lib/live.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const hotel = clean(body.hotel).slice(0, 120);
  if (!hotel) return json(400, { error: 'Bad request.' });

  const audit = await fetchAudit(hotel, clean(body.city).slice(0, 80), clean(body.state).slice(0, 80)).catch(() => null);
  if (!audit) return json(409, { error: 'That scan isn’t ready yet.' });
  const live = await liveFor(audit).catch(() => ({ prices: null, search: null, ai: null }));
  return json(200, { live });
};

export const config = {
  path: '/api/live-scan',
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
