// The page speed reading for a website, cached for a day. Running it takes
// 10 to 25 seconds, so the scan itself only ever reads the cache; the page
// asks /api/speed to do the run on the side.

import { scanSpeed, hasSpeedKey } from '../../scanner/speed.mjs';
import { publicUrl } from '../../scanner/site.mjs';

const DAY = 24 * 60 * 60 * 1000;

async function store() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore('speed-scans-v1');
  } catch { return null; }
}

const keyOf = (url) => url.hostname.replace(/^www\./, '') + (url.pathname.length > 1 ? url.pathname.replace(/[^a-z0-9]+/gi, '_') : '');
const freshHit = (hit) => (hit?.ok && hit.fetchedAt && Date.now() - Date.parse(hit.fetchedAt) < DAY ? hit : null);

/** What the cache holds for a site, and whether a background run was started in the last two minutes. */
export async function speedState(rawUrl) {
  const url = publicUrl(rawUrl);
  if (!url) return { url: null, hit: null, running: false };
  const s = await store();
  let hit = null;
  let running = false;
  try { hit = freshHit(s ? await s.get(keyOf(url), { type: 'json' }) : null); } catch { hit = null; }
  try { const r = s ? await s.get(`${keyOf(url)}:running`, { type: 'json' }) : null; running = !!r?.at && Date.now() - Date.parse(r.at) < 120000; } catch { running = false; }
  return { url, hit, running };
}

/** Note that a background run has started, so a second visitor doesn't start another. */
export async function markRunning(rawUrl) {
  const url = publicUrl(rawUrl);
  const s = await store();
  try { if (url && s) await s.setJSON(`${keyOf(url)}:running`, { at: new Date().toISOString() }); } catch { /* best effort */ }
}

/**
 * From cache when fresh; run now only when `fresh` is set and a key exists. Null when there's nothing.
 * `background` is for the background function, which has minutes to spend: both runs at once, long timeouts.
 */
export async function speedFor(rawUrl, { fresh = false, why = null, background = false } = {}) {
  const { url, hit } = await speedState(rawUrl);
  if (!url) { if (why) why.reason = 'no-site'; return null; }
  const whole = hit && hit.mobile && hit.desktop;
  // A cached reading with one run missing is still served; a fresh call fills in the other run.
  if (whole || (hit && !fresh)) return hit;
  if (!fresh || !hasSpeedKey()) { if (why) why.reason = fresh ? 'no-key' : 'not-cached'; return hit; }
  const got = await scanSpeed(url.toString(), background ? { have: hit, both: true, timeout: 100000 } : { have: hit });
  const s = await store();
  try { if (s && got.ok) await s.setJSON(keyOf(url), got); } catch { /* the reading still stands */ }
  if (!got.ok && why) why.reason = got.error || 'failed';
  return got.ok ? got : hit;
}
