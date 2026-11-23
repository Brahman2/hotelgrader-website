import { useMemo, useState, type ReactNode } from 'react';
import { assess, type Assessment, type Check, type FunctionResult, type Priority } from '../../shared/assess.mjs';
import { gradeTone, letterFor, type Audit } from '../lib/hg';
import { sendCorrection } from '../lib/verify';
import { track } from '../lib/track';
import { MarketScatter, Ring, toneFor, type MarketPoint } from './Charts';
import Scanner, { type Blip } from './Scanner';
import type { LatLon } from '../lib/geo';

// The report. A sidebar keeps the grade and every part's score in view; the
// main column opens with what needs work and how the hotel ranks, then what to
// do first, then every check we ran, part by part, with that part's charts.
// All of it comes from assess() in shared/assess.mjs, which scores only what
// the scan observed.

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
            {c.basis === 'same-class' ? `These are the ${c.peers} closest hotels Google lists near you in the same star class. Ranks are among all ${c.setSize} in that class. `
              : c.basis === 'near-class' ? `These are the ${c.peers} closest hotels Google lists near you within one star of your class. `
                : c.basis === 'nearby' ? `These are the ${c.peers} closest hotels Google lists near you. Too few shared your star class to match on it. `
                  : c.setSize ? `Our model picked these ${c.peers} from ${c.setSize} hotels near you that it placed in a similar class. ` : 'Our model picked these from hotels near you. '}
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

