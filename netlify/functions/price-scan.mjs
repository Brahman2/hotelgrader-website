// POST /api/price-scan  { hotel, city, state }
// Reads Google's hotel prices for the hotel on two nights, and the lowest rate
// shown for the hotels around it. Only runs for a hotel that already has a
// finished scan, so the search budget can't be spent on arbitrary text.

import { clean, json } from '../lib/verify.mjs';
import { fetchAudit } from '../lib/report.mjs';
import { pricesFor } from '../lib/prices.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const hotel = clean(body.hotel).slice(0, 120);
  if (!hotel) return json(400, { error: 'Bad request.' });

  const audit = await fetchAudit(hotel, clean(body.city).slice(0, 80), clean(body.state).slice(0, 80)).catch(() => null);
  if (!audit) return json(409, { error: 'That scan isn’t ready yet.' });
  const prices = await pricesFor(audit).catch(() => null);
  return json(200, { prices });
};

export const config = {
  path: '/api/price-scan',
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
