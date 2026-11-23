// Collector: the hotel's own website.
//
// Reads what any visitor's browser is sent: the home page, robots.txt, the
// sitemap, and the first page of the booking engine. It never submits a form,
// never enters guest details and never makes a booking. Needs no API key.
//
// Limit worth knowing: this reads the HTML the server sends. A site that
// builds its page in the browser with JavaScript shows up as nearly empty, and
// the result says so (`rendered: 'script'`) instead of reporting things as missing.

import { parse } from 'node-html-parser';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 hotelgrader/2.0 (+https://hotelgrader.com/methodology)';
const MAX_BYTES = 6_000_000; // site builders such as Framer send pages of 2 MB and more

/** Booking engines we can name from a link's host. */
const ENGINES = [
  [/synxis\.com|sabre/i, 'Sabre SynXis'], [/cloudbeds\.com/i, 'Cloudbeds'], [/travelclick\.com|ihotelier/i, 'Amadeus iHotelier'],
  [/webrezpro\.com/i, 'WebRezPro'], [/thinkreservations\.com/i, 'ThinkReservations'], [/guestcentric/i, 'GuestCentric'],
  [/siteminder\.com|thebookingbutton|direct-book\.com/i, 'SiteMinder'], [/mews\.com|mews\.li/i, 'Mews'], [/littlehotelier\.com/i, 'Little Hotelier'],
  [/profitroom/i, 'Profitroom'], [/d-edge\.com|securehotelbooking|availpro/i, 'D-EDGE'], [/avvio\.com/i, 'Avvio'], [/roomraccoon/i, 'RoomRaccoon'],
  [/reservations\.verticalbooking|verticalbooking/i, 'Vertical Booking'], [/bookingsuite|booking\.com\/hotel/i, 'Booking.com'], [/reseze\.net|rezstream/i, 'RezStream'],
  [/stayntouch|rover\.stayntouch/i, 'Stayntouch'], [/hotelrunner/i, 'HotelRunner'], [/guesty/i, 'Guesty'], [/lodgify/i, 'Lodgify'], [/innroad/i, 'innRoad'],
  [/reservhotel/i, 'ReservHotel'], [/windsurfercrs|sht\.io|shrgroup/i, 'SHR Windsurfer'], [/pegs\.com|pegasus/i, 'Pegasus'], [/hotelkeyapp|hotelkey/i, 'HotelKey'],
  [/triptease/i, 'Triptease'], [/bookdirect|book-direct|bookings?\.|reservations?\.|reserve\.|secure\./i, ''],
];
const BOOK_WORDS = /\b(book( now| direct| a room| online| your stay)?|reserve( now)?|reservations?|check (availability|rates)|availability|rooms? & rates)\b/i;
const DATE_KEYS = ['arrive', 'arrival', 'checkin', 'check_in', 'check-in', 'datein', 'startdate', 'start_date', 'from', 'ci', 'arrivaldate', 'checkindate'];
const SOCIAL = [['facebook', /facebook\.com\/(?!sharer|share|tr\b|plugins|dialog)([^/?#]+)/i], ['instagram', /instagram\.com\/([^/?#]+)/i], ['tiktok', /tiktok\.com\/(@[^/?#]+)/i],
  ['youtube', /youtube\.com\/((?:@|channel\/|c\/|user\/)[^/?#]+)/i], ['x', /(?:twitter|x)\.com\/(?!intent|share)([^/?#]+)/i], ['linkedin', /linkedin\.com\/(company\/[^/?#]+)/i], ['tripadvisor', /tripadvisor\.[a-z.]+\/(Hotel_Review[^?#]+)/i]];
const SIGNUP_PROVIDERS = [[/list-manage\.com|mailchimp/i, 'Mailchimp'], [/klaviyo/i, 'Klaviyo'], [/constantcontact/i, 'Constant Contact'], [/revinate/i, 'Revinate'], [/cendyn/i, 'Cendyn'],
  [/hsforms|hubspot/i, 'HubSpot'], [/navis/i, 'Navis'], [/campaignmonitor|createsend/i, 'Campaign Monitor'], [/flodesk/i, 'Flodesk'], [/sendinblue|brevo/i, 'Brevo']];

/** Refuse anything that isn't a public web address. */
export function publicUrl(raw) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return null;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':')) return null; // no raw IPs
  return u;
}

async function get(url, { timeout = 7000, text = true } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(timeout),
    });
    if (!publicUrl(res.url)) return { ok: false, status: 0, error: 'redirected somewhere private', ms: Date.now() - started };
    let body = '';
    if (text) {
      const buf = await res.arrayBuffer();
      body = new TextDecoder('utf-8').decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf);
    }
    return { ok: res.ok, status: res.status, url: res.url, body, type: res.headers.get('content-type') || '', ms: Date.now() - started };
  } catch (e) {
    return { ok: false, status: 0, error: e?.name === 'TimeoutError' ? 'timed out' : 'could not connect', ms: Date.now() - started };
  }
}

const tidy = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const abs = (href, base) => { try { return new URL(href, base).toString(); } catch { return ''; } };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const engineOf = (u) => { for (const [re, name] of ENGINES) if (re.test(hostOf(u))) return name || hostOf(u); return ''; };

function pastDate(url, today) {
  try {
    const q = new URL(url).searchParams;
    for (const [k, v] of q) {
      if (!DATE_KEYS.includes(k.toLowerCase())) continue;
      const m = v.match(/(\d{4})-(\d{2})-(\d{2})/) || (v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) ? [null, v.slice(6), v.slice(0, 2), v.slice(3, 5)] : null);
      if (m && `${m[1]}-${m[2]}-${m[3]}` < today) return `${m[1]}-${m[2]}-${m[3]}`;
    }
  } catch { /* not a URL */ }
  return '';
}

