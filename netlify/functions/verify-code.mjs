// POST /api/verify-code  { name, email, code, token, hotel, city, state }
// Checks the code against the signed token from /api/send-code. On success it
// records the lead (Netlify Forms, plus an optional email to LEADS_TO) and
// returns a proof the browser keeps so the visitor isn't asked again.

import { EMAIL_RE, clean, escapeHtml, json, matches, sendMail, sign } from '../lib/verify.mjs';

async function recordLead(lead) {
  const jobs = [];
  if (process.env.URL) {
    // Same hidden form the site declares in grade.astro.
    jobs.push(fetch(`${process.env.URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'form-name': 'report-card', ...lead }).toString(),
    }));
  }
  if (process.env.LEADS_TO) {
    const where = [lead.hotel, lead.city, lead.state].filter(Boolean).join(', ');
    jobs.push(sendMail({
      to: process.env.LEADS_TO,
      subject: `New hotelgrader lead: ${lead.name}${lead.hotel ? ` (${lead.hotel})` : ''}`,
      text: `${lead.name} <${lead.email}> verified their email.\nHotel: ${where || 'not given'}`,
      html: `<p><strong>${escapeHtml(lead.name)}</strong> &lt;${escapeHtml(lead.email)}&gt; verified their email.</p><p>Hotel: ${escapeHtml(where || 'not given')}</p>`,
    }));
  }
  await Promise.allSettled(jobs); // a failed notification never blocks the visitor
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }

  const secret = process.env.VERIFY_SECRET;
  if (!secret) return json(503, { error: 'Email verification isn’t set up yet.' });

  const email = clean(body.email).toLowerCase().slice(0, 200);
  const code = clean(body.code).replace(/\D/g, '');
  const [expRaw, sig] = clean(body.token).split('.');
  const exp = Number(expRaw);
  if (!EMAIL_RE.test(email) || code.length !== 6 || !exp || !sig) return json(400, { error: 'Enter the 6-digit code from the email.' });
  if (Date.now() > exp) return json(410, { error: 'That code has expired. Send a new one.' });
  if (!matches(sig, sign(secret, email, code, exp))) return json(401, { error: 'That code isn’t right. Check the email and try again.' });

  await recordLead({
    name: clean(body.name).slice(0, 60),
    email,
    hotel: clean(body.hotel).slice(0, 120),
    city: clean(body.city).slice(0, 80),
    state: clean(body.state).slice(0, 80),
  });
  return json(200, { ok: true, proof: sign(secret, 'verified', email) });
};

export const config = {
  path: '/api/verify-code',
  // Slows down guessing: 10 attempts a minute from one address.
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
