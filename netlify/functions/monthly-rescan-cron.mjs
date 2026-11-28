// Scheduled: 10:00 UTC on the 25th. Starts the monthly re-scan if the program is enabled in /admin.

import { getSettings, trigger } from '../lib/monthly.mjs';

export default async () => {
  const s = await getSettings();
  if (s.enabled) await trigger('monthly-rescan-background');
};

export const config = { schedule: '0 10 25 * *' };
