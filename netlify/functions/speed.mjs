// POST /api/speed  { hotel, city, state }
// Runs the page speed test for the hotel's website, which is too slow to sit
// inside the scan. The page calls it once the scan has found the website.

import { clean, json } from '../lib/verify.mjs';
import { scanFor } from '../lib/scan.mjs';
import { speedFor } from '../lib/speed.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const hotel = clean(body.hotel).slice(0, 120);
  if (hotel.length < 3) return json(400, { error: 'Bad request.' });
  // Only for a hotel the scan already knows, so this can't be pointed at any address.
  const scan = await scanFor({ hotel, city: clean(body.city).slice(0, 80), state: clean(body.state).slice(0, 80) }, { fresh: false }).catch(() => null);
  const site = scan?.crawl?.finalUrl || scan?.crawl?.url || scan?.live?.prices?.hotel?.link || '';
  // `why` says what stopped it when there's no reading: no-site, no-key, timeout, or Google's own error.
  const why = { reason: site ? '' : 'no-site' };
  const started = Date.now();
  const speed = site ? await speedFor(site, { fresh: true, why }).catch(() => null) : null;
  return json(200, { speed, why: speed ? '' : why.reason, ms: Date.now() - started });
};

export const config = {
  path: '/api/speed',
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
