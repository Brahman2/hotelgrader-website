// POST /.netlify/functions/speed-run-background  { hotel, city, state }
// The page speed test for a hotel's website, run as a background function
// because Google's test can take longer than the 30 seconds an ordinary
// request is allowed. It writes its reading to the cache; /api/speed starts it
// and the page polls /api/speed for the result.

import { clean } from '../lib/verify.mjs';
import { scanFor } from '../lib/scan.mjs';
import { speedFor, markRunning } from '../lib/speed.mjs';

export default async (req) => {
  let body;
  try { body = await req.json(); } catch { return; }
  const hotel = clean(body.hotel).slice(0, 120);
  if (hotel.length < 3) return;
  // Only for a hotel the scan already knows, so this can't be pointed at any address.
  const scan = await scanFor({ hotel, city: clean(body.city).slice(0, 80), state: clean(body.state).slice(0, 80) }, { fresh: false }).catch(() => null);
  const site = scan?.crawl?.finalUrl || scan?.crawl?.url || scan?.live?.prices?.hotel?.link || '';
  if (!site) return;
  const got = await speedFor(site, { fresh: true, background: true }).catch(() => null);
  // Nothing came back at all: say so, so the page stops waiting.
  if (!got) await markRunning(site, { failed: true });
};
