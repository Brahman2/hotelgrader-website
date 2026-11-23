// Ads collector. Two public ad libraries, one search each:
// Google's Ads Transparency Center, searched by the hotel's website, and
// Meta's Ad Library, searched by the hotel's name. Both show that ads exist,
// never budget, targeting or return. Observed for the report, not graded.

import { search } from './serpapi.mjs';

const host = (u) => { try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const none = (error) => /hasn.t returned any results|no results/i.test(String(error ?? ''));
const day = (secs) => (typeof secs === 'number' && secs > 0 ? new Date(secs * 1000).toISOString().slice(0, 10) : '');

/** Google ads that ran for a website. `recent` counts the ones shown in the last 45 days. */
export async function googleAds({ site }) {
  const domain = host(site);
  if (!domain) return { ok: false, error: 'no-site', searches: 0 };
  const r = await search({ engine: 'google_ads_transparency_center', text: domain, num: '40' });
  const checkedAt = new Date().toISOString();
  if (!r.ok) return none(r.error) ? { ok: true, error: '', searches: 1, checkedAt, domain, total: 0, recent: 0, lastShown: '', advertisers: [], formats: [] } : { ok: false, error: r.error, searches: 0 };
  const ads = r.data.ad_creatives ?? [];
  const cutoff = Date.now() / 1000 - 45 * 86400;
  const last = Math.max(0, ...ads.map((a) => Number(a.last_shown) || 0));
  return {
    ok: true, error: '', searches: 1, checkedAt, domain,
    total: Number(r.data.search_information?.total_results) || ads.length,
    recent: ads.filter((a) => Number(a.last_shown) >= cutoff).length,
    lastShown: day(last),
    advertisers: [...new Set(ads.map((a) => String(a.advertiser ?? '')).filter(Boolean))].slice(0, 4),
    formats: [...new Set(ads.map((a) => String(a.format ?? '')).filter(Boolean))],
  };
}

/** Active Meta ads that mention the hotel by name. The report keeps only the ones run by a page that carries the hotel's name. */
export async function metaAds({ hotel }) {
  const q = String(hotel ?? '').trim();
  if (q.length < 3) return { ok: false, error: 'no-name', searches: 0 };
  const r = await search({ engine: 'meta_ad_library', q, country: 'US', active_status: 'active', search_type: 'keyword_exact_phrase', ad_type: 'all' });
  const checkedAt = new Date().toISOString();
  if (!r.ok) return none(r.error) ? { ok: true, error: '', searches: 1, checkedAt, query: q, ads: [] } : { ok: false, error: r.error, searches: 0 };
  // The list has carried more than one name; take the first array of ads we find.
  const list = [r.data.ads, r.data.ads_results, r.data.results].find((x) => Array.isArray(x)) ?? Object.values(r.data).find((v) => Array.isArray(v) && v[0]?.page_name) ?? [];
  return {
    ok: true, error: '', searches: 1, checkedAt, query: q,
    ads: list.slice(0, 30).map((a) => ({ page: String(a.page_name ?? ''), pageId: String(a.page_id ?? ''), started: String(a.start_date ?? ''), platforms: Array.isArray(a.publisher_platforms) ? a.publisher_platforms : [] })).filter((a) => a.page),
    blocks: Object.keys(r.data).filter((k) => !/^search_|^serpapi_/.test(k)).slice(0, 12),
  };
}

/** Both libraries. Up to two searches. */
export async function scanAds({ hotel, site }) {
  const [google, meta] = await Promise.all([googleAds({ site }), metaAds({ hotel })]);
  return { ok: google.ok || meta.ok, checkedAt: new Date().toISOString(), google: google.ok ? google : null, meta: meta.ok ? meta : null, errors: [google, meta].filter((x) => !x.ok).map((x) => x.error), searches: google.searches + meta.searches };
}
