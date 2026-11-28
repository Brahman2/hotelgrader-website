// Scheduled: 17:00 UTC on the 1st (7am Honolulu, 9am Pacific, noon Eastern), again at 19:00 and 21:00 to resume
// a run that hit the time limit (contacts already sent are skipped). Starts the monthly send if the
// program is enabled in /admin. The send itself checks live mode and every approval before mailing anyone.

import { getSettings, trigger } from '../lib/monthly.mjs';

export default async () => {
  const s = await getSettings();
  if (s.enabled) await trigger('monthly-send-background');
};

export const config = { schedule: '0 17,19,21 1 * *' };
