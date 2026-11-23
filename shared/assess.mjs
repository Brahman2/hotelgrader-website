// hotelgrader assessment, methodology v2.
//
// Turns one scan from the grading API into the report's three judgments:
//   1. an execution grade, weighted by commercial importance,
//   2. a guest-choice comparison against the hotels in the comp set,
//   3. a short list of improvement priorities.
//
// Rules this file holds itself to:
//   - Importance is given to twelve commercial functions first (WEIGHTS, 100
//     points). Checks inside a function split that function's points, so adding
//     small checks never makes a function count for more.
//   - Every check is scored from a fact the scan observed. A check with no
//     evidence is "unknown": it earns nothing and costs nothing, and it lowers
//     the function's coverage instead of its score.
//   - Each underlying issue has one owner. A missing page title counts under
//     brand, not again under search.
//   - Nothing here reads the API's own scores or its generated advice.
//
// Plain JavaScript so the page (Vite) and the email function (Netlify) run the
// same code. Types are in assess.d.mts.

export const METHOD_VERSION = '2.1';

/** Importance of each function, in points out of 100. */
export const FUNCTIONS = [
  { key: 'booking', name: 'Website and booking path', short: 'Booking', weight: 21,
    covers: 'Whether a guest can get from your listing to your site to a booking engine that answers, on a usable date, on a phone.',
    notYet: 'Room selection, fees, policies and checkout inside the booking engine.' },
  { key: 'rates', name: 'Rates and offer', short: 'Rates', weight: 20,
    covers: 'Whether your direct rate shows where guests compare prices, and how it sits against the OTAs on two sampled nights.',
    notYet: 'A room-for-room, fee-for-fee match across channels.' },
  { key: 'reputation', name: 'Reputation', short: 'Reputation', weight: 14,
    covers: 'Ratings, review volume against your comp set, what guests keep saying, and whether management replies.',
    notYet: 'Booking.com and Expedia review scores.' },
  { key: 'discovery', name: 'Search and local discovery', short: 'Search', weight: 12,
    covers: 'Whether your own site wins a search for your name, and whether the page is built so search engines can read it.',
    notYet: 'Searches that don’t include your name, such as “boutique hotel near the beach”.' },
  { key: 'profiles', name: 'Profiles and listings', short: 'Profiles', weight: 10,
    covers: 'Your Google profile, your presence in Google’s hotel prices, and the main review and booking sites.',
    notYet: 'Whether room and amenity details are right on each listing. Apple Maps, Bing and ChatGPT business profiles.' },
  { key: 'media', name: 'Photos and media', short: 'Photos', weight: 8,
    covers: 'Whether your Google profile carries photos at all.',
    notYet: 'Whether photos cover every room type, are current, and match what guests find.' },
  { key: 'speed', name: 'Page speed', short: 'Speed', weight: 4,
    covers: 'A lab test of your home page on a phone and on a desktop.',
    notYet: 'Speed measured from real visitors.' },
  { key: 'brand', name: 'Brand clarity', short: 'Brand', weight: 3,
    covers: 'Whether your name is used the same way on your site and your listing.',
    notYet: 'Whether a guest can tell who the hotel suits and why to pick it.' },
  { key: 'links', name: 'Links and citations', short: 'Links', weight: 3,
    covers: '', notYet: 'Which credible sites link to yours. Not collected yet.' },
  { key: 'social', name: 'Social presence', short: 'Social', weight: 2,
    covers: 'Whether Facebook and Instagram profiles for this hotel can be found.',
    notYet: 'Whether the profiles are current and answer guest questions.' },
  { key: 'contact', name: 'Guest communication', short: 'Email', weight: 2,
    covers: 'Whether your home page gives guests a phone number, a way to write, and a way to join your email list.',
    notYet: 'Your email programme itself: pre-arrival, post-stay, win-back and results. It’s private and can’t be scored from outside.' },
  { key: 'ai', name: 'AI visibility (sampled)', short: 'AI', weight: 1,
    covers: 'Whether AI assistants named the hotel for the questions we asked.',
    notYet: 'A wider set of guest questions and assistants.' },
];

export const CUTOFFS = [[95, 'A+'], [90, 'A'], [85, 'B+'], [80, 'B'], [75, 'C+'], [70, 'C'], [65, 'D+'], [60, 'D']];

export function letterFor(score) {
  if (score == null) return '-';
  for (const [min, l] of CUTOFFS) if (score >= min) return l;
  return 'F';
}

/** Below this share of the assessment (by importance) we don't print a letter. */
export const MIN_COVERAGE = 0.35;

