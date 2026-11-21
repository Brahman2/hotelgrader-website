import { useEffect, useRef, useState } from 'react';
import { pillars } from '../content/pillars';
import { isMeasured, type Audit, type Metric } from '../lib/hg';
import { DotStrip, MarketScatter, Radar, Ring, toneFor, type MarketPoint } from './Charts';

// The full report, built around charts: a radar of the seven sections, every
// finding as a dot on a 0-100 line, the hotel against its competitors, then
// the findings themselves, worst first. Findings that score well collapse to a
// row of chips, so the page spends its length on what needs work.
// It unlocks when the visitor shares on LinkedIn. We can't confirm
// a post went out, so opening the LinkedIn composer is what unlocks it.
//
// What gets shared is never the grade. It's the hotel's best result, picked
// here, or a plain "what's yours?" challenge with no result at all.

const SITE = 'https://hotelgrader.com';

const PLAIN: Record<string, string> = {
  searchAndAI: 'AI and search visibility',
  digitalPresence: 'its website',
  reputation: 'reputation',
  socialMedia: 'social media',
  advertising: 'advertising',
  booking: 'booking and distribution',
  competitive: 'competitive position',
};

interface Highlight { stat: string; line: string; sentence: string }

/** The most flattering true thing in the scan, or null if nothing clears the bar. */
export function pickHighlight(audit: Audit): Highlight | null {
  const c = audit._meta?.competitors;
  if (c?.rating_rank != null && c.total_in_set != null && c.rating_rank <= 3 && c.total_in_set >= 4) {
    return {
      stat: `#${c.rating_rank} of ${c.total_in_set}`,
      line: 'on guest rating among nearby hotels',
      sentence: `ranks #${c.rating_rank} of ${c.total_in_set} nearby hotels on guest rating`,
    };
  }
  const counted = audit._meta?.overall_scoring?.included;
  const best = pillars
    .filter((p) => !counted || counted.includes(p.key))
    .map((p) => ({ key: p.key, score: audit.categories[p.key]?.score ?? 0 }))
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 80) {
    return {
      stat: `${best.score} / 100`,
      line: `for ${PLAIN[best.key]}`,
      sentence: `scored ${best.score} out of 100 for ${PLAIN[best.key]}`,
    };
  }
  if (c?.own_rating != null && c.own_rating >= 4.3 && c.own_reviews) {
    const n = c.own_reviews.toLocaleString('en-US');
    return { stat: `${c.own_rating} stars`, line: `across ${n} Google reviews`, sentence: `holds ${c.own_rating} stars across ${n} Google reviews` };
  }
  return null;
}

