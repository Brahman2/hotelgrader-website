// POST /api/send-code  { name, email, hotel, theme }
// Emails a 6-digit code and returns a signed token for /api/verify-code.
//
// Needs three site environment variables in Netlify:
//   RESEND_API_KEY  the Resend key that sends the email
//   VERIFY_SECRET   any long random string; signs the codes
//   MAIL_FROM       optional sender, e.g. "hotelgrader <verify@hotelgrader.com>"

import { randomInt } from 'node:crypto';
import { CODE_TTL_MS, EMAIL_RE, clean, json, sendMail, sign } from '../lib/verify.mjs';
import { codeEmail } from '../lib/email.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }

  const name = clean(body.name).slice(0, 60);
  const email = clean(body.email).toLowerCase().slice(0, 200);
  const hotel = clean(body.hotel).slice(0, 120);
  if (!name) return json(400, { error: 'Enter your name.' });
  if (!EMAIL_RE.test(email)) return json(400, { error: 'That doesn’t look like an email address.' });

  if (!process.env.RESEND_API_KEY || !process.env.VERIFY_SECRET) {
    return json(503, { error: 'Email verification isn’t set up yet.' });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const exp = Date.now() + CODE_TTL_MS;
  // The email is styled to match the theme the visitor is looking at.
  const mail = codeEmail({ theme: clean(body.theme), name, code, hotel });
  const sent = await sendMail({ to: email, ...mail }).catch(() => false);

  if (!sent) return json(502, { error: 'We couldn’t send the code. Try again in a minute.' });
  return json(200, { token: `${exp}.${sign(process.env.VERIFY_SECRET, 'code', email, code, exp)}` });
};

export const config = {
  path: '/api/send-code',
  // At most 5 code emails a minute from one address.
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
