// Price collector. Reads what Google's hotel search shows for one hotel on two
// nights (a midweek night and a weekend night), and the lowest rate shown for
// the hotels around it on the first night. Read-only: it never opens a booking.
//
// What it can't see: whether two sites are selling the same room, and fees a
// site adds after the first price. The report says so wherever a gap is shown.

import { search } from './serpapi.mjs';

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Whether Google's listing name and the name the visitor typed are plausibly the same hotel. */
export function sameHotel(found, asked) {
  const words = (s) => norm(s).split(' ').filter((w) => w.length > 1 && !['the', 'hotel', 'hotels', 'resort', 'resorts', 'and', 'by', 'inn', 'suites', 'spa'].includes(w));
  const f = words(found), a = words(asked);
  if (!f.length || !a.length) return norm(found) === norm(asked);
  const shared = a.filter((w) => f.includes(w)).length;
  return shared >= Math.ceil(Math.min(a.length, f.length) / 2) && shared >= 1;
}

/** Rough US holiday periods, by month and day, when rates aren't typical. */
function isHoliday(d) {
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  return md >= 1218 || md <= 104 // Christmas and New Year
    || (md >= 1121 && md <= 1130) // Thanksgiving week
    || (md >= 701 && md <= 706) // Independence Day
    || (md >= 522 && md <= 531 && [5, 6, 0, 1].includes(d.getUTCDay())) // Memorial Day weekend
    || (md >= 830 && md <= 907 && [5, 6, 0, 1].includes(d.getUTCDay())) // Labor Day weekend
    || (md >= 212 && md <= 217 && [5, 6, 0, 1].includes(d.getUTCDay())); // Presidents' Day weekend
}

/** The two one-night stays we price: the first Tuesday three weeks out, the first Saturday five weeks out. */
export function sampleNights(today = new Date()) {
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const next = (from, weekday) => { let d = from; while (d.getUTCDay() !== weekday) d = addDays(d, 1); return d; };
  // Step past holiday periods a week at a time: a holiday rate says little about an ordinary week.
  const clear = (d) => { let x = d; for (let i = 0; i < 6 && isHoliday(x); i++) x = addDays(x, 7); return x; };
  const tue = clear(next(addDays(base, 21), 2));
  const sat = clear(next(addDays(base, 35), 6));
  return [
    { kind: 'midweek', checkIn: iso(tue), checkOut: iso(addDays(tue, 1)) },
    { kind: 'weekend', checkIn: iso(sat), checkOut: iso(addDays(sat, 1)) },
  ];
}

const money = (o) => { const n = o?.extracted_lowest ?? o?.extracted_display_price; return typeof n === 'number' && n > 0 ? n : null; };

function rateRows(d) {
  const seen = new Map();
  const take = (p, featured) => {
    if (!p?.source) return;
    const rate = money(p.rate_per_night);
    if (rate == null) return;
    const roomCancel = (p.rooms ?? []).some((r) => (r.rates ?? []).some((x) => x.free_cancellation));
    const row = {
      source: String(p.source).slice(0, 80), rate,
      beforeTax: p.rate_per_night?.extracted_before_taxes_fees ?? null,
      official: p.official === true,
      freeCancel: p.free_cancellation === true || roomCancel ? true : p.free_cancellation === false ? false : null,
      featured,
    };
    const k = norm(row.source);
    const old = seen.get(k);
    if (!old) seen.set(k, row);
    else seen.set(k, { ...(row.rate < old.rate ? row : old), official: old.official || row.official, freeCancel: old.freeCancel || row.freeCancel || (old.freeCancel ?? row.freeCancel) });
  };
  (d.featured_prices ?? []).forEach((p) => take(p, true));
  (d.prices ?? []).forEach((p) => take(p, false));
  return [...seen.values()].sort((a, b) => a.rate - b.rate);
}

function rooms(d) {
  const own = (d.featured_prices ?? []).find((p) => p.official === true);
  return (own?.rooms ?? []).map((r) => ({ name: String(r.name ?? '').slice(0, 80), rate: money(r.rate_per_night) })).filter((r) => r.name && r.rate != null).slice(0, 8);
}

const details = (d) => ({
  name: d.name ?? '', token: d.property_token ?? '', address: d.address ?? '', phone: d.phone ?? '', link: d.link ?? '',
  hotelClass: d.extracted_hotel_class ?? null, rating: d.overall_rating ?? null, reviews: d.reviews ?? null,
  lat: d.gps_coordinates?.latitude ?? null, lng: d.gps_coordinates?.longitude ?? null,
  // The listing itself, from the same response: no extra search.
  description: String(d.description ?? '').slice(0, 600),
  checkIn: d.check_in_time ?? '', checkOut: d.check_out_time ?? '',
  photos: Array.isArray(d.images) ? d.images.length : null,
  // A few of the listing's own photo thumbnails, for the scan screen.
  images: (Array.isArray(d.images) ? d.images : []).map((i) => i?.thumbnail).filter((u) => typeof u === 'string' && u.startsWith('https://')).slice(0, 6),
  amenities: Array.isArray(d.amenities) ? d.amenities.slice(0, 60) : [],
  stars: (Array.isArray(d.ratings) ? d.ratings : []).slice(0, 5).map((r) => ({ stars: r.stars, count: r.count })).filter((r) => r.stars >= 1 && r.count >= 0),
  // Google's own grouping of what reviewers mention, counted across every review it holds.
  topics: (Array.isArray(d.reviews_breakdown) ? d.reviews_breakdown : []).slice(0, 14).map((t) => ({ name: String(t.name ?? '').slice(0, 40), mentions: t.total_mentioned ?? 0, positive: t.positive ?? 0, negative: t.negative ?? 0 })).filter((t) => t.name && t.mentions > 0),
  // Ratings Google shows from other review sites. The sample review text it attaches is not kept.
  otherSites: (Array.isArray(d.other_reviews) ? d.other_reviews : []).slice(0, 6).map((o) => ({ source: String(o.source ?? '').slice(0, 40), rating: o.source_rating?.score != null ? Math.round(o.source_rating.score * 10) / 10 : null, max: o.source_rating?.max_score ?? null, reviews: o.reviews ?? null })).filter((o) => o.source),
  locationRating: d.location_rating ?? null,
  ecoCertified: d.eco_certified ?? null,
  typical: d.typical_price_range ? { low: d.typical_price_range.extracted_lowest ?? null, high: d.typical_price_range.extracted_highest ?? null } : null,
});