/** Draws the 1200 x 627 share card and returns it as a PNG data URL. */
async function drawCard(hotel: string, place: string, h: Highlight | null): Promise<string> {
  try { await document.fonts.ready; } catch { /* draw with the fallback font */ }
  const W = 1200, H = 627;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const sans = `'Schibsted Grotesk Variable', -apple-system, 'Segoe UI', sans-serif`;
  g.fillStyle = '#F5F5F7'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#5B5BD6'; g.fillRect(0, 0, 18, H);

  // hg mark
  g.beginPath(); g.roundRect(84, 72, 64, 64, 12); g.fill();
  g.fillStyle = '#FFFFFF'; g.font = `600 34px ${sans}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('hg', 116, 116);
  g.textAlign = 'left';
  g.fillStyle = '#14151A'; g.font = `650 30px ${sans}`; g.fillText('hotelgrader', 166, 115);

  if (h) {
    g.font = `700 170px ${sans}`; g.fillStyle = '#14151A';
    g.fillText(h.stat, 80, 360);
    g.font = `500 40px ${sans}`; g.fillStyle = 'rgba(20,21,26,0.66)';
    g.fillText(h.line, 86, 425);
    g.font = `650 40px ${sans}`; g.fillStyle = '#14151A';
    g.fillText(hotel, 86, 520, W - 170);
    if (place) { g.font = `400 28px ${sans}`; g.fillStyle = 'rgba(20,21,26,0.66)'; g.fillText(place, 86, 562); }
  } else {
    g.font = `700 92px ${sans}`; g.fillStyle = '#14151A';
    g.fillText('What grade does', 80, 320);
    g.fillText('your hotel get?', 80, 425);
    g.font = `400 34px ${sans}`; g.fillStyle = 'rgba(20,21,26,0.66)';
    g.fillText('A free report card on how guests find and book it.', 86, 510);
  }
  g.font = `500 26px 'IBM Plex Mono', ui-monospace, monospace`; g.fillStyle = '#5B5BD6'; g.textAlign = 'right';
  g.fillText('hotelgrader.com', W - 80, 115);
  return cv.toDataURL('image/png');
}

function SharePanel({ audit, onShared }: { audit: Audit; onShared: () => void }) {
  const highlight = pickHighlight(audit);
  const [mode, setMode] = useState<'highlight' | 'challenge'>(highlight ? 'highlight' : 'challenge');
  const [image, setImage] = useState('');
  const [copied, setCopied] = useState(false);
  const place = [audit.city, audit.state].filter(Boolean).join(', ');
  const active = mode === 'highlight' ? highlight : null;

  const text = active
    ? `${audit.hotelName} ${active.sentence}. I just ran our free marketing report card on hotelgrader. See how your hotel scores: ${SITE}`
    : `I just graded my hotel’s marketing on hotelgrader. It’s free and takes two minutes. What does yours get? ${SITE}`;

  useEffect(() => {
    let live = true;
    drawCard(audit.hotelName, place, active).then((url) => { if (live) setImage(url); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, audit.hotelName]);

  const share = () => {
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    onShared();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* select and copy by hand */ }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 items-start">
      <div>
        <p className="text-ink-60">Share on LinkedIn to open it. Your grade stays private: the post is your best result, or no result at all.</p>
        {highlight && (
          <div className="flex gap-2 mt-5" role="group" aria-label="What to share">
            <button type="button" className={`btn ${mode === 'highlight' ? 'btn--on' : ''}`} aria-pressed={mode === 'highlight'} onClick={() => setMode('highlight')}>our best result</button>
            <button type="button" className={`btn ${mode === 'challenge' ? 'btn--on' : ''}`} aria-pressed={mode === 'challenge'} onClick={() => setMode('challenge')}>just a challenge</button>
          </div>
        )}
        <p className="mt-5 text-[14px] border-l-2 border-edge-strong pl-4">{text}</p>
        <div className="flex flex-wrap gap-2.5 mt-6">
          <button type="button" className="btn btn--primary" onClick={share}>share on LinkedIn</button>
          <button type="button" className="btn" onClick={copy}>{copied ? 'copied' : 'copy the text'}</button>
        </div>
        <p className="meta mt-3">You can edit the post before it goes out.</p>
      </div>
      <div>
        {image && <img src={image} alt={active ? `${audit.hotelName}: ${active.stat} ${active.line}` : 'What grade does your hotel get?'} className="w-full rounded border border-edge-strong" />}
        {image && <p className="meta mt-2"><a href={image} download="hotelgrader.png">Download this image</a> to attach to your post.</p>}
      </div>
    </div>
  );
}

type Step = { action?: string; details?: string };
type Full = Metric & { actionSteps?: Step[] };
type Finding = Full & { score: number; section: string };

const GOOD = 85; // B+ and up counts as working well

const SHORT: Record<string, string> = {
  searchAndAI: 'AI & search', digitalPresence: 'Website', reputation: 'Reputation', socialMedia: 'Social',
  advertising: 'Advertising', booking: 'Booking', competitive: 'Competitive',
};

const firstStep = (m: Full) => (m.actionSteps ?? []).find((s) => s.action);
const tidy = (t?: string) => (t ?? '').replace(/[.:]\s*$/, '');

/** Three big counts: how many findings need fixing, improving, or nothing. */
function Tally({ findings }: { findings: Finding[] }) {
  const fix = findings.filter((f) => f.score < 70).length;
  const improve = findings.filter((f) => f.score >= 70 && f.score < GOOD).length;
  const good = findings.filter((f) => f.score >= GOOD).length;
  const cell = (n: number, label: string, tone: string) => (
    <div>
      <div className={`num text-[40px] leading-none font-semibold ${tone}`}>{n}</div>
      <div className="meta mt-1.5">{label}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-4">
      {cell(fix, 'to fix', 'grade--f')}
      {cell(improve, 'to improve', 'grade--c')}
      {cell(good, 'working well', 'grade--a')}
    </div>
  );
}

function Overview({ audit, findings }: { audit: Audit; findings: Finding[] }) {
  const radar = pillars.map((p) => ({ label: SHORT[p.key], score: audit.categories[p.key]?.score ?? null }));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
      <Radar items={radar} />
      <div>
        <Tally findings={findings} />
        <div className="mt-7">
          <DotStrip scores={findings} />
          <p className="meta mt-2">Each dot is one finding, placed by its score. Left needs work, right is working.</p>
        </div>
      </div>
    </div>
  );
}

function StartHere({ findings }: { findings: Finding[] }) {
  const worst = findings.filter((f) => f.score < GOOD).slice(0, 5);
  if (!worst.length) return null;
  return (
    <div className="mt-9 pt-7 border-t border-edge">
      <h3 className="label label--ink mb-4">Start here</h3>
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
    </div>
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
    <div className="mt-9 pt-7 border-t border-edge grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
      <div>
        <h3 className="label label--ink mb-3">You against the market</h3>
        <p className="text-ink-60 text-[14px]">
          {higher === 0 ? 'No named competitor has a higher guest rating.' : `${higher} of ${rivals.length} named competitors have a higher guest rating.`}{' '}
          {louder === 0 ? 'None has more reviews.' : `${louder} ${louder === 1 ? 'has' : 'have'} more reviews.`}
        </p>
        <p className="meta mt-3">Higher is a better rating. Further right is more reviews. Numbers match the market table above.</p>
      </div>
      <MarketScatter points={points} />
    </div>
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

export default function FullReport({ audit, unlocked, onUnlock }: { audit: Audit; unlocked: boolean; onUnlock: () => void }) {
  const top = useRef<HTMLElement>(null);
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
    <section ref={top} className="panel mt-6 px-5 sm:px-8 py-7">
      <h2 className="headline text-[22px] sm:text-[26px]">The full report</h2>
      <p className="text-ink-60 mt-1.5 mb-7">
        {findings.length} findings across seven sections, with what to do about each one.
      </p>

      <Overview audit={audit} findings={findings} />

      {!unlocked ? (
        <div className="mt-9 pt-7 border-t border-edge no-print">
          <SharePanel audit={audit} onShared={() => { onUnlock(); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />
        </div>
      ) : (
        <>
          <StartHere findings={findings} />
          <Market audit={audit} />

          <div className="mt-9">
            {groups.filter((g) => g.measured.length > 0).map((g, i) => {
              const work = g.measured.filter((m) => m.score < GOOD);
              const good = g.measured.filter((m) => m.score >= GOOD);
              return (
                <details key={g.p.key} open={i === 0} className="border-t border-edge">
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
          </div>

          {missing.length > 0 && (
            <p className="meta mt-6 pt-5 border-t border-edge max-w-[80ch]">
              Not measured this scan, so left out: {missing.join(', ')}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
