// POST /api/share-link  { email, proof, hotel, city, state }
// Hands a verified visitor the signed link for one hotel's report, the same
// link the report email carries. Anyone who opens it sees that report without
// the email gate.

import { EMAIL_RE, clean, json, matches, sign } from '../lib/verify.mjs';
import { reportLink } from '../lib/report.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const secret = process.env.VERIFY_SECRET;
  if (!secret) return json(503, { error: 'Sharing isn’t set up yet.' });

  const email = clean(body.email).toLowerCase().slice(0, 200);
  const hotel = clean(body.hotel).slice(0, 120);
  if (!EMAIL_RE.test(email) || !hotel) return json(400, { error: 'Bad request.' });
  if (!matches(clean(body.proof), sign(secret, 'verified', email))) return json(401, { error: 'Verify your email first.' });

  return json(200, { link: reportLink(secret, hotel, clean(body.city).slice(0, 80), clean(body.state).slice(0, 80)) });
};

export const config = {
  path: '/api/share-link',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
