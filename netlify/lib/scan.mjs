// The scan runner. Builds a report's evidence from our own collectors, without
// waiting for the grading API: find the hotel on Google's hotel search and read
// its prices, then (once we know its website and star class) crawl the site,
// run the brand search and ask the AI question.
//
// Each reading is cached for a day on its own, so a call that runs out of time
// returns what it has with pending: true, and the next call picks up the rest.
// Searches cost money, so three limits apply: a monthly reserve, a cap on new
// hotels per day, and a name check before anything past the first search.

import { scanPrices } from '../../scanner/prices.mjs';
import { brandSearch } from '../../scanner/search.mjs';
import { aiAnswer } from '../../scanner/ai.mjs';
import { hasKey, searchesLeft } from '../../scanner/serpapi.mjs';
import { websiteOf } from '../../shared/assess.mjs';
import { fetchAudit } from './report.mjs';
import { crawlFor } from './site.mjs';

const DAY = 24 * 60 * 60 * 1000;
// Searches kept back each month so a busy day can't empty the plan.
const RESERVE = Number(process.env.SERPAPI_RESERVE || 10);
// The most one new hotel can spend: finding it, two nights, the hotels nearby, the brand search, one AI question.
const PER_SCAN = 6;
// New hotels scanned per day before we stop spending and lean on the grading API alone.
const DAILY_CAP = Number(process.env.SCAN_DAILY_CAP || 20);

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

const today = () => new Date().toISOString().slice(0, 10);

/** How many new hotels have been scanned today, and a way to count one more. */
async function dailyCount() {
  const s = await store('scan-budget');
  const key = `day-${today()}`;
  let n = 0;
  try { n = Number((await s?.get(key, { type: 'json' }))?.n ?? 0); } catch { /* treat as zero */ }
  return { n, bump: async () => { try { await s?.setJSON(key, { n: n + 1 }); } catch { /* best effort */ } } };
}

const within = (p, ms) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);

/**
 * Everything our own collectors know about one hotel.
 * Returns { base, crawl, live: { prices, search, ai }, pending, limited }.
 * `base` is an empty scan in the grading API's shape, so the assessment can run on our evidence alone.
 */
export async function scanFor({ hotel, city, state }, { fresh = true } = {}) {
  const target = { hotel: String(hotel ?? '').trim(), city: String(city ?? '').trim(), state: String(state ?? '').trim() };
  const empty = { base: null, crawl: null, live: { prices: null, search: null, ai: null }, pending: false, limited: '' };
  if (!target.hotel) return empty;
  const key = [slug(target.hotel), slug(target.city), slug(target.state)].join('_');
  const started = Date.now();

  // A finished grading-API scan, if one is already cached there. It can hand us the hotel's website and
  // Google listing id, which saves a search. We never wait long for it.
  const old = await within(fetchAudit(target.hotel, target.city, target.state), 3000);
  const token = old?._meta?.booking_pricing?.identity?.hotel_identifier || '';

  let budget;
  let limited = '';
  const haveBudget = async () => {
    if (!hasKey()) return false;
    if (budget === undefined) budget = await searchesLeft();
    if (budget != null && budget < RESERVE + PER_SCAN) { limited = 'monthly'; return false; }
    return true;
  };
  // Starting a new hotel also has to fit under today's cap.
  const mayStart = async () => {
    if (!(await haveBudget())) return false;
    const day = await dailyCount();
    if (day.n >= DAILY_CAP) { limited = 'daily'; return false; }
    await day.bump();
    return true;
  };

  // Round one: find the hotel and read its prices.
  const prices = await cached('price-scans-v6', key, { fresh, allowed: mayStart, complete: (p) => p.done !== false }, () => scanPrices({ ...target, token })).catch(() => null);
  const site = websiteOf(old ?? {}) || prices?.hotel?.link || '';

  // Round two needs the website and star class from round one. If round one just spent real time,
  // return now and let the page's next call do it, so no single call runs long.
  const slow = Date.now() - started > 3500;
  const go = fresh && !slow;
  const known = !!prices?.ok;
  const [crawl, search, ai] = await Promise.all([
    site ? crawlFor(site, { fresh: go }).catch(() => null) : null,
    known ? cached('brand-searches-v2', key, { fresh: go, allowed: haveBudget }, () => brandSearch({ ...target, site })).catch(() => null) : null,
    known ? cached('ai-answers-v3', key, { fresh: go, allowed: haveBudget }, () => aiAnswer({ ...target, hotelClass: prices.hotel?.hotelClass ?? null })).catch(() => null) : null,
  ]);
  const missing = (site && !crawl) || (known && hasKey() && (!search || !ai));
  const pending = fresh && (prices?.done === false || (slow && missing));

  const base = prices?.ok || crawl?.ok ? {
    hotelName: target.hotel, city: target.city, state: target.state, categories: {},
    _meta: { ownScan: true, generatedAt: prices?.fetchedAt ?? crawl?.fetchedAt ?? new Date().toISOString() },
  } : null;
  return { base, crawl, live: { prices, search, ai }, pending, limited };
}