function Voice({ a }: { a: Assessment }) {
  const v = a.voice;
  if (!v) return null;
  const worst = v.topics.filter((t) => t.negShare >= 0.25).slice(0, 2);
  return (
    <Section id="topics" title="Where the praise and the complaints land"
      kicker={`Google groups every review it holds for your listing${v.total ? ` (${v.total.toLocaleString('en-US')})` : ''} by topic. Green is praise, red is complaint. Not scored: it shows where to look.`}>
      {worst.length > 0 && (
        <p className="headline text-[19px] sm:text-[22px] max-w-[60ch] mb-6">
          {worst.map((t, i) => (i === 0 ? t.name : t.name.toLowerCase())).join(' and ')} {worst.length === 1 ? 'draws' : 'draw'} the largest share of complaints: <span className="grade--f">{Math.round(worst[0].negShare * 100)}%</span> of the opinions on {worst[0].name.toLowerCase()} are negative.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] gap-10 items-start">
        <ul className="list-none m-0 p-0 space-y-2">
          {v.topics.map((t) => {
            const sum = Math.max(1, t.positive + t.negative);
            return (
              <li key={t.name} className="grid grid-cols-[minmax(0,30%)_1fr_auto] items-center gap-3 text-[13px]">
                <span className="truncate text-ink-60">{t.name}</span>
                <span className="flex h-[10px] bg-edge" aria-hidden="true">
                  <span style={{ width: `${(t.positive / sum) * 100}%`, background: 'var(--grade-a)' }} />
                  <span style={{ width: `${(t.negative / sum) * 100}%`, background: 'var(--grade-f)' }} />
                </span>
                <span className="num w-[112px] text-right text-ink-60 whitespace-nowrap"><span className="text-ink">{Math.round(t.negShare * 100)}%</span> neg · {t.mentions}</span>
              </li>
            );
          })}
        </ul>
        {v.stars.length > 0 && (
          <div>
            <div className="meta mb-2">Star ratings on Google</div>
            <ul className="list-none m-0 p-0 space-y-1.5">
              {v.stars.map((r) => (
                <li key={r.stars} className="grid grid-cols-[18px_1fr_44px] items-center gap-2 text-[13px]">
                  <span className="num text-ink-60">{r.stars}</span>
                  <span className="h-[10px] bg-edge" aria-hidden="true"><span className="block h-full" style={{ width: `${r.share * 100}%`, background: r.stars >= 4 ? 'var(--grade-a)' : r.stars === 3 ? 'var(--ink-40)' : 'var(--grade-f)' }} /></span>
                  <span className="num text-right text-ink-60">{Math.round(r.share * 100)}%</span>
                </li>
              ))}
            </ul>
            {v.low != null && <p className="meta mt-3">{Math.round(v.low * 100)}% of ratings are one or two stars.</p>}
          </div>
        )}
      </div>
    </Section>
  );
}

function Ads({ a }: { a: Assessment }) {
  const ads = a.ads;
  if (!ads || (ads.rivals.length < 2 && !ads.brand)) return null;
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
      {ads.brand && (
        <p className="text-[14px] text-ink-60 mt-4 max-w-[70ch]">
          <span className="text-ink">On a search for “{ads.brand.query}”:</span>{' '}
          {ads.brand.others.length > 0
            ? <>{ads.brand.others.length} other {ads.brand.others.length === 1 ? 'site was' : 'sites were'} advertising on your name ({ads.brand.others.join(', ')}){ads.brand.own ? ', alongside your own ad.' : ', and you weren’t.'}</>
            : ads.brand.own ? 'yours was the only ad.' : 'nobody was advertising on your name when we looked.'}
          {' '}One search at one moment, so ads can come and go.
        </p>
      )}
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
              <li key={s.surface} className="border border-edge-strong rounded px-3 py-1.5 text-[13px] max-w-[60ch]">
                <span className="font-semibold">{s.surface}</span>{' '}
                {s.valid ? (s.mentioned ? <span className="grade--a">named the hotel</span> : <span className="text-ink-60">didn’t name the hotel</span>)
                  : <span className="text-ink-40">no usable answer ({s.why})</span>}
                {s.named.length > 0 && <span className="block text-ink-60 mt-1">From your comparison set it named {s.named.join(', ')}.</span>}
                {s.sources.length > 0 && <span className="block text-ink-40 mt-1">It drew on {s.sources.join(', ')}.</span>}
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

const MARK: Record<Check['status'], { cls: string; word: string; glyph: 'tick' | 'cross' | 'bang' | 'query' }> = {
  pass: { cls: 'check-mark--pass', word: 'good', glyph: 'tick' },
  partial: { cls: 'check-mark--partial', word: 'could be better', glyph: 'bang' },
  fail: { cls: 'check-mark--fail', word: 'needs work', glyph: 'cross' },
  unknown: { cls: 'check-mark--unknown', word: 'couldn’t see', glyph: 'query' },
  na: { cls: 'check-mark--unknown', word: 'doesn’t apply', glyph: 'query' },
};

function Mark({ status }: { status: Check['status'] }) {
  const m = MARK[status];
  return (
    <span className={`check-mark ${m.cls}`} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {m.glyph === 'tick' && <path d="M2.5 6.4l2.3 2.3 4.7-5.2" />}
        {m.glyph === 'cross' && <path d="M3 3l6 6M9 3l-6 6" />}
        {m.glyph === 'bang' && <path d="M6 2.6v4.2M6 9.3v.1" />}
        {m.glyph === 'query' && <path d="M4.2 4.4a1.9 1.9 0 113 1.5c-.7.5-1.2.8-1.2 1.6M6 9.4v.1" />}
      </svg>
    </span>
  );
}

/** One thing we checked: a tick or a cross, what it is, and what we saw. */
function CheckRow({ c }: { c: Check }) {
  const m = MARK[c.status];
  const quiet = c.status === 'pass' || c.status === 'unknown' || c.status === 'na';
  return (
    <li className="grid grid-cols-[24px_1fr] gap-x-3 py-3">
      <Mark status={c.status} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className={`text-[15px] ${c.status === 'unknown' || c.status === 'na' ? 'text-ink-60' : 'font-medium'}`}>{c.label}</span>
          {!quiet && <span className={`text-[12px] ${c.status === 'fail' ? 'grade--f' : 'grade--c'}`}>{m.word}</span>}
        </div>
        <p className={`text-[13.5px] mt-0.5 ${quiet ? 'text-ink-40' : 'text-ink-60'}`}>{c.observed}</p>
        {!quiet && c.source && <p className="meta mt-1">{c.source}{day(c.when) ? `, ${day(c.when)}` : ''}</p>}
      </div>
    </li>
  );
}

/** What each part of the grade is for, in the owner's words. */
const GOAL: Record<string, string> = {
  booking: 'Get guests from your listing to a booking',
  rates: 'Make your own rate the one worth booking',
  reputation: 'Earn the rating that wins the click',
  discovery: 'Be found when guests search for you',
  profiles: 'Keep every listing complete and correct',
  media: 'Show the hotel well',
  speed: 'Load fast on a phone',
  brand: 'Say clearly what kind of hotel you are',
  links: 'Be linked from the places that matter',
  social: 'Be present where guests look you up',
  contact: 'Make it easy to reach you',
  ai: 'Be named when guests ask AI',
};

const verdict = (score: number | null) => (score == null ? 'Not seen' : score >= 90 ? 'Strong' : score >= 80 ? 'Good' : score >= 70 ? 'Fair' : score >= 60 ? 'Weak' : 'Poor');
const needsWork = (c: Check) => c.status === 'fail' || c.status === 'partial';
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** One part of the grade: its aim, its score, every check, then its charts. */
function Part({ f, n, children }: { f: FunctionResult; n: number; children?: ReactNode }) {
  const work = f.checks.filter(needsWork).length;
  return (
    <section id={`fn-${f.key}`} className="scroll-mt-24">
      <div className="flex items-end justify-between gap-4 px-1 mb-3">
        <div className="min-w-0">
          <div className="text-ink-40 text-[15px]">{n}. {f.name} <span className="meta ml-1">{f.weight} of 100 points</span></div>
          <h3 className="headline text-[20px] sm:text-[23px] mt-0.5">{GOAL[f.key] ?? f.name}</h3>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className={`text-[13px] ${toneFor(f.score)}`}>{f.score == null ? 'not seen' : work ? `${work} to work on` : verdict(f.score).toLowerCase()}</span>
          <Ring score={f.score} size={40} label={`${f.name}: ${f.score ?? 'not observed'}`} />
        </div>
      </div>
      <div className="panel overflow-hidden">
        <div className="px-5 sm:px-8 py-5">
          {f.covers && <p className="text-ink-60 text-[13.5px] mb-2 max-w-[72ch]">{f.covers}</p>}
          <ul className="list-none m-0 p-0 divide-y divide-[var(--edge)]">{f.checks.map((c) => <CheckRow key={c.id} c={c} />)}</ul>
        </div>
        {children}
      </div>
    </section>
  );
}

/** The grade and every part's score, kept in view beside the report. */
function Side({ a }: { a: Assessment }) {
  const rows = a.functions.map((f) => (
    <a key={f.key} href={`#fn-${f.key}`} className="grid grid-cols-[30px_1fr_auto] items-center gap-x-3 py-[7px] text-ink hover:no-underline group">
      <Ring score={f.score} size={30} label={`${f.name}: ${f.score ?? 'not observed'}`} />
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium group-hover:text-accent">{f.name}</span>
        <span className={`block text-[12px] leading-tight ${f.score == null ? 'text-ink-40' : toneFor(f.score)}`}>{verdict(f.score)}</span>
      </span>
      <span className="meta tabular">{f.weight} pts</span>
    </a>
  ));
  return (
    <aside className="panel px-6 py-7 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-print-sticky">
      <div className="flex lg:flex-col items-center gap-5 lg:gap-0 lg:text-center">
        {a.graded ? (
          <div className="relative shrink-0" role="img" aria-label={`Execution grade ${a.letter}, ${a.score} out of 100`}>
            <svg width="168" height="168" viewBox="0 0 44 44" className={`w-[112px] h-[112px] lg:w-[168px] lg:h-[168px] ${toneFor(a.score)}`} aria-hidden="true">
              <circle cx="22" cy="22" r="19" fill="none" stroke="var(--edge-strong)" strokeWidth="2.6" />
              <circle cx="22" cy="22" r="19" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
                strokeDasharray={`${((a.score ?? 0) / 100) * 2 * Math.PI * 19} ${2 * Math.PI * 19}`} transform="rotate(-90 22 22)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-[34px] lg:text-[50px] leading-none font-semibold">{a.score}</span>
              <span className="meta mt-1">of 100</span>
            </div>
          </div>
        ) : (
          <p className="headline text-[20px]">Not enough evidence for a grade yet.</p>
        )}
        <div className="lg:mt-5">
          <div className="meta">execution grade</div>
          {a.graded && (
            <div className="flex items-baseline gap-3 lg:justify-center mt-1">
              <Grade letter={a.letter} size={44} />
              <span className="headline text-[24px]">{verdict(a.score)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-5">
        <div className="hatch h-[6px] relative"><div className="absolute inset-y-0 left-0 bg-[var(--accent)]" style={{ width: pct(a.coverage) }} /></div>
        <p className="meta mt-1.5">Rests on <span className="text-ink num">{pct(a.coverage)}</span> of the assessment. The rest couldn’t be seen from outside and isn’t counted.</p>
      </div>
      <nav className="mt-5 pt-3 border-t border-edge hidden lg:block" aria-label="Parts of the grade">{rows}</nav>
      <details className="mt-4 pt-3 border-t border-edge lg:hidden">
        <summary className="cursor-pointer text-[14px] font-medium py-1 flex justify-between list-none">The twelve parts of the grade</summary>
        <nav className="mt-1" aria-label="Parts of the grade">{rows}</nav>
      </details>
      <a href="#priorities" className="btn btn--primary w-full justify-center mt-5 no-print">what to do first</a>
    </aside>
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
  const all = a.functions.flatMap((f) => f.checks);
  const checked = all.filter((c) => c.earned != null).length;
  const work = all.filter(needsWork).length;
  const hidden = all.filter((c) => c.earned == null && c.max > 0).length;
  // The hotels we compared, best guest rating first, with this hotel's place among them.
  const ranked = a.choice ? [...a.choice.rows].filter((r) => r.rating != null).sort((x, y) => (y.rating! - x.rating!) || ((y.reviews ?? 0) - (x.reviews ?? 0))) : [];
  const place = ranked.findIndex((r) => r.you) + 1;
  // The charts that belong with a part sit inside that part.
  const extras: Record<string, ReactNode> = {
    rates: <Prices a={a} />,
    reputation: <><Choice a={a} audit={audit} market={market} /><Themes a={a} /><Voice a={a} /></>,
    ai: <AiSample a={a} />,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
      <Side a={a} />

      <div className="min-w-0 space-y-6">
        {/* 1. What needs work, and where the hotel stands */}
        <div className={`grid grid-cols-1 ${place > 0 ? 'xl:grid-cols-2' : ''} gap-6`}>
          <section className="panel px-6 sm:px-8 py-7">
            <div className="meta flex flex-wrap justify-between gap-2 mb-4">
              <span className="text-accent">report card</span>
              <span>{day(a.scannedAt) && `scanned ${day(a.scannedAt)} · `}method v{a.version}</span>
            </div>
            <p className="headline text-[24px] sm:text-[28px] leading-tight">
              {work > 0 ? <>{work} of the {checked} things we checked need work</> : <>All {checked} things we could check look good</>}
            </p>
            <h1 className="text-[19px] font-semibold mt-5">{audit.hotelName}</h1>
            <p className="text-ink-60 text-[14px]">
              {[a.identity.place, a.identity.website, a.identity.bookingEngine && `books through ${a.identity.bookingEngine}`].filter(Boolean).join(' · ')}
            </p>
            {a.priorities.length > 0 && (
              <ul className="list-none m-0 p-0 mt-5 space-y-2.5">
                {a.priorities.slice(0, 4).map((p) => (
                  <li key={p.id} className="grid grid-cols-[20px_1fr] gap-x-2.5 text-[15px]">
                    <svg width="16" height="16" viewBox="0 0 16 16" className={`mt-[3px] ${p.type === 'fix' ? 'grade--f' : 'grade--c'}`} aria-hidden="true"><path d="M8 1.6l7 12.3H1L8 1.6z" fill="currentColor" /><path d="M8 6.2v3.6M8 11.6v.1" stroke="var(--panel-bg, #111)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    <a href="#priorities" className="text-ink hover:text-accent">{p.title}</a>
                  </li>
                ))}
              </ul>
            )}
            {a.priorities.length > 4 && <a href="#priorities" className="text-[13.5px] inline-block mt-3">and {a.priorities.length - 4} more</a>}
          </section>

          {place > 0 && (
            <section className="panel px-6 sm:px-8 py-7">
              <div className="meta mb-4">guest rating on Google{a.identity.hotelClass && a.identity.classSource === 'google' ? ` · ${a.identity.hotelClass} hotels near you` : ' · hotels near you'}</div>
              <p className="headline text-[24px] sm:text-[28px] leading-tight">
                You’re ranked {ordinal(place)} of {ranked.length} {place === 1 ? 'among' : 'against'} the hotels around you
              </p>
              <ol className="list-none m-0 p-0 mt-5">
                {ranked.map((r, i) => (
                  <li key={r.name} className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-3 py-2 rounded ${r.you ? 'bg-[var(--accent-soft)]' : ''}`}>
                    <span className={`min-w-0 truncate text-[15px] ${r.you ? 'font-semibold' : ''}`}>{r.name}</span>
                    <span className="num text-[14px] text-ink-60">{r.rating!.toFixed(1)} ★{r.rate != null && <span className="text-ink-40 hidden sm:inline"> · {usd(r.rate)}</span>}</span>
                    <span className={`num text-[14px] w-[34px] text-right ${r.you ? 'font-semibold' : 'text-ink-60'}`}>{ordinal(i + 1)}</span>
                  </li>
                ))}
              </ol>
              <a href="#choice" className="text-[13.5px] inline-block mt-3">how these hotels were chosen, and their prices</a>
            </section>
          )}
        </div>

        <section className="px-1">
          <p className="text-[16px] max-w-[70ch]">{a.headline}</p>
          <p className="text-ink-60 text-[13.5px] mt-2 max-w-[78ch]">
            The grade says how well the hotel runs the marketing, listing and booking work a public scan can observe. It isn’t a verdict on the hotel, or on which hotel a guest would pick.
            {a.identity.hotelClass && (a.identity.classSource === 'google'
              ? <> Google lists it as a <span className="text-ink">{a.identity.hotelClass}</span> hotel, and we used that class to choose comparisons.</>
              : <> We placed the hotel in the <span className="text-ink">{a.identity.hotelClass.toLowerCase()}</span> class to choose comparisons. That’s our model’s estimate, not a star rating.</>)}
          </p>
          {a.siteNote && <p className="meta mt-2 max-w-[78ch]">{a.siteNote}</p>}
          {a.identity.flags.length > 0 && (
            <div className="mt-4 border border-dashed border-edge-strong rounded px-4 py-3 max-w-[78ch]">
              <div className="meta mb-1">Check these: we may have matched the wrong record</div>
              <ul className="m-0 pl-4 text-[13.5px] text-ink-60 space-y-1">{a.identity.flags.map((f) => <li key={f}>{f}</li>)}</ul>
              <a href="#correct" className="text-[13px] inline-block mt-2">send a correction</a>
            </div>
          )}
        </section>

        {/* 2. What to do first */}
        <article className="panel overflow-hidden">
          <section id="priorities" className="px-5 sm:px-8 py-7 scroll-mt-24">
            <div className="mb-5">
              <h2 className="label label--ink">{a.priorities.length ? 'What to do first' : 'Nothing urgent found'}</h2>
              <p className="text-ink-60 text-[13.5px] mt-1 max-w-[72ch]">
                {a.priorities.length
                  ? 'Ordered by how many points of the grade are at stake and how sure we are. An uncertain problem in a part that matters a lot comes before a confirmed small one.'
                  : 'None of the checks we could run turned up a problem worth your time.'}
              </p>
            </div>
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
          </section>
        </article>

        {/* 3. Everything we checked, part by part */}
        <div className="px-1 pt-6">
          <h2 className="headline text-[26px] sm:text-[32px] leading-tight">{checked} things checked, {work} need work</h2>
          <p className="headline text-[20px] sm:text-[24px] text-ink-40 leading-tight mt-1">See what we looked for, what we found and what to change</p>
          <p className="text-ink-60 text-[13.5px] mt-3 max-w-[72ch]">
            The twelve parts are in order of how much they matter to bookings.{hidden > 0 && <> A further {hidden} things couldn’t be seen from outside. They’re marked with a question mark and left out of the grade.</>}
          </p>
        </div>
        <div className="space-y-10">
          {a.functions.map((f, i) => <Part key={f.key} f={f} n={i + 1}>{extras[f.key]}</Part>)}
        </div>

        {/* 4. Reported, not graded */}
        {(a.ads || a.example) && (
          <article className="panel overflow-hidden [&>section:first-child]:border-t-0">
            <Ads a={a} />
            <Example a={a} />
          </article>
        )}

        {/* 5. Limits, method, corrections */}
        <article className="panel overflow-hidden [&>section:first-child]:border-t-0">
          <Section id="method" title="What this scan couldn’t see"
            kicker="These parts were left out of the grade instead of being guessed. They’re the reason the grade rests on part of the assessment.">
            <ImportanceBar fns={a.functions} />
            <ul className="list-none m-0 p-0 grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-6">
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
            <div id="correct" className="mt-7 pt-6 border-t border-edge grid grid-cols-1 md:grid-cols-2 gap-8 scroll-mt-24">
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
      </div>
    </div>
  );
}
