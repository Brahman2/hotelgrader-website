import { useEffect, useMemo, useState } from 'react';
import { HG_API, fetchScan, fetchSpeed, fetchThemes, runAudit, type Audit, type OwnScan } from '../lib/hg';
import { assess, compSet } from '../../shared/assess.mjs';
import { checkLink, loadUser, saveUser, sendReport, shareLink, type User } from '../lib/verify';
import { hotelParams, track } from '../lib/track';
import Gate from './Gate';
import Report, { shareText } from './Report';
import { geocode, geocodeCity, offset, type LatLon } from '../lib/geo';
import HeroForm from './HeroForm';
import Scanner, { type Blip } from './Scanner';

// The free report card. Reads ?hotel=&city=&state= from the URL, runs a live
// scan against the hotelgrader API, and renders the report (Report.tsx): the
// grade and what it rests on, what to do first, and the evidence.
//
// The card is gated: the scan starts right away, but the grade only shows once
// the visitor gives a first name and email and confirms a code we send there.
// One verified email unlocks every card in that browser, including the full
// report. Sharing on LinkedIn is optional, one button, and never states the grade.


const MAILED_KEY = 'hg-mailed';
const LEADS_KEY = 'hg-leads';

type Target = { hotel: string; city: string; state: string };
type Rival = { n: number; name: string; rating?: number; reviews?: number; lat?: number | null; lng?: number | null };

function readStore(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function writeStore(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked; the gate just asks again next time */ }
}

/**
 * Record who graded which hotel in Netlify Forms (form "report-card", declared
 * as static HTML in grade.astro). Sent once per hotel per browser. A failed
 * send never blocks the visitor.
 */
function recordLead(user: User, t: Target) {
  const id = [t.hotel, t.city, t.state].join('|').toLowerCase();
  const sent = readStore(LEADS_KEY).split('\n').filter(Boolean);
  if (sent.includes(id)) return;
  const body = new URLSearchParams({ 'form-name': 'report-card', name: user.name, email: user.email, hotel: t.hotel, city: t.city, state: t.state });
  fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
    .then((r) => { if (r.ok) writeStore(LEADS_KEY, [...sent, id].slice(-50).join('\n')); })
    .catch(() => { /* offline or not on Netlify */ });
}

/**
 * Locates the hotel as soon as the page opens, then each named competitor once
 * the scan returns them. Blips appear one by one as they are found.
 */
function useMarket(target: Target | null | undefined, audit: Audit | null, live: unknown | null = null) {
  const [center, setCenter] = useState<LatLon | null>(null);
  const [located, setLocated] = useState(false);
  const [approximate, setApproximate] = useState(false);
  const [blips, setBlips] = useState<Blip[]>([]);

  useEffect(() => {
    if (!target) return;
    const ctrl = new AbortController();
    setCenter(null);
    setLocated(false);
    setApproximate(false);
    geocode(target.hotel, target.city, target.state, ctrl.signal)
      .then((c) => c ?? geocodeCity(target.city, target.state, ctrl.signal).then((city) => { if (city) setApproximate(true); return city; }))
      .then((c) => {
        if (ctrl.signal.aborted) return;
        setCenter(c);
        setLocated(true);
      });
    return () => ctrl.abort();
  }, [target]);

  // Our own comparison set when we have one (it carries coordinates); otherwise the grading API's.
  const ours = audit ? compSet(audit, live) : null;
  const rivals: Rival[] = (ours?.top_competitors ?? audit?._meta?.competitors?.top_competitors ?? []).map((c, i) => ({ ...c, n: i + 1 }));
  const rivalKey = rivals.map((r) => r.name).join('|');

  useEffect(() => {
    setBlips([]);
    if (!target || !center || approximate || !rivalKey) return;
    const ctrl = new AbortController();
    rivals.forEach((r) => {
      const known = r.lat != null && r.lng != null ? Promise.resolve({ lat: r.lat, lon: r.lng }) : null;
      (known ?? geocode(r.name, target.city, target.state, ctrl.signal)).then((p) => {
        if (!p || ctrl.signal.aborted) return;
        const { x, y } = offset(center, p);
        if (Math.hypot(x, y) > 80000) return; // a wrong match in another city
        setBlips((prev) => [...prev.filter((b) => b.n !== r.n), { n: r.n, name: r.name, lat: p.lat, lon: p.lon }].sort((a, b) => a.n - b.n));
      });
    });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, center, approximate, rivalKey]);

  return { center, located, approximate, blips, rivals };
}

