import { useEffect, useState } from 'react';
import { pillars } from '../content/pillars';

// The dashboard, redesigned. This is the marketing site's best version of the
// Pro product: four surfaces, sample data consistent with the rest of the site.
// It doubles as the design direction for the app itself.

const CYCLE_MS = 6200;

const TABS = [
  { key: 'overview', label: 'OVERVIEW' },
  { key: 'plan', label: 'ACTION PLAN' },
  { key: 'comp', label: 'COMPETITORS' },
  { key: 'iq', label: 'ASK HOTELIQ' },
] as const;

const PLAN_ROWS = [
  { n: '01', fix: 'Publish entity pages and schema for AI engines', owner: 'MARKETING', impact: 'AI 45 → 70 TARGET', effort: 'MED · 4-6 WKS', status: 'IN PROGRESS', featured: true },
  { n: '02', fix: 'Reallocate paid spend to brand defense', owner: 'MARKETING', impact: '+9 ADS PTS', effort: 'LOW · 2-3 WKS', status: 'QUEUED' },
  { n: '03', fix: 'Post-checkout review automation via PMS trigger', owner: 'FRONT DESK', impact: '+0.3 ★ TRAJECTORY', effort: 'LOW · 6-8 WKS', status: 'QUEUED' },
  { n: '04', fix: 'Mobile checkout test on the booking engine', owner: 'REVENUE MGR', impact: '+3-5% DIRECT CVR', effort: 'MED · 4-6 WKS', status: 'QUEUED' },
];

const COMP_ROWS = [
  { rank: '#12', name: 'The Lark House', grade: 'A-', score: 91, tone: '#1E7F4B', note: 'Wins AI mentions, 4 of 4 engines' },
  { rank: '#15', name: 'Ardmore & Vine', grade: 'B+', score: 88, tone: '#1E7F4B', note: 'Outspends you on brand terms' },
  { rank: '#18', name: 'The Riverton Hotel', grade: 'B+', score: 87, tone: '#5B5BD6', note: 'Your position', you: true },
  { rank: '#22', name: 'Cedar Hollow Inn', grade: 'B', score: 84, tone: '#1E7F4B', note: 'Slower review replies, 9-day lag' },
];