// ---------- helpers ----------

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sameName = (a, b) => !!a && !!b && norm(a) === norm(b);
/** Looser match for hotel names from two sources: ignores "hotel", "the", "resort" and trademark marks. */
const core = (s) => norm(s).replace(/\b(the|hotel|hotels|resort|resorts|by|and|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
const likeName = (a, b) => {
  const x = core(a).split(' ').filter(Boolean), y = core(b).split(' ').filter(Boolean);
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  // One name wholly inside the other, and at least two distinguishing words long ("waikiki" alone matches half the island).
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 2 && short.every((w) => long.includes(w));
};
const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const n0 = (n) => Number(n).toLocaleString('en-US');
const niceDay = (d) => { const t = new Date(`${d}T12:00:00Z`); return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };

/** Piecewise-linear scale. points = [[x, y], ...] with x ascending; y is 0..1. */
function scale(v, points) {
  if (v <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    if (v <= x1) return y0 + ((v - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

const RATING_SCALE = [[3.0, 0], [3.5, 0.3], [3.8, 0.5], [4.0, 0.65], [4.3, 0.85], [4.5, 1]];

function evidence(audit, pattern) {
  for (const c of Object.values(audit.categories ?? {})) {
    for (const m of c.metrics ?? []) if (pattern.test(m.name) && m.verified_data) return m.verified_data;
  }
  return null;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** The words that identify this hotel, minus generic ones, for matching profiles. */
function nameTokens(name) {
  const stop = new Set(['hotel', 'hotels', 'resort', 'resorts', 'the', 'and', 'inn', 'suites', 'by', 'at', 'of', 'spa', 'a']);
  return norm(name).split(' ').filter((w) => w && !stop.has(w));
}
function looksLikeHotel(candidate, hotelName) {
  const want = nameTokens(hotelName);
  if (!want.length || !candidate) return null;
  const have = norm(candidate).replace(/ /g, '');
  const hit = want.filter((w) => have.includes(w)).length;
  return hit / want.length >= 0.6;
}

// ---------- the assessment ----------

const km = (a, b) => {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return null;
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  return Math.hypot(dLat, dLng) * 6371;
};

/**
 * Our own comparison set, built from Google's hotel listings around the hotel:
 * the same star class first, then the closest. Returns the same shape the
 * grading API used, or null when there is too little to build one (the API's
 * set is used then).
 */
export function compSet(audit, live = null) {
  const px = live?.prices?.ok ? live.prices : null;
  const own = px?.hotel;
  const listed = (px?.area?.hotels ?? []).filter((h) => h.name && h.rating != null && h.reviews > 0
    && !sameName(h.name, own?.name) && !sameName(h.name, audit.hotelName) && !likeName(h.name, audit.hotelName));
  if (!own || own.rating == null || listed.length < 4) return null;
  const cls = own.hotelClass;
  const same = cls != null ? listed.filter((h) => h.hotelClass === cls) : [];
  const near = cls != null ? listed.filter((h) => h.hotelClass != null && Math.abs(h.hotelClass - cls) <= 1) : [];
  const pool = same.length >= 4 ? same : near.length >= 4 ? near : listed;
  const basis = same.length >= 4 ? 'same-class' : near.length >= 4 ? 'near-class' : 'nearby';
  const ranked = pool.map((h, i) => ({ ...h, km: km(own, h), i })).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || a.i - b.i);
  const avg = (xs) => xs.reduce((t, x) => t + x, 0) / xs.length;
  return {
    basis, ours: true, hotel_class: cls ?? null,
    tier_label: cls != null ? `${cls}-star` : '',
    own_rating: own.rating, own_reviews: own.reviews ?? null,
    compset_avg_rating: Math.round(avg(pool.map((h) => h.rating)) * 10) / 10,
    compset_avg_reviews: Math.round(avg(pool.map((h) => h.reviews))),
    rating_rank: 1 + pool.filter((h) => h.rating > own.rating).length,
    review_rank: own.reviews != null ? 1 + pool.filter((h) => h.reviews > own.reviews).length : null,
    total_in_set: pool.length + 1,
    total_nearby: listed.length,
    top_competitors: ranked.slice(0, 5).map((h) => ({ name: h.name, rating: h.rating, reviews: h.reviews, rate: h.rate ?? null, lat: h.lat, lng: h.lng, km: h.km, hotel_class: h.hotelClass })),
  };
}

/**
 * @param audit  One scan from the grading API.
 * @param crawl  Optional result of our own website collector (scanner/site.mjs). When present it
 *               replaces the API's reading of the hotel's site and fills checks the API never made.
 * @param live   Optional results of our other collectors: { prices } from scanner/prices.mjs.
 *               When present they replace the API's reading of the same thing.
 */
export function assess(audit, crawl = null, live = null) {
  const px = live?.prices?.ok && (live.prices.nights ?? []).some((n) => n.ok && n.rates?.length >= 1) ? live.prices : null;
  const web = crawl && crawl.ok ? crawl : null;
  // A page built in the browser by script reads as nearly empty, so "not found" there means "couldn't read".
  const webSolid = !!web && web.rendered !== 'script';
  const meta = audit._meta ?? {};
  const when = meta.generatedAt ?? null;
  const gbp = evidence(audit, /^google business profile/i);
  const bp = meta.booking_pricing ?? evidence(audit, /rate parity/i);
  const links = meta.booking_links ?? null;
  const comp = compSet(audit, live) ?? meta.competitors ?? null;
  const platforms = evidence(audit, /directory listings|review volume|platform distribution/i);
  const sent = evidence(audit, /^(sentiment score|response rate)/i);
  // Our own brand search when we have it, in the shape the checks below already read.
  const bs = live?.search?.ok ? live.search : null;
  const serp = bs ? {
    query: bs.query, checked_at: bs.checkedAt, found: bs.found, brand_rank: bs.brandRank, has_knowledge_panel: bs.hasKnowledgePanel,
    top_results: bs.results.map((r) => ({ domain: r.domain, owner: r.owner, position: r.position, title: r.title })),
  } : evidence(audit, /^(search visibility|brand protection|local seo)/i);
  const serpSrc = bs ? 'Google search, read by our scanner' : 'Google search';
  const geo = evidence(audit, /geo optimization/i);
  const speed = evidence(audit, /^(website performance|mobile speed)/i);
  const aiData = evidence(audit, /^(ai mention rate|recommendation position)/i);
  const socialData = evidence(audit, /^(facebook presence|instagram presence|social media score)/i);
  const offer = evidence(audit, /amenity comparison|cancellation policy|description quality/i);

  const flags = []; // identity and data doubts shown to the reader, never scored
  const out = {};
  const add = (fn, check) => { (out[fn] ??= []).push(check); };
  /** status: pass | partial | fail | unknown | na.  earned: 0..1, or null when unknown / na. */
  const check = (fn, id, label, max, earned, observed, source, extra = {}) => {
    const status = extra.status ?? (earned == null ? 'unknown' : earned >= 0.85 ? 'pass' : earned >= 0.5 ? 'partial' : 'fail');
    add(fn, { id, label, max, earned: earned == null ? null : Math.max(0, Math.min(1, earned)), status, observed, source, when: extra.when ?? when, note: extra.note });
  };

  // --- Website and booking path (21) ---
  const site = gbp?.website_url || links?.website_url || '';
  const staleDate = (links?.stale ?? []).map((x) => x.checkin).filter(Boolean)[0] ?? '';
  check('booking', 'site-linked', 'Your Google profile links to your website', 5,
    gbp ? (gbp.has_website ? 1 : 0) : null,
    gbp ? (gbp.has_website ? `Links to ${hostOf(site) || 'your site'}.` : 'No website link on the profile.') : 'Profile not read this scan.',
    'Google Business Profile');
  if (web) {
    const bk = web.booking;
    check('booking', 'engine', 'A booking link is on your home page', 10,
      bk.main ? 1 : webSolid ? 0 : null,
      bk.main ? `Booking links lead to ${bk.engine || hostOf(bk.main)}.` : webSolid ? 'No booking link was found in the home page.' : 'Your home page is built by script, so we couldn’t read its links.',
      'Our crawl of your home page', { when: web.fetchedAt });
    check('booking', 'buttons', 'Booking buttons open on a usable date', 15,
      bk.buttons > 0 ? (bk.staleCount > 0 ? 0.3 : 1) : null,
      bk.buttons > 0
        ? (bk.staleCount > 0 ? `${bk.staleCount} of ${bk.buttons} booking links ${bk.staleCount === 1 ? 'opens' : 'open'} the booking engine on a date that has already passed${bk.stale[0]?.pastDate ? ` (${niceDay(bk.stale[0].pastDate)})` : ''}.` : `${bk.buttons} booking links found, none set to a past date.`)
        : 'No booking links to check.',
      'Our crawl of your home page', { when: web.fetchedAt });
    const fs = bk.firstStep;
    check('booking', 'first-step', 'The booking engine answers', 15,
      !fs || fs.blocked ? null : fs.ok ? 1 : 0,
      !fs ? 'Not checked: no link to an outside booking engine was found.'
        : fs.blocked ? `${fs.finalHost || hostOf(fs.url)} turned away our automated visit, which is normal for some engines. Not scored.`
          : fs.ok ? `${fs.finalHost} loaded in ${(fs.ms / 1000).toFixed(1)} seconds.`
            : `The booking link answered with an error${fs.status ? ` (${fs.status})` : ''}.`,
      'Our visit to the first page of your booking engine', { when: web.fetchedAt });
    check('booking', 'mobile-ready', 'The page is set up for phone screens', 5,
      web.viewport ? 1 : 0,
      web.viewport ? 'The page declares a mobile layout.' : 'The page doesn’t declare a mobile layout, so phones may show the desktop page shrunk down.',
      'Our crawl of your home page', { when: web.fetchedAt });
    check('booking', 'journey', 'Inside the booking engine: rooms, dates, fees, policies, checkout', 50, null,
      'Not observed. We open the first page of the booking engine and stop. We never enter guest details or make a booking.', '');
  } else {
    check('booking', 'engine', 'A booking engine is reachable from your site', 10,
      links ? (links.main ? 1 : 0) : null,
      links ? (links.main ? `Booking links lead to ${links.engine || hostOf(links.main)}.` : 'No booking link was found on the home page.') : 'Your site wasn’t crawled this scan.',
      'Crawl of your home page', { when: links?.checked_at });
    check('booking', 'buttons', 'Booking buttons work', 15,
      links && links.buttons != null ? (links.buttons > 0 ? (links.stale_buttons > 0 ? 0.3 : 1) : 0) : null,
      links && links.buttons != null
        ? (links.buttons > 0
          ? (links.stale_buttons > 0 ? `${links.stale_buttons} of ${links.buttons} booking buttons open the booking engine on a date that has already passed${staleDate ? ` (${niceDay(staleDate)})` : ''}.` : `${links.buttons} booking buttons found, none out of date.`)
          : 'No booking buttons found on the home page.')
        : 'Your site wasn’t crawled this scan.',
      'Crawl of your home page', { when: links?.checked_at });
    check('booking', 'journey', 'The booking engine itself: rooms, dates, fees, policies, checkout', 70, null,
      'Not observed. We don’t step through the booking engine yet, and we never make a booking to test one.', '');
  }

  // --- Rates and offer (20) ---
  // One night's rates, read the same way whichever collector supplied them.
  const nightView = (list, checkIn, kind = '') => {
    const rs = list.filter((r) => r && r.rate > 0 && r.source).sort((a, b) => a.rate - b.rate);
    const mine = rs.find((r) => r.official) ?? rs.find((r) => sameName(r.source, px?.hotel?.name) || sameName(r.source, bp?.matched_name) || sameName(r.source, audit.hotelName)) ?? null;
    const rest = rs.filter((r) => r !== mine);
    const low = rest[0] ?? null;
    return { night: checkIn, kind, rates: rs, direct: mine, others: rest, lowest: low, gap: mine && low ? (mine.rate - low.rate) / mine.rate : null, cheaper: mine ? rest.filter((r) => r.rate < mine.rate).length : 0 };
  };
  const nights = px
    ? px.nights.filter((n) => n.ok && n.rates?.length).map((n) => nightView(n.rates, n.checkIn, n.kind))
    : [nightView(bp?.ota_rates ?? [], bp?.identity?.check_in ?? null)];
  const n1 = nights[1] ?? null;
  const { rates, direct, others, lowest, gap, night } = nights[0];
  const priceSrc = px ? 'Google hotel search, read by our scanner' : 'Google hotel search';
  const priceWhen = px ? { when: px.fetchedAt } : {};
  const ratesRan = !!px || (!!bp && (rates.length > 0 || bp.no_bookable_rates != null || bp.ota_count != null));
  check('rates', 'bookable', 'Rates show for the sampled night', 15,
    ratesRan ? (rates.length > 0 ? 1 : null) : null,
    rates.length > 0 ? `${rates.length} rates found on Google’s hotel search${night ? ` for a one-night stay checking in ${niceDay(night)}` : ''}.`
      : 'No rates came back. That can mean sold out, or that the price check failed, so it isn’t scored.',
    priceSrc, priceWhen);
  check('rates', 'direct-listed', 'Your own rate appears next to the OTAs on Google', 25,
    rates.length >= 3 ? (direct ? 1 : 0) : null,
    rates.length >= 3
      ? (direct ? `Your official site is listed at ${usd(direct.rate)}.` : `${rates.length} sites showed a rate. Your own site wasn’t one of them.`)
      : 'Too few rates to tell.',
    priceSrc, priceWhen);
  const cancelKnown = px ? rates.some((r) => r.freeCancel != null) : offer && offer.has_free_cancellation != null;
  const cancelFree = px ? nights.some((n) => n.rates.some((r) => r.freeCancel === true)) : !!offer?.has_free_cancellation;
  check('rates', 'free-cancel', 'A free-cancellation rate is on offer', 10,
    cancelKnown ? (cancelFree ? 1 : 0.4) : null,
    cancelKnown
      ? (cancelFree ? 'At least one listed rate offers free cancellation.' : 'No listed rate showed free cancellation.')
      : 'Not read this scan.',
    priceSrc, priceWhen);
  const gapScore = (g) => scale(g, [[0.02, 1], [0.1, 0.6], [0.25, 0.2], [0.4, 0]]);
  check('rates', 'signal', 'No large gap between your rate and the lowest listed rate', 15,
    gap == null ? null : gapScore(gap),
    gap == null ? 'Not observed.'
      : gap > 0.02
        ? `Your site shows ${usd(direct.rate)}; the lowest other rate is ${usd(lowest.rate)} on ${lowest.source}, ${Math.round(gap * 100)}% less. The rooms may differ, so it counts for a small part of the grade.`
        : `Your site shows ${usd(direct.rate)} and no listed site was meaningfully lower.`,
    `${priceSrc}, one night, rooms not matched`, priceWhen);
  // The same question on a second night. A gap that shows up twice is less likely to be a one-off.
  const n1Seen = !!n1 && n1.rates.length >= 3;
  check('rates', 'second-date', 'Your rate holds up on a second date', 15,
    n1Seen ? (n1.direct ? (n1.gap == null ? null : gapScore(n1.gap)) : 0) : null,
    !n1Seen ? 'Not observed. Only one night was priced this scan.'
      : !n1.direct ? `For ${niceDay(n1.night)}, ${n1.rates.length} sites showed a rate and your own site wasn’t one of them.`
        : n1.gap != null && n1.gap > 0.02 ? `For ${niceDay(n1.night)} your site shows ${usd(n1.direct.rate)}; the lowest other rate is ${usd(n1.lowest.rate)} on ${n1.lowest.source}, ${Math.round(n1.gap * 100)}% less.`
          : `For ${niceDay(n1.night)} your site shows ${usd(n1.direct.rate)} and no listed site was meaningfully lower.`,
    `${priceSrc}, a second night, rooms not matched`, priceWhen);
  check('rates', 'parity', 'Same room, same fees, same terms across channels', 20, null,
    'Not observed. We read the lowest rate each site shows. We don’t yet match room type, mandatory fees or cancellation terms.', '');

  // --- Reputation (14) ---
  const gRating = comp?.own_rating ?? gbp?.rating ?? platforms?.per_platform?.google?.rating ?? null;
  const gCount = comp?.own_reviews ?? gbp?.review_count ?? platforms?.per_platform?.google?.review_count ?? null;
  const ta = platforms?.per_platform?.tripadvisor ?? null;
  // Tripadvisor's rating as Google shows it on the hotel's listing, when the grading API didn't read one.
  const taG = (px?.hotel?.otherSites ?? []).find((o) => /tripadvisor/i.test(o.source) && o.rating != null && (o.max ?? 5) === 5);
  check('reputation', 'google-rating', 'Google rating', 30,
    gRating != null ? scale(gRating, RATING_SCALE) : null,
    gRating != null ? `${Number(gRating).toFixed(1)} stars${gCount ? ` from ${n0(gCount)} reviews` : ''}.` : 'Not read this scan.',
    'Google');
  check('reputation', 'vs-compset', 'Rating against your comp set', 15,
    gRating != null && comp?.compset_avg_rating != null ? scale(gRating - comp.compset_avg_rating, [[-0.4, 0], [-0.2, 0.25], [0, 0.6], [0.2, 1]]) : null,
    gRating != null && comp?.compset_avg_rating != null
      ? `Yours is ${Number(gRating).toFixed(1)}; the comp set averages ${Number(comp.compset_avg_rating).toFixed(1)}.${comp.rating_rank != null && comp.total_in_set != null ? ` You rank #${comp.rating_rank} of ${comp.total_in_set}.` : ''}`
      : 'No comp set this scan.',
    'Google');
  check('reputation', 'volume', 'Review count against your comp set', 10,
    gCount != null && comp?.compset_avg_reviews ? scale(gCount / comp.compset_avg_reviews, [[0.2, 0], [0.5, 0.4], [1, 0.9], [1.3, 1]]) : null,
    gCount != null && comp?.compset_avg_reviews
      ? `${n0(gCount)} Google reviews; the comp set averages ${n0(comp.compset_avg_reviews)}.${comp.review_rank != null && comp.total_in_set != null ? ` You rank #${comp.review_rank} of ${comp.total_in_set}.` : ''}`
      : 'No comp set this scan.',
    'Google');
  check('reputation', 'tripadvisor', 'Tripadvisor rating', 10,
    ta?.rating != null ? scale(ta.rating, RATING_SCALE) : taG ? scale(taG.rating, RATING_SCALE) : null,
    ta?.rating != null ? `${Number(ta.rating).toFixed(1)} from ${n0(ta.review_count ?? 0)} reviews.`
      : taG ? `${taG.rating.toFixed(1)}${taG.reviews ? ` from ${n0(taG.reviews)} reviews` : ''}, as shown on your Google hotel listing.` : 'No Tripadvisor rating was read this scan.',
    ta?.rating != null ? 'Tripadvisor' : taG ? 'Google hotel listing' : 'Tripadvisor');
  const rs = sent?.response_stats;
  check('reputation', 'responses', 'Management replies to reviews', 15,
    rs && rs.total_reviews >= 10 ? scale(rs.response_rate, [[0, 0], [25, 0.3], [50, 0.6], [80, 1]]) : null,
    rs && rs.total_reviews >= 10 ? `${rs.total_responded} of the ${rs.total_reviews} most recent reviews we read had a reply (${Math.round(rs.response_rate)}%).` : 'Too few reviews read to tell.',
    'Recent Google and Tripadvisor reviews');
  const pos = (sent?.positive_themes ?? []).reduce((n, t) => n + (t.mentions || 0), 0);
  const neg = (sent?.negative_themes ?? []).reduce((n, t) => n + (t.mentions || 0), 0);
  check('reputation', 'themes', 'What guests keep saying', 20,
    pos + neg >= 10 ? scale(pos / (pos + neg), [[0.5, 0], [0.6, 0.25], [0.7, 0.5], [0.8, 0.75], [0.9, 1]]) : null,
    pos + neg >= 10 ? `In ${rs?.total_reviews ?? 'the'} recent reviews, positive themes came up ${pos} times and complaints ${neg} times.` : 'Too few reviews read to summarise.',
    'Recent reviews, themes grouped by AI');

  // --- Search and local discovery (12) ---
  const rank = serp?.found === false ? 0 : serp?.brand_rank ?? null;
  // A results page we couldn't attribute to sites says nothing about where the hotel ranks.
  const rankKnown = !!serp && (serp.found != null || serp.brand_rank != null);
  check('discovery', 'brand-rank', 'Your own site ranks first for your name', 25,
    rankKnown ? (rank === 1 ? 1 : rank >= 2 && rank <= 3 ? 0.6 : rank > 3 ? 0.2 : 0) : null,
    rankKnown ? (rank ? `Your site is result #${rank} for “${serp.query}”.` : `Your site wasn’t in the top results for “${serp.query}”.`) : serp ? 'The results page couldn’t be read clearly this scan, so this isn’t scored.' : 'Not searched this scan.',
    serpSrc, { when: serp?.checked_at });
  check('discovery', 'panel', 'Google shows a knowledge panel for the hotel', 10,
    serp && serp.has_knowledge_panel != null ? (serp.has_knowledge_panel ? 1 : 0) : null,
    serp && serp.has_knowledge_panel != null ? (serp.has_knowledge_panel ? 'A knowledge panel appears on a search for your name.' : 'No knowledge panel appeared.') : 'Not searched this scan.',
    serpSrc, { when: serp?.checked_at });
  // Our own crawl is the better reading of the page when we have one.
  const gc = web ? {
    schema_lodging: web.schema.lodging ? true : webSolid ? false : null,
    schema_faq: web.schema.faq ? true : webSolid ? false : null,
    h1_present: web.h1.length > 0 ? true : webSolid ? false : null,
    meta_description: !!web.description,
    og_tags: !!(web.og.title || web.og.image),
  } : geo?.result?.checks ?? null;
  const geoWhen = web ? web.fetchedAt : geo?.fetched_at;
  const geoCheck = (id, label, max, key, yes, no) => check('discovery', id, label, max,
    gc && gc[key] != null ? (gc[key] ? 1 : 0) : null,
    gc && gc[key] != null ? (gc[key] ? yes : no) : 'Your home page wasn’t read this scan.',
    'Your home page', { when: geoWhen });
  geoCheck('schema-hotel', 'Hotel details in a format search engines and AI can read', 15, 'schema_lodging', 'Hotel structured data is present.', 'No Hotel or LodgingBusiness structured data on the home page.');
  geoCheck('schema-faq', 'Guest questions marked up as FAQs', 5, 'schema_faq', 'FAQ structured data is present.', 'No FAQ structured data on the home page. It may live on another page.');
  geoCheck('h1', 'One clear main heading', 5, 'h1_present', 'The home page has a main heading.', 'The home page has no main (H1) heading.');
  geoCheck('meta-desc', 'A search description', 5, 'meta_description', 'A meta description is set.', 'No meta description on the home page.');
  geoCheck('og', 'Link previews for sharing', 5, 'og_tags', 'Sharing tags are set.', 'No sharing (Open Graph) tags on the home page.');
  if (web) {
    const blocked = web.noindex || web.robots.blocksAll;
    check('discovery', 'crawlable', 'Search engines are allowed in and given a map', 5,
      blocked ? 0 : web.sitemap.found ? 1 : 0.5,
      blocked ? (web.noindex ? 'The home page tells search engines not to index it.' : 'robots.txt tells every search engine to stay out of the whole site.')
        : web.sitemap.found ? `Nothing blocks search engines, and a sitemap lists ${web.sitemap.urls} ${web.sitemap.urls === 1 ? 'entry' : 'entries'}.` : 'Nothing blocks search engines, but no sitemap was found.',
      'robots.txt and sitemap on your site', { when: web.fetchedAt });
  }
  check('discovery', 'non-brand', 'Searches that don’t include your name', web ? 25 : 30, null, 'Not observed. We only searched for the hotel by name.', '');

  // --- Profiles and listings (10) ---
  check('profiles', 'gbp-live', 'Google profile is live and marked open', 10,
    gbp ? (gbp.business_status === 'OPERATIONAL' ? 1 : 0) : null,
    gbp ? (gbp.business_status === 'OPERATIONAL' ? 'Listed as open.' : `Listed as ${String(gbp.business_status || 'unknown').toLowerCase().replace(/_/g, ' ')}.`) : 'Profile not read this scan.',
    'Google Business Profile');
  check('profiles', 'gbp-phone', 'Google profile shows a phone number', 10,
    gbp ? (gbp.has_phone ? 1 : 0) : null,
    gbp ? (gbp.has_phone ? 'A phone number is listed.' : 'No phone number on the profile.') : 'Profile not read this scan.',
    'Google Business Profile');
  check('profiles', 'gbp-hours', 'Opening hours', 0, null,
    'Not applicable. Google doesn’t let hotels edit opening hours, so we don’t check them.', 'Google Business Profile', { status: 'na' });
  const sources = [...new Set([...(bp?.ota_sources ?? []), ...rates.map((r) => r.source)])];
  const big = ['booking.com', 'expedia', 'hotels.com', 'agoda', 'priceline'];
  const majors = big.filter((b) => sources.some((s) => norm(s).replace(/ /g, '').includes(b.replace(/[^a-z]/g, ''))));
  check('profiles', 'otas', 'Listed on the major booking sites', 25,
    ratesRan && sources.length > 0 ? scale(majors.length, [[0, 0], [1, 0.6], [2, 1]]) : null,
    ratesRan && sources.length > 0
      ? `${bp?.ota_count ?? sources.length} booking sites showed a rate${majors.length ? `, including ${sources.filter((s) => big.some((b) => norm(s).replace(/ /g, '').includes(b.replace(/[^a-z]/g, '')))).slice(0, 3).join(', ')}` : ', none of them a major OTA in the names we could read'}.`
      : 'Not read this scan.',
    'Google hotel search');
  check('profiles', 'tripadvisor-listed', 'A Tripadvisor listing with reviews', 15,
    platforms ? (ta?.review_count > 0 ? 1 : 0) : null,
    platforms ? (ta?.review_count > 0 ? `Found, with ${n0(ta.review_count)} reviews.` : 'No Tripadvisor listing was matched to this hotel.') : 'Not read this scan.',
    'Tripadvisor');
  check('profiles', 'accuracy', 'Room, amenity and policy details are right on each listing', 40, null,
    'Not observed. We confirm the listings exist; we don’t yet compare their details against your site. Apple Maps, Bing and ChatGPT business profiles aren’t read yet.', '');

  // --- Photos and media (8) ---
  const photos = gbp?.photo_count ?? null;
  check('media', 'gbp-photos', 'Photos on your Google profile', 20,
    photos != null ? scale(photos, [[0, 0], [5, 0.5], [10, 1]]) : null,
    photos != null ? (photos >= 10 ? 'Ten or more photos. Our source stops counting at ten, so the real number may be far higher.' : `${photos} photos found.`) : 'Profile not read this scan.',
    'Google Business Profile');
  check('media', 'coverage', 'Photos explain every room type, the bathrooms, the setting and the view', 80, null,
    'Not observed. We don’t look at the photos themselves yet.', '');

  // --- Page speed (4) ---
  check('speed', 'mobile', 'Home page speed on a phone', 60,
    speed?.mobile_score != null ? speed.mobile_score / 100 : null,
    speed?.mobile_score != null ? `Lab score ${speed.mobile_score} out of 100.` : 'Not tested this scan.',
    'Lighthouse lab test', { status: speed?.mobile_score != null ? (speed.mobile_score >= 90 ? 'pass' : speed.mobile_score >= 50 ? 'partial' : 'fail') : 'unknown' });
  check('speed', 'desktop', 'Home page speed on a desktop', 20,
    speed?.desktop_score != null ? speed.desktop_score / 100 : null,
    speed?.desktop_score != null ? `Lab score ${speed.desktop_score} out of 100.` : 'Not tested this scan.',
    'Lighthouse lab test', { status: speed?.desktop_score != null ? (speed.desktop_score >= 90 ? 'pass' : speed.desktop_score >= 50 ? 'partial' : 'fail') : 'unknown' });
  check('speed', 'field', 'Speed for real visitors', 20, null,
    'Not observed. A lab test is one simulated visit; it isn’t proof that guests have a slow experience.', '');

  // --- Brand clarity (3) ---
  // The API's own title check is accent-sensitive ("Waikīkī" ≠ "Waikiki"), so we redo it from the search result.
  const ownResult = (serp?.top_results ?? []).find((r) => r.owner === 'you');
  const pageTitle = web?.title || ownResult?.title || '';
  const titleHasName = pageTitle ? norm(pageTitle).includes(norm(audit.hotelName).replace(/^the /, '')) : (gc?.name_in_title === true ? true : null);
  check('brand', 'name-in-title', 'Your page title carries the hotel’s name', 30,
    titleHasName == null ? null : titleHasName ? 1 : 0,
    titleHasName == null ? 'Your page title wasn’t read this scan.'
      : pageTitle ? `Your title reads “${pageTitle}”.` : 'The hotel’s name is in the page title.',
    web ? 'Our crawl of your home page' : 'Google search result for your site', { when: web ? web.fetchedAt : serp?.checked_at });
  check('brand', 'listing-desc', 'Your Google hotel listing has a description', 20,
    offer && offer.description_length != null ? (offer.description_length >= 150 ? 1 : offer.description_length > 0 ? 0.5 : 0) : null,
    offer && offer.description_length != null ? (offer.description_length > 0 ? `A ${offer.description_length}-character description is shown.` : 'No description is shown.') : 'Not read this scan.',
    'Google hotel search');
  check('brand', 'positioning', 'A guest can tell who the hotel suits and why to choose it', 50, null,
    'Not observed. This needs a read of your site’s content, which the scan doesn’t do yet.', '');

  // --- Links and citations (3) ---
  check('links', 'links', 'Credible sites that link to yours', 100, null, 'Not collected yet.', '');

  // --- Social presence (2) ---
  // Profiles the hotel links to from its own site are certain to be the hotel's. Prefer them.
  const linked = web?.social ?? {};
  const fb = linked.facebook ? { success: true, page_name: linked.facebook.handle, page_url: linked.facebook.url, followers: null, fromSite: true } : socialData?.facebook;
  const ig = linked.instagram ? { success: true, username: linked.instagram.handle, full_name: '', followers: null, fromSite: true } : socialData?.instagram;
  const fbOk = fb?.success && (fb.page_url || fb.followers != null);
  const fbMatch = fb?.fromSite ? true : fbOk ? looksLikeHotel(`${fb.page_name ?? ''} ${fb.page_url ?? ''}`, audit.hotelName) : null;
  check('social', 'facebook', 'A Facebook page for this hotel', 40,
    socialData || fbOk ? (fbOk ? (fbMatch === false ? null : 1) : 0) : null,
    socialData || fbOk
      ? (fbOk ? (fbMatch === false ? `We matched “${fb.page_name}”, which may be a different business, so this isn’t scored.` : fb.fromSite ? `Your site links to facebook.com/${fb.page_name}.` : `Found: ${fb.page_name || fb.page_url}${fb.followers != null ? `, ${n0(fb.followers)} followers` : ''}.`) : 'No Facebook page was found.')
      : 'Not searched this scan.',
    'Facebook', { when: fb?.fetched_at });
  const igOk = ig?.success && ig.username;
  const igMatch = ig?.fromSite ? true : igOk ? looksLikeHotel(`${ig.full_name ?? ''} ${ig.username ?? ''}`, audit.hotelName) : null;
  if (igOk && igMatch === false) flags.push(`The Instagram account our search matched is @${ig.username} (“${ig.full_name}”), which looks like a different property. We left Instagram out of the grade.`);
  if (fbOk && fbMatch === false) flags.push(`The Facebook page our search matched is “${fb.page_name}”, which may not be this hotel. We left it out of the grade.`);
  check('social', 'instagram', 'An Instagram account for this hotel', 40,
    socialData || igOk ? (igOk ? (igMatch === false ? null : 1) : 0) : null,
    socialData || igOk
      ? (igOk ? (igMatch === false ? `We matched @${ig.username} (“${ig.full_name}”), which looks like a different property, so this isn’t scored.` : ig.fromSite ? `Your site links to @${ig.username}.` : `Found: @${ig.username}${ig.followers != null ? `, ${n0(ig.followers)} followers` : ''}.`) : 'No Instagram account was found.')
      : 'Not searched this scan.',
    'Instagram', { when: ig?.fetched_at });
  check('social', 'useful', 'Profiles are current and answer guest questions', 20, null, 'Not observed. Follower counts and posting frequency aren’t scored.', '');

  // --- Guest communication (2) ---
  if (web) {
    const c = web.contact;
    const phone = c.phones.length > 0 || c.phoneInText;
    check('contact', 'phone', 'A phone number on your home page', 30,
      phone ? 1 : webSolid ? 0 : null,
      phone ? (c.phones.length ? 'A phone number is shown and can be tapped to call.' : 'A phone number is shown, but it isn’t a tap-to-call link.') : webSolid ? 'No phone number was found on the home page.' : 'We couldn’t read the page’s text.',
      'Our crawl of your home page', { when: web.fetchedAt });
    const reach = c.emails.length > 0 || !!c.page || web.chat;
    check('contact', 'reach', 'A way to write to the hotel', 20,
      reach ? 1 : webSolid ? 0 : null,
      reach ? [c.page && 'A contact page is linked', c.emails.length && 'an email address is shown', web.chat && 'a chat tool is installed'].filter(Boolean).join(', ').replace(/^an /, 'An ').replace(/^a chat/, 'A chat') + '.' : webSolid ? 'No contact page, email address or chat was found on the home page.' : 'We couldn’t read the page’s links.',
      'Our crawl of your home page', { when: web.fetchedAt });
    check('contact', 'signup', 'A way to join your email list', 30,
      web.signup.found ? 1 : webSolid ? 0 : null,
      web.signup.found ? `An email signup is on the home page${web.signup.provider ? `, run through ${web.signup.provider}` : ''}.` : webSolid ? 'No email signup was found on the home page. That’s a choice, not a fault, if you don’t send email.' : 'We couldn’t read the page’s forms.',
      'Our crawl of your home page', { when: web.fetchedAt });
    check('contact', 'programme', 'Your email programme: pre-arrival, post-stay, win-back, results', 20, null,
      'Private. It can’t be seen from outside and isn’t scored.', '');
  } else {
    check('contact', 'contact', 'Contact paths and email signup on your site', 100, null,
      'Not collected this scan. Your email programme itself (pre-arrival, post-stay, win-back) is private and can’t be scored from outside.', '');
  }

  // --- AI visibility, sampled (1) ---
  const records = aiData?.records ?? [];
  const samples = records.map((r) => {
    const surface = /gpt|chatgpt/i.test(`${r.surface} ${r.model}`) ? 'ChatGPT' : /gemini/i.test(`${r.surface} ${r.model}`) ? 'Gemini' : /claude/i.test(`${r.surface} ${r.model}`) ? 'Claude' : (r.surface || r.model || 'assistant');
    const text = String(r.response_text ?? '');
    const valid = !!r.ok && text.length >= 150;
    return { surface, query: r.query, mentioned: valid ? !!r.mentioned : null, valid, when: r.fetched_at, why: valid ? '' : r.ok ? 'the answer came back cut short' : 'the request failed' };
  });
  const validSamples = samples.filter((s) => s.valid);
  const queries = [...new Set(samples.map((s) => s.query).filter(Boolean))];
  const mentions = validSamples.filter((s) => s.mentioned).length;
  check('ai', 'sample', 'Named by AI assistants for the questions we asked', Math.min(100, 25 * Math.max(1, queries.length)),
    validSamples.length ? mentions / validSamples.length : null,
    validSamples.length
      ? `Named in ${mentions} of ${validSamples.length} usable answers to ${queries.length} question${queries.length === 1 ? '' : 's'}.`
      : 'No usable answers came back this scan.',
    [...new Set(validSamples.map((s) => s.surface))].join(' and ') || 'AI assistants', { when: validSamples[0]?.when });
  if (queries.length < 4) {
    check('ai', 'breadth', 'A wider set of guest questions', 100 - Math.min(100, 25 * Math.max(1, queries.length)), null,
      `Only ${queries.length || 'no'} question${queries.length === 1 ? ' was' : 's were'} asked. A broad “best hotels in the city” question favours the biggest names, so one answer can’t show that a hotel is invisible to AI.`, '');
  }

  // ---------- roll up ----------
  const functions = FUNCTIONS.map((f) => {
    const checks = out[f.key] ?? [];
    const scoredChecks = checks.filter((c) => c.earned != null && c.max > 0);
    const total = checks.reduce((n, c) => n + c.max, 0) || 1;
    const seen = scoredChecks.reduce((n, c) => n + c.max, 0);
    const got = scoredChecks.reduce((n, c) => n + c.max * c.earned, 0);
    return { ...f, checks, coverage: seen / total, score: seen > 0 ? Math.round((got / seen) * 100) : null };
  });
  const seenWeight = functions.reduce((n, f) => n + f.weight * f.coverage, 0);
  const coverage = seenWeight / 100;
  const score = seenWeight > 0 ? Math.round(functions.reduce((n, f) => n + f.weight * f.coverage * (f.score ?? 0), 0) / seenWeight) : null;
  const graded = score != null && coverage >= MIN_COVERAGE;

  // ---------- hotel identity ----------
  if (bp?.matched_name && !looksLikeHotel(bp.matched_name, audit.hotelName)) {
    flags.push(`Prices were read from a Google listing named “${bp.matched_name}”. If that isn’t this hotel, the rates section is wrong.`);
  }
  const identity = {
    name: audit.hotelName,
    place: [audit.city, audit.state].filter(Boolean).join(', '),
    website: hostOf(site),
    mapsUrl: gbp?.google_maps_url ?? '',
    bookingEngine: web?.booking.engine || links?.engine || '',
    /** Our comp-set model's guess at the hotel's class. Not an official star rating. */
    hotelClass: comp?.tier_label ?? '',
    /** 'google' when the class is Google's star class for the listing, 'model' when it is the grading API's guess. */
    classSource: comp?.ours ? 'google' : 'model',
    flags,
  };

  // ---------- guest choice ----------
  const rivals = (comp?.top_competitors ?? []).filter((r) => r?.name);
  // Like for like: the lowest rate Google shows for each hotel on the first sampled night.
  const area = px?.area?.checkIn === night ? (px.area.hotels ?? []).filter((h) => h.rate > 0) : [];
  const areaRate = (name) => rivals.find((r) => r.name === name)?.rate ?? area.find((h) => sameName(h.name, name))?.rate ?? area.find((h) => likeName(h.name, name))?.rate ?? null;
  const ownLow = rates[0]?.rate ?? null;
  const table = [
    area.length
      ? { name: audit.hotelName, you: true, rating: gRating, reviews: gCount, rate: ownLow, rateNote: 'lowest shown' }
      : { name: audit.hotelName, you: true, rating: gRating, reviews: gCount, rate: direct?.rate ?? lowest?.rate ?? null, rateNote: direct ? 'your site' : lowest ? `lowest found, on ${lowest.source}` : '' },
    ...rivals.map((r) => { const rate = areaRate(r.name); return { name: r.name, you: false, rating: r.rating ?? null, reviews: r.reviews ?? null, rate, rateNote: rate != null ? 'lowest shown' : '' }; }),
  ];
  const priced = table.filter((r) => !r.you && r.rate != null);
  const pricedLower = ownLow != null ? priced.filter((r) => r.rate < ownLow).length : 0;
  const areaRates = area.map((h) => h.rate).sort((a, b) => a - b);
  const areaMedian = areaRates.length >= 5 ? areaRates[Math.floor(areaRates.length / 2)] : null;
  const areaLower = ownLow != null ? areaRates.filter((r) => r < ownLow).length : 0;
  const priceLine = ownLow == null ? ''
    : priced.length >= 2
      ? ` On price for that night, ${pricedLower === 0 ? `none of the ${priced.length} we could price showed a lower rate than your ${usd(ownLow)}` : `${pricedLower} of the ${priced.length} we could price showed a lower rate than your ${usd(ownLow)}`}.`
      : areaMedian != null
        ? ` On price, the lowest rate shown for you on ${niceDay(night)} was ${usd(ownLow)}; ${areaLower} of ${areaRates.length} hotels Google lists near you showed less. Those aren’t matched for class or room, so read it as context.`
        : '';
  const better = rivals.filter((r) => r.rating != null && gRating != null && r.rating > gRating).length;
  const tied = rivals.filter((r) => r.rating != null && gRating != null && r.rating === gRating).length;
  const choice = rivals.length >= 2 ? {
    scenario: night ? `One night, checking in ${niceDay(night)}, lowest rate shown on Google’s hotel search.` : 'No trip was priced this scan.',
    rows: table,
    peers: rivals.length,
    setSize: comp?.total_in_set ?? null,
    /** How the set was chosen: 'same-class' | 'near-class' | 'nearby' from our own listings, or 'model' from the grading API. */
    basis: comp?.ours ? comp.basis : 'model',
    compared: priced.length >= 2 ? ['Google rating', 'Google review count', 'Lowest rate shown on Google for the same night'] : areaMedian != null ? ['Google rating', 'Google review count', 'Lowest rate shown that night across nearby hotels'] : ['Google rating', 'Google review count'],
    notCompared: [...(priced.length >= 2 ? ['Whether those rates are for a similar room'] : ['Price for the same night at each competitor']), 'Room fit for the party', 'Location for the trip', 'Cancellation and payment terms'],
    area: areaMedian != null ? { median: areaMedian, count: areaRates.length, low: areaRates[0], high: areaRates[areaRates.length - 1], own: ownLow } : null,
    verdict: gRating == null ? 'We couldn’t read your rating, so there is nothing to compare yet.'
      : better === 0
        ? `On guest rating, you lead this set${tied ? ` (level with ${tied})` : ''}.${priceLine ? '' : ' That is the only thing compared so far, so it isn’t a verdict on who wins the booking.'}${priceLine}`
        : `${better} of ${rivals.length} hotels in this set ${better === 1 ? 'carries' : 'carry'} a higher Google rating than yours.${priceLine ? '' : ' That is the only thing compared so far, so it isn’t a verdict on who wins the booking.'}${priceLine}`,
  } : null;

  // ---------- priorities ----------
  const byId = Object.fromEntries(functions.flatMap((f) => f.checks.map((c) => [`${f.key}.${c.id}`, { c, f }])));
  const stake = (key) => { const x = byId[key]; return x && x.c.earned != null ? x.f.weight * (x.c.max / 100) * (1 - x.c.earned) : 0; };
  const cands = [];
  const push = (p) => { if (p.points > 0.15) cands.push(p); };

  const bothNights = gap != null && gap > 0.05 && n1?.gap != null && n1.gap > 0.05;
  if (gap != null && gap > 0.05) {
    push({
      id: 'rate-gap', type: 'investigate', fn: 'rates', points: 20 * 0.5 * Math.min(1, gap / 0.25) * (bothNights ? 0.85 : 0.7),
      title: `Check why ${lowest.source} shows ${usd(lowest.rate)} against ${usd(direct.rate)} on your own site`,
      evidence: `On Google’s hotel search${night ? ` for the night of ${niceDay(night)}` : ''}, ${others.filter((r) => r.rate < direct.rate).length} of ${others.length} other sites showed a lower rate than your official site.${bothNights ? ` It was the same on ${niceDay(n1.night)}: ${usd(n1.lowest.rate)} on ${n1.lowest.source} against your ${usd(n1.direct.rate)}.` : ''}`,
      why: 'A guest comparing prices on Google sees the cheaper offer first. If it is the same room, each booking that goes there costs a commission.',
      outcome: 'Either the gap is explained (a different room, a member rate, fees left out) or your direct rate matches the lowest public rate for the same room.',
      owner: 'Revenue manager', effort: 'Low to check', confidence: bothNights ? 'Likely' : 'Needs checking',
      proof: 'Search the same night on Google, open your site and the cheapest listing, and compare room type, fees and cancellation terms side by side.',
    });
  }
  if (rates.length >= 3 && !direct) {
    push({
      id: 'no-direct', type: 'fix', fn: 'rates', points: stake('rates.direct-listed'),
      title: 'Get your own rate listed in Google’s hotel prices',
      evidence: `${rates.length} booking sites showed a rate on Google’s hotel search. Your official site wasn’t among them.`,
      why: 'Guests who find you on Google can only click through to an OTA. Google’s free booking links let your own rate sit in that list.',
      outcome: 'Your official site appears in the price list on your Google hotel listing.',
      owner: 'Revenue manager, with your booking-engine provider', effort: 'Medium', confidence: 'Likely',
      proof: 'Search your hotel on Google for any open date and see “Official site” among the prices.',
    });
  }
  const staleN = web ? web.booking.staleCount : (links?.stale_buttons ?? 0);
  const buttonsN = web ? web.booking.buttons : (links?.buttons ?? 0);
  const staleEx = web ? web.booking.stale[0] : links?.stale?.[0];
  const staleDay = staleEx?.pastDate || staleEx?.checkin || '';
  if (staleN > 0) {
    push({
      id: 'stale-buttons', type: 'fix', fn: 'booking', points: stake('booking.buttons'),
      title: `Fix ${staleN === 1 ? 'the booking link that opens' : `${staleN} booking links that open`} on a past date`,
      evidence: `${staleN} of ${buttonsN} booking links on your home page ${staleN === 1 ? 'opens' : 'open'} the booking engine with a check-in date that has already passed${staleDay ? `, such as ${niceDay(staleDay)}` : ''}.${staleEx?.text ? ` One is labelled “${staleEx.text}”.` : ''}`,
      why: 'A guest who taps “book” and lands on an error or an empty calendar for a past date often gives up.',
      outcome: 'Every booking button opens the booking engine on today’s date or with no date set.',
      owner: 'Website provider', effort: 'Low', confidence: 'Confirmed',
      proof: 'Tap each booking button on a phone and reach a date picker every time.',
    });
  }
  const fsBroken = web?.booking.firstStep && !web.booking.firstStep.ok && !web.booking.firstStep.blocked;
  if (fsBroken) {
    push({
      id: 'engine-down', type: 'fix', fn: 'booking', points: stake('booking.first-step'),
      title: 'Fix the booking link that returns an error',
      evidence: `Your main booking link answered with an error${web.booking.firstStep.status ? ` (${web.booking.firstStep.status})` : ''} when we opened it.`,
      why: 'If the booking engine doesn’t load, nobody can book direct.',
      outcome: 'The booking link opens a date picker.',
      owner: 'Website provider, with your booking-engine provider', effort: 'Low', confidence: 'Likely',
      proof: 'Tap the main “book” button on a phone and reach a date picker.',
    });
  }
  if (web ? (webSolid && !web.booking.main) : (links && !links.main)) {
    push({
      id: 'no-engine', type: 'investigate', fn: 'booking', points: stake('booking.engine') * 0.7,
      title: 'Check that your home page links to your booking engine',
      evidence: 'Our crawl of your home page found no link to a booking engine.',
      why: 'If guests can’t start a booking from the home page, the site can’t sell rooms. The link may also load in a way our crawl can’t see.',
      outcome: 'A visible “book” button on the home page that opens the booking engine.',
      owner: 'Website provider', effort: 'Low to check', confidence: 'Needs checking',
      proof: 'Open the home page on a phone and reach a date picker in one tap.',
    });
  }
  if (rs && rs.total_reviews >= 10 && rs.response_rate < 60) {
    push({
      id: 'responses', type: 'fix', fn: 'reputation', points: stake('reputation.responses'),
      title: 'Reply to more guest reviews',
      evidence: `${rs.total_responded} of the ${rs.total_reviews} most recent reviews we read had a management reply (${Math.round(rs.response_rate)}%).`,
      why: 'Future guests read the replies as much as the reviews. An unanswered complaint stands as the last word.',
      outcome: 'Every new review answered within a few days, complaints first.',
      owner: 'General manager or front office manager', effort: 'Low, ongoing', confidence: 'Confirmed',
      proof: 'The ten most recent Google and Tripadvisor reviews each carry a reply.',
    });
  }
  const majorThemes = (sent?.negative_themes ?? []).filter((t) => t.mentions >= 3).sort((a, b) => b.mentions - a.mentions);
  if (majorThemes.length && rs?.total_reviews) {
    const t = majorThemes[0];
    push({
      id: 'theme', type: 'operations', fn: 'reputation', points: stake('reputation.themes'),
      title: `Decide what to do about “${t.theme}”`,
      evidence: `It came up ${t.mentions} times in ${rs.total_reviews} recent reviews.${t.example_phrase ? ` One guest: “${String(t.example_phrase).slice(0, 180)}${String(t.example_phrase).length > 180 ? '…' : ''}”` : ''}`,
      why: 'This is about the stay itself, so better marketing won’t fix it. What marketing can do is set the expectation honestly before the guest books.',
      outcome: 'Either the underlying issue is addressed, or your room descriptions and photos say plainly what guests will find.',
      owner: 'General manager and owner', effort: 'Varies', confidence: 'Likely',
      proof: 'The theme appears less often in the next three months of reviews.',
    });
  }
  if (speed?.mobile_score != null && speed.mobile_score < 70) {
    push({
      id: 'mobile-speed', type: 'fix', fn: 'speed', points: stake('speed.mobile'),
      title: 'Speed up your home page on phones',
      evidence: `A lab test scored the home page ${speed.mobile_score} out of 100 on a phone${speed.desktop_score != null ? ` and ${speed.desktop_score} on a desktop` : ''}.`,
      why: 'Most travel browsing happens on a phone. A slow first load loses guests before they see a room.',
      outcome: 'A phone lab score of 80 or more, and a first screen that appears in under about 2.5 seconds.',
      owner: 'Website provider', effort: 'Medium', confidence: 'Likely',
      proof: 'Run the page through Google’s PageSpeed Insights and check the mobile score and the real-visitor data, if shown.',
    });
  }
  if (gc && gc.schema_lodging === false) {
    push({
      id: 'schema', type: 'fix', fn: 'discovery', points: stake('discovery.schema-hotel'),
      title: 'Add hotel structured data to your home page',
      evidence: 'The home page carries no Hotel or LodgingBusiness structured data.',
      why: 'This is the block of code that tells Google and AI assistants, without guessing, your name, address, rating and amenities.',
      outcome: 'A Hotel block on the home page that passes Google’s Rich Results Test.',
      owner: 'Website provider', effort: 'Low', confidence: 'Confirmed',
      proof: 'Paste your home page address into Google’s Rich Results Test and see a valid Hotel item.',
    });
  }
  if (rankKnown && rank !== 1) {
    push({
      id: 'brand-rank', type: 'investigate', fn: 'discovery', points: stake('discovery.brand-rank'),
      title: 'Find out why your site isn’t the first result for your own name',
      evidence: rank ? `Your site was result #${rank} for “${serp.query}”.` : `Your site wasn’t in the top results for “${serp.query}”.`,
      why: 'Guests who already want you are the cheapest bookings you will get. Whoever ranks above you takes them first.',
      outcome: 'Your own site is the first organic result for your name and city.',
      owner: 'Website or SEO provider', effort: 'Medium', confidence: 'Likely',
      proof: 'Search your hotel’s name and city in a private window and find your site first.',
    });
  }
  const squatter = (serp?.top_results ?? []).find((r) => r.owner === 'other' && r.position <= 3 && looksLikeHotel(r.title, audit.hotelName));
  if (squatter && rank === 1) {
    push({
      id: 'brand-squatter', type: 'investigate', fn: 'discovery', points: 0.9,
      title: `Check the ${squatter.domain} page that ranks for your name`,
      evidence: `Result #${squatter.position} for “${serp.query}” is “${squatter.title}” on ${squatter.domain}, which isn’t your site or a booking site.`,
      why: 'If it is an old management company or reseller page, it may show out-of-date rates or details under your name.',
      outcome: 'The page is current and approved by you, or it is taken down or redirected to your site.',
      owner: 'General manager', effort: 'Low to check', confidence: 'Needs checking',
      proof: 'Open the page and confirm the details, rates and booking link are yours.',
    });
  }
  if (gbp && (!gbp.has_phone || !gbp.has_website)) {
    push({
      id: 'gbp-basics', type: 'fix', fn: 'profiles', points: stake('profiles.gbp-phone') + stake('booking.site-linked'),
      title: `Add the missing ${!gbp.has_phone && !gbp.has_website ? 'phone number and website' : !gbp.has_phone ? 'phone number' : 'website link'} to your Google profile`,
      evidence: `Your Google Business Profile shows ${gbp.has_phone ? 'a phone number' : 'no phone number'} and ${gbp.has_website ? 'a website link' : 'no website link'}.`,
      why: 'The profile is the first thing most guests see when they search for you.',
      outcome: 'Phone and website both show on the profile.',
      owner: 'Whoever manages your Google Business Profile', effort: 'Low', confidence: 'Confirmed',
      proof: 'Search your hotel on Google and see both on the profile.',
    });
  }
  if (titleHasName === false) {
    push({
      id: 'title', type: 'fix', fn: 'brand', points: stake('brand.name-in-title'),
      title: 'Put the hotel’s name in your home page title',
      evidence: pageTitle ? `Your title reads “${pageTitle}”.` : 'The hotel’s name isn’t in the page title.',
      why: 'The title is the blue link guests see in search results.',
      outcome: `A title that begins with “${audit.hotelName}”.`,
      owner: 'Website provider', effort: 'Low', confidence: 'Confirmed',
      proof: 'Search your hotel and read the blue link.',
    });
  }
  const priorities = cands.sort((a, b) => b.points - a.points).slice(0, 5);

  // ---------- strengths ----------
  const strengths = functions.flatMap((f) => f.checks.filter((c) => c.earned != null && c.earned >= 0.85 && c.max > 0)
    .map((c) => ({ label: c.label, observed: c.observed, fn: f.name, value: f.weight * (c.max / 100) })))
    .sort((a, b) => b.value - a.value).slice(0, 4);

  // ---------- one improvement example ----------
  let example = null;
  if (gc && gc.schema_lodging === false && site) { // `site` here is the hotel's web address
    const url = (() => { try { const u = new URL(site); return `${u.origin}/`; } catch { return ''; } })();
    const block = {
      '@context': 'https://schema.org',
      '@type': 'Hotel',
      name: audit.hotelName,
      url,
      address: { '@type': 'PostalAddress', streetAddress: 'FILL IN', addressLocality: audit.city || 'FILL IN', addressRegion: audit.state || 'FILL IN', postalCode: 'FILL IN', addressCountry: 'FILL IN' },
      telephone: 'FILL IN',
      ...(gbp?.google_maps_url ? { hasMap: gbp.google_maps_url } : {}),
      checkinTime: 'FILL IN, e.g. 15:00',
      checkoutTime: 'FILL IN, e.g. 11:00',
      amenityFeature: [{ '@type': 'LocationFeatureSpecification', name: 'FILL IN one per amenity', value: true }],
    };
    example = {
      finding: 'The home page carries no Hotel structured data.',
      title: 'A starting block of hotel structured data',
      intro: 'This is a proposal, built only from facts the scan confirmed: your name, website, city and Google Maps listing. Everything marked FILL IN is yours to supply. We didn’t guess at amenities, times or your address.',
      code: `<script type="application/ld+json">\n${JSON.stringify(block, null, 2)}\n</script>`,
      handoff: 'Hand this to whoever maintains your website. It goes in the home page’s <head>.',
    };
  }

  // ---------- observations that aren't scored ----------
  const gAds = evidence(audit, /^google ads presence/i);
  const mAds = evidence(audit, /^meta ads presence/i);
  const adRivals = meta.compset_ads?.competitors ?? [];
  const ads = (gAds || mAds || adRivals.length) ? {
    you: {
      name: audit.hotelName,
      google: gAds?.registry?.checked ? !!(gAds.runs_ads_registry ?? gAds.registry.runs_ads_registry) : null,
      googleBy: (gAds?.registry?.advertisers ?? []).filter(Boolean),
      meta: mAds?.status === 'ok' ? !!mAds.running_ads : null,
    },
    rivals: adRivals.map((r) => ({ name: r.name, google: r.google_ads ?? null, meta: r.meta_ads ?? null })),
    /** Who was advertising on a search for the hotel's own name, from our brand search. Null when not read. */
    brand: bs ? { query: bs.query, own: bs.ownAd, others: [...new Set(bs.ads.filter((x) => x.owner !== 'you').map((x) => x.domain))].slice(0, 6) } : null,
  } : null;

  const themes = sent ? {
    reviews: rs?.total_reviews ?? null,
    positive: (sent.positive_themes ?? []).slice(0, 5).map((t) => ({ theme: t.theme, mentions: t.mentions, quote: t.example_phrase })),
    negative: (sent.negative_themes ?? []).slice(0, 5).map((t) => ({ theme: t.theme, mentions: t.mentions, quote: t.example_phrase, severity: t.severity })),
  } : null;

  // Google's own review topics and star spread for the listing. Shown, not scored: the themes check already covers what guests say.
  const gTopics = (px?.hotel?.topics ?? []).filter((t) => t.mentions >= 10);
  const gStars = px?.hotel?.stars ?? [];
  const starTotal = gStars.reduce((t, r) => t + r.count, 0);
  const voice = gTopics.length >= 3 || starTotal >= 20 ? {
    topics: gTopics.map((t) => ({ ...t, negShare: t.negative / Math.max(1, t.positive + t.negative) })).sort((a, b) => b.negShare - a.negShare).slice(0, 10),
    stars: starTotal >= 20 ? [5, 4, 3, 2, 1].map((n) => { const c = gStars.find((r) => r.stars === n)?.count ?? 0; return { stars: n, count: c, share: c / starTotal }; }) : [],
    total: starTotal,
    low: starTotal ? gStars.filter((r) => r.stars <= 2).reduce((t, r) => t + r.count, 0) / starTotal : null,
  } : null;

  const prices = rates.length >= 3 ? {
    night, direct, lowest, gap,
    cheaper: direct ? others.filter((r) => r.rate < direct.rate).length : 0,
    others: others.length,
    ours: !!px,
    nights: nights.filter((n) => n.rates.length >= 3).map((n) => ({ night: n.night, kind: n.kind, direct: n.direct, lowest: n.lowest, gap: n.gap, cheaper: n.cheaper, others: n.others.length })),
    rooms: px ? (px.nights.find((n) => n.ok)?.rooms ?? []) : [],
    rows: [...(direct ? [{ ...direct, mine: true }] : []), ...others.slice(0, direct ? 9 : 10)].sort((a, b) => a.rate - b.rate),
  } : null;

  const headline = (() => {
    const scoredFns = functions.filter((f) => f.score != null && f.coverage >= 0.2);
    const flagged = new Set(priorities.map((p) => p.fn));
    const best = [...scoredFns].filter((f) => f.coverage >= 0.5 && !flagged.has(f.key)).sort((a, b) => b.score - a.score || b.weight - a.weight)[0];
    const top = priorities[0];
    const parts = [];
    if (best && best.score >= 75) parts.push(`${audit.hotelName} is strongest on ${best.name.toLowerCase()} (${best.score} out of 100 on what we could see).`);
    if (top) parts.push(`First: ${lower(top.title)}.`);
    else parts.push('Nothing we could observe needs urgent attention.');
    return parts.join(' ');
  })();

  return {
    version: METHOD_VERSION,
    scannedAt: when,
    /** True when our own website collector's reading was used. */
    siteRead: !!web,
    siteNote: crawl && !crawl.ok ? `We couldn’t read your website ourselves this time (${crawl.error || 'no answer'}), so the website checks use the older reading.` : web && !webSolid ? 'Your home page is built in the browser by script, so some website checks couldn’t be read and were left out.' : '',
    score: graded ? score : null,
    rawScore: score,
    letter: graded ? letterFor(score) : '-',
    graded,
    coverage,
    functions, priorities, strengths, identity, choice, example, ads, themes, voice, prices, headline,
    ai: { samples, queries },
    counts: {
      checks: functions.reduce((n, f) => n + f.checks.filter((c) => c.status !== 'na').length, 0),
      observed: functions.reduce((n, f) => n + f.checks.filter((c) => c.earned != null).length, 0),
    },
  };
}

/** The hotel's website address as the scan found it, or ''. */
export function websiteOf(audit) {
  const gbp = evidence(audit, /^google business profile/i);
  return gbp?.website_url || audit?._meta?.booking_links?.website_url || '';
}

function lower(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
