// POST /api/contact-hotel  { name, email, proof, hotel, city, state }
// A visitor who already verified their email grades another hotel: add it to their contact record and keep
// a baseline snapshot (cached readings only). The proof is the one verify-code handed back, so only a
// verified address can add hotels to itself.

import { EMAIL_RE, clean, json, matches, sign } from '../lib/verify.mjs';
import { recordContact } from '../lib/contacts.mjs';
import { baselineAtUnlock } from '../lib/monthly.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const secret = process.env.VERIFY_SECRET;
  if (!secret) return json(503, { error: 'Not set up.' });
  const email = clean(body.email).toLowerCase().slice(0, 200);
  const hotel = clean(body.hotel).slice(0, 120);
  if (!EMAIL_RE.test(email) || !hotel) return json(400, { error: 'Bad request.' });
  if (!matches(clean(body.proof), sign(secret, 'verified', email))) return json(401, { error: 'Verify your email first.' });
  const target = { hotel, city: clean(body.city).slice(0, 80), state: clean(body.state).slice(0, 80) };
  await recordContact({ email, name: clean(body.name).slice(0, 60), ...target, country: context?.geo?.country?.code ?? '', source: 'unlocked-browser' });
  await baselineAtUnlock(target).catch(() => null);
  return json(200, { ok: true });
};

export const config = {
  path: '/api/contact-hotel',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
