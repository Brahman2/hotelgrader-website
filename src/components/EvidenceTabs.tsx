import { useEffect, useRef, useState } from 'react';

// Interactive exhibit browser. Four channels, four pieces of evidence.
// Auto-advances until the visitor takes the wheel. GEO exhibit types the
// traveler prompt live, then reveals the answer that leaves you out.

const HEX: Record<string, string> = {
  good: '#1E7F4B',
  warn: '#D98A1C',
  attention: '#C6453D',
};

const PROMPT = 'best boutique hotels in the hudson valley';
const ANSWERS = [
  { name: '1. The Lark House', note: 'recommended', tone: 'good' },
  { name: '2. Ardmore & Vine', note: 'recommended', tone: 'good' },
  { name: '3. Cedar Hollow Inn', note: 'recommended', tone: 'good' },
  { name: 'The Riverton Hotel', note: 'not mentioned', tone: 'attention' },
];

const TABS = [
  {
    key: 'geo',
    label: 'AI',
    sub: 'GEO & AI VISIBILITY',
    grade: 'D',
    tone: 'attention',
    punch: 'Ask ChatGPT for a hotel here. It won’t say yours.',
    stat: 'Mentioned by 1 of 4 AI engines. Your comp set averages 3.',
    delta: 'BOTTOM 25% OF COMP SET',
    fix: 'The dashboard drafts the entity pages and schema that get AI engines citing you.',
  },
  {
    key: 'paid',
    label: 'ADS',
    sub: 'ADVERTISING & BRAND',
    grade: 'C+',
    tone: 'warn',
    punch: 'You’re buying clicks the OTAs already own.',
    stat: 'Two OTA ads sit above your own name and resell your rooms.',
    delta: '−3 PTS VS LAST MONTH',
    fix: 'The action queue shows which brand terms to defend and what they cost to win back.',
  },
  {
    key: 'rep',
    label: 'REP',
    sub: 'REPUTATION',
    grade: 'B+',
    tone: 'good',
    punch: 'Reviews are strong. Three are still waiting on you.',
    stat: '4.7 stars across 1,284 reviews. 88% reply rate, 12-day lag.',
    delta: '+0.2 VS LAST MONTH',
    fix: 'Reply templates and a response-lag alarm clear the review queue inside a week.',
  },
  {
    key: 'soc',
    label: 'SOC',
    sub: 'SOCIAL MEDIA',
    grade: 'B',
    tone: 'good',
    punch: 'Plenty of posting. Not much engagement.',
    stat: '4.2 posts a week at 0.8% engagement. Comp set runs 2.4%.',
    delta: '+0.6 VS COMP SET',
    fix: 'A content plan modeled on the posts your comp set actually wins with.',
  },
] as const;

const CYCLE_MS = 5200;

