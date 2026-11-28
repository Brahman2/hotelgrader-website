// POST /.netlify/functions/monthly-send-background  { forceTest? }
// Sends the monthly report card. Live sending happens only when the admin has approved the template and
// a sample and switched the program to live; otherwise it is a test run to MONTHLY_TEST_TO only.
// Only internal calls (signed with VERIFY_SECRET) are accepted.

import { sendMonthly, validInternal } from '../lib/monthly.mjs';

export default async (req) => {
  if (!validInternal(process.env.VERIFY_SECRET, req.headers.get('x-hg-internal'))) return;
  let body = {};
  try { body = await req.json(); } catch { /* no body */ }
  await sendMonthly({ forceTest: body.forceTest === true });
};
