// POST /api/correction  { hotel, city, state, message, name?, email? }
// A visitor says something in a report is wrong. The note goes to the team
// (LEADS_TO). Free to send, no verification needed: a correction is a favour.

import { clean, escapeHtml, json, sendMail } from '../lib/verify.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }
  if (!process.env.RESEND_API_KEY || !process.env.LEADS_TO) return json(503, { error: 'Corrections aren’t set up yet.' });

  const message = clean(body.message).slice(0, 2000);
  const hotel = clean(body.hotel).slice(0, 120);
  if (message.length < 5 || !hotel) return json(400, { error: 'Tell us what is wrong.' });
  const where = [hotel, clean(body.city).slice(0, 80), clean(body.state).slice(0, 80)].filter(Boolean).join(', ');
  const from = [clean(body.name).slice(0, 60), clean(body.email).slice(0, 200)].filter(Boolean).join(' / ') || 'not given';

  const sent = await sendMail({
    to: process.env.LEADS_TO,
    subject: `Report correction: ${hotel}`,
    text: `A visitor says something in a hotelgrader report is wrong.\n\nHotel: ${where}\nFrom: ${from}\n\n${message}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#14151A">
<p style="margin:0 0 12px;font-weight:600">Report correction</p>
<p style="margin:0;color:#5E5F66">Hotel: ${escapeHtml(where)}<br>From: ${escapeHtml(from)}</p>
<p style="margin:14px 0 0;white-space:pre-wrap">${escapeHtml(message)}</p></div>`,
  }).catch(() => false);
  return sent ? json(200, { ok: true }) : json(502, { error: 'We couldn’t send that.' });
};

export const config = {
  path: '/api/correction',
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
