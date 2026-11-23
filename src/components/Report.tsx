import { useMemo, useState, type ReactNode } from 'react';
import { assess, type Assessment, type Check, type FunctionResult, type Priority } from '../../shared/assess.mjs';
import { gradeTone, letterFor, type Audit } from '../lib/hg';
import { sendCorrection } from '../lib/verify';
import { track } from '../lib/track';
import { MarketScatter, Ring, toneFor, type MarketPoint } from './Charts';
import Scanner, { type Blip } from './Scanner';
import type { LatLon } from '../lib/geo';

// The report, in the order an owner reads it: the grade and what it rests on,
// what to do first, how the hotel sits against the alternatives, then the
// evidence behind every check. All of it comes from assess() in
// shared/assess.mjs, which scores only what the scan observed.

const SITE = 'https://hotelgrader.com';

export interface MarketView {
  center: LatLon | null;
  located: boolean;
  approximate: boolean;
  blips: Blip[];
  rivals: { n: number; name: string }[];
}

/** The post text for the optional LinkedIn share. It never includes the grade. */
export function shareText(audit: Audit, a: Assessment): string {
  const lead = a.choice?.rows.find((r) => r.you);
  const better = a.choice ? a.choice.rows.filter((r) => !r.you && r.rating != null && lead?.rating != null && r.rating > lead.rating).length : 1;
  return a.choice && better === 0 && lead?.rating != null
    ? `${audit.hotelName} has the top Google rating among the ${a.choice.peers} hotels we were compared with. I just ran our free marketing report card on hotelgrader. See how your hotel scores: ${SITE}`
    : `I just graded my hotel’s marketing on hotelgrader. It’s free and takes two minutes. What does yours get? ${SITE}`;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
// The API stamps scans in UTC without a zone marker; add it so the date is right locally.
function day(stamp?: string | null): string {
  if (!stamp) return '';
  const d = new Date(/^\d{4}-\d\d-\d\d$/.test(stamp) ? `${stamp}T12:00:00` : /(?:Z|[+-]\d\d:?\d\d)$/i.test(stamp) ? stamp : `${stamp}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Grade({ letter, size }: { letter: string; size: number }) {
  return (
    <span className={`grade ${gradeTone(letter)} tabular`} style={{ fontSize: size }}>
      {letter.charAt(0)}
      <span className="grade-mod">{letter.slice(1)}</span>
    </span>
  );
}

function Section({ id, title, kicker, children }: { id?: string; title: string; kicker?: string; children: ReactNode }) {
  return (
    <section id={id} className="px-5 sm:px-8 py-7 border-t border-edge scroll-mt-20">
      <div className="mb-5">
        <h2 className="label label--ink">{title}</h2>
        {kicker && <p className="text-ink-60 text-[13.5px] mt-1 max-w-[72ch]">{kicker}</p>}
      </div>
      {children}
    </section>
  );
}

/** Where the grade's 100 points sit, how much of each was seen, and how it scored. */
function ImportanceBar({ fns }: { fns: FunctionResult[] }) {
  return (
    <div>
      <div className="flex gap-[2px] h-[30px]" role="img"
        aria-label={`The grade by importance: ${fns.map((f) => `${f.name} ${f.weight} points, ${f.score == null ? 'not observed' : `scored ${f.score}, ${pct(f.coverage)} observed`}`).join('; ')}`}>
        {fns.map((f) => (
          <div key={f.key} className="relative hatch min-w-[3px]" style={{ flexGrow: f.weight, flexBasis: 0 }} title={`${f.name}: ${f.weight} points. ${f.score == null ? 'Not observed.' : `${f.score} out of 100 on the ${pct(f.coverage)} we could see.`}`}>
            <div className={`absolute inset-y-0 left-0 ${toneFor(f.score)}`} style={{ width: pct(f.coverage), background: 'currentColor' }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1.5">
        {fns.map((f) => (
          <div key={f.key} className="meta truncate text-[10.5px] leading-tight" style={{ flexGrow: f.weight, flexBasis: 0, minWidth: 0 }}>
            {f.weight >= 8 ? f.short : ''}
          </div>
        ))}
      </div>
      <p className="meta mt-2.5">
        Each block is one part of the grade, sized by how much it matters. Colour is how it scored. The hatched part is what a public scan couldn’t see, and it neither helps nor hurts the grade.
      </p>
    </div>
  );
}

function FunctionRows({ fns }: { fns: FunctionResult[] }) {
  const cols = 'grid grid-cols-[40px_1fr_70px] sm:grid-cols-[1fr_60px_150px_70px] gap-x-3';
  return (
    <div className="mt-6">
      <div className={`${cols} meta pb-1.5`}>
        <span className="hidden sm:block">part of the grade</span><span className="sm:text-right">points</span><span>seen</span><span className="text-right">score</span>
      </div>
      {fns.map((f) => (
        <a key={f.key} href={`#fn-${f.key}`} className={`${cols} items-center py-2 border-t border-edge text-ink hover:no-underline hover:bg-[var(--accent-soft)]`}>
          <span className="col-span-3 sm:col-span-1 min-w-0 truncate font-medium sm:font-normal">{f.name}</span>
          <span className="num text-ink-60 sm:text-right">{f.weight}</span>
          <span className="flex items-center gap-2">
            <span className="hatch h-[8px] flex-1 relative"><span className="absolute inset-y-0 left-0 bg-[var(--ink-40)]" style={{ width: pct(f.coverage) }} /></span>
            <span className="num text-ink-60 text-[12px] w-[34px] text-right">{pct(f.coverage)}</span>
          </span>
          <span className="text-right whitespace-nowrap">
            {f.score == null
              ? <span className="text-ink-40 text-[12px]">not seen</span>
              : <><span className="num text-ink-60 mr-2">{f.score}</span><span className="inline-block w-[24px] text-left"><Grade letter={letterFor(f.score)} size={18} /></span></>}
          </span>
        </a>
      ))}
    </div>
  );
}

