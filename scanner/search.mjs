// Brand search collector. One Google search for the hotel's name and town:
// where the hotel's own site ranks, who else ranks for the name, whether a
// knowledge panel shows, and who is advertising on the name.

import { search } from './serpapi.mjs';

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
/** Registrable-ish domain: the last two labels, or three for co.uk-style endings. */
const root = (h) => { const p = h.split('.'); return p.length <= 2 ? h : (/^(co|com|org|net|gov|ac)$/.test(p[p.length - 2]) ? p.slice(-3) : p.slice(-2)).join('.'); };

const OTA = ['booking.com', 'expedia.com', 'hotels.com', 'agoda.com', 'priceline.com', 'kayak.com', 'trivago.com', 'orbitz.com', 'travelocity.com', 'hotwire.com', 'trip.com', 'guestreservations.com', 'reservations.com', 'hoteltonight.com', 'vrbo.com', 'airbnb.com', 'hotelscombined.com', 'momondo.com', 'skyscanner.com', 'snaptravel.com', 'super.com', 'getaroom.com', 'costcotravel.com', 'ihg.com', 'marriott.com', 'hilton.com', 'hyatt.com'];
const REVIEW = ['tripadvisor.com', 'yelp.com', 'google.com', 'oyster.com', 'usnews.com', 'fodors.com', 'frommers.com', 'lonelyplanet.com', 'cntraveler.com', 'travelandleisure.com'];
const SOCIAL = ['facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'x.com', 'twitter.com', 'linkedin.com', 'pinterest.com'];
const REFERENCE = ['wikipedia.org', 'wikitravel.org', 'mapquest.com', 'yellowpages.com'];

/** Who a result belongs to, from the hotel's point of view. */
export function ownerOf(link, siteHost) {
  const d = root(host(link));
  if (!d) return 'other';
  const mine = root(String(siteHost || '').replace(/^www\./, '').toLowerCase());
  if (mine && d === mine) return 'you';
  if (OTA.includes(d)) return 'ota';
  if (REVIEW.includes(d)) return 'review';
  if (SOCIAL.includes(d)) return 'social';
  if (REFERENCE.includes(d)) return 'reference';
  return 'other';
}

/** One search. `site` is the hotel's own website (host or URL), used to recognise its results. */
export async function brandSearch({ hotel, city, site }) {
  const siteHost = host(/^https?:/.test(site || '') ? site : `https://${site || ''}`);
  const query = [hotel, city].filter(Boolean).join(' ');
  const r = await search({ engine: 'google', q: query, gl: 'us', hl: 'en', num: '10' });
  if (!r.ok) return { ok: false, error: r.error, query, searches: 0 };
  const d = r.data;
  const row = (x, i) => ({
    position: x.position ?? i + 1,
    title: String(x.title ?? '').slice(0, 160),
    link: x.link ?? '',
    domain: host(x.link ?? ''),
    owner: ownerOf(x.link ?? '', siteHost),
    snippet: String(x.snippet ?? x.description ?? '').slice(0, 240),
  });
  const results = (d.organic_results ?? []).slice(0, 10).map(row);
  const mine = results.find((x) => x.owner === 'you');
  const kg = d.knowledge_graph ?? null;
  const ads = (d.ads ?? []).map(row);
  return {
    ok: true, error: '', searches: 1,
    query, checkedAt: new Date().toISOString(), siteHost,
    results,
    found: !!mine,
    brandRank: mine ? mine.position : null,
    hasKnowledgePanel: !!kg?.title,
    panel: kg ? {
      title: kg.title ?? '', type: kg.type ?? '', rating: kg.rating ?? null, reviews: kg.review_count ?? kg.reviews ?? null,
      phone: kg.phone ?? '', address: kg.address ?? '', website: kg.website ?? '',
    } : null,
    ads,
    adsByOthers: ads.filter((a) => a.owner !== 'you').length,
    ownAd: ads.some((a) => a.owner === 'you'),
    questions: (d.related_questions ?? []).map((q) => String(q.question ?? '')).filter(Boolean).slice(0, 6),
    localPack: (d.local_results?.places ?? []).map((p) => ({ title: p.title ?? '', rating: p.rating ?? null, reviews: p.reviews ?? null })).slice(0, 5),
  };
}