export default function EvidenceTabs() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [visit, setVisit] = useState(0); // bumps every activation, restarts typewriter
  const [typed, setTyped] = useState(0);
  const [shown, setShown] = useState(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const goTo = (i: number, viaUser: boolean) => {
    setActive(i);
    setVisit((v) => v + 1);
    if (viaUser) setAuto(false);
  };

  // Auto-advance
  useEffect(() => {
    if (!auto || hovered) return;
    const t = window.setTimeout(() => goTo((active + 1) % TABS.length, false), CYCLE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, auto, hovered, visit]);

  // Typewriter for the GEO exhibit
  useEffect(() => {
    clearTimers();
    setTyped(0);
    setShown(0);
    if (TABS[active].key !== 'geo') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped(PROMPT.length);
      setShown(ANSWERS.length);
      return;
    }
    for (let c = 1; c <= PROMPT.length; c++) {
      timers.current.push(window.setTimeout(() => setTyped(c), 300 + c * 22));
    }
    const answersStart = 300 + PROMPT.length * 22 + 260;
    for (let a = 1; a <= ANSWERS.length; a++) {
      timers.current.push(window.setTimeout(() => setShown(a), answersStart + a * 170));
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, visit]);

  const tab = TABS[active];
  const hex = HEX[tab.tone];

  return (
    <div
      className="border border-edge rounded overflow-hidden bg-bone"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tab rail */}
      <div
        role="tablist"
        aria-label="Evidence by channel"
        className="grid grid-cols-4 bg-paper border-b border-edge"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') goTo((active + 1) % TABS.length, true);
          if (e.key === 'ArrowLeft') goTo((active - 1 + TABS.length) % TABS.length, true);
        }}
      >
        {TABS.map((t, i) => {
          const isActive = i === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => goTo(i, true)}
              className={`relative text-left px-4 py-3 ${isActive ? '' : 'evtab'}`}
              style={{ border: 'none', borderLeft: i > 0 ? '1px solid #E6E6E1' : 'none', cursor: 'pointer', background: isActive ? '#F4F2EC' : undefined }}
            >
              <span className="meta tabular block" style={{ color: isActive ? '#26221B' : undefined }}>
                {t.label}
              </span>
              <span className="meta mt-1 hidden sm:block" style={{ fontSize: 9 }}>{t.sub}</span>
              {isActive && auto && (
                <span
                  key={`${t.key}-${visit}`}
                  className="absolute bottom-0 left-0 h-[2px] bg-indigo"
                  style={{
                    width: 0,
                    animation: `hg-progress ${CYCLE_MS}ms linear forwards`,
                    animationPlayState: hovered ? 'paused' : 'running',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Panel — fixed min-height so tab switches don't jump the layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px]">
        <div className="p-5 sm:p-7 md:border-r border-edge md:min-h-[430px] flex flex-col justify-center">
          {tab.key === 'geo' && (
            <div className="border border-edge rounded overflow-hidden max-w-[560px]">
              <div className="px-4 py-2.5 border-b border-edge bg-paper meta tabular">ChatGPT, traveler prompt, live</div>
              <div className="px-4 py-4">
                <p className="text-[14px] text-ink font-medium min-h-[21px]">
                  “{PROMPT.slice(0, typed)}”
                  {typed < PROMPT.length && <span className="hg-caret-block" aria-hidden="true" />}
                </p>
                <div className="mt-4 space-y-2.5">
                  {ANSWERS.map((a, i) => (
                    <div
                      key={a.name}
                      className={`flex items-baseline justify-between ${i === ANSWERS.length - 1 ? 'pt-2.5 border-t border-edge' : ''}`}
                      style={{
                        opacity: shown > i ? 1 : 0,
                        transform: shown > i ? 'none' : 'translateY(3px)',
                        transition: 'opacity 180ms cubic-bezier(0.2,0,0,1), transform 180ms cubic-bezier(0.2,0,0,1)',
                      }}
                    >
                      <span className={`text-[14px] tabular ${a.tone === 'attention' ? 'font-medium' : ''}`} style={{ color: a.tone === 'attention' ? '#C6453D' : '#26221B' }}>
                        {a.name}
                      </span>
                      <span className="meta tabular" style={{ color: HEX[a.tone] }}>{a.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab.key === 'paid' && (
            <div className="border border-edge rounded overflow-hidden max-w-[560px]">
              <div className="px-4 py-2.5 border-b border-edge bg-paper meta tabular">GOOGLE · “riverton hotel hudson valley”</div>
              <div className="px-4 py-4 space-y-3.5">
                <div>
                  <div className="meta tabular">Ad, Booking.com</div>
                  <div className="text-[13px] text-indigo mt-0.5">The Riverton, Hudson Valley. Book Now</div>
                </div>
                <div>
                  <div className="meta tabular">Ad, Expedia.com</div>
                  <div className="text-[13px] text-indigo mt-0.5">Riverton Hotel. Member Prices</div>
                </div>
                <div className="pt-3 border-t border-edge">
                  <div className="meta tabular" style={{ color: '#1E7F4B' }}>YOU · POSITION 3 · RIVERTON.COM</div>
                  <div className="text-[13px] text-indigo mt-0.5">The Riverton Hotel | Official Site</div>
                </div>
              </div>
            </div>
          )}

          {tab.key === 'rep' && (
            <div className="border border-edge rounded overflow-hidden max-w-[560px]">
              <div className="px-4 py-2.5 border-b border-edge bg-paper flex items-baseline justify-between">
                <span className="meta tabular">GOOGLE · TRIPADVISOR · OTA</span>
                <span className="text-[13px] font-medium tabular">4.7 ★ · 1,284</span>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink">“Best stay in the valley.”</span>
                  <span className="meta tabular" style={{ color: '#1E7F4B' }}>replied · 4h</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink">“Room was cold. Nobody answered.”</span>
                  <span className="meta tabular" style={{ color: '#C6453D' }}>open · 12d</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink">“Incredible breakfast.”</span>
                  <span className="meta tabular" style={{ color: '#1E7F4B' }}>replied · 1d</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink">“Would come back twice over.”</span>
                  <span className="meta tabular" style={{ color: '#C6453D' }}>open · 6d</span>
                </div>
              </div>
            </div>
          )}

          {tab.key === 'soc' && (
            <div className="max-w-[560px]">
              <div className="border border-edge rounded overflow-hidden">
                <div className="px-4 py-2.5 border-b border-edge bg-paper meta tabular">INSTAGRAM · ENGAGEMENT PER POST · LAST 9</div>
                <div className="px-4 pt-6 pb-3">
                  {/* Chart: 9 post bars against the comp-set reference line */}
                  <div className="relative h-[170px]">
                    {/* comp-set line at 2.4% */}
                    <div
                      className="absolute inset-x-0 border-t border-dashed"
                      style={{ top: `${100 - (2.4 / 2.6) * 100}%`, borderColor: 'rgba(38,34,27,0.35)' }}
                    >
                      <span className="meta tabular absolute right-0 -top-4">COMP SET 2.4%</span>
                    </div>
                    {/* bars */}
                    <div className="absolute inset-0 flex items-end justify-between gap-[6px] sm:gap-2">
                      {[1.4, 1.1, 0.9, 0.8, 0.7, 0.8, 0.6, 0.7, 0.5].map((eng, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="meta tabular mb-1" style={{ fontSize: 9 }}>{eng.toFixed(1)}</span>
                          <div
                            className="w-full rounded-sm border border-edge"
                            style={{
                              height: `${(eng / 2.6) * 100}%`,
                              background: eng >= 1 ? 'rgba(30,127,75,0.30)' : 'rgba(198,69,61,0.22)',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 meta tabular" style={{ fontSize: 9 }}>
                    <span>9 POSTS AGO</span>
                    <span>LATEST</span>
                  </div>
                </div>
                <div className="px-4 py-2.5 border-t border-edge meta tabular">
                  EVERY POST BELOW THE COMP LINE · AVG 0.8% · 4.2 POSTS / WK
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Verdict rail */}
        <div className="p-5 sm:p-7 border-t md:border-t-0 border-edge flex flex-col justify-center">
          <span className="grade tabular text-[72px] leading-none" style={{ color: hex }}>{tab.grade.charAt(0)}<span className="grade-mod">{tab.grade.slice(1)}</span></span>
          <p className="text-[15px] font-medium text-ink mt-4 leading-snug">{tab.punch}</p>
          <p className="text-[13px] text-ink-60 mt-2 leading-relaxed">{tab.stat}</p>
          <span className="meta tabular mt-3" style={{ color: hex }}>{tab.delta}</span>
          <div className="mt-5 pt-4 border-t border-edge">
            <span className="label" style={{ fontSize: 10 }}>The fix</span>
            <p className="text-[13px] text-ink mt-1.5 leading-relaxed">{tab.fix}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
