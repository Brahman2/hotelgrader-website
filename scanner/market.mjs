// Market search collector. The searches a traveller types before they know
// which hotel they want ("hotels in Honolulu"): which sites hold the regular
// results, and which hotels Google shows in its own hotel box.
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

/** The hotels Google lists in its own box on the page. The response has carried them under several names. */
function hotelBox(d) {
  const from = (list, source) => (Array.isArray(list) && list.length ? { source, list } : null);
  const got = from(d.local_results?.places, 'local') ?? from(d.local_results, 'local')
    ?? from(d.answer_box?.hotels, 'hotels') ?? from(d.hotels_results?.hotels, 'hotels') ?? from(d.hotels_results, 'hotels')
    ?? from(d.answer_box?.results, 'hotels');
  if (!got) return { source: '', list: [] };
  const list = got.list.map((p, i) => ({
    position: i + 1,
    name: String(p.title ?? p.name ?? '').slice(0, 120),
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviews: typeof p.reviews === 'number' ? p.reviews : null,
  })).filter((p) => p.name).slice(0, 10);
  return { source: got.source, list };
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
  const box = hotelBox(d);
  return {
    ok: true, error: '', searches: 1,
    query, location, checkedAt: new Date().toISOString(),
    results,
    readable: results.filter((x) => x.domain).length >= 5,
    box: box.list, boxSource: box.source,
    ads: (d.ads ?? []).length,
    // Which blocks the page carried, kept so a missing hotel box can be told apart from one we failed to read.
    blocks: Object.keys(d).filter((k) => !/^search_|^pagination|^serpapi_/.test(k)).slice(0, 30),
  };
}
