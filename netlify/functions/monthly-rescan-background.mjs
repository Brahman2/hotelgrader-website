// POST /.netlify/functions/monthly-rescan-background
// Re-scans every unlocked hotel within the monthly spend cap. Started by monthly-rescan-cron or the admin.
// Only internal calls (signed with VERIFY_SECRET) are accepted.

import { rescanAll, validInternal } from '../lib/monthly.mjs';

export default async (req) => {
  if (!validInternal(process.env.VERIFY_SECRET, req.headers.get('x-hg-internal'))) return;
  await rescanAll();
};