const listRow = (p) => ({
  name: p.name ?? '', token: p.property_token ?? '', type: p.type ?? '',
  rate: money(p.rate_per_night), rating: p.overall_rating ?? null, reviews: p.reviews ?? null,
  hotelClass: p.extracted_hotel_class ?? null,
  lat: p.gps_coordinates?.latitude ?? null, lng: p.gps_coordinates?.longitude ?? null,
});

const common = { engine: 'google_hotels', adults: '2', currency: 'USD', gl: 'us', hl: 'en' };

/** Rates for one hotel on one night. Pass the property token when known; otherwise it searches by name. */
export async function nightQuote({ token, hotel, city, state }, night) {
  const params = { ...common, check_in_date: night.checkIn, check_out_date: night.checkOut };
  let r = await search(token ? { ...params, property_token: token } : { ...params, q: [hotel, city, state].filter(Boolean).join(', ') });
  let searches = r.ok ? 1 : 0;
  // A name search can come back as a list. Take the closest name and read its details.
  if (r.ok && !r.data.property_token && Array.isArray(r.data.properties)) {
    const want = norm(hotel);
    const pick = r.data.properties.find((p) => norm(p.name) === want) ?? r.data.properties.find((p) => norm(p.name).includes(want) || want.includes(norm(p.name)));
    if (!pick?.property_token) return { ...night, ok: false, error: 'not-found', rates: [], searches };
    r = await search({ ...params, property_token: pick.property_token });
    searches += r.ok ? 1 : 0;
  }
  if (!r.ok) return { ...night, ok: false, error: r.error, rates: [], searches };
  const d = r.data;
  return { ...night, ok: true, error: '', hotel: details(d), rates: rateRows(d), rooms: rooms(d), searches };
}

/** Lowest rate shown for hotels around this one on one night. One search. */
export async function areaQuotes({ hotel, city, state }, night) {
  const r = await search({ ...common, check_in_date: night.checkIn, check_out_date: night.checkOut, q: `hotels near ${[hotel, city, state].filter(Boolean).join(', ')}` });
  if (!r.ok) return { ...night, ok: false, error: r.error, hotels: [], searches: 0 };
  const hotels = (r.data.properties ?? []).map(listRow).filter((h) => h.name && h.type !== 'vacation rental');
  return { ...night, ok: true, error: '', hotels, searches: 1 };
}

/** Google's own hotel search for a town, in the order it lists them. One search, shared by every hotel in the town. */
export async function townRanking({ city, state }, night) {
  const query = `hotels in ${[city, state].filter(Boolean).join(', ')}`;
  const r = await search({ ...common, check_in_date: night.checkIn, check_out_date: night.checkOut, q: query });
  if (!r.ok) return { ok: false, error: r.error, query, searches: 0 };
  const list = (r.data.properties ?? []).filter((p) => !p.sponsored).map(listRow).filter((h) => h.name && h.type !== 'vacation rental')
    .map((h, i) => ({ position: i + 1, name: h.name, rating: h.rating, reviews: h.reviews, hotelClass: h.hotelClass }));
  return { ok: list.length >= 5, error: list.length >= 5 ? '' : 'thin', searches: 1, kind: 'hotels', query, checkedAt: new Date().toISOString(), night: night.checkIn, list };
}

/** The full price reading for one hotel. Up to three searches when the token is known. */
export async function scanPrices(target, { today = new Date() } = {}) {
  const [n1, n2] = sampleNights(today);
  let a, b, area;
  if (target.token) {
    [a, b, area] = await Promise.all([nightQuote(target, n1), nightQuote(target, n2), areaQuotes(target, n1)]);
  } else {
    // No listing id yet: find the hotel by name first, and spend nothing more unless Google's match is this hotel.
    a = await nightQuote(target, n1);
    if (!a.ok || !a.hotel?.token || !sameHotel(a.hotel.name, target.hotel)) {
      return { ok: false, done: true, fetchedAt: new Date().toISOString(), hotel: null, nights: [], area: null, errors: [a.ok ? 'name-mismatch' : a.error], matched: a.hotel?.name ?? '', searches: a.searches };
    }
    [b, area] = await Promise.all([nightQuote({ ...target, token: a.hotel.token }, n2), areaQuotes(target, n1)]);
  }
  const first = [a, b].find((n) => n.ok);
  const timedOut = [a, b, area].some((x) => !x.ok && x.error === 'timeout');
  return {
    ok: !!first,
    done: !timedOut,
    fetchedAt: new Date().toISOString(),
    source: 'Google hotel search',
    hotel: first?.hotel ?? null,
    nights: [a, b].map(({ hotel: _h, ...n }) => n),
    area: area.ok ? { checkIn: area.checkIn, hotels: area.hotels } : null,
    errors: [a, b, area].filter((x) => !x.ok).map((x) => x.error),
    searches: a.searches + b.searches + area.searches,
  };
}
