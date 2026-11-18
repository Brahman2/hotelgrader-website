import { useEffect, useState } from 'react';
import { pillars } from '../content/pillars';
import { isMeasured, letterFor, gradeTone, runAudit, type Audit, type Metric } from '../lib/hg';
import { loadUser, saveUser, type User } from '../lib/verify';
import Gate from './Gate';
import FullReport from './FullReport';
import { geocode, geocodeCity, offset, type LatLon } from '../lib/geo';
import HeroForm from './HeroForm';
import Scanner, { type Blip } from './Scanner';

// The free report card. Reads ?hotel=&city=&state= from the URL, runs a live
// scan against the hotelgrader API, and renders one page: the grade, the local
// market, the seven section scores, what to fix first, and what is working.
//
// The card is gated: the scan starts right away, but the grade only shows once
// the visitor gives a first name and email and confirms a code we send there.
// One verified email unlocks every card in that browser. The full report below
// the card unlocks separately, by sharing on LinkedIn (see FullReport.tsx).

const SHARED_KEY = 'hg-shared';
const LEADS_KEY = 'hg-leads';

type Target = { hotel: string; city: string; state: string };
type Rival = { n: number; name: string; rating?: number; reviews?: number };

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
function useMarket(target: Target | null | undefined, audit: Audit | null) {
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

  const rivals: Rival[] = (audit?._meta?.competitors?.top_competitors ?? []).map((c, i) => ({ ...c, n: i + 1 }));
  const rivalKey = rivals.map((r) => r.name).join('|');

  useEffect(() => {
    setBlips([]);
    if (!target || !center || approximate || !rivalKey) return;
    const ctrl = new AbortController();
    rivals.forEach((r) => {
      geocode(r.name, target.city, target.state, ctrl.signal).then((p) => {
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

function Grade({ letter, size }: { letter: string; size: number }) {
  return (
    <span className={`grade ${gradeTone(letter)} tabular`} style={{ fontSize: size }}>
      {letter.charAt(0)}
      <span className="grade-mod">{letter.slice(1)}</span>
    </span>
  );
}

/** Measured metrics only. Rows the API could not back with data are skipped. */
function scored(audit: Audit): (Metric & { section: string })[] {
  return pillars.flatMap((p) =>
    (audit.categories[p.key]?.metrics ?? [])
      .filter(isMeasured)
      .map((m) => ({ ...m, section: p.name })),
  );
}

function MetricList({ title, items, tone }: { title: string; items: (Metric & { section: string })[]; tone: string }) {
  return (
    <div>
      <h2 className="label label--ink mb-4">{title}</h2>
      <ol className="list-none m-0 p-0 space-y-5">
        {items.map((m) => (
          <li key={m.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{m.name}</span>
              <span className={`${tone} num`}>{m.score}</span>
            </div>
            <div className="meta">{m.section}</div>
            {(m.recommendation || m.insight) && (
              <p className="text-ink-60 text-[13px] mt-1.5">
                {tone === 'text-attention' ? m.recommendation || m.insight : m.insight || m.recommendation}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

type Market = ReturnType<typeof useMarket>;

/** The hotel against its nearest competitors: radar on the left, table on the right. */
function MarketSection({ audit, market }: { audit: Audit; market: Market }) {
  const comp = audit._meta?.competitors;
  if (!market.rivals.length) return null;
  const plotted = new Set(market.blips.map((b) => b.n));
  return (
    <section className="px-5 sm:px-8 py-7 border-t border-edge">
      <h2 className="label label--ink mb-5">Your market</h2>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr] gap-8 items-center">
        <Scanner center={market.center} blips={market.blips} scanning={false} hotel={audit.hotelName} approximate={market.approximate} />
        <div>
          {comp?.rating_rank != null && comp.total_in_set != null && (
            <p className="headline text-[20px] sm:text-[24px] mb-4">
              #{comp.rating_rank} of {comp.total_in_set} <span className="text-ink-60 font-normal">on guest rating nearby</span>
            </p>
          )}
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="meta text-left">
                <th className="font-normal py-1.5 w-8"></th>
                <th className="font-normal py-1.5">hotel</th>
                <th className="font-normal py-1.5 text-right">rating</th>
                <th className="font-normal py-1.5 text-right">reviews</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-edge">
                <td className="py-2"><span className="scanner-key scanner-key--home" /></td>
                <td className="py-2 font-semibold">{audit.hotelName}</td>
                <td className="py-2 text-right font-semibold num">{comp?.own_rating ?? 'n/a'}</td>
                <td className="py-2 text-right num">{comp?.own_reviews?.toLocaleString('en-US') ?? 'n/a'}</td>
              </tr>
              {market.rivals.map((r) => (
                <tr key={r.n} className="border-t border-edge">
                  <td className="py-2">
                    <span className={`scanner-key ${plotted.has(r.n) ? '' : 'scanner-key--off'}`}>{r.n}</span>
                  </td>
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right num">{r.rating ?? 'n/a'}</td>
                  <td className="py-2 text-right text-ink-60 num">{r.reviews?.toLocaleString('en-US') ?? 'n/a'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {comp?.compset_avg_rating != null && (
            <p className="meta mt-3">Nearby average rating: {comp.compset_avg_rating}. Numbered hotels are pinned where we could locate them.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ReportCardView({ audit, market }: { audit: Audit; market: Market }) {
  const letter = letterFor(audit.overallScore);
  const total = pillars.reduce((n, p) => n + (audit.categories[p.key]?.metrics?.length ?? 0), 0);
  const counted = audit._meta?.overall_scoring?.included;
  // The API stamps scans in UTC without a zone marker; add it so the date is right locally.
  const stamp = audit._meta?.generatedAt;
  const date = stamp
    ? new Date(/(?:Z|[+-]\d\d:?\d\d)$/i.test(stamp) ? stamp : `${stamp}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const metrics = scored(audit);
  const fixes = [...metrics].sort((a, b) => a.score! - b.score!).slice(0, 3);
  const wins = [...metrics].sort((a, b) => b.score! - a.score!).slice(0, 3);
  const place = [audit.city, audit.state].filter(Boolean).join(', ');

  return (
    <article className="panel overflow-hidden">
      <header className="px-5 sm:px-8 py-3 border-b border-edge flex flex-wrap justify-between gap-2 meta">
        <span className="text-accent">report card</span>
        {date && <span>scanned {date}</span>}
      </header>

      <section className="px-5 sm:px-8 py-8 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 sm:gap-10 items-center">
        <div role="img" aria-label={`Grade ${letter}, ${audit.overallScore} out of 100`}>
          <Grade letter={letter} size={132} />
          <div className="text-ink-60 mt-3 num">{audit.overallScore} / 100</div>
        </div>
        <div>
          <h1 className="headline text-[26px] sm:text-[32px]">{audit.hotelName}</h1>
          {place && <p className="text-ink-60 mt-1">{place}</p>}
          {audit.executiveSummary?.keyFinding && <p className="mt-4">{audit.executiveSummary.keyFinding}</p>}
        </div>
      </section>

      <MarketSection audit={audit} market={market} />

      <section className="px-5 sm:px-8 py-7 border-t border-edge">
        <h2 className="label label--ink mb-2">The seven sections</h2>
        {pillars.map((p) => {
          const s = audit.categories[p.key]?.score ?? null;
          const l = letterFor(s);
          const reference = counted && !counted.includes(p.key);
          return (
            <div key={p.key} className={'grid grid-cols-[1fr_auto] sm:grid-cols-[250px_1fr_auto] items-center gap-x-5 py-2'}>
              <div>
                <div>{p.name}</div>
                {reference && <div className="meta">for reference, not in the overall grade</div>}
              </div>
              <div className="bar hidden sm:block" aria-hidden="true">
                <div className={gradeTone(l)} style={{ width: `${s ?? 0}%` }} />
              </div>
              <div className="flex items-baseline justify-end gap-3 w-[84px]">
                <span className="text-ink-60 num">{s ?? 'n/a'}</span>
                <span className="w-[34px]"><Grade letter={l} size={22} /></span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="px-5 sm:px-8 py-7 border-t border-edge grid grid-cols-1 md:grid-cols-2 gap-10">
        <MetricList title="Fix these first" items={fixes} tone="text-attention" />
        <MetricList title="What is working" items={wins} tone="text-good" />
      </section>

      <footer className="px-5 sm:px-8 py-3 border-t border-edge flex flex-wrap justify-between gap-2 meta">
        <span>
          {total > 0 && `${metrics.length} of ${total} metrics backed by data this scan. `}
          Public data only.
        </span>
        <a href="/methodology">how the grade is built</a>
      </footer>
    </article>
  );
}

// What the scan is doing, by seconds elapsed. The API reports few progress
// steps, so these plain-language lines keep the wait readable.
const STAGES: [number, string][] = [
  [0, 'Finding the hotel on Google'],
  [12, 'Reading reviews and ratings'],
  [30, 'Checking prices on booking sites'],
  [55, 'Asking AI assistants about the hotel'],
  [85, 'Comparing with nearby hotels'],
  [115, 'Scoring the seven sections'],
];

/** Shown while the scan runs, and after it if the email isn't verified yet. */
function ScanScreen({ target, elapsed, ready, locked, market, onUnlock }: {
  target: Target; elapsed: number; ready: boolean; locked: boolean; market: Market; onUnlock: (user: User) => void;
}) {
  const current = ready ? STAGES.length : STAGES.filter(([t]) => elapsed >= t).length - 1;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,340px)_1fr] gap-6 md:gap-10 items-start">
      <div className="panel p-6 sm:p-7">
        <p className="label label--accent" role="status" aria-live="polite">
          <span className="dark-only">$ </span>{ready ? 'scan complete' : `scanning · ${elapsed}s`}
        </p>
        <h1 className="headline text-[22px] sm:text-[26px] mt-2">{target.hotel}</h1>
        <ol className="steps list-none m-0 p-0 mt-6">
          {STAGES.map(([t, text], i) => (
            <li key={t} className={i < current ? 'is-done' : i === current ? 'is-now' : ''}>
              <span className="steps-dot" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ol>
        {locked
          ? <Gate target={target} ready={ready} onUnlock={onUnlock} />
          : <p className="meta mt-6">A live scan takes one to two minutes. Keep this tab open.</p>}
      </div>
      <div className="max-w-[460px] w-full mx-auto md:pt-2">
        <Scanner center={market.center} blips={market.blips} scanning={!ready || !market.located} hotel={target.hotel} approximate={market.approximate} />
        {market.rivals.length > 0 && (
          <p className="meta mt-4">{market.rivals.length} competing hotels found nearby.</p>
        )}
      </div>
    </div>
  );
}

export default function ReportCard() {
  const [target, setTarget] = useState<Target | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [shared, setShared] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const market = useMarket(target, audit);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const hotel = (q.get('hotel') || '').trim();
    setUser(loadUser());
    setShared(readStore(SHARED_KEY) === '1');
    setTarget(hotel ? { hotel, city: q.get('city') || '', state: q.get('state') || '' } : null);
  }, []);

  useEffect(() => {
    if (!target) return;
    const ctrl = new AbortController();
    setError('');
    setAudit(null);
    setElapsed(0);
    const started = Date.now();
    const tick = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    document.title = `${target.hotel} · report card · hotelgrader`;
    runAudit(target.hotel, target.city, target.state, ctrl.signal)
      .then(setAudit)
      .catch((e) => { if (e?.name !== 'AbortError') setError(e?.message || 'The scan failed.'); })
      .finally(() => window.clearInterval(tick));
    return () => { ctrl.abort(); window.clearInterval(tick); };
  }, [target, attempt]);

  // Log the lead for every hotel an unlocked visitor grades.
  useEffect(() => {
    if (target && user) recordLead(user, target);
  }, [target, user]);

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

  if (!audit || !user) {
    return (
      <ScanScreen
        target={target}
        elapsed={elapsed}
        ready={!!audit}
        locked={!user}
        market={market}
        onUnlock={(u) => { saveUser(u); setUser(u); }}
      />
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked; the URL bar still works */ }
  };

  return (
    <div>
      <ReportCardView audit={audit} market={market} />
      <FullReport audit={audit} unlocked={shared} onUnlock={() => { writeStore(SHARED_KEY, '1'); setShared(true); }} />
      <div className="flex flex-wrap gap-3 mt-5 no-print">
        <button type="button" className="btn" onClick={copy}>{copied ? 'link copied' : 'copy link'}</button>
        <button type="button" className="btn" onClick={() => window.print()}>print</button>
        <a href="/" className="btn btn--primary">grade another hotel</a>
      </div>
    </div>
  );
}
