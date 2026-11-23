// Our own price reading for a hotel, cached for a day so the page and the
// report email score the same evidence and a repeat view spends nothing.

import { scanPrices } from '../../scanner/prices.mjs';
import { hasKey, searchesLeft } from '../../scanner/serpapi.mjs';

const DAY = 24 * 60 * 60 * 1000;
// Searches kept back each month so a busy day can't empty the plan.
const RESERVE = Number(process.env.SERPAPI_RESERVE || 10);

async function store() {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore('price-scans');
  } catch { return null; }
}

const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Prices for this scan's hotel: from cache when fresh, otherwise read now.
 * Null when there is no key, no budget, or nothing could be read.
 */
export async function pricesFor(audit, { fresh = true } = {}) {
  const target = {
    hotel: audit.hotelName, city: audit.city, state: audit.state,
    token: audit._meta?.booking_pricing?.identity?.hotel_identifier || '',
  };
  if (!target.hotel) return null;
  const key = [slug(target.hotel), slug(target.city), slug(target.state)].join('_');
  const s = await store();
  let hit = null;
  try { hit = s ? await s.get(key, { type: 'json' }) : null; } catch { /* cache miss */ }
  const isFresh = hit?.fetchedAt && Date.now() - Date.parse(hit.fetchedAt) < DAY;
  if (isFresh && hit.ok && hit.done) return hit;
  if (!fresh || !hasKey()) return isFresh && hit.ok ? hit : null;

  const left = await searchesLeft();
  if (left != null && left < RESERVE + 3) return isFresh && hit.ok ? hit : { ok: false, done: true, reason: 'budget', nights: [], area: null };

  const scan = await scanPrices(target);
  try { if (s && scan.ok) await s.setJSON(key, scan); } catch { /* cache write failed: the reading still stands */ }
  return scan.ok ? scan : (isFresh && hit.ok ? hit : scan);
}