type Market = ReturnType<typeof useMarket>;

// What the scan is doing, by seconds elapsed. Our own readings land in the
// first fifteen seconds; the slower review, ad and speed checks follow.
const STAGES: [number, string][] = [
  [0, 'Finding the hotel on Google'],
  [4, 'Checking rates'],
  [8, 'Opening the website and booking path'],
  [11, 'Searching your name and your town'],
  [14, 'Reading the newest reviews and replies'],
  [18, 'Testing page speed on a phone'],
  [26, 'Grouping what guests keep saying'],
  [38, 'Weighing the evidence'],
];
// When our own scan can't carry the grade, the older grading API does, and it takes about two minutes.
const SLOW_STAGES: [number, string][] = STAGES.map(([t, text], i) => [i < 4 ? t : Math.round(t * 3.2), text]);

/* eslint-disable @typescript-eslint/no-explicit-any */
/** What our own scan has found so far, shown as it lands so the wait isn't a blank screen. */
/** The Google Places listing for a hotel: a fallback for the first panel when our own price search can't find it. */
function usePlacesListing(target: Target) {
  const [listing, setListing] = useState<any>(undefined);
  useEffect(() => {
    let off = false;
    const q = new URLSearchParams({ hotel_name: target.hotel, city: target.city, state: target.state, max_photos: '6' });
    fetch(`${HG_API}/api/hotel-photos?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!off) setListing(d?.success && d.hotel ? { ...d.hotel, images: (d.photos ?? []).map((p: any) => p.url).filter(Boolean) } : null); })
      .catch(() => { if (!off) setListing(null); });
    return () => { off = true; };
  }, [target.hotel, target.city, target.state]);
  return listing; // undefined while loading, null when not found
}

function Findings({ peek, market, target, ready, shot }: { peek: OwnScan | null; market: Market; target: Target; ready: boolean; shot?: string }) {
  const live = (peek?.live ?? {}) as any;
  const places = usePlacesListing(target);
  const own = live.prices?.ok ? live.prices.hotel : null;
  // Our own reading wins; the Places listing fills the panel when the price search can't find the hotel.
  const h = own ?? (places ? { name: places.name, address: places.address, rating: places.rating, reviews: places.reviews_count, images: places.images, link: places.website } : null);
  const lost = !h && places === null && !!peek && !peek.pending;
  const night = live.prices?.ok ? (live.prices.nights ?? []).find((n: any) => n.ok && n.rates?.length) : null;
  const site = (peek?.crawl as any)?.ok ? (peek!.crawl as any) : null;
  const topics: any[] = (own?.topics ?? []).filter((t: any) => t.mentions >= 10);
  const share = (t: any) => t.positive / Math.max(1, t.positive + t.negative);
  const praised = [...topics].sort((x, y) => share(y) - share(x)).slice(0, 3);
  const griped = [...topics].filter((t) => share(t) < 0.6).sort((x, y) => share(x) - share(y)).slice(0, 3);
  const stars: any[] = own?.stars ?? [];
  const starTotal = stars.reduce((t, r) => t + r.count, 0);
  const newest: any[] = (live.reviews?.reviews ?? []).filter((x: any) => x.text && x.rating != null);
  const card = 'panel p-5 reveal';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
      {/* The listing: photos, address, rating */}
      <div className={`${card} sm:col-span-2`}>
        <div className="meta mb-3">{h ? 'found on Google' : lost ? 'not found on Google' : 'finding the hotel on Google'}</div>
        {h ? (
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-center">
            {h.images?.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {h.images.slice(0, 6).map((src: string) => (
                  <img key={src} src={src} alt="" referrerPolicy="no-referrer" className="w-full aspect-square object-cover rounded-sm bg-edge" />
                ))}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-[17px]">{h.name}</div>
              {h.address && <div className="text-ink-60 text-[13.5px] mt-0.5">{h.address}</div>}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-3">
                {h.rating != null && <span className="num text-[26px] leading-none">{Number(h.rating).toFixed(1)}<span className="text-accent text-[18px]"> ★</span></span>}
                {h.reviews != null && <span className="text-ink-60 text-[13.5px]">{Number(h.reviews).toLocaleString('en-US')} Google reviews</span>}
              </div>
              {h.hotelClass != null && <div className="meta mt-2">Google lists it as a {h.hotelClass}-star hotel</div>}
            </div>
          </div>
        ) : lost
          ? <p className="text-ink-60 text-[13.5px] m-0">We couldn’t find {target.hotel} on Google. Check the spelling, or pick the hotel from the list as you type.</p>
          : <div className="skeleton h-[92px]" />}
      </div>

      {/* What guests say */}
      {h && (starTotal >= 20 || topics.length >= 3) && (
        <div className={card}>
          <div className="meta mb-3">reading {starTotal ? starTotal.toLocaleString('en-US') : 'the'} guest reviews</div>
          {starTotal >= 20 && (
            <ul className="list-none m-0 p-0 space-y-1 mb-4">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = stars.find((r) => r.stars === n)?.count ?? 0;
                return (
                  <li key={n} className="grid grid-cols-[14px_1fr] items-center gap-2 text-[12px]">
                    <span className="num text-ink-60">{n}</span>
                    <span className="h-[7px] bg-edge"><span className="block h-full" style={{ width: `${(c / starTotal) * 100}%`, background: n >= 4 ? 'var(--grade-a)' : n === 3 ? 'var(--ink-40)' : 'var(--grade-f)' }} /></span>
                  </li>
                );
              })}
            </ul>
          )}
          {praised.length > 0 && <p className="text-[13.5px]"><span className="text-ink-60">Guests praise </span>{praised.map((t) => t.name.toLowerCase()).join(', ')}.</p>}
          {griped.length > 0 && <p className="text-[13.5px] mt-1"><span className="text-ink-60">Complaints gather around </span>{griped.map((t) => t.name.toLowerCase()).join(', ')}.</p>}
        </div>
      )}

      {/* The hotel's own site, as a phone sees it */}
      {(site || h?.link) && (
        <div className={card}>
          <div className="meta mb-3">{site ? 'your website on a phone' : 'opening your website'}</div>
          <div className="flex gap-4 items-start">
            <div className="phone" aria-hidden="true">
              {/* The page speed test's own picture of the page when we have it: it always renders, a framed site sometimes doesn't. */}
              {(shot || live.speed?.screenshot)
                ? <img src={shot || live.speed.screenshot} alt="" className="block w-full h-full object-cover object-top" />
                : site?.frameable
                ? <iframe src={site.finalUrl} title="" tabIndex={-1} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" />
                : site
                  ? <div className="phone-card">{site.og?.image && <img src={site.og.image} alt="" referrerPolicy="no-referrer" />}<strong>{site.title}</strong><span>{site.description}</span></div>
                  : <div className="skeleton h-full" />}
            </div>
            {site && (
              <ul className="list-none m-0 p-0 text-[13px] space-y-2 min-w-0">
                <li className="truncate font-medium">{site.host}</li>
                <li className="text-ink-60">loaded in {(site.ms / 1000).toFixed(1)}s</li>
                {site.booking?.engine && <li className="text-ink-60">books through {site.booking.engine}</li>}
                {site.booking?.buttons > 0 && <li className="text-ink-60">{site.booking.buttons} booking {site.booking.buttons === 1 ? 'link' : 'links'} found</li>}
                {site.schema?.lodging && <li className="text-ink-60">hotel data for search engines found</li>}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* The newest reviews themselves */}
      {newest.length >= 2 && (
        <div className={`${card} sm:col-span-2`}>
          <div className="meta mb-3">reading your newest Google reviews and checking for replies</div>
          <ul className="list-none m-0 p-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {newest.slice(0, 3).map((x: any, i: number) => (
              <li key={i} className="border border-edge p-3 text-[12.5px] leading-snug min-w-0">
                <div className="flex justify-between gap-2 mb-1.5">
                  <span className={`num ${x.rating >= 4 ? 'grade--a' : x.rating > 3 ? 'grade--c' : 'grade--f'}`}>{x.rating}/5</span>
                  <span className="text-ink-40">{x.reply ? 'replied' : 'no reply'}</span>
                </div>
                <p className="text-ink-60 m-0">“{x.text.length > 120 ? `${x.text.slice(0, 120).replace(/\s+\S*$/, '')}…` : x.text}”</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prices, as a count only: the detail is in the report */}
      {night && (
        <div className={card}>
          <div className="meta mb-2">comparing prices</div>
          <div className="num text-[30px] leading-none">{night.rates.length}</div>
          <p className="text-ink-60 text-[13.5px] mt-1.5">booking sites show a rate for {new Date(`${night.checkIn}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}. Your own site is {night.rates.some((r: any) => r.official) ? 'one of them' : 'not among them'}.</p>
        </div>
      )}

      {/* The hotels around it */}
      <div className={`${card} ${night && !(site || h?.link) ? '' : ''}`}>
        <div className="meta mb-3">{market.rivals.length > 0 ? `${market.rivals.length} hotels to compare you with` : 'mapping the hotels around you'}</div>
        <Scanner center={market.center} blips={market.blips} scanning={!ready || !market.located} hotel={target.hotel} approximate={market.approximate} />
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Shown while the scan runs, and after it if the email isn't verified yet. */
function ScanScreen({ target, elapsed, ready, settled, slow, locked, market, peek, shot, onUnlock }: {
  shot?: string;
  /** True when the older, slower grading API is carrying this scan. */
  slow?: boolean;
  target: Target; elapsed: number; ready: boolean; settled: boolean; locked: boolean; market: Market; peek: OwnScan | null; onUnlock: (user: User) => void;
}) {
  // The steps keep moving until the whole scan has settled, even once the first reading can be shown.
  const stages = slow ? SLOW_STAGES : STAGES;
  const current = settled ? stages.length : stages.filter(([t]) => elapsed >= t).length - 1;
  return (
    <div className="max-w-[1120px] mx-auto grid grid-cols-1 md:grid-cols-[minmax(0,340px)_1fr] gap-6 md:gap-8 items-start">
      <div className="panel p-6 sm:p-7 md:sticky md:top-20">
        <p className="label label--accent" role="status" aria-live="polite">
          <span className="dark-only">$ </span>{settled ? 'scan complete' : ready ? `first reading ready · still scanning · ${elapsed}s` : `scanning · ${elapsed}s`}
        </p>
        <h1 className="headline text-[22px] sm:text-[26px] mt-2">{target.hotel}</h1>
        <ol className="steps list-none m-0 p-0 mt-6">
          {stages.map(([t, text], i) => (
            <li key={t} className={i < current ? 'is-done' : i === current ? 'is-now' : ''}>
              <span className="steps-dot" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ol>
        {locked
          ? <Gate target={target} ready={ready} onUnlock={onUnlock} />
          : <p className="meta mt-6">The first reading takes about fifteen seconds. Keep this tab open.</p>}
      </div>
      <Findings peek={peek} market={market} target={target} ready={ready} shot={shot} />
    </div>
  );
}

export default function ReportCard() {
  const [target, setTarget] = useState<Target | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [viaLink, setViaLink] = useState(false); // opened from an emailed report link
  const [audit, setAudit] = useState<Audit | null>(null);
  // Our own crawl of the hotel's website. undefined = still reading, null = couldn't read.
  const [crawl, setCrawl] = useState<unknown | null | undefined>(undefined);
  // Results of our other collectors (prices, brand search). Null until read.
  const [live, setLive] = useState<unknown | null>(null);
  // True while the report on screen rests on our own scan and the grading API is still working.
  const [prelim, setPrelim] = useState(false);
  // True when our own scan couldn't carry the grade and the older grading API is doing it.
  const [fallback, setFallback] = useState(false);
  // Whether the page speed run and the review themes have answered (or had nothing to read).
  const [speedDone, setSpeedDone] = useState(false);
  const [themesDone, setThemesDone] = useState(false);
  // The latest stage of our own scan, for the scan screen.
  const [peek, setPeek] = useState<OwnScan | null>(null);
  // Our page speed run, which arrives on its own after the scan has found the website.
  const [speed, setSpeed] = useState<unknown | null>(null);
  const [themes, setThemes] = useState<unknown | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [share, setShare] = useState(''); // link that opens this report without the gate
  // Before the report exists, the scan screen maps the comparison set from the scan's first stage.
  const market = useMarket(target, audit ?? peek?.base ?? null, live ?? peek?.live ?? null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const hotel = (q.get('hotel') || '').trim();
    setUser(loadUser());
    const k = q.get('k');
    if (hotel && k) {
      checkLink({ hotel, city: q.get('city') || '', state: q.get('state') || '' }, k).then((ok) => { if (ok) { setViaLink(true); track('shared_report_view', { hotel }); } });
    }
    setTarget(hotel ? { hotel, city: q.get('city') || '', state: q.get('state') || '' } : null);
  }, []);

  // Ask for the page speed run once the scan knows the website, unless the scan already carried one.
  const siteKnown = !!((peek?.crawl as any)?.ok || (peek?.live as any)?.prices?.hotel?.link);
  const speedCached = (peek?.live as any)?.speed ?? null;
  // The scan has returned its last stage. If it never found a website or reviews, there is nothing to wait for on the side.
  const scanDone = !!peek && !peek.pending;
  useEffect(() => {
    if (!target) return;
    if (!siteKnown) { if (scanDone) setSpeedDone(true); return; }
    if (speedCached?.mobile && speedCached?.desktop) { setSpeed(speedCached); setSpeedDone(true); return; }
    if (speedCached) setSpeed(speedCached);
    const ctrl = new AbortController();
    // The test runs in the background on the server; this keeps asking until it is in or has clearly failed.
    fetchSpeed(target.hotel, target.city, target.state, ctrl.signal).then((sp) => {
      if (ctrl.signal.aborted) return;
      if (sp) setSpeed(sp);
      setSpeedDone(true);
    });
    return () => ctrl.abort();
  }, [target, siteKnown, speedCached, scanDone]);
  // The same for review themes: asked for once the scan has read the reviews.
  const reviewsRead = !!(peek?.live as any)?.reviews?.ok;
  const themesCached = (peek?.live as any)?.themes ?? null;
  useEffect(() => {
    if (!target) return;
    if (!reviewsRead) { if (scanDone) setThemesDone(true); return; }
    if (themesCached) { setThemes(themesCached); setThemesDone(true); return; }
    const ctrl = new AbortController();
    fetchThemes(target.hotel, target.city, target.state, ctrl.signal).then((t) => { if (ctrl.signal.aborted) return; if (t) setThemes(t); setThemesDone(true); });
    return () => ctrl.abort();
  }, [target, reviewsRead, themesCached, scanDone]);
  const liveAll = useMemo(() => (live && (speed || themes) ? { ...(live as object), ...(speed ? { speed } : {}), ...(themes ? { themes } : {}) } : live), [live, speed, themes]);

  useEffect(() => {
    if (!target) return;
    const ctrl = new AbortController();
    setError('');
    setSpeed(null);
    setThemes(null);
    setAudit(null);
    setCrawl(undefined);
    setLive(null);
    setPrelim(false);
    setFallback(false);
    setSpeedDone(false);
    setThemesDone(false);
    setPeek(null);
    setElapsed(0);
    const started = Date.now();
    // The clock runs while readings are still arriving, and stops itself after five minutes.
    const tick = window.setInterval(() => { setElapsed(Math.round((Date.now() - started) / 1000)); if (Date.now() - started > 300000) window.clearInterval(tick); }, 1000);
    document.title = `${target.hotel} · report card · hotelgrader`;
    track('grade_start', hotelParams(target));
    const where = [target.hotel, target.city, target.state] as const;
    // Our scan can carry the grade when it found the hotel's listing and saw enough to grade.
    const carries = (s: OwnScan | null) => !!s?.base && !!(s.live as any)?.prices?.ok && assess(s.base, s.crawl, s.live).graded;
    let shown = false;
    const finish = (a: Audit, s: OwnScan | null, source: 'own' | 'fallback') => {
      setCrawl(s?.crawl ?? null);
      setLive(s?.live ?? null);
      setAudit(a);
      setPrelim(false);
      const done = assess(a, s?.crawl ?? null, s?.live ?? null);
      track('grade_complete', { ...hotelParams(target), score: done.rawScore ?? undefined, coverage: Math.round(done.coverage * 100), site_read: done.siteRead, own_only: source === 'own', seconds: Math.round((Date.now() - started) / 1000) });
    };

    // The grade comes from our own scan, which returns in stages over about fifteen seconds. Show the first
    // stage that can carry a grade, marked as still filling in, and settle when the last stage lands.
    fetchScan(...where, ctrl.signal, (s) => {
      if (ctrl.signal.aborted) return;
      setPeek(s);
      if (s.pending && !shown && carries(s)) {
        shown = true;
        setCrawl(s.crawl);
        setLive(s.live);
        setAudit(s.base);
        setPrelim(true);
        track('grade_preview', { ...hotelParams(target), seconds: Math.round((Date.now() - started) / 1000) });
      }
    }).then(async (s) => {
      if (ctrl.signal.aborted) return;
      if (carries(s)) { finish(s!.base!, s, 'own'); return; }
      // Our scan couldn't carry a grade (the search budget is spent, or the hotel wasn't matched on Google).
      // Fall back to the older grading API, which takes about two minutes.
      setFallback(true);
      try {
        const a = await runAudit(...where, ctrl.signal);
        // That scan knows the hotel's website, so ours can now read it. Ask once more.
        const again = (await fetchScan(...where, ctrl.signal, (x) => { if (!ctrl.signal.aborted) setPeek(x); })) ?? s;
        if (!ctrl.signal.aborted) finish(a, again, 'fallback');
      } catch (e: any) {
        if (e?.name === 'AbortError' || ctrl.signal.aborted) return;
        window.clearInterval(tick);
        setError(e?.message || 'The scan failed.');
        track('grade_error', hotelParams(target));
      }
    });
    return () => { ctrl.abort(); window.clearInterval(tick); };
  }, [target, attempt]);

  // The grade is settled once the scan's last stage is in and the two slower readings have answered.
  const settling = !!audit && (prelim || !speedDone || !themesDone);

  // Log the lead for every hotel an unlocked visitor grades.
  useEffect(() => {
    // Testers (see the ?test=on switch in BaseLayout) don't count as leads.
    if (target && user && user.proof !== 'tester') recordLead(user, target);
  }, [target, user]);

  // Email the report card once per hotel to visitors who verified their address.
  useEffect(() => {
    // Wait for the settled report, so the emailed grade matches the page.
    if (!target || !audit || settling || !user || ['tester', 'unverified'].includes(user.proof)) return;
    const id = [target.hotel, target.city, target.state].join('|').toLowerCase();
    const mailed = readStore(MAILED_KEY).split('\n').filter(Boolean);
    if (mailed.includes(id)) return;
    writeStore(MAILED_KEY, [...mailed, id].slice(-50).join('\n'));
    void sendReport(user, target);
  }, [target, audit, settling, user]);

  // Fetched ahead of the click, so copying stays a single tap.
  useEffect(() => {
    if (!target || !audit || settling || !user || viaLink || ['tester', 'unverified'].includes(user.proof)) return;
    void shareLink(user, target).then(setShare);
  }, [target, audit, settling, user, viaLink]);

  if (target === undefined) return <div className="min-h-[420px]" />;

  if (target === null) {
    return (
      <div className="max-w-[600px] mx-auto py-16">
        <h1 className="headline text-[26px] sm:text-[32px] mb-6">Which hotel should we grade?</h1>
        <HeroForm autoFocus />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[600px] mx-auto py-16" role="alert">
        <p className="text-attention">error</p>
        <h1 className="headline text-[24px] sm:text-[28px] mt-2">Couldn’t finish grading {target.hotel}.</h1>
        <p className="text-ink-60 mt-3">{error}</p>
        <div className="flex gap-3 mt-7">
          <button type="button" className="btn btn--primary" onClick={() => setAttempt((n) => n + 1)}>try again</button>
          <a href="/" className="btn">search another hotel</a>
        </div>
      </div>
    );
  }

  if (!audit || (!user && !viaLink)) {
    return (
      <ScanScreen
        shot={(speed as any)?.screenshot || ''}
        target={target}
        elapsed={elapsed}
        ready={!!audit}
        settled={!!audit && !settling}
        slow={fallback}
        locked={!user && !viaLink}
        market={market}
        peek={peek}
        onUnlock={(u) => {
          saveUser(u);
          setUser(u);
          // The conversion: a visitor gave a name and email to see the grade.
          track('generate_lead', { ...hotelParams(target), method: u.proof === 'unverified' ? 'unverified' : 'email_code' });
        }}
      />
    );
  }

  const copy = async () => {
    try {
      // A link opened from a share already carries its key; otherwise use the one fetched above.
      await navigator.clipboard.writeText(viaLink ? window.location.href : share || window.location.href);
      setCopied(true);
      track('share', { method: 'copy_link', content_type: 'report', item_id: target.hotel });
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked; the URL bar still works */ }
  };

  return (
    <div>
      {viaLink && !user && (
        <div className="panel px-5 sm:px-8 py-5 mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 no-print">
          <p className="flex-1 min-w-[240px]">
            <span className="font-semibold">This report was shared with you.</span>{' '}
            <span className="text-ink-60">See how your own hotel scores. It’s free and takes two minutes.</span>
          </p>
          <a href="/" className="btn btn--primary">grade your hotel</a>
        </div>
      )}
      {settling && (
        <div className="panel px-5 sm:px-8 py-4 mb-6 no-print" role="status">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="scan-dot" aria-hidden="true" />
            <p className="flex-1 min-w-[240px] text-[14px]">
              <span className="font-semibold">First reading. The grade can still move.</span>{' '}
              <span className="text-ink-60">{prelim ? 'Prices, your website and the hotels around you are in. Search, reviews and ads are still being read.' : 'Page speed and review themes are still being read.'} Usually under a minute.</span>
            </p>
            <span className="meta tabular">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
          </div>
        </div>
      )}
      <Report audit={audit} crawl={crawl ?? null} live={liveAll} market={market} />
      <div className="flex flex-wrap gap-3 mt-5 no-print">
        <button type="button" className="btn" onClick={() => {
          track('share', { method: 'linkedin', content_type: 'report', item_id: target.hotel });
          window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText(audit, assess(audit, crawl ?? null, live)))}`, '_blank', 'noopener');
        }}>share on LinkedIn</button>
        <button type="button" className="btn" onClick={copy}>{copied ? 'link copied' : 'copy share link'}</button>
        <button type="button" className="btn" onClick={() => { track('print_report', { hotel: target.hotel }); window.print(); }}>print</button>
        <a href="/" className="btn btn--primary">grade another hotel</a>
        {user?.proof === 'tester' && (
          <span className="meta self-center">
            Tester mode: gates bypassed.{' '}
            <button type="button" className="link" onClick={() => {
              const u = new URL(window.location.href);
              u.searchParams.set('test', 'off');
              window.location.href = u.toString();
            }}>Turn off</button>
          </span>
        )}
      </div>
    </div>
  );
}
