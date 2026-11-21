import { gradeTone, letterFor } from '../lib/hg';

// Small SVG charts for the full report. Every mark is drawn from scan data;
// colours come from the theme's A-F grade colours via the .grade--x classes.

export const toneFor = (score: number | null | undefined) => gradeTone(letterFor(score ?? null));

/** A score as a ring: the arc fills clockwise from the top. */
export function Ring({ score, size = 56, label }: { score: number | null; size?: number; label?: string }) {
  const r = 17, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score ?? 0));
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" role="img" aria-label={label ?? `${score ?? 'no'} out of 100`}
      className={`shrink-0 ${toneFor(score)}`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--edge-strong)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="butt"
        strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 22 22)" />
      <text x="22" y="26.2" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-num)">{score ?? '-'}</text>
    </svg>
  );
}

/** Seven section scores on a radar. Further from the centre is better. */
export function Radar({ items }: { items: { label: string; score: number | null }[] }) {
  const R = 78, n = items.length;
  const at = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [Math.cos(a) * R * (v / 100), Math.sin(a) * R * (v / 100)] as const;
  };
  const shape = items.map((it, i) => at(i, it.score ?? 0).map((p) => p.toFixed(1)).join(',')).join(' ');
  return (
    <svg viewBox="-150 -112 300 224" className="w-full h-auto" role="img"
      aria-label={`Section scores: ${items.map((i) => `${i.label} ${i.score ?? 'not scored'}`).join(', ')}`}>
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} fill="none" stroke="var(--edge-strong)" strokeWidth={v === 100 ? 1 : 0.6}
          points={items.map((_, i) => at(i, v).map((p) => p.toFixed(1)).join(',')).join(' ')} />
      ))}
      {items.map((_, i) => { const [x, y] = at(i, 100); return <line key={i} x2={x} y2={y} stroke="var(--edge-strong)" strokeWidth="0.6" />; })}
      <polygon points={shape} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
      {items.map((it, i) => {
        const [x, y] = at(i, it.score ?? 0);
        const [lx, ly] = at(i, 122);
        return (
          <g key={it.label}>
            <circle cx={x} cy={y} r="4" className={toneFor(it.score)} fill="currentColor" stroke="var(--field)" strokeWidth="1.5" />
            <text x={lx} y={ly - 2} textAnchor={Math.abs(lx) < 12 ? 'middle' : lx > 0 ? 'start' : 'end'} fontSize="9.5" fill="var(--ink-60)" fontFamily="var(--font)">{it.label}</text>
            <text x={lx} y={ly + 10} textAnchor={Math.abs(lx) < 12 ? 'middle' : lx > 0 ? 'start' : 'end'} fontSize="11" fontWeight="600"
              className={toneFor(it.score)} fill="currentColor" fontFamily="var(--font-num)">{it.score ?? '-'}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Every finding as a dot on a 0-100 line, so the spread is visible at a glance. */
export function DotStrip({ scores, height = 34, axis = true }: { scores: { name: string; score: number }[]; height?: number; axis?: boolean }) {
  // Stack dots that share a score so none hide behind another.
  const seen = new Map<number, number>();
  const dots = [...scores].sort((a, b) => a.score - b.score).map((s) => {
    const k = Math.round(s.score / 2); const lvl = seen.get(k) ?? 0; seen.set(k, lvl + 1);
    return { ...s, lvl };
  });
  const top = Math.max(0, ...dots.map((d) => d.lvl));
  const h = Math.max(height, 16 + top * 9);
  return (
    <svg viewBox={`0 0 200 ${h + (axis ? 12 : 0)}`} className="w-full h-auto overflow-visible" role="img"
      aria-label={`${scores.length} findings, scores from ${Math.min(...scores.map((s) => s.score))} to ${Math.max(...scores.map((s) => s.score))}`}>
      <line x1="4" x2="196" y1={h - 5} y2={h - 5} stroke="var(--edge-strong)" strokeWidth="1" />
      {[60, 70, 80, 90].map((t) => <line key={t} x1={4 + t * 1.92} x2={4 + t * 1.92} y1={h - 9} y2={h - 1} stroke="var(--edge-strong)" strokeWidth="0.6" />)}
      {dots.map((d, i) => (
        <circle key={i} cx={4 + d.score * 1.92} cy={h - 5 - d.lvl * 9} r="3.6" className={toneFor(d.score)} fill="currentColor" stroke="var(--field)" strokeWidth="1">
          <title>{`${d.name}: ${d.score}`}</title>
        </circle>
      ))}
      {axis && [0, 60, 70, 80, 90, 100].map((t) => (
        <text key={t} x={4 + t * 1.92} y={h + 9} textAnchor="middle" fontSize="6.5" fill="var(--ink-40)" fontFamily="var(--font-num)">{t}</text>
      ))}
    </svg>
  );
}

export interface MarketPoint { label: string; name: string; rating: number; reviews: number; you?: boolean }

/** Guest rating against review count, for the hotel and its named competitors. */
export function MarketScatter({ points }: { points: MarketPoint[] }) {
  const W = 300, H = 170, L = 30, B = 22, T = 10, Rt = 14;
  const lr = points.map((p) => Math.log10(Math.max(1, p.reviews)));
  const x0 = Math.min(...lr) - 0.08, x1 = Math.max(...lr) + 0.08;
  const y0 = Math.floor((Math.min(...points.map((p) => p.rating)) - 0.05) * 10) / 10;
  const y1 = Math.min(5, Math.ceil((Math.max(...points.map((p) => p.rating)) + 0.05) * 10) / 10);
  const px = (rev: number) => L + ((Math.log10(Math.max(1, rev)) - x0) / (x1 - x0 || 1)) * (W - L - Rt);
  const py = (rt: number) => T + (1 - (rt - y0) / (y1 - y0 || 1)) * (H - T - B);
  const yt: number[] = []; for (let v = y0; v <= y1 + 1e-9; v += 0.1) yt.push(Math.round(v * 10) / 10);
  const step = Math.ceil(yt.length / 5);
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
  const xt = [Math.min(...points.map((p) => p.reviews)), Math.max(...points.map((p) => p.reviews))];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
      aria-label={`Guest rating against review count for ${points.length} hotels`}>
      {yt.filter((_, i) => i % step === 0).map((v) => (
        <g key={v}>
          <line x1={L} x2={W - Rt} y1={py(v)} y2={py(v)} stroke="var(--edge)" strokeWidth="1" />
          <text x={L - 5} y={py(v) + 3} textAnchor="end" fontSize="8" fill="var(--ink-40)" fontFamily="var(--font-num)">{v.toFixed(1)}</text>
        </g>
      ))}
      <line x1={L} x2={W - Rt} y1={H - B} y2={H - B} stroke="var(--edge-strong)" strokeWidth="1" />
      {xt.map((v, i) => <text key={i} x={px(v)} y={H - B + 11} textAnchor="middle" fontSize="8" fill="var(--ink-40)" fontFamily="var(--font-num)">{fmt(v)}</text>)}
      <text x={(L + W - Rt) / 2} y={H - 1} textAnchor="middle" fontSize="8" fill="var(--ink-40)" fontFamily="var(--font)">Google reviews</text>
      <text x={L - 22} y={T - 2} fontSize="8" fill="var(--ink-40)" fontFamily="var(--font)">rating</text>
      {points.filter((p) => !p.you).map((p) => (
        <g key={p.label} transform={`translate(${px(p.reviews)} ${py(p.rating)})`}>
          <circle r="7" fill="var(--ink)" stroke="var(--field)" strokeWidth="1.5"><title>{`${p.name}: ${p.rating} stars, ${p.reviews.toLocaleString('en-US')} reviews`}</title></circle>
          <text y="2.8" textAnchor="middle" fontSize="8" fontWeight="600" fill="var(--paper)" fontFamily="var(--font)">{p.label}</text>
        </g>
      ))}
      {points.filter((p) => p.you).map((p) => (
        <g key="you" transform={`translate(${px(p.reviews)} ${py(p.rating)})`}>
          <circle r="11" fill="var(--accent-soft)" />
          <circle r="6.5" fill="var(--accent)" stroke="var(--field)" strokeWidth="1.5"><title>{`${p.name}: ${p.rating} stars, ${p.reviews.toLocaleString('en-US')} reviews`}</title></circle>
          <text x="11" y="-7" fontSize="9" fontWeight="600" fill="var(--accent)" fontFamily="var(--font)">you</text>
        </g>
      ))}
    </svg>
  );
}
