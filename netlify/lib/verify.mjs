// Shared by the two email-verification functions.
//
// No database: send-code signs (email + code + expiry) with VERIFY_SECRET and
// hands the signature back to the browser as a token. verify-code recomputes
// the signature from what the visitor typed. Only someone who read the email
// knows the code, and the token alone doesn't reveal it.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CODE_TTL_MS = 10 * 60 * 1000;

export const clean = (v) => (typeof v === 'string' ? v.trim() : '');

export function sign(secret, ...parts) {
  return createHmac('sha256', secret).update(parts.join('|')).digest('hex');
}

export function matches(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Send one email through Resend. Returns true when Resend accepted it. */
export async function sendMail({ to, subject, text, html, headers }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'hotelgrader <verify@hotelgrader.com>',
      to: [to],
      // Replies reach the team instead of bouncing off the send-only subdomain.
      ...(process.env.REPLY_TO || process.env.LEADS_TO ? { reply_to: process.env.REPLY_TO || process.env.LEADS_TO } : {}),
      subject,
      text,
      html,
      ...(headers ? { headers } : {}),
    }),
  });
  return res.ok;
}
