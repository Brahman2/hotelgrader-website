// GET or POST /api/unsubscribe?e=<email>&t=<signed token>
// One-click unsubscribe from the monthly report card. Clicking the link in the email unsubscribes at once;
// mail apps that show their own button send a POST with "List-Unsubscribe=One-Click" (RFC 8058).
// The page offers to undo it, in case the click was a mistake.

import { clean, escapeHtml as e } from '../lib/verify.mjs';
import { setUnsubscribed, validUnsubscribe } from '../lib/contacts.mjs';

const page = (title, body) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${e(title)} · hotelgrader</title>
<style>body{margin:0;background:#F5F5F7;color:#14151A;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}main{max-width:460px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #E2E2E8;border-radius:12px}h1{font-size:22px;margin:0 0 10px}p{color:#5E5F66;margin:0 0 14px}button{font:inherit;padding:10px 16px;border-radius:10px;border:1px solid #5B5BD6;background:#fff;color:#5B5BD6;cursor:pointer}a{color:#5B5BD6}</style></head>
<body><main>${body}</main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

export default async (req) => {
  const url = new URL(req.url);
  const email = clean(url.searchParams.get('e') ?? '').toLowerCase();
  const token = clean(url.searchParams.get('t') ?? '');
  const secret = process.env.VERIFY_SECRET;
  if (!secret || !validUnsubscribe(secret, email, token)) {
    return page('Link not valid', '<h1>That link isn’t valid</h1><p>It may have been cut off. Reply to any of our emails with “unsubscribe” and we’ll take you off the list.</p>');
  }
  let resubscribe = false;
  if (req.method === 'POST') {
    const form = await req.text().catch(() => '');
    resubscribe = new URLSearchParams(form).get('action') === 'resubscribe';
  }
  await setUnsubscribed(email, !resubscribe);
  const self = `/api/unsubscribe?${new URLSearchParams({ e: email, t: token })}`;
  return resubscribe
    ? page('Subscribed', `<h1>You’re back on the list</h1><p>${e(email)} will get the monthly report card again.</p><p><a href="https://hotelgrader.com">hotelgrader.com</a></p>`)
    : page('Unsubscribed', `<h1>You’re unsubscribed</h1><p>${e(email)} won’t get the monthly report card any more.</p>
<form method="post" action="${e(self)}"><input type="hidden" name="action" value="resubscribe"><button type="submit">That was a mistake, keep sending it</button></form>`);
};

export const config = { path: '/api/unsubscribe' };
