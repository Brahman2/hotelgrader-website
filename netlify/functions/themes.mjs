// POST /api/themes  { hotel, city, state }
// Groups the hotel's newest reviews into themes. The page calls it once the
// scan has read the reviews; the result is cached and later scans carry it.

import { clean, json } from '../lib/verify.mjs';
import { scanFor, scanKey } from '../lib/scan.mjs';
import { themesFor } from '../lib/themes.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const target = { hotel: clean(body.hotel).slice(0, 120), city: clean(body.city).slice(0, 80), state: clean(body.state).slice(0, 80) };
  if (target.hotel.length < 3) return json(400, { error: 'Bad request.' });
  // Only for reviews the scan itself collected, so this can't be handed arbitrary text.
  const scan = await scanFor(target, { fresh: false }).catch(() => null);
  const why = { reason: '' };
  const started = Date.now();
  const themes = await themesFor(scanKey(target), scan?.live?.reviews?.reviews ?? [], { fresh: true, why }).catch(() => null);
  return json(200, { themes, why: themes ? '' : why.reason, ms: Date.now() - started });
};

export const config = {
  path: '/api/themes',
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
