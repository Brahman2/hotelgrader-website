// Our own reading of a hotel's website, cached for a day so the page and the
// report email score the same evidence.

import { scanSite, publicUrl } from '../../scanner/site.mjs';
import { websiteOf } from '../../shared/assess.mjs';

const DAY = 24 * 60 * 60 * 1000;

async function store() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore('site-scans');
  } catch { return null; } // not on Netlify (local runs): no cache
}

/** The crawl for one website address: from cache when fresh, otherwise read now. Null when the address isn't usable. */
export async function crawlFor(rawUrl, { fresh = true } = {}) {
  const url = publicUrl(rawUrl);
  if (!url) return null;
  const key = url.hostname.replace(/^www\./, '') + (url.pathname.length > 1 ? url.pathname.replace(/[^a-z0-9]+/gi, '_') : '');
  const s = await store();
  try {
    const hit = s ? await s.get(key, { type: 'json' }) : null;
    if (hit?.fetchedAt && Date.now() - Date.parse(hit.fetchedAt) < DAY) return hit;
  } catch { /* cache miss */ }
  if (!fresh) return null;
  const crawl = await scanSite(url.toString());
  try { if (s && crawl.ok) await s.setJSON(key, crawl); } catch { /* cache write failed: the crawl still stands */ }
  return crawl;
}

/** The crawl for a finished grading-API scan's hotel. */
export const siteFor = (audit, opts) => crawlFor(websiteOf(audit), opts);
