// POST /api/send-report  { name, email, proof, hotel, city, state, theme }
// Emails the report card to a visitor who has already verified their address.
// The proof is the value verify-code handed back, so this can only send to an
// address that proved it owns its inbox. The content is read from the grading
// API here, not taken from the browser.

import { EMAIL_RE, clean, json, matches, sendMail, sign } from '../lib/verify.mjs';
import { reportEmail } from '../lib/email.mjs';
import { fetchAudit, reportLink, summarize } from '../lib/report.mjs';
import { logToSheet } from '../lib/sheet.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request.' }); }

  const secret = process.env.VERIFY_SECRET;
  if (!secret || !process.env.RESEND_API_KEY) return json(503, { error: 'Email isn’t set up yet.' });

  const email = clean(body.email).toLowerCase().slice(0, 200);
  const hotel = clean(body.hotel).slice(0, 120);
  const city = clean(body.city).slice(0, 80);
  const state = clean(body.state).slice(0, 80);
  if (!EMAIL_RE.test(email) || !hotel) return json(400, { error: 'Bad request.' });
  if (!matches(clean(body.proof), sign(secret, 'verified', email))) return json(401, { error: 'Verify your email first.' });

  const audit = await fetchAudit(hotel, city, state).catch(() => null);
  if (!audit) return json(409, { error: 'That report isn’t ready yet.' });

  const summary = summarize(audit);
  const link = reportLink(secret, hotel, city, state);
  const name = clean(body.name).slice(0, 60);
  const mail = reportEmail({ theme: clean(body.theme), name: name || 'there', summary, link });
  const [sent] = await Promise.all([
    sendMail({ to: email, ...mail }).catch(() => false),
    // Puts the grade on this lead's row in the sheet.
    logToSheet({ event: 'report', name, email, hotel, city, state, grade: summary.letter, score: summary.score, link }),
  ]);
  return sent ? json(200, { ok: true }) : json(502, { error: 'We couldn’t send the report.' });
};

export const config = {
  path: '/api/send-report',
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
