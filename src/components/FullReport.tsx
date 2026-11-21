import { pillars } from '../content/pillars';
import { isMeasured, type Audit, type Metric } from '../lib/hg';
import { DotStrip, MarketScatter, Ring, toneFor, type MarketPoint } from './Charts';

// The full report, shown to every verified visitor. It is built around charts
// and real numbers from the scan: how the findings spread, where to start, what
// one night costs on each booking site, which competitors advertise, and the
// hotel against its market. Then the findings themselves, weakest section
// first. Findings that score well collapse to a row of chips, so the page
// spends its length on what needs work.

const SITE = 'https://hotelgrader.com';
const GOOD = 85; // B+ and up counts as working well

const PLAIN: Record<string, string> = {
  searchAndAI: 'AI and search visibility',
  digitalPresence: 'its website',
  reputation: 'reputation',
  socialMedia: 'social media',
  advertising: 'advertising',
  booking: 'booking and distribution',
  competitive: 'competitive position',
};

interface Highlight { sentence: string }

/** The most flattering true thing in the scan, for the optional LinkedIn post. */
export function pickHighlight(audit: Audit): Highlight | null {
  const c = audit._meta?.competitors;
  if (c?.rating_rank != null && c.total_in_set != null && c.rating_rank <= 3 && c.total_in_set >= 4) {
    return { sentence: `ranks #${c.rating_rank} of ${c.total_in_set} nearby hotels on guest rating` };
  }
  const counted = audit._meta?.overall_scoring?.included;
  const best = pillars
    .filter((p) => !counted || counted.includes(p.key))
    .map((p) => ({ key: p.key, score: audit.categories[p.key]?.score ?? 0 }))
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 80) return { sentence: `scored ${best.score} out of 100 for ${PLAIN[best.key]}` };
  if (c?.own_rating != null && c.own_rating >= 4.3 && c.own_reviews) {
    return { sentence: `holds ${c.own_rating} stars across ${c.own_reviews.toLocaleString('en-US')} Google reviews` };
  }
  return null;
}

/** The post text. It never includes the grade. */
export function shareText(audit: Audit, h: Highlight | null): string {
  return h
    ? `${audit.hotelName} ${h.sentence}. I just ran our free marketing report card on hotelgrader. See how your hotel scores: ${SITE}`
    : `I just graded my hotel’s marketing on hotelgrader. It’s free and takes two minutes. What does yours get? ${SITE}`;
}

type Step = { action?: string; details?: string };
type Full = Metric & { actionSteps?: Step[] };
type Finding = Full & { score: number; section: string };

const firstStep = (m: Full) => (m.actionSteps ?? []).find((s) => s.action);
const tidy = (t?: string) => (t ?? '').replace(/[.:]\s*$/, '');
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Three big counts: how many findings need fixing, improving, or nothing. */
function Tally({ findings }: { findings: Finding[] }) {
  const cell = (n: number, label: string, tone: string) => (
    <div>
      <div className={`num text-[40px] leading-none font-semibold ${tone}`}>{n}</div>
      <div className="meta mt-1.5">{label}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-4">
      {cell(findings.filter((f) => f.score < 70).length, 'to fix', 'grade--f')}
      {cell(findings.filter((f) => f.score >= 70 && f.score < GOOD).length, 'to improve', 'grade--c')}
      {cell(findings.filter((f) => f.score >= GOOD).length, 'working well', 'grade--a')}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-9 pt-7 border-t border-edge">
      <h3 className="label label--ink mb-4">{title}</h3>
      {children}
    </div>
  );
}

