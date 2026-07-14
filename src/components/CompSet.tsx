import { useEffect, useRef, useState } from 'react';

// The comp set as a skyline: 74 hotels sorted by score, tallest first.
// Hover any bar for its blind rank and grade. Toggle TODAY / AFTER FIXES to
// watch your position climb and the upside repriced at your ADR and occupancy.

interface Props {
  total?: number;
  todayRank?: number;
  fixedRank?: number;
  medianRank?: number;
}

const bandLetter = (score: number) =>
  score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 45 ? 'D' : 'F';

const bandColor = (score: number) =>
  score >= 80 ? '#1E7F4B' : score >= 45 ? '#D98A1C' : '#C6453D';

export default function CompSet({ total = 74, todayRank = 18, fixedRank = 9, medianRank = 37 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const rank = fixed ? fixedRank : todayRank;
  const youIdx = rank - 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Deterministic skyline: descending scores with a little texture
  const score = (i: number) => Math.round(96 - (i / (total - 1)) * 54 - ((i * 37) % 7) * 0.4);
  const height = (i: number) => 22 + ((score(i) - 40) / 56) * 78; // 22%..100%

  const youPct = (youIdx / (total - 1)) * 100;
  const hoverPct = hover !== null ? (hover / (total - 1)) * 100 : 0;

  return (
    <div ref={ref} className="border border-edge rounded px-5 sm:px-7 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <span className="label">Your comp set · {total} hotels</span>
        <div className="flex items-center border border-edge rounded-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setFixed(false)}
            className="meta tabular px-3 py-1.5"
            style={{
              border: 'none',
              cursor: 'pointer',
              background: !fixed ? '#26221B' : 'transparent',
              color: !fixed ? '#F4F2EC' : undefined,
              transition: 'background 120ms cubic-bezier(0.2,0,0,1)',
            }}
          >
            TODAY · #{todayRank}
          </button>
          <button
            type="button"
            onClick={() => setFixed(true)}
            className="meta tabular px-3 py-1.5 border-l border-edge"
            style={{
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              cursor: 'pointer',
              background: fixed ? '#5B5BD6' : 'transparent',
              color: fixed ? '#fff' : undefined,
              transition: 'background 120ms cubic-bezier(0.2,0,0,1)',
            }}
          >
            AFTER FIXES · #{fixedRank}
          </button>
        </div>
      </div>

      <div className="relative pt-8 pb-2" onMouseLeave={() => setHover(null)}>
        {/* YOU label slides with your rank */}
        <span
          className="absolute top-0 meta tabular font-medium"
          style={{
            left: `clamp(28px, ${youPct}%, calc(100% - 40px))`,
            transform: 'translateX(-50%)',
            color: '#5B5BD6',
            opacity: inView ? 1 : 0,
            transition: 'left 450ms cubic-bezier(0.2,0,0,1), opacity 200ms 700ms cubic-bezier(0.2,0,0,1)',
            whiteSpace: 'nowrap',
          }}
        >
          YOU · #{rank}
        </span>

        {/* hover tooltip */}
        {hover !== null && hover !== youIdx && (
          <span
            className="absolute top-0 meta tabular border border-edge rounded-sm bg-paper px-2 py-0.5 pointer-events-none"
            style={{
              left: `clamp(40px, ${hoverPct}%, calc(100% - 52px))`,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}
          >
            #{hover + 1} · {bandLetter(score(hover))} · {score(hover)}
          </span>
        )}

        {/* the skyline */}
        <div className="flex items-end justify-between gap-px h-[110px]">
          {Array.from({ length: total }, (_, i) => {
            const isYou = i === youIdx;
            const isMedian = i === medianRank - 1;
            return (
              <div
                key={i}
                onMouseEnter={() => setHover(i)}
                className="flex-1 flex items-end h-full"
                style={{ cursor: 'default' }}
              >
                <span
                  className="w-full rounded-sm"
                  style={{
                    height: `${height(i)}%`,
                    background: isYou ? '#5B5BD6' : hover === i ? 'rgba(38,34,27,0.45)' : isMedian ? 'rgba(38,34,27,0.35)' : 'rgba(38,34,27,0.16)',
                    opacity: inView ? 1 : 0,
                    transition: `opacity 160ms cubic-bezier(0.2,0,0,1) ${inView ? i * 8 : 0}ms, background 120ms cubic-bezier(0.2,0,0,1)`,
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-between mt-2 meta tabular" style={{ fontSize: 9 }}>
          <span>BEST IN SET</span>
          <span style={{ position: 'absolute', left: `${((medianRank - 1) / (total - 1)) * 100}%`, transform: 'translateX(-50%)' }}>MEDIAN</span>
          <span>#{total}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 mt-4 pt-4 border-t border-edge">
        <span className="meta tabular" style={{ color: '#5B5BD6' }}>
          {fixed ? 'TOP 12% OF THE FIELD' : 'TOP 25% OF THE FIELD'}
        </span>
        <span className="meta tabular">
          {fixed
            ? '+22% DIRECT ≈ $1.42M / YR AT CURRENT ADR & OCCUPANCY'
            : `${todayRank - 1} AHEAD OF YOU · CLOSING THE AI GAP PASSES ${todayRank - fixedRank} OF THEM`}
        </span>
      </div>
    </div>
  );
}
