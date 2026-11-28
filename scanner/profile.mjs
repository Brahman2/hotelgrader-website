// Google Business Profile collector. One Google Maps search for the hotel's name and town:
// whether Google has a profile for this hotel at all, and whether anyone has claimed it.
// Google Maps marks a listing nobody has claimed ("Own this business?"); SerpAPI returns
// that as unclaimed_listing: true on the place.

import { search } from './serpapi.mjs';
import { sameHotel } from './prices.mjs';

export async function googleProfile({ hotel, city, state }) {
  const q = [hotel, city, state].filter(Boolean).join(', ');
  const r = await search({ engine: 'google_maps', type: 'search', q, hl: 'en', gl: 'us' });
  if (!r.ok) return { ok: false, error: r.error, searches: 0 };
  const d = r.data;
  // One clear match comes back as the place itself; otherwise as a list to pick from.
  const candidates = [d.place_results, ...(Array.isArray(d.local_results) ? d.local_results : [])].filter(Boolean);
  const p = candidates.find((x) => sameHotel(x.title ?? '', hotel)) ?? null;
  return {
    ok: true,
    searches: 1,
    checkedAt: new Date().toISOString(),
    query: q,
    found: !!p,
    name: p?.title ?? '',
    unclaimed: p ? p.unclaimed_listing === true : null,
    placeId: p?.place_id ?? null,
    type: p?.type ?? '',
    rating: p?.rating ?? null,
    reviews: p?.reviews ?? null,
  };
}
