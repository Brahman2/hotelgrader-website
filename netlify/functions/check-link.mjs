// POST /api/check-link  { hotel, city, state, k }
// Says whether an emailed report link is genuine, so the page can open that
// one hotel's report card without the email gate.

import { clean, json, matches } from '../lib/verify.mjs';
import { linkKey } from '../lib/report.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const secret = process.env.VERIFY_SECRET;
  if (!secret) return json(200, { ok: false });
  const hotel = clean(body.hotel);
  const ok = !!hotel && matches(clean(body.k), linkKey(secret, hotel, clean(body.city), clean(body.state)));
  return json(200, { ok });
};

export const config = {
  path: '/api/check-link',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
