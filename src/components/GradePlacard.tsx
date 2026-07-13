import { useEffect, useRef, useState } from 'react';

interface Props {
  grade?: string;
  tone?: 'good' | 'warn' | 'attention';
  score?: string;
  kicker?: string;
  /** Pixel size of the grade glyph (drives the whole placard scale). */
  size?: number;
  /** When true, the placard is present. In the hero it flips true on scan-complete. */
  stamped?: boolean;
  /** Play the one-time stamp-down when `stamped` becomes true. */
  animate?: boolean;
}

/**
 * The grade placard: a letterpress inspection stamp pressed into paper.
 * The site's single memorable object, and its single orchestrated motion —
 * it stamps down once when the scan completes (spring, one press, then rests).
 * Respects prefers-reduced-motion via the CSS animation guard.
 */
export default function GradePlacard({
  grade = 'B+',
  tone = 'good',
  score,
  kicker = 'hotelgrader',
  size = 104,
  stamped = true,
  animate = false,
}: Props) {
  const [play, setPlay] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!stamped) {
      firedRef.current = false;
      setPlay(false);
      return;
    }
    if (animate && !firedRef.current) {
      firedRef.current = true;
      const t = setTimeout(() => setPlay(true), 30);
      return () => clearTimeout(t);
    }
  }, [stamped, animate]);

  return (
    <span
      className={`placard ${play ? 'placard--stamp' : ''}`}
      style={{ fontSize: size, opacity: stamped ? 1 : 0 }}
      role="img"
      aria-label={`Grade ${grade}${score ? `, ${score}` : ''}`}
    >
      {kicker && <span className="placard-kicker" aria-hidden="true">{kicker}</span>}
      <span className={`placard-grade placard-grade--${tone} tabular`} aria-hidden="true">{grade}</span>
      {score && <span className="placard-score" aria-hidden="true">{score}</span>}
    </span>
  );
}
