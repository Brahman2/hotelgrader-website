import { useEffect, useState } from 'react';
import { pillars } from '../content/pillars';
import BenchmarkBar from './BenchmarkBar';

// Hero scan theater. Runs the 7-section audit live in the product's own order:
// rows flip QUEUED -> RUN -> grade, a terminal log narrates, then the master
// grade lands and the banded position scale slides to your spot. Re-runnable.

const HEX: Record<string, string> = {
  good: '#1E7F4B',
  warn: '#D98A1C',
  attention: '#C6453D',
};

const ROW_LABEL: Record<string, string> = {
  AI: 'AI VISIBILITY',
  WEB: 'WEBSITE',
  REP: 'REPUTATION',
  SOC: 'SOCIAL',
  ADS: 'ADS & BRAND',
  BKG: 'BOOKING',
  COMP: 'COMPETITIVE',
};

const STEP_MS = 380;

const LOGS = [
  'ai · asking chatgpt, gemini, perplexity, copilot · 1 of 4 mention you',
  'web · lighthouse run · performance 94 · mobile 91',
  'rep · 4.7 stars · reply rate 88% · lag 12 days',
  'soc · 4.2 posts per week · engagement 0.8%',
  'ads · 2 ota ads above your own name · 62% share of voice',
  'bkg · ota share 58% · direct 38%',
  'competitive · rank #18 of 74 · top 25%',
];
const FINAL_LOG = 'grade computed · 11.2s · verified by 38 sources · 7 fixes queued';

interface Prospect {
  name: string;
  city: string;
  state: string;
}

export default function HeroDemo() {
  const [step, setStep] = useState(-1);
  const [runId, setRunId] = useState(0);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const total = pillars.length;
  const done = step >= total;

  // The live search announces whichever hotel is on deck
  useEffect(() => {
    const onProspect = (e: Event) => setProspect((e as CustomEvent).detail);
    window.addEventListener('hg:prospect', onProspect);
    return () => window.removeEventListener('hg:prospect', onProspect);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(total);
      return;
    }
    setStep(0);
    const iv = window.setInterval(() => {
      setStep((s) => {
        if (s >= total) {
          window.clearInterval(iv);
          return s;
        }
        return s + 1;
      });
    }, STEP_MS);
    return () => window.clearInterval(iv);
  }, [runId, total]);

  const prospectLine = prospect
    ? `next scan: ${prospect.name.toLowerCase()}${prospect.city ? ` · ${prospect.city.toLowerCase()}${prospect.state ? `, ${prospect.state}` : ''}` : ''} · press get the report`
    : null;
  const logLine = done
    ? (prospectLine ?? FINAL_LOG)
    : step >= 0 && step < LOGS.length
      ? LOGS[step]
      : 'resolving the riverton hotel';

  return (
    <div className="mt-12 mx-auto max-w-[880px] border border-edge rounded bg-bone text-left overflow-hidden">

      {/* Title bar */}
      <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-edge bg-paper">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{
              background: done ? '#1E7F4B' : '#5B5BD6',
              animation: done ? 'none' : 'hg-pulse 1s ease-in-out infinite',
            }}
          />
          <span className="meta tabular">{done ? 'SCAN COMPLETE · THE RIVERTON HOTEL' : 'SAMPLE SCAN · THE RIVERTON HOTEL'}</span>
        </div>
        <button
          type="button"
          onClick={() => setRunId((r) => r + 1)}
          disabled={!done}
          className={`meta tabular ${done ? 'hover:underline' : ''}`}
          style={{
            border: 0,
            background: 'none',
            padding: 0,
            cursor: done ? 'pointer' : 'default',
            color: done ? '#5B5BD6' : 'rgba(11,18,32,0.4)',
          }}
        >
          {done ? 'RE-RUN SCAN' : 'SCANNING…'}
        </button>
      </div>

      {/* Body: grade left, section rows right */}
      <div className="grid grid-cols-1 sm:grid-cols-[236px_1fr]">

        <div className="relative flex flex-col items-center justify-center px-6 py-8 sm:py-6 border-b sm:border-b-0 sm:border-r border-edge min-h-[190px]">
          <span className="label mb-3">CURRENT GRADE</span>
          <span
            className="grade grade--good tabular leading-[0.85] text-[96px] sm:text-[104px]"
            style={{ opacity: done ? 1 : 0, transition: 'opacity 180ms cubic-bezier(0.2,0,0,1)' }}
          >
            B+
          </span>
          <p
            className="text-[12px] text-ink-60 mt-3 tabular"
            style={{ opacity: done ? 1 : 0, transition: 'opacity 180ms 80ms cubic-bezier(0.2,0,0,1)' }}
          >
            <span className="font-serif italic">Above market</span> · 87/100 · <span className="whitespace-nowrap">#18 of 74</span>
          </p>
          {!done && (
            <span className="meta tabular absolute inset-0 flex items-center justify-center text-ink-40">
              computing…
            </span>
          )}
        </div>

        <div>
          {pillars.map((p, i) => {
            const rowDone = step > i;
            const running = step === i;
            const hex = HEX[p.sample.tone];
            return (
              <div
                key={p.num}
                className={`grid grid-cols-[104px_1fr_56px] items-center gap-3 px-4 sm:px-5 py-[8.5px] ${i > 0 ? 'border-t border-edge' : ''}`}
              >
                <span className="meta tabular" style={{ color: rowDone ? '#0B1220' : undefined, fontSize: 10 }} title={p.name}>
                  {ROW_LABEL[p.short] ?? p.short}
                </span>

                <div className="relative h-[5px] bg-paper border border-edge rounded-sm overflow-hidden">
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: rowDone ? `${p.sample.position}%` : '0%',
                      background: hex,
                      opacity: 0.35,
                      transition: 'width 420ms cubic-bezier(0.2,0,0,1)',
                    }}
                  />
                </div>

                <span className="text-right">
                  {rowDone ? (
                    <span className="tabular text-[13px] font-semibold leading-none" style={{ color: hex }}>
                      {p.sample.score}
                      <span className="text-[10px] font-normal" style={{ color: 'rgba(11,18,32,0.4)' }}>/100</span>
                    </span>
                  ) : (
                    <span
                      className="meta tabular"
                      style={
                        running
                          ? { color: '#5B5BD6', animation: 'hg-pulse 0.8s ease-in-out infinite' }
                          : undefined
                      }
                    >
                      {running ? 'RUN' : '·'}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Position scale — banded, like the live report */}
      <div
        className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-5 px-5 sm:px-6 py-4 border-t border-edge"
        style={{ opacity: done ? 1 : 0.3, transition: 'opacity 200ms cubic-bezier(0.2,0,0,1)' }}
      >
        <BenchmarkBar immediate showHeader={false} position={done ? 78 : 0} compMedian={50} />
        <div className="text-left sm:text-right sm:pb-5">
          <span className="label" style={{ fontSize: 10 }}>Revenue impact</span>
          <div className="text-[22px] font-semibold tabular text-good leading-tight">+22%</div>
          <div className="meta tabular">≈ $1.42M / YR</div>
        </div>
      </div>

      {/* Terminal log */}
      <div className="px-5 sm:px-6 py-2.5 border-t border-edge bg-paper">
        <span
          className="meta tabular"
          style={{ color: done && prospectLine ? '#5B5BD6' : 'rgba(11,18,32,0.6)' }}
        >
          {'>'} {logLine}
        </span>
        {(!done || !!prospectLine) && <span className="hg-caret-block" aria-hidden="true" />}
      </div>
    </div>
  );
}