export default function DashboardTour() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [visit, setVisit] = useState(0);

  const goTo = (i: number, viaUser: boolean) => {
    setActive(i);
    setVisit((v) => v + 1);
    if (viaUser) setAuto(false);
  };

  useEffect(() => {
    if (!auto || hovered) return;
    const t = window.setTimeout(() => goTo((active + 1) % TABS.length, false), CYCLE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, auto, hovered, visit]);

  const tab = TABS[active];

  return (
    <div
      className="border border-edge rounded overflow-hidden bg-bone"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* App chrome */}
      <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-edge bg-paper">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-good" />
          <span className="meta tabular">THE RIVERTON HOTEL · PRO</span>
        </div>
        <span className="meta tabular hidden sm:inline">LAST SCAN · TODAY 6:00 AM · NEXT · ON DEMAND</span>
      </div>

      {/* Tab rail */}
      <div role="tablist" aria-label="Dashboard surfaces" className="grid grid-cols-4 bg-paper border-b border-edge">
        {TABS.map((t, i) => {
          const isActive = i === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => goTo(i, true)}
              className={`relative text-left px-4 py-3 ${isActive ? '' : 'evtab'}`}
              style={{ border: 'none', borderLeft: i > 0 ? '1px solid #E6E6E1' : 'none', cursor: 'pointer', background: isActive ? '#F7F4F0' : undefined }}
            >
              <span className="meta tabular block" style={{ color: isActive ? '#0B1220' : undefined }}>{t.label}</span>
              {isActive && auto && (
                <span
                  key={`${t.key}-${visit}`}
                  className="absolute bottom-0 left-0 h-[2px] bg-indigo"
                  style={{ width: 0, animation: `hg-progress ${CYCLE_MS}ms linear forwards`, animationPlayState: hovered ? 'paused' : 'running' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="md:min-h-[430px]">
        {tab.key === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-[250px_1fr]">
            <div className="px-6 py-7 md:border-r border-b md:border-b-0 border-edge flex flex-col items-center justify-center text-center">
              <span className="label mb-3">CURRENT GRADE</span>
              <span className="grade grade--good tabular text-[84px] leading-[0.85]">B+</span>
              <p className="text-[12px] text-ink-60 mt-3 tabular">
                <span className="font-serif italic">Above market</span> · 87/100
              </p>
              <div className="w-full mt-6 pt-5 border-t border-edge">
                <svg viewBox="0 0 200 56" className="w-full" aria-hidden="true">
                  <polyline points="0,44 33,41 66,42 100,33 133,30 166,22 200,12" fill="none" stroke="#5B5BD6" strokeWidth="1.5" />
                  <circle cx="200" cy="12" r="3" fill="#5B5BD6" />
                </svg>
                <div className="flex justify-between mt-1.5">
                  <span className="meta tabular">90D AGO · 71</span>
                  <span className="meta tabular" style={{ color: '#1E7F4B' }}>TODAY · 87</span>
                </div>
              </div>
            </div>
            <div>
              {pillars.map((p, i) => (
                <div key={p.num} className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 sm:px-6 py-[9px] ${i > 0 ? 'border-t border-edge' : ''}`}>
                  <span className="text-[13px] font-medium text-ink">{p.name}</span>
                  <span className="meta tabular hidden sm:inline">{p.sample.delta.toUpperCase()}</span>
                  <span className="tabular text-[13px] font-semibold" style={{ color: p.sample.tone === 'good' ? '#1E7F4B' : p.sample.tone === 'warn' ? '#D98A1C' : '#C6453D' }}>
                    {p.sample.score}<span className="text-[10px] font-normal" style={{ color: 'rgba(11,18,32,0.4)' }}>/100</span>
                  </span>
                </div>
              ))}
              <div className="px-5 sm:px-6 py-3 border-t border-edge bg-paper">
                <span className="meta tabular" style={{ color: '#C6453D' }}>2 ALERTS · ADS SLIPPED 3 PTS · REVIEW LAG HIT 12 DAYS</span>
              </div>
            </div>
          </div>
        )}

        {tab.key === 'plan' && (
          <div>
            <ul className="list-none p-0 m-0">
              {PLAN_ROWS.map((row, i) => (
                <li key={row.n} className={`grid grid-cols-[32px_1fr_auto] items-start gap-4 px-5 sm:px-7 py-5 ${i > 0 ? 'border-t border-edge' : ''}`} style={{ background: row.featured ? '#FBF9F6' : undefined }}>
                  <span className="meta tabular pt-0.5">{row.n}</span>
                  <div>
                    <p className="text-[15px] font-medium text-ink leading-snug">{row.fix}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
                      <span className="meta tabular">{row.owner}</span>
                      <span className="meta tabular" style={{ color: '#5B5BD6' }}>{row.impact}</span>
                      <span className="meta tabular">{row.effort}</span>
                    </div>
                  </div>
                  <span className="meta tabular pt-0.5" style={{ color: row.status === 'IN PROGRESS' ? '#1E7F4B' : undefined }}>{row.status}</span>
                </li>
              ))}
            </ul>
            <div className="px-5 sm:px-7 py-3 border-t border-edge bg-paper">
              <span className="meta tabular">RANKED BY PAYBACK · RE-RANKS AFTER EVERY SCAN</span>
            </div>
          </div>
        )}

        {tab.key === 'comp' && (
          <div>
            <ul className="list-none p-0 m-0">
              {COMP_ROWS.map((row, i) => (
                <li
                  key={row.rank}
                  className={`grid grid-cols-[44px_1fr_auto] sm:grid-cols-[52px_1fr_1fr_auto] items-center gap-4 px-5 sm:px-7 py-[15px] ${i > 0 ? 'border-t border-edge' : ''}`}
                  style={{ background: row.you ? 'rgba(91,91,214,0.06)' : undefined }}
                >
                  <span className="meta tabular">{row.rank}</span>
                  <span className={`text-[14px] ${row.you ? 'font-semibold text-indigo' : 'font-medium text-ink'}`}>{row.name}</span>
                  <span className="meta tabular hidden sm:inline">{row.note.toUpperCase()}</span>
                  <span className="grade tabular text-[26px] leading-none" style={{ color: row.tone }}>{row.grade}</span>
                </li>
              ))}
            </ul>
            <div className="px-5 sm:px-7 py-3 border-t border-edge bg-paper">
              <span className="meta tabular">GAPS COMPUTED PER SECTION · SCAN ANY HOTEL, INCLUDING THEIRS</span>
            </div>
          </div>
        )}

        {tab.key === 'iq' && (
          <div className="px-5 sm:px-7 py-7">
            <div className="max-w-[620px]">
              <div className="flex justify-end">
                <div className="border border-edge rounded bg-paper px-4 py-3 max-w-[420px]">
                  <span className="label block mb-1" style={{ fontSize: 9 }}>You</span>
                  <p className="text-[14px] text-ink leading-relaxed">Where do I start if I want more direct bookings before Q4?</p>
                </div>
              </div>
              <div className="mt-4 border border-edge rounded px-4 sm:px-5 py-4">
                <span className="label block mb-2" style={{ fontSize: 9 }}>HotelIQ · grounded in your scan</span>
                <p className="text-[14px] text-ink leading-relaxed">
                  Start with AI visibility. You are mentioned by 1 of 4 engines while
                  The Lark House gets all four; entity pages and schema are 4 to 6
                  weeks of work and lift mention rate fastest. Then move paid spend
                  to brand defense: two OTAs outbid you on your own name today.
                  Both are queued with owners assigned.
                </p>
                <p className="meta tabular mt-3">
                  CITES: AI 45/100 · ADS 62/100 · COMP #18 OF 74
                  <span className="hg-caret-block" aria-hidden="true" />
                </p>
              </div>
              <p className="meta tabular mt-4">ANSWERS CITE YOUR DATA · NEVER GENERIC ADVICE</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
