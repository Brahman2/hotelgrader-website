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

/** From cache when fresh; run now only when `fresh` is set and a key exists. Null when there's nothing. */
export async function speedFor(rawUrl, { fresh = false } = {}) {
  const url = publicUrl(rawUrl);
  if (!url) return null;
  const key = url.hostname.replace(/^www\./, '') + (url.pathname.length > 1 ? url.pathname.replace(/[^a-z0-9]+/gi, '_') : '');
  const s = await store();
  try {
    const hit = s ? await s.get(key, { type: 'json' }) : null;
    if (hit?.ok && hit.fetchedAt && Date.now() - Date.parse(hit.fetchedAt) < DAY) return hit;
  } catch { /* cache miss */ }
  if (!fresh || !hasSpeedKey()) return null;
  const got = await scanSpeed(url.toString());
  try { if (s && got.ok) await s.setJSON(key, got); } catch { /* the reading still stands */ }
  return got.ok ? got : null;
}
