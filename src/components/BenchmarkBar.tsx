import { useEffect, useRef, useState } from 'react';

// Banded F-to-A position scale, matching the live report's "YOUR POSITION"
// treatment: five tinted bands, the active band outlined in ink, a dot marking
// your exact position, captions under the rail.

interface Props {
  /** 0-100 position (higher is better) */
  position?: number;
  compMedian?: number;
  /** Render the label row above the scale */
  showHeader?: boolean;
  /** Skip the entrance animation (parent drives its own reveal) */
  immediate?: boolean;
}

const BANDS = [
  { letter: 'F', tint: 'rgba(198, 69, 61, 0.08)',  text: '#C6453D' },
  { letter: 'D', tint: 'rgba(217, 138, 28, 0.10)', text: '#D98A1C' },
  { letter: 'C', tint: 'rgba(217, 138, 28, 0.06)', text: '#D98A1C' },
  { letter: 'B', tint: 'rgba(30, 127, 75, 0.07)',  text: '#1E7F4B' },
  { letter: 'A', tint: 'rgba(30, 127, 75, 0.11)',  text: '#1E7F4B' },
];

export default function BenchmarkBar({
  position = 78,
  compMedian = 50,
  showHeader = true,
  immediate = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(immediate);

  useEffect(() => {
    if (immediate) { setLive(true); return; }
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setLive(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setLive(true); io.disconnect(); } },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [immediate]);

  const activeIdx = Math.min(4, Math.floor(position / 20));

  return (
    <div ref={ref}>
      {showHeader && (
        <div className="flex items-baseline justify-between mb-3">
          <span className="label">Your position</span>
          <span className="meta tabular">YOU {position}P · COMP MEDIAN {compMedian}P</span>
        </div>
      )}

      <div className="relative">
        <div className="grid grid-cols-5 h-9">
          {BANDS.map((b, i) => (
            <div
              key={b.letter}
              className="relative flex items-center justify-center"
              style={{
                background: b.tint,
                border: i === activeIdx && live ? '1px solid #26221B' : '1px solid transparent',
                borderRadius: i === activeIdx ? 4 : 0,
                transition: 'border-color 180ms cubic-bezier(0.2,0,0,1)',
              }}
            >
              <span className="tabular text-[12px] font-medium" style={{ color: b.text, letterSpacing: '0.08em' }}>
                {b.letter}
              </span>
            </div>
          ))}
        </div>

        {/* your dot, riding the top edge. Indigo means "you" across the site. */}
        <span
          className="absolute -top-[5px] -translate-x-1/2 h-[9px] w-[9px] rounded-sm"
          style={{
            left: `${live ? position : 0}%`,
            background: '#5B5BD6',
            opacity: live ? 1 : 0,
            transition: 'left 600ms cubic-bezier(0.2,0,0,1), opacity 180ms cubic-bezier(0.2,0,0,1)',
          }}
          title="Your position"
        />
        {/* comp median tick */}
        <span
          className="absolute -bottom-[3px] -translate-x-1/2 h-[7px] w-px bg-edge-strong"
          style={{ left: `${compMedian}%` }}
          title="Comp median"
        />
      </div>

      <div className="flex justify-between mt-2 meta tabular">
        <span>significantly below</span>
        <span>at market</span>
        <span>top tier</span>
      </div>
    </div>
  );
}
