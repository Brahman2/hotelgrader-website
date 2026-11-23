// Our own readings that cost a search each (prices, brand search), cached for a
// day so the page and the report email score the same evidence and a repeat
// view spends nothing.

import { scanPrices } from '../../scanner/prices.mjs';
import { brandSearch } from '../../scanner/search.mjs';
import { hasKey, searchesLeft } from '../../scanner/serpapi.mjs';
import { websiteOf } from '../../shared/assess.mjs';

const DAY = 24 * 60 * 60 * 1000;
// Searches kept back each month so a busy day can't empty the plan.
const RESERVE = Number(process.env.SERPAPI_RESERVE || 10);
// The most one scan can spend: two nights, the hotels nearby, the brand search.
const PER_SCAN = 4;

async function store(name) {
  try {
    const { getStore } = await import('@netlify/blobs');
    return getStore(name);
  } catch { return null; } // not on Netlify (local runs): no cache
}

const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stampOf = (x) => x?.fetchedAt ?? x?.checkedAt;
const freshEnough = (x) => !!stampOf(x) && Date.now() - Date.parse(stampOf(x)) < DAY;

/** One cached reading. `read` runs only when the cache is stale and spending is allowed. */
async function cached(storeName, key, { fresh, allowed, complete = () => true }, read) {
  const s = await store(storeName);
  let hit = null;
  try { hit = s ? await s.get(key, { type: 'json' }) : null; } catch { /* cache miss */ }
  const usable = freshEnough(hit) && hit.ok ? hit : null;
  if (usable && complete(usable)) return usable;
  if (!fresh || !(await allowed())) return usable;
  const got = await read();
  try { if (s && got?.ok) await s.setJSON(key, got); } catch { /* cache write failed: the reading still stands */ }
  return got?.ok ? got : usable ?? got;
}

/**
 * { prices, search } for this scan's hotel. Either can be null: no key, no
 * budget left this month, or nothing could be read.
 */
export async function liveFor(audit, { fresh = true } = {}) {
  const target = {
    hotel: audit.hotelName, city: audit.city, state: audit.state,
    token: audit._meta?.booking_pricing?.identity?.hotel_identifier || '',
    site: websiteOf(audit),
  };
  if (!target.hotel) return { prices: null, search: null };
  const key = [slug(target.hotel), slug(target.city), slug(target.state)].join('_');

  // Ask the provider how many searches are left once, and only if something needs reading.
  let budget;
  const allowed = async () => {
    if (!hasKey()) return false;
    if (budget === undefined) budget = await searchesLeft();
    return budget == null || budget >= RESERVE + PER_SCAN;
  };

  const [prices, search] = await Promise.all([
    cached('price-scans-v4', key, { fresh, allowed, complete: (p) => p.done !== false }, () => scanPrices(target)).catch(() => null),
    cached('brand-searches-v2', key, { fresh, allowed }, () => brandSearch(target)).catch(() => null),
  ]);
  return { prices, search, outOfBudget: hasKey() && budget != null && budget < RESERVE + PER_SCAN };
}
