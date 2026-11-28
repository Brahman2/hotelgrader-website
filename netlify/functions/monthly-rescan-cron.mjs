// Scheduled: 10:00 UTC on the 25th to the 28th. Starts the monthly re-scan if the program is enabled in /admin.
// The later days resume a run that hit the background function's time limit; finished hotels are skipped.

import { getSettings, trigger } from '../lib/monthly.mjs';

export default async () => {
  const s = await getSettings();
  if (s.enabled) await trigger('monthly-rescan-background');
};

export const config = { schedule: '0 10 25-28 * *' };
