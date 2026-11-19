// POST /api/send-code  { name, email, hotel }
// Emails a 6-digit code and returns a signed token for /api/verify-code.
//
// Needs three site environment variables in Netlify:
//   RESEND_API_KEY  the Resend key that sends the email
//   VERIFY_SECRET   any long random string; signs the codes
//   MAIL_FROM       optional sender, e.g. "hotelgrader <verify@hotelgrader.com>"

import { randomInt } from 'node:crypto';
import { CODE_TTL_MS, EMAIL_RE, clean, escapeHtml, json, sendMail, sign } from '../lib/verify.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }

  const name = clean(body.name).slice(0, 60);
  const email = clean(body.email).toLowerCase().slice(0, 200);
  const hotel = clean(body.hotel).slice(0, 120);
  if (!name) return json(400, { error: 'Enter your first name.' });
  if (!EMAIL_RE.test(email)) return json(400, { error: 'That doesn’t look like an email address.' });

  if (!process.env.RESEND_API_KEY || !process.env.VERIFY_SECRET) {
    return json(503, { error: 'Email verification isn’t set up yet.' });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const exp = Date.now() + CODE_TTL_MS;
  const about = hotel ? `the report card for ${hotel}` : 'your report card';

  const sent = await sendMail({
    to: email,
    subject: `${code} is your hotelgrader code`,
    text: `Hi ${name},\n\nYour code is ${code}\n\nEnter it on hotelgrader to see ${about}. It works for 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;color:#14151A">
<p>Hi ${escapeHtml(name)},</p>
<p>Your code is</p>
<p style="font-family:ui-monospace,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:6px;margin:8px 0 16px">${code}</p>
<p>Enter it on hotelgrader to see ${escapeHtml(about)}. It works for 10 minutes.</p>
<p style="color:#6b6c72;font-size:13px">If you didn't ask for this, you can ignore this email.</p>
</div>`,
  }).catch(() => false);

  if (!sent) return json(502, { error: 'We couldn’t send the code. Try again in a minute.' });
  return json(200, { token: `${exp}.${sign(process.env.VERIFY_SECRET, email, code, exp)}` });
};

export const config = {
  path: '/api/send-code',
  // At most 5 code emails a minute from one address.
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