function StartHere({ findings }: { findings: Finding[] }) {
  const worst = findings.filter((f) => f.score < GOOD).slice(0, 5);
  if (!worst.length) return null;
  return (
    <Block title="Start here">
      <ol className="list-none m-0 p-0 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {worst.map((f, i) => {
          const step = firstStep(f);
          return (
            <li key={f.id} className="flex gap-4 items-start">
              <Ring score={f.score} size={58} />
              <div className="min-w-0">
                <div className="font-semibold leading-snug"><span className="num text-ink-40 mr-1.5">{i + 1}</span>{f.name}</div>
                <div className="meta">{f.section}</div>
                {step && <p className="text-[13px] text-ink-60 mt-1.5">{tidy(step.action)}.</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </Block>
  );
}

/** What one night costs on the hotel's own site against each booking site. */
function Prices({ audit }: { audit: Audit }) {
  const bp = audit._meta?.booking_pricing;
  const all = (bp?.ota_rates ?? []).filter((r) => r && r.rate > 0 && r.source);
  if (all.length < 3) return null;
  const direct = all.find((r) => same(r.source, bp?.matched_name) || same(r.source, audit.hotelName));
  const others = all.filter((r) => r !== direct).sort((a, b) => a.rate - b.rate);
  const cheaper = direct ? others.filter((r) => r.rate < direct.rate) : [];
  const rows = [...(direct ? [direct] : []), ...others.slice(0, direct ? 9 : 10)].sort((a, b) => a.rate - b.rate);
  const max = Math.max(...rows.map((r) => r.rate));
  const night = bp?.identity?.check_in
    ? new Date(`${bp.identity.check_in}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  return (
    <Block title="One night, priced on each booking site">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-8 items-start">
        <div>
          {direct ? (
            <>
              <p className="headline text-[22px] sm:text-[26px]">
                {cheaper.length > 0
                  ? <>{cheaper.length} of {others.length} sites <span className="grade--f">undercut</span> your own.</>
                  : <>Your own site has the <span className="grade--a">lowest</span> price.</>}
              </p>
              <p className="text-ink-60 text-[14px] mt-3">
                Your site lists the night at <span className="text-ink num">{usd(direct.rate)}</span>.
                {cheaper.length > 0 && <> The lowest price elsewhere is <span className="text-ink num">{usd(others[0].rate)}</span> on {others[0].source}, {usd(direct.rate - others[0].rate)} less.</>}
              </p>
            </>
          ) : (
            <p className="text-ink-60 text-[14px]">We found {all.length} prices for the same night and couldn’t tell which one is your own site.</p>
          )}
          <p className="meta mt-3">
            {night ? `Check-in ${night}. ` : ''}Prices as shown on Google’s hotel search at scan time. Room types and taxes can differ between sites.
          </p>
        </div>
        <ul className="list-none m-0 p-0 space-y-1.5">
          {rows.map((r) => {
            const mine = r === direct;
            return (
              <li key={r.source} className="grid grid-cols-[minmax(0,34%)_1fr_auto] items-center gap-3 text-[13px]">
                <span className={`truncate ${mine ? 'font-semibold' : 'text-ink-60'}`}>{mine ? 'Your site' : r.source}</span>
                <span className="h-[10px] bg-edge" aria-hidden="true">
                  <span className="block h-full" style={{ width: `${(r.rate / max) * 100}%`, background: mine ? 'var(--accent)' : 'var(--ink-40)' }} />
                </span>
                <span className={`num w-[52px] text-right ${mine ? 'font-semibold' : ''}`}>{usd(r.rate)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Block>
  );
}

/** Which hotels in the set run Google or Meta ads. */
function Ads({ audit }: { audit: Audit }) {
  const rivals = audit._meta?.compset_ads?.competitors ?? [];
  if (rivals.length < 2) return null;
  const mine = audit.categories.advertising?.metrics ?? [];
  const g = mine.find((m) => /google ads/i.test(m.name))?.verified_data;
  const f = mine.find((m) => /meta ads/i.test(m.name))?.verified_data;
  const own = {
    name: audit.hotelName,
    google_ads: g?.registry?.checked ? !!(g.runs_ads_registry ?? g.registry.runs_ads_registry) : null,
    meta_ads: f?.status === 'ok' ? !!f.running_ads : null,
  };
  const cell = (v: boolean | null | undefined) =>
    v == null ? <span className="text-ink-40">couldn’t tell</span>
      : v ? <span className="inline-flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />running</span>
        : <span className="text-ink-40">none found</span>;
  const gCount = rivals.filter((r) => r.google_ads).length;
  const mCount = rivals.filter((r) => r.meta_ads).length;
  return (
    <Block title="Who is advertising near you">
      <p className="text-ink-60 text-[14px] mb-4 max-w-[70ch]">
        {gCount} of {rivals.length} named competitors run Google ads and {mCount} run ads on Facebook or Instagram.
      </p>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="meta text-left">
            <th className="font-normal py-1.5">hotel</th>
            <th className="font-normal py-1.5 w-[28%]">Google ads</th>
            <th className="font-normal py-1.5 w-[28%]">Meta ads</th>
          </tr>
        </thead>
        <tbody>
          {[own, ...rivals].map((r, i) => (
            <tr key={r.name} className="border-t border-edge">
              <td className={`py-2 pr-3 ${i === 0 ? 'font-semibold' : ''}`}>{r.name}</td>
              <td className="py-2">{cell(r.google_ads)}</td>
              <td className="py-2">{cell(r.meta_ads)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meta mt-3 max-w-[80ch]">
        Checked in Google’s Ads Transparency Center by each hotel’s website, and in Meta’s Ad Library by each hotel’s own Facebook page.
        Ads run under another company’s name, such as a management group or an agency, won’t show here.
      </p>
    </Block>
  );
}

function Market({ audit }: { audit: Audit }) {
  const c = audit._meta?.competitors;
  const rivals = (c?.top_competitors ?? []).filter((r) => r.rating != null && r.reviews != null);
  if (c?.own_rating == null || !c.own_reviews || rivals.length < 2) return null;
  const points: MarketPoint[] = [
    ...rivals.map((r, i) => ({ label: String(i + 1), name: r.name, rating: r.rating!, reviews: r.reviews! })),
    { label: 'you', name: audit.hotelName, rating: c.own_rating, reviews: c.own_reviews, you: true },
  ];
  const higher = rivals.filter((r) => r.rating! > c.own_rating!).length;
  const louder = rivals.filter((r) => r.reviews! > c.own_reviews!).length;
  return (
    <Block title="Rating and reviews against the market">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div>
          <p className="text-ink-60 text-[14px]">
            {higher === 0 ? 'No named competitor has a higher guest rating.' : `${higher} of ${rivals.length} named competitors have a higher guest rating.`}{' '}
            {louder === 0 ? 'None has more reviews.' : `${louder} ${louder === 1 ? 'has' : 'have'} more reviews.`}
          </p>
          <p className="meta mt-3">Higher is a better rating. Further right is more reviews. Numbers match the market table above.</p>
        </div>
        <MarketScatter points={points} />
      </div>
    </Block>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const steps = (f.actionSteps ?? []).filter((s) => s.action);
  return (
    <div className="py-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
      <div className="flex gap-4 items-start">
        <Ring score={f.score} size={52} />
        <div className="min-w-0">
          <h4 className="font-semibold leading-snug">{f.name}</h4>
          {f.insight && <p className="text-ink-60 text-[13.5px] mt-1.5">{f.insight}</p>}
        </div>
      </div>
      <div>
        {f.recommendation && <p className="text-[13.5px]"><span className="font-semibold">What to do: </span>{f.recommendation}</p>}
        {steps.length > 0 && (
          <ol className="mt-2.5 pl-5 text-[13.5px] text-ink-60 space-y-1.5 list-decimal">
            {steps.map((s, i) => (
              <li key={i}><span className="text-ink">{tidy(s.action)}.</span>{s.details ? ` ${s.details}` : ''}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default function FullReport({ audit }: { audit: Audit }) {
  const groups = pillars.map((p) => {
    const all = (audit.categories[p.key]?.metrics ?? []) as Full[];
    const measured = (all.filter(isMeasured) as Finding[])
      .map((m) => ({ ...m, section: p.name }))
      .sort((a, b) => a.score - b.score);
    return { p, score: audit.categories[p.key]?.score ?? null, measured, missing: all.filter((m) => !isMeasured(m)) };
  }).sort((a, b) => (a.score ?? 101) - (b.score ?? 101)); // weakest section first
  const findings = groups.flatMap((g) => g.measured).sort((a, b) => a.score - b.score);
  const missing = groups.flatMap((g) => g.missing.map((m) => m.name));

  return (
    <section className="panel mt-6 px-5 sm:px-8 py-7">
      <h2 className="headline text-[22px] sm:text-[26px]">The full report</h2>
      <p className="text-ink-60 mt-1.5 mb-7">
        {findings.length} findings from this scan, with what to do about each one.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-8 items-center">
        <Tally findings={findings} />
        <div>
          <DotStrip scores={findings} />
          <p className="meta mt-2">Each dot is one finding, placed by its score. Left needs work, right is working.</p>
        </div>
      </div>

      <StartHere findings={findings} />
      <Prices audit={audit} />
      <Ads audit={audit} />
      <Market audit={audit} />

      <Block title="Every finding, weakest section first">
        {groups.filter((g) => g.measured.length > 0).map((g, i) => {
          const work = g.measured.filter((m) => m.score < GOOD);
          const good = g.measured.filter((m) => m.score >= GOOD);
          return (
            <details key={g.p.key} open={i === 0} className={i > 0 ? 'border-t border-edge' : ''}>
              <summary className="flex items-center gap-3 py-4 cursor-pointer list-none">
                <Ring score={g.score} size={44} label={`${g.p.name}: ${g.score ?? 'not scored'} out of 100`} />
                <span className="font-semibold text-[17px] flex-1 min-w-0">{g.p.name}</span>
                <span className="hidden sm:block w-[180px]"><DotStrip scores={g.measured} height={20} axis={false} /></span>
                <span className="meta num w-[92px] text-right">{work.length ? `${work.length} to work on` : 'none flagged'}</span>
              </summary>
              <div className="pb-4">
                {work.length > 0 && <div className="divide-y divide-[var(--edge)]">{work.map((m) => <FindingCard key={m.id} f={m} />)}</div>}
                {good.length > 0 && (
                  <div className={work.length ? 'pt-4 border-t border-edge' : ''}>
                    <div className="meta mb-2.5">Working well</div>
                    <ul className="list-none m-0 p-0 flex flex-wrap gap-2">
                      {good.map((m) => (
                        <li key={m.id} className="inline-flex items-baseline gap-2 border border-edge-strong rounded px-3 py-1.5 text-[13px]">
                          {m.name}<span className={`num font-semibold ${toneFor(m.score)}`}>{m.score}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </Block>

      {missing.length > 0 && (
        <Block title="What a public scan can’t see">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-8 items-start">
            <div>
              <p className="text-ink-60 text-[14px] mb-4">
                {missing.length} checks came back without data this time. Most need a look from the inside, or a second pass.
              </p>
              <ul className="list-none m-0 p-0 flex flex-wrap gap-2">
                {missing.map((name) => (
                  <li key={name} className="border border-dashed border-edge-strong rounded px-3 py-1.5 text-[13px] text-ink-60">{name}</li>
                ))}
              </ul>
            </div>
            <div className="no-print">
              <p className="font-semibold">Want these measured too?</p>
              <p className="text-ink-60 text-[14px] mt-1.5">We’ll go through the report with you and fill in what’s missing.</p>
              <a className="btn btn--primary mt-4"
                href={`mailto:hello@hotelgrader.com?subject=${encodeURIComponent(`Full audit for ${audit.hotelName}`)}`}>talk to us</a>
            </div>
          </div>
        </Block>
      )}
    </section>
  );
}
