// POST /api/scan  { hotel, city, state }
// Our own scan of one hotel: prices on two nights, the hotels around it, its
// website and booking path, the brand search and one AI question. The page
// calls this while the slower grading API is still working, and again until
// `pending` is false.

import { clean, json } from '../lib/verify.mjs';
import { scanFor } from '../lib/scan.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const hotel = clean(body.hotel).slice(0, 120);
  if (hotel.length < 3) return json(400, { error: 'Bad request.' });
  const scan = await scanFor({ hotel, city: clean(body.city).slice(0, 80), state: clean(body.state).slice(0, 80) }).catch(() => null);
  return json(200, { scan });
};

export const config = {
  path: '/api/scan',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
