import { useEffect, useState } from 'react';

interface Props {
  grade?: string;
  tone?: 'good' | 'warn' | 'attention';
  /** Pixel size of the grade glyph */
  size?: number;
}

/**
 * Fades the Grade in fully formed — no scale, no spring, no bounce.
 * The brand bible says the Grade never animates other than to appear.
 */
export default function GradeReveal({ grade = 'B+', tone = 'good', size = 220 }: Props) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <span
      className={`grade grade--${tone} block tabular`}
      style={{
        fontSize: size,
        lineHeight: 0.85,
        opacity: shown ? 1 : 0,
        transition: 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {grade}
    </span>
  );
}
