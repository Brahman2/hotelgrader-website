// Scheduled: 17:00 UTC on the 1st (7am Honolulu, 9am Pacific, noon Eastern). Starts the monthly send if the
// program is enabled in /admin. The send itself checks live mode and every approval before mailing anyone.

import { getSettings, trigger } from '../lib/monthly.mjs';

export default async () => {
  const s = await getSettings();
  if (s.enabled) await trigger('monthly-send-background');
};

export const config = { schedule: '0 17 1 * *' };
