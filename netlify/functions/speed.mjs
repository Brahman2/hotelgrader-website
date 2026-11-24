// POST /api/speed  { hotel, city, state }
// The page speed reading for the hotel's website. Google's test can take
// longer than a request is allowed to run, so this starts it as a background
// function and answers `pending: true`; the page asks again until it's in.
// If the background function can't be started, it runs one test inline.

import { clean, json } from '../lib/verify.mjs';
import { scanFor } from '../lib/scan.mjs';
import { speedFor, speedState, markRunning } from '../lib/speed.mjs';
import { hasSpeedKey } from '../../scanner/speed.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const target = { hotel: clean(body.hotel).slice(0, 120), city: clean(body.city).slice(0, 80), state: clean(body.state).slice(0, 80) };
  if (target.hotel.length < 3) return json(400, { error: 'Bad request.' });
  // Only for a hotel the scan already knows, so this can't be pointed at any address.
  const scan = await scanFor(target, { fresh: false }).catch(() => null);
  const site = scan?.crawl?.finalUrl || scan?.crawl?.url || scan?.live?.prices?.hotel?.link || '';
  if (!site) return json(200, { speed: null, why: 'no-site', pending: false });
  if (!hasSpeedKey()) return json(200, { speed: null, why: 'no-key', pending: false });

  const { hit, running, failed } = await speedState(site);
  if (hit?.mobile && hit?.desktop) return json(200, { speed: hit, why: '', pending: false });
  if (failed) return json(200, { speed: hit, why: 'failed', pending: false });
  // A run is under way: hand back what's cached so far and let the page ask again.
  if (running) return json(200, { speed: hit, why: '', pending: true });

  // Start the background run. It answers 202 at once when it's available.
  let started = false;
  try {
    const res = await fetch(new URL('/.netlify/functions/speed-run-background', req.url), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(target), signal: AbortSignal.timeout(5000),
    });
    started = res.status === 202;
  } catch { started = false; }
  if (started) { await markRunning(site); return json(200, { speed: hit, why: '', pending: true }); }

  // No background function here (a local run, or the plan doesn't have them): one test inline.
  const why = { reason: '' };
  const speed = await speedFor(site, { fresh: true, why }).catch(() => null);
  return json(200, { speed, why: speed ? '' : why.reason, pending: false });
};

export const config = {
  path: '/api/speed',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