const TYPE: Record<Priority['type'], { label: string; tone: string }> = {
  fix: { label: 'Fix', tone: 'grade--f' },
  investigate: { label: 'Check first', tone: 'grade--c' },
  operations: { label: 'Operations, not marketing', tone: 'grade--d' },
};

function PriorityCard({ p, n, fnName }: { p: Priority; n: number; fnName: string }) {
  const row = (k: string, v: string) => (
    <div className="grid grid-cols-[92px_1fr] gap-3 py-1.5 border-t border-edge text-[13.5px]">
      <dt className="meta pt-[2px]">{k}</dt><dd className="m-0 text-ink-60">{v}</dd>
    </div>
  );
  return (
    <li className="py-5 first:pt-0 grid grid-cols-[34px_1fr] gap-x-3">
      <span className="num text-[22px] leading-none text-ink-40 pt-0.5">{n}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
          <span className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${TYPE[p.type].tone}`}>{TYPE[p.type].label}</span>
          <span className="meta">{fnName}</span>
        </div>
        <h3 className="font-semibold text-[16.5px] leading-snug">{p.title}</h3>
        <p className="text-[14px] mt-2">{p.evidence}</p>
        <p className="meta mt-2">{p.owner} · effort: {p.effort.toLowerCase()} · {p.confidence.toLowerCase()}</p>
        <dl className="m-0 mt-3">
          {row('Why it matters', p.why)}
          {row('Done looks like', p.outcome)}
          {row('How to confirm', p.proof)}
        </dl>
      </div>
    </li>
  );
}

const pos = (v: number, r: { low: number; high: number }) => Math.max(0, Math.min(99, ((v - r.low) / Math.max(1, r.high - r.low)) * 100));

function Choice({ a, audit, market }: { a: Assessment; audit: Audit; market: MarketView }) {
  const c = a.choice;
  if (!c) return null;
  const plotted = new Set(market.blips.map((b) => b.n));
  const rivals = c.rows.filter((r) => !r.you);
  const you = c.rows.find((r) => r.you);
  const points: MarketPoint[] = you?.rating != null && you.reviews
    ? [...rivals.filter((r) => r.rating != null && r.reviews != null).map((r, i) => ({ label: String(i + 1), name: r.name, rating: r.rating!, reviews: r.reviews! })),
      { label: 'you', name: audit.hotelName, rating: you.rating, reviews: you.reviews, you: true }]
    : [];
  return (
    <Section id="choice" title="How you compare for a guest choosing"
      kicker="A separate question from the grade. A hotel can run its marketing well and still lose a guest on price, room or location.">
      <p className="headline text-[19px] sm:text-[22px] max-w-[60ch]">{c.verdict}</p>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,300px)_1fr] gap-8 items-start mt-6">
        <Scanner center={market.center} blips={market.blips} scanning={false} hotel={audit.hotelName} approximate={market.approximate} />
        <div className="min-w-0">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="meta text-left">
                <th className="font-normal py-1.5 w-8"></th>
                <th className="font-normal py-1.5">hotel</th>
                <th className="font-normal py-1.5 text-right">rating</th>
                <th className="font-normal py-1.5 text-right hidden sm:table-cell">reviews</th>
                <th className="font-normal py-1.5 text-right">rate</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r, i) => (
                <tr key={r.name} className="border-t border-edge">
                  <td className="py-2">{r.you ? <span className="scanner-key scanner-key--home" /> : <span className="scanner-key">{i}</span>}</td>
                  <td className={`py-2 pr-2 ${r.you ? 'font-semibold' : ''}`}>{r.name}{!r.you && !plotted.has(i) && market.located && <span className="text-ink-40"> (not on map)</span>}</td>
                  <td className={`py-2 text-right num ${r.you ? 'font-semibold' : ''}`}>{r.rating != null ? r.rating.toFixed(1) : 'n/a'}</td>
                  <td className="py-2 text-right num text-ink-60 hidden sm:table-cell">{r.reviews != null ? r.reviews.toLocaleString('en-US') : 'n/a'}</td>
                  <td className="py-2 text-right num">{r.rate != null ? usd(r.rate) : <span className="text-ink-40">not read</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.area && c.area.own != null && (
            <div className="mt-4">
              <div className="meta mb-1.5">Lowest rate shown that night, across {c.area.count} hotels near you</div>
              <div className="relative h-[10px] bg-edge" aria-hidden="true">
                <span className="absolute top-[-3px] h-[16px] w-[2px] bg-ink-40" style={{ left: `${pos(c.area.median, c.area)}%` }} />
                <span className="absolute top-[-4px] h-[18px] w-[4px]" style={{ left: `${pos(c.area.own, c.area)}%`, background: 'var(--accent)' }} />
              </div>
              <div className="flex justify-between text-[12px] text-ink-60 mt-1.5 num">
                <span>{usd(c.area.low)}</span>
                <span>you {usd(c.area.own)} · middle of the range {usd(c.area.median)}</span>
                <span>{usd(c.area.high)}</span>
              </div>
            </div>
          )}
          {points.length >= 3 && <div className="mt-5 max-w-[420px]"><MarketScatter points={points} /></div>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 text-[13.5px]">
        <div>
          <div className="meta mb-1.5">The trip</div>
          <p className="text-ink-60">{c.scenario}</p>
        </div>
        <div>
          <div className="meta mb-1.5">Compared</div>
          <p className="text-ink-60">{c.compared.join('. ')}.</p>
          <div className="meta mb-1.5 mt-3">Not compared yet</div>
          <p className="text-ink-60">{c.notCompared.join('. ')}.</p>
        </div>
        <div>
          <div className="meta mb-1.5">Why these hotels</div>
          <p className="text-ink-60">
            {c.setSize ? `Our model picked these ${c.peers} from ${c.setSize} hotels near you that it placed in a similar class. ` : 'Our model picked these from hotels near you. '}
            Nearby isn’t the same as comparable. If these aren’t the hotels you lose bookings to, <a href="#correct">tell us</a>.
          </p>
        </div>
      </div>
    </Section>
  );
}

function Prices({ a }: { a: Assessment }) {
  const p = a.prices;
  if (!p) return null;
  const max = Math.max(...p.rows.map((r) => r.rate));
  const second = p.nights.length >= 2 ? p.nights[1] : null;
  return (
    <Section id="rates" title={second ? 'Two nights across the booking sites' : 'One night across the booking sites'}
      kicker="The lowest rate each site showed on Google’s hotel search for the same night. Rooms, fees and cancellation terms aren’t matched, so read a gap as something to check.">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-8 items-start">
        <div>
          {p.direct ? (
            <>
              <p className="headline text-[21px] sm:text-[25px]">
                {p.cheaper > 0
                  ? <>{p.cheaper} of {p.others} sites showed a <span className="grade--c">lower rate</span> than your own.</>
                  : <>Your own rate was the <span className="grade--a">lowest shown</span>.</>}
              </p>
              <p className="text-ink-60 text-[14px] mt-3">
                Your site lists the night at <span className="text-ink num">{usd(p.direct.rate)}</span>.
                {p.cheaper > 0 && p.lowest && <> The lowest other rate is <span className="text-ink num">{usd(p.lowest.rate)}</span> on {p.lowest.source}.</>}
              </p>
            </>
          ) : (
            <p className="text-ink-60 text-[14px]">We found {p.rows.length} rates for the same night and couldn’t tell which one is your own site’s.</p>
          )}
          {second && (
            <div className="mt-5 border-t border-edge pt-4">
              <div className="meta mb-2">The same check on a second night</div>
              <div className="grid grid-cols-2 gap-3">
                {p.nights.slice(0, 2).map((n) => (
                  <div key={n.night ?? n.kind} className="border border-edge p-3">
                    <div className="meta">{n.night ? day(n.night) : ''}{n.kind ? ` · ${n.kind}` : ''}</div>
                    <div className="num text-[20px] mt-1">{n.direct ? usd(n.direct.rate) : <span className="text-ink-40 text-[14px]">your site not listed</span>}</div>
                    <div className="text-[12.5px] text-ink-60 mt-1">
                      {n.direct && n.lowest
                        ? (n.cheaper > 0
                          ? <>lowest other <span className="num text-ink">{usd(n.lowest.rate)}</span>, <span className="grade--c">{Math.round((n.gap ?? 0) * 100)}% less</span></>
                          : <span className="grade--a">no site lower</span>)
                        : n.lowest ? <>lowest shown <span className="num text-ink">{usd(n.lowest.rate)}</span></> : 'no rates shown'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="meta mt-3">{p.night ? `Bars show check-in ${day(p.night)}, one night. ` : ''}Read {day(a.scannedAt)}. {second ? 'Two dates are a sample, not a pattern.' : 'One date can’t show a lasting pattern.'}</p>
        </div>
        <ul className="list-none m-0 p-0 space-y-1.5">
          {p.rows.map((r) => (
            <li key={r.source} className="grid grid-cols-[minmax(0,34%)_1fr_auto] items-center gap-3 text-[13px]">
              <span className={`truncate ${r.mine ? 'font-semibold' : 'text-ink-60'}`}>{r.mine ? 'Your site' : r.source}</span>
              <span className="h-[10px] bg-edge" aria-hidden="true">
                <span className="block h-full" style={{ width: `${(r.rate / max) * 100}%`, background: r.mine ? 'var(--accent)' : 'var(--ink-40)' }} />
              </span>
              <span className={`num w-[52px] text-right ${r.mine ? 'font-semibold' : ''}`}>{usd(r.rate)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Themes({ a }: { a: Assessment }) {
  const t = a.themes;
  if (!t || (!t.positive.length && !t.negative.length)) return null;
  const max = Math.max(1, ...t.positive.map((x) => x.mentions), ...t.negative.map((x) => x.mentions));
  const col = (title: string, rows: { theme: string; mentions: number; quote?: string }[], color: string) => (
    <div>
      <div className="meta mb-3">{title}</div>
      <ul className="list-none m-0 p-0 space-y-3">
        {rows.map((r) => (
          <li key={r.theme}>
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]"><span>{r.theme}</span><span className="num text-ink-60">{r.mentions}</span></div>
            <div className="h-[6px] bg-edge mt-1"><div className="h-full" style={{ width: `${(r.mentions / max) * 100}%`, background: color }} /></div>
            {r.quote && <p className="text-ink-60 text-[12.5px] mt-1.5 leading-snug">“{r.quote.length > 150 ? `${r.quote.slice(0, 150)}…` : r.quote}”</p>}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <Section id="guests" title="What guests keep saying"
      kicker={`Themes from ${t.reviews ?? 'recent'} recent Google and Tripadvisor reviews, grouped by AI. The number is how many reviews raised each one.`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {col('They value', t.positive, 'var(--grade-a)')}
        {col('They complain about', t.negative, 'var(--grade-f)')}
      </div>
      <p className="meta mt-5">A complaint about the stay itself is an operating decision. Marketing can only set the expectation honestly.</p>
    </Section>
  );
}

function Ads({ a }: { a: Assessment }) {
  const ads = a.ads;
  if (!ads || ads.rivals.length < 2) return null;
  const cell = (v: boolean | null) =>
    v == null ? <span className="text-ink-40">couldn’t tell</span>
      : v ? <span className="inline-flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />seen</span>
        : <span className="text-ink-40">none found</span>;
  return (
    <Section id="ads" title="Advertising we could see"
      kicker="Observed, not graded. Public ad libraries show whether ads exist. They say nothing about budget, targeting or return, and a search that shows no ad doesn’t prove there isn’t one.">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="meta text-left"><th className="font-normal py-1.5">hotel</th><th className="font-normal py-1.5 w-[28%]">Google ads</th><th className="font-normal py-1.5 w-[28%]">Meta ads</th></tr>
        </thead>
        <tbody>
          {[ads.you, ...ads.rivals].map((r, i) => (
            <tr key={r.name} className="border-t border-edge">
              <td className={`py-2 pr-3 ${i === 0 ? 'font-semibold' : ''}`}>{r.name}</td>
              <td className="py-2">{cell(r.google)}</td>
              <td className="py-2">{cell(r.meta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meta mt-3 max-w-[84ch]">
        Google’s Ads Transparency Center, searched by each hotel’s website, and Meta’s Ad Library, searched by each hotel’s Facebook page.
        {ads.you.googleBy.length > 0 && ` The Google ads for your site run under ${ads.you.googleBy.join(', ')}.`}
        {' '}Ads placed under a management group or agency name can be missed.
      </p>
    </Section>
  );
}

function AiSample({ a }: { a: Assessment }) {
  if (!a.ai.samples.length) return null;
  return (
    <Section id="ai" title="AI assistants: what we asked"
      kicker="A sample, not a ranking. It counts for one point of the grade.">
      {a.ai.queries.map((q) => (
        <div key={q} className="mb-4">
          <p className="text-[14px]">“{q}”</p>
          <ul className="list-none m-0 p-0 mt-2 flex flex-wrap gap-2">
            {a.ai.samples.filter((s) => s.query === q).map((s) => (
              <li key={s.surface} className="border border-edge-strong rounded px-3 py-1.5 text-[13px]">
                <span className="font-semibold">{s.surface}</span>{' '}
                {s.valid ? (s.mentioned ? <span className="grade--a">named the hotel</span> : <span className="text-ink-60">didn’t name the hotel</span>)
                  : <span className="text-ink-40">no usable answer ({s.why})</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="meta max-w-[80ch]">
        {a.ai.queries.length <= 1 && 'One broad question favours the largest and best-known hotels. It can’t show that a hotel is invisible to AI, and we don’t treat it that way. '}
        Asked {day(a.ai.samples[0]?.when)}. Answers change from one request to the next.
      </p>
    </Section>
  );
}

const DOT: Record<Check['status'], { cls: string; word: string; hollow?: boolean }> = {
  pass: { cls: 'grade--a', word: 'good' },
  partial: { cls: 'grade--c', word: 'could be better' },
  fail: { cls: 'grade--f', word: 'needs work' },
  unknown: { cls: 'text-ink-40', word: 'not observed', hollow: true },
  na: { cls: 'text-ink-40', word: 'doesn’t apply', hollow: true },
};

function CheckRow({ c }: { c: Check }) {
  const d = DOT[c.status];
  return (
    <li className="grid grid-cols-[14px_1fr] gap-x-3 py-3 border-t border-edge">
      <svg width="12" height="12" viewBox="0 0 12 12" className={`mt-[5px] ${d.cls}`} aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" fill={d.hollow ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth="1.5" strokeDasharray={d.hollow ? '2 2' : undefined} />
      </svg>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="text-[14px] font-medium">{c.label}</span>
          <span className={`text-[12px] ${d.cls}`}>{d.word}</span>
        </div>
        <p className="text-ink-60 text-[13.5px] mt-1">{c.observed}</p>
        {c.source && c.earned != null && <p className="meta mt-1">{c.source}{day(c.when) ? `, ${day(c.when)}` : ''}</p>}
      </div>
    </li>
  );
}

function Detail({ a }: { a: Assessment }) {
  return (
    <Section id="detail" title="The evidence behind each part"
      kicker="Every check, what we saw, where and when. Open a part to read it.">
      {a.functions.map((f, i) => (
        <details key={f.key} id={`fn-${f.key}`} className={`scroll-mt-20 ${i > 0 ? 'border-t border-edge' : ''}`}>
          <summary className="flex items-center gap-3 py-3.5 cursor-pointer list-none">
            <Ring score={f.score} size={42} label={`${f.name}: ${f.score ?? 'not observed'}`} />
            <span className="flex-1 min-w-0">
              <span className="font-semibold text-[16px] block truncate">{f.name}</span>
              <span className="meta">{f.weight} of 100 points · {f.score == null ? 'not observed this scan' : `${pct(f.coverage)} observed`}</span>
            </span>
            <span className="meta hidden sm:block">{f.checks.filter((c) => c.status === 'fail' || c.status === 'partial').length || 'no'} to work on</span>
          </summary>
          <div className="pb-5">
            {f.covers && <p className="text-ink-60 text-[13.5px] mb-1">{f.covers}</p>}
            <ul className="list-none m-0 p-0">{f.checks.map((c) => <CheckRow key={c.id} c={c} />)}</ul>
          </div>
        </details>
      ))}
    </Section>
  );
}

function Example({ a }: { a: Assessment }) {
  const [copied, setCopied] = useState(false);
  const ex = a.example;
  if (!ex) return null;
  return (
    <Section id="example" title="One improvement, drafted for you" kicker={`From this finding: ${ex.finding}`}>
      <h3 className="font-semibold text-[16px]">{ex.title}</h3>
      <p className="text-ink-60 text-[14px] mt-1.5 max-w-[76ch]">{ex.intro}</p>
      <pre className="mt-4 p-4 border border-edge-strong rounded overflow-x-auto text-[12px] leading-relaxed num bg-[var(--paper)]"><code>{ex.code}</code></pre>
      <div className="flex flex-wrap items-center gap-3 mt-3 no-print">
        <button type="button" className="btn" onClick={async () => {
          try { await navigator.clipboard.writeText(ex.code); setCopied(true); setTimeout(() => setCopied(false), 2000); track('copy_example', { hotel: a.identity.name }); } catch { /* clipboard blocked */ }
        }}>{copied ? 'copied' : 'copy the code'}</button>
        <span className="meta">{ex.handoff}</span>
      </div>
    </Section>
  );
}

function Correction({ audit }: { audit: Audit }) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  if (state === 'sent') return <p className="text-[14px]" role="status">Thanks. A person reads every correction, and it’s free to send one.</p>;
  return (
    <form className="no-print" onSubmit={async (e) => {
      e.preventDefault();
      if (text.trim().length < 5) return;
      setState('busy');
      const ok = await sendCorrection({ hotel: audit.hotelName, city: audit.city, state: audit.state }, text.trim());
      setState(ok ? 'sent' : 'error');
      if (ok) track('correction_sent', { hotel: audit.hotelName });
    }}>
      <label htmlFor="correction" className="text-[13px] font-medium block mb-2">Something wrong? Tell us what and we’ll fix the record.</label>
      <textarea id="correction" rows={3} value={text} onChange={(e) => { setText(e.target.value); if (state === 'error') setState('idle'); }}
        className="input w-full" placeholder="For example: that Instagram account isn’t ours, or these aren’t our real competitors." />
      <div className="flex flex-wrap items-center gap-3 mt-2.5">
        <button type="submit" className="btn" disabled={state === 'busy' || text.trim().length < 5}>{state === 'busy' ? 'sending' : 'send correction'}</button>
        {state === 'error' && <span className="text-attention text-[13px]" role="alert">That didn’t send. Email contact@hotelgrader.com instead.</span>}
      </div>
    </form>
  );
}

export default function Report({ audit, crawl = null, live = null, market }: { audit: Audit; crawl?: unknown | null; live?: unknown | null; market: MarketView }) {
  const a = useMemo(() => assess(audit, crawl, live), [audit, crawl, live]);
  const fnName = (key: string) => a.functions.find((f) => f.key === key)?.name ?? '';
  const unseen = a.functions.filter((f) => f.coverage < 1 && f.notYet);

  return (
    <article className="panel overflow-hidden">
      <header className="px-5 sm:px-8 py-3 border-b border-edge flex flex-wrap justify-between gap-2 meta">
        <span className="text-accent">report card</span>
        <span>{day(a.scannedAt) && `scanned ${day(a.scannedAt)} · `}method v{a.version}</span>
      </header>

      {/* 1. The result, what it means, and what it rests on */}
      <section className="px-5 sm:px-8 py-8 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 sm:gap-10 items-start">
        <div className="sm:w-[190px]">
          {a.graded ? (
            <div role="img" aria-label={`Execution grade ${a.letter}, ${a.score} out of 100`}>
              <Grade letter={a.letter} size={124} />
              <div className="text-ink-60 mt-3 num">{a.score} / 100</div>
            </div>
          ) : (
            <p className="headline text-[22px]">Not enough evidence for a grade yet.</p>
          )}
          <div className="meta mt-1">execution grade</div>
          <div className="mt-4">
            <div className="hatch h-[8px] relative"><div className="absolute inset-y-0 left-0 bg-[var(--accent)]" style={{ width: pct(a.coverage) }} /></div>
            <p className="meta mt-1.5">Based on <span className="text-ink num">{pct(a.coverage)}</span> of the assessment, weighted by importance.</p>
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="headline text-[26px] sm:text-[32px]">{audit.hotelName}</h1>
          <p className="text-ink-60 mt-1 text-[14px]">
            {[a.identity.place, a.identity.website, a.identity.bookingEngine && `books through ${a.identity.bookingEngine}`].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-4 text-[16px] max-w-[62ch]">{a.headline}</p>
          <p className="text-ink-60 text-[13.5px] mt-3 max-w-[70ch]">
            The grade says how well the hotel runs the marketing, listing and booking work a public scan can observe. It isn’t a verdict on the hotel, or on which hotel a guest would pick.
            {a.identity.hotelClass && <> We placed the hotel in the <span className="text-ink">{a.identity.hotelClass.toLowerCase()}</span> class to choose comparisons. That’s our model’s estimate, not a star rating.</>}
          </p>
          {a.siteNote && <p className="meta mt-3 max-w-[70ch]">{a.siteNote}</p>}
          {a.identity.flags.length > 0 && (
            <div className="mt-4 border border-dashed border-edge-strong rounded px-4 py-3">
              <div className="meta mb-1">Check these: we may have matched the wrong record</div>
              <ul className="m-0 pl-4 text-[13.5px] text-ink-60 space-y-1">{a.identity.flags.map((f) => <li key={f}>{f}</li>)}</ul>
              <a href="#correct" className="text-[13px] inline-block mt-2">send a correction</a>
            </div>
          )}
        </div>
      </section>

      <Section id="grade" title="What the grade is made of"
        kicker="100 points, shared out by how much each part of the job matters to bookings. A part only counts for what we could see.">
        <ImportanceBar fns={a.functions} />
        <FunctionRows fns={a.functions} />
      </Section>

      {/* 2. What to do first */}
      <Section id="priorities" title={a.priorities.length ? 'What to do first' : 'Nothing urgent found'}
        kicker={a.priorities.length
          ? 'Ordered by how many points of the grade are at stake and how sure we are. An uncertain problem in a part that matters a lot comes before a confirmed small one.'
          : 'None of the checks we could run turned up a problem worth your time. See the parts we couldn’t observe below.'}>
        {a.priorities.length > 0 && (
          <ol className="list-none m-0 p-0 divide-y divide-[var(--edge)]">
            {a.priorities.map((p, i) => <PriorityCard key={p.id} p={p} n={i + 1} fnName={fnName(p.fn)} />)}
          </ol>
        )}
        {a.strengths.length > 0 && (
          <div className="mt-6 pt-5 border-t border-edge">
            <div className="meta mb-2.5">Working well, leave it alone</div>
            <ul className="list-none m-0 p-0 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
              {a.strengths.map((s) => (
                <li key={s.label} className="text-[13.5px]"><span className="grade--a mr-2" aria-hidden="true">●</span><span className="font-medium">{s.label}.</span> <span className="text-ink-60">{s.observed}</span></li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* 3. Against the alternatives */}
      <Choice a={a} audit={audit} market={market} />

      {/* 4. The detail */}
      <Prices a={a} />
      <Themes a={a} />
      <Ads a={a} />
      <AiSample a={a} />
      <Detail a={a} />
      <Example a={a} />

      {/* 5. Limits, method, corrections */}
      <Section id="method" title="What this scan couldn’t see"
        kicker="These parts were left out of the grade instead of being guessed. They’re the reason the grade rests on part of the assessment.">
        <ul className="list-none m-0 p-0 grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {unseen.map((f) => (
            <li key={f.key} className="py-2.5 border-t border-edge text-[13.5px]">
              <span className="font-medium">{f.name}</span> <span className="num text-ink-40">{pct(1 - f.coverage)} unseen</span>
              <p className="text-ink-60 mt-0.5">{f.notYet}</p>
            </li>
          ))}
        </ul>
        <p className="text-ink-60 text-[13.5px] mt-5 max-w-[80ch]">
          Also outside any public scan: your occupancy, ADR and RevPAR, your direct-booking share, what your ads return, and how your email programme performs. Those are worth more than several parts of this grade, and they need a look from the inside.
        </p>
        <div id="correct" className="mt-7 pt-6 border-t border-edge grid grid-cols-1 md:grid-cols-2 gap-8 scroll-mt-20">
          <Correction audit={audit} />
          <div className="text-[13.5px] text-ink-60">
            <p>
              Scored with method v{a.version}: {a.counts.observed} of {a.counts.checks} checks had evidence this scan. Public data only. No booking was made and no guest details were entered anywhere.
            </p>
            <p className="mt-2"><a href="/methodology">How the grade is built</a>, with every weight and rule.</p>
          </div>
        </div>
      </Section>
    </article>
  );
}