/** Every JSON-LD object on the page, flattened through @graph. */
function jsonLd(root) {
  const out = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { out.push(o); if (o['@graph']) walk(o['@graph']); } };
      walk(JSON.parse(s.text));
    } catch { /* malformed block: ignored, and counted below */ }
  }
  return out;
}
const typesOf = (o) => [].concat(o['@type'] ?? []).map(String);
const LODGING = /^(Hotel|LodgingBusiness|Resort|Motel|Hostel|BedAndBreakfast|VacationRental|Campground)$/;

export async function scanSite(rawUrl, { now = new Date() } = {}) {
  const start = publicUrl(rawUrl);
  const fetchedAt = now.toISOString();
  if (!start) return { ok: false, error: 'not a public web address', fetchedAt };
  const today = fetchedAt.slice(0, 10);
  // Tracking parameters from a Google profile link aren't part of the page.
  for (const k of [...start.searchParams.keys()]) if (/^(utm_|nck$|gclid$|fbclid$|y_source$)/i.test(k)) start.searchParams.delete(k);

  const origin = start.origin;
  const [home, robotsRes, sitemapRes, llmsRes] = await Promise.all([
    get(start.toString(), { timeout: 6000 }),
    get(`${origin}/robots.txt`, { timeout: 3500 }),
    get(`${origin}/sitemap.xml`, { timeout: 3500 }),
    get(`${origin}/llms.txt`, { timeout: 3500 }),
  ]);
  if (!home.ok || !/html/i.test(home.type)) {
    return { ok: false, url: start.toString(), status: home.status, error: home.error || (home.status ? `the site answered ${home.status}` : 'no HTML came back'), fetchedAt };
  }

  const root = parse(home.body, { comment: false });
  const base = home.url;
  const siteHost = hostOf(base);
  const meta = (sel) => tidy(root.querySelector(sel)?.getAttribute('content'));
  const ld = jsonLd(root);
  const ldBlocks = root.querySelectorAll('script[type="application/ld+json"]').length;
  const scripts = root.querySelectorAll('script').length;
  // Read the visible words only: scripts and styles aren't content. This uses its own
  // copy of the page so links inside <template> or <noscript> stay available below.
  const textRoot = parse(home.body, { comment: false });
  for (const n of textRoot.querySelectorAll('script, style, svg')) n.remove();
  const bodyText = tidy((textRoot.querySelector('body') ?? textRoot).text ?? '');
  const rendered = bodyText.length < 400 && scripts > 3 ? 'script' : 'html';

  // ---- links ----
  const anchors = root.querySelectorAll('a[href]').map((a) => ({ href: abs(a.getAttribute('href'), base), text: tidy(a.text || a.getAttribute('aria-label') || a.getAttribute('title') || '') }))
    .filter((a) => /^https?:/i.test(a.href));
  const tel = [...new Set(root.querySelectorAll('a[href^="tel:"]').map((a) => a.getAttribute('href').replace(/^tel:/i, '').replace(/[^\d+]/g, '')).filter((t) => t.length >= 7))];
  const mail = [...new Set(root.querySelectorAll('a[href^="mailto:"]').map((a) => a.getAttribute('href').replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase()).filter((m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)))];

  // ---- booking path ----
  const bookLinks = [];
  const seen = new Set();
  for (const a of anchors) {
    const engine = engineOf(a.href);
    const offsite = hostOf(a.href) !== siteHost;
    const isBook = (offsite && engine) || (BOOK_WORDS.test(a.text) && a.text.length <= 40);
    // Account pages on a booking host aren't a way to book.
    // Table and spa bookings aren't room bookings.
    if (/designmynight|opentable|resy\.com|sevenrooms|exploretock|tock\.com|mindbody|booker\.com|eventbrite/i.test(a.href)) continue;
    if (!isBook || /\/(account|login|sign-?in|manage|cancel|my-?(booking|reservation)s?)\b/i.test(a.href)) continue;
    const key = a.href.split('#')[0];
    const stale = pastDate(a.href, today);
    bookLinks.push({ url: a.href, text: a.text.slice(0, 40), engine: offsite ? engine : '', offsite, pastDate: stale });
    seen.add(key);
  }
  // Forms that post to a booking engine count as a booking path too.
  for (const f of root.querySelectorAll('form[action]')) {
    const action = abs(f.getAttribute('action'), base);
    const engine = engineOf(action);
    if (engine && hostOf(action) !== siteHost) bookLinks.push({ url: action, text: 'booking form', engine, offsite: true, pastDate: '', form: true });
  }
  const engineLinks = bookLinks.filter((l) => l.engine);
  const engine = engineLinks.map((l) => l.engine).sort((a, b) => engineLinks.filter((l) => l.engine === b).length - engineLinks.filter((l) => l.engine === a).length)[0] || '';
  const worded = (l) => BOOK_WORDS.test(l.text);
  const main = (engineLinks.find((l) => !l.pastDate && !l.form && worded(l)) || engineLinks.find((l) => !l.pastDate && !l.form) || engineLinks[0]
    || bookLinks.find((l) => !l.pastDate && l.offsite) || bookLinks.find((l) => !l.pastDate) || bookLinks[0])?.url || '';
  const stale = bookLinks.filter((l) => l.pastDate);

  // First page of the booking engine: does it answer?
  let firstStep = null;
  if (main && hostOf(main) !== siteHost) {
    const r = await get(main, { timeout: 4500 });
    const page = r.ok ? parse(r.body, { comment: false }) : null;
    const pageTitle = page ? tidy(page.querySelector('title')?.text) : '';
    if (page) for (const n of page.querySelectorAll('script, style, svg')) n.remove();
    const txt = page ? tidy((page.querySelector('body') ?? page).text ?? '') : '';
    firstStep = {
      url: main, status: r.status, ok: r.ok, ms: r.ms,
      // A 401/403/429 means the engine turned away an automated visit, not that it is broken.
      blocked: [401, 403, 429].includes(r.status) || r.error === 'timed out', finalHost: r.url ? hostOf(r.url) : '', error: r.error || '',
      title: pageTitle,
      // Many engines draw their calendar with JavaScript, so an empty page here isn't a fault.
      readable: txt.length >= 200,
      mentionsRooms: /\b(room|suite|rate|night|check.?in|arrival|guests?)\b/i.test(txt),
    };
  }

  // ---- structured data ----
  const lodging = ld.find((o) => typesOf(o).some((t) => LODGING.test(t)));
  const has = (o, k) => o && o[k] != null && o[k] !== '';
  const schema = {
    blocks: ldBlocks,
    types: [...new Set(ld.flatMap(typesOf))].slice(0, 20),
    lodging: lodging ? {
      type: typesOf(lodging).find((t) => LODGING.test(t)),
      name: tidy(lodging.name),
      has: { address: has(lodging, 'address'), telephone: has(lodging, 'telephone'), geo: has(lodging, 'geo'), image: has(lodging, 'image'), priceRange: has(lodging, 'priceRange'),
        amenities: has(lodging, 'amenityFeature'), checkin: has(lodging, 'checkinTime'), rating: has(lodging, 'aggregateRating') || has(lodging, 'starRating') },
    } : null,
    faq: ld.some((o) => typesOf(o).includes('FAQPage')),
  };

  // ---- contact and email signup ----
  const htmlLower = home.body.toLowerCase();
  const provider = SIGNUP_PROVIDERS.find(([re]) => re.test(home.body))?.[1] || '';
  const emailForms = root.querySelectorAll('form').filter((f) => f.querySelector('input[type="email"], input[name*="email" i], input[placeholder*="email" i]'));
  const signupForm = emailForms.find((f) => /newsletter|subscribe|sign.?up|offers|updates|mailing|stay in touch|exclusive/i.test(f.outerHTML));
  const signupLink = anchors.find((a) => /newsletter|subscribe|sign up for|email (offers|sign)|mailing list/i.test(a.text));
  const pick = (re) => anchors.find((a) => hostOf(a.href) === siteHost && (re.test(a.text) || re.test(new URL(a.href).pathname)))?.href || '';
  const pages = {
    rooms: pick(/\b(rooms?|suites?|accommodations?|stay)\b/i),
    offers: pick(/\b(offers?|specials?|packages?|deals?|promotions?)\b/i),
    gallery: pick(/\b(gallery|photos?)\b/i),
    faq: pick(/\b(faqs?|frequently asked)\b/i),
    contact: pick(/\bcontact\b/i),
    location: pick(/\b(location|directions|getting here|map|neighborhood|area)\b/i),
    dining: pick(/\b(dining|restaurants?|eat|bar)\b/i),
    amenities: pick(/\b(amenities|facilities|services|pool|spa|wellness)\b/i),
  };

  // ---- social profiles the hotel itself links to ----
  const social = {};
  // Profiles named in the page's structured data (sameAs) count as the hotel's own, too.
  const sameAs = ld.flatMap((o) => [].concat(o.sameAs ?? [])).filter((u) => typeof u === 'string').map((href) => ({ href }));
  for (const a of [...anchors, ...sameAs]) for (const [name, re] of SOCIAL) { const m = a.href.match(re); if (m && !social[name]) social[name] = { url: a.href.split('?')[0], handle: decodeURIComponent(m[1]).replace(/\/$/, '') }; }

  // ---- robots, sitemap, llms.txt ----
  const robotsOk = robotsRes.ok && /user-agent/i.test(robotsRes.body) && !/<html/i.test(robotsRes.body);
  const robots = {
    found: robotsOk,
    blocksAll: robotsOk && /user-agent:\s*\*[^]*?disallow:\s*\/\s*(\n|$)/i.test(robotsRes.body.split(/\n\s*\n/).find((b) => /user-agent:\s*\*/i.test(b)) || ''),
    sitemaps: robotsOk ? [...robotsRes.body.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 5) : [],
  };
  let sitemap = { found: sitemapRes.ok && /<(urlset|sitemapindex)/i.test(sitemapRes.body), urls: 0, url: `${origin}/sitemap.xml` };
  if (!sitemap.found && robots.sitemaps[0] && publicUrl(robots.sitemaps[0])) {
    const alt = await get(robots.sitemaps[0], { timeout: 3000 });
    sitemap = { found: alt.ok && /<(urlset|sitemapindex)/i.test(alt.body), urls: 0, url: robots.sitemaps[0], body: alt.body };
  } else sitemap.body = sitemapRes.body;
  if (sitemap.found) sitemap.urls = (sitemap.body.match(/<loc>/gi) || []).length;
  delete sitemap.body;

  const images = root.querySelectorAll('img');
  return {
    ok: true,
    url: start.toString(), finalUrl: home.url, host: siteHost, status: home.status, ms: home.ms, bytes: home.body.length, https: home.url.startsWith('https:'),
    rendered, words: bodyText.split(' ').filter(Boolean).length,
    title: tidy(root.querySelector('title')?.text), description: meta('meta[name="description"]'),
    h1: root.querySelectorAll('h1').map((h) => tidy(h.text)).filter(Boolean).slice(0, 5),
    lang: root.querySelector('html')?.getAttribute('lang') || '',
    viewport: !!root.querySelector('meta[name="viewport"]'),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
    noindex: /noindex/i.test(meta('meta[name="robots"]')),
    og: { title: meta('meta[property="og:title"]'), image: meta('meta[property="og:image"]'), description: meta('meta[property="og:description"]') },
    images: { count: images.length, withAlt: images.filter((i) => tidy(i.getAttribute('alt')).length > 2).length },
    schema,
    booking: { links: bookLinks.slice(0, 25), buttons: bookLinks.length, engine, main, stale: stale.slice(0, 10), staleCount: stale.length, firstStep },
    contact: { phones: tel.slice(0, 4), emails: mail.slice(0, 4), page: pages.contact, phoneInText: /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(bodyText) },
    signup: { found: !!(signupForm || signupLink || provider), form: !!signupForm, link: signupLink?.href || '', provider },
    chat: /intercom|drift\.com|tawk\.to|livechat|zendesk|hubspot.*conversations|asksuite|quicktext|whistle|myma\.ai/i.test(htmlLower),
    pages, social, robots, sitemap,
    llms: { found: llmsRes.ok && !/<html/i.test(llmsRes.body) && llmsRes.body.trim().length > 20 },
    fetchedAt,
  };
}
