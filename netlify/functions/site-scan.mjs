// POST /api/site-scan  { hotel, city, state }
// Reads the hotel's own website (home page, robots.txt, sitemap, first page of
// the booking engine) and returns what it found. The address comes from the
// finished scan on the server, never from the browser, so this can't be pointed
// at an arbitrary URL.

import { clean, json } from '../lib/verify.mjs';
import { fetchAudit } from '../lib/report.mjs';
import { siteFor } from '../lib/site.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const hotel = clean(body.hotel).slice(0, 120);
  if (!hotel) return json(400, { error: 'Bad request.' });

  const audit = await fetchAudit(hotel, clean(body.city).slice(0, 80), clean(body.state).slice(0, 80)).catch(() => null);
  if (!audit) return json(409, { error: 'That scan isn’t ready yet.' });
  const crawl = await siteFor(audit).catch(() => null);
  return json(200, { crawl });
};

export const config = {
  path: '/api/site-scan',
  rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
