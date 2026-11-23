// Market search collector. The searches a traveller types before they know
// which hotel they want ("hotels in Honolulu"): which sites hold the regular
// results. The search provider doesn't return Google's hotel box on these
// pages, so the hotels Google itself lists come from its hotel search instead
// (townRanking in prices.mjs).
//
// A reading belongs to the town, not to one hotel, so every hotel in the same
// town shares it. The report works out each hotel's place in it afterwards.

import { search } from './serpapi.mjs';
import { ownerOf, searchLocation } from './search.mjs';

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

/** The searches we read for a town. The third depends on the hotel's star class, when we know it. */
export function marketQueries({ city, hotelClass }) {
  const town = String(city ?? '').trim();
  if (!town) return [];
  const cls = Number(hotelClass);
  const third = cls >= 5 ? `luxury hotels in ${town}` : cls === 4 ? `4 star hotels in ${town}` : cls === 3 ? `3 star hotels in ${town}` : cls >= 1 ? `cheap hotels in ${town}` : '';
  return [`hotels in ${town}`, `best hotels in ${town}`, third].filter(Boolean);
}

function realHost(x) {
  const h = host(x.link ?? '');
  if (h && !/(^|\.)google\.[a-z.]+$/.test(h)) return h;
  const shown = String(x.displayed_link ?? '').split(/[\s›>]/)[0];
  const d = host(/^https?:/.test(shown) ? shown : `https://${shown}`);
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(d) ? d : '';
}

/** One search for one town. */
export async function marketSearch({ city, state, query }) {
  const location = searchLocation(city, state);
  const r = await search({ engine: 'google', q: query, gl: 'us', hl: 'en', google_domain: 'google.com', location, num: '10' });
  if (!r.ok) return { ok: false, error: r.error, query, searches: 0 };
  const d = r.data;
  const results = (d.organic_results ?? []).slice(0, 10).map((x, i) => {
    const domain = realHost(x);
    return { position: x.position ?? i + 1, title: String(x.title ?? '').slice(0, 140), domain, owner: ownerOf(domain, '') };
  });
  return {
    ok: true, error: '', searches: 1,
    query, location, checkedAt: new Date().toISOString(),
    results,
    readable: results.filter((x) => x.domain).length >= 5,
    kind: 'web',
    ads: (d.ads ?? []).length,
  };
}
