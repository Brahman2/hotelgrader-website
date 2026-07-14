import fs from 'node:fs';

// Abstract-art generator for the hotelgrader motif family (see BRAND-HANDOFF.md §5).
// Point OUT at the consuming repo's static-assets dir: ART_OUT=./public/images node generate-art.mjs
const OUT = process.env.ART_OUT || './public/images';
const PAL = ['#8480D9', '#3AAFA4', '#E87A54', '#C6D95E']; // muted iris / teal / coral / lime

function wrap({ w, h, name, base, inner, focal }) {
  const fx = focal ? ((focal[0] / w) * 100).toFixed(0) : 50;
  const fy = focal ? ((focal[1] / h) * 100).toFixed(0) : 50;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="">
  <defs>
    <radialGradient id="glow-${name}" cx="${fx}%" cy="${fy}%" r="46%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.4"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig-${name}" cx="${fx}%" cy="${fy}%" r="82%">
      <stop offset="52%" stop-color="#0B0820" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0B0820" stop-opacity="0.55"/>
    </radialGradient>
    <pattern id="ht-${name}" width="9" height="9" patternUnits="userSpaceOnUse">
      <circle cx="4.5" cy="4.5" r="2.4" fill="#0B0820" fill-opacity="0.17"/>
    </pattern>
    <filter id="grain-${name}">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.06"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="${base}"/>
  ${inner}
  <rect width="${w}" height="${h}" fill="url(#glow-${name})"/>
  <rect width="${w}" height="${h}" fill="url(#vig-${name})"/>
  <rect width="${w}" height="${h}" fill="url(#ht-${name})"/>
  <rect width="${w}" height="${h}" filter="url(#grain-${name})"/>
</svg>`;
}

// 1) Sunburst — radiating rays.
function burst({ w = 900, h = 700, cx, cy, n = 36, palette = PAL, base = '#241E52', name = 'a' }) {
  const R = Math.hypot(w, h) * 1.4;
  let rays = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI;
    const p = (a) => `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`;
    rays += `<polygon points="${cx.toFixed(1)},${cy.toFixed(1)} ${p(a0)} ${p(a1)}" fill="${palette[i % palette.length]}" fill-opacity="${i % 2 ? 0.42 : 0.8}"/>`;
  }
  return wrap({ w, h, name, base, inner: rays, focal: [cx, cy] });
}

// 2) Concentric arcs / ripples — thick colored rings from an off-canvas focal.
function rings({ w = 900, h = 700, cx, cy, palette = PAL, base = '#1B2440', name = 'r', bands = 15, bandW = 60, gap = 34 }) {
  let arcs = '';
  for (let i = bands; i >= 1; i--) {
    const rad = i * (bandW + gap);
    arcs += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${palette[i % palette.length]}" stroke-width="${bandW}" stroke-opacity="${i % 2 ? 0.78 : 0.5}"/>`;
  }
  return wrap({ w, h, name, base, inner: arcs, focal: [cx, cy] });
}

// 3) Soft color pools — overlapping bright blobs on a deep base.
function blobs({ w = 900, h = 700, palette = PAL, base = '#221B47', name = 'b', spots }) {
  let defs = '', rects = '';
  spots.forEach((s, i) => {
    const id = `pool-${name}-${i}`;
    defs += `<radialGradient id="${id}" cx="${s.x}%" cy="${s.y}%" r="${s.r}%"><stop offset="0%" stop-color="${palette[s.c]}" stop-opacity="0.92"/><stop offset="70%" stop-color="${palette[s.c]}" stop-opacity="0.12"/><stop offset="100%" stop-color="${palette[s.c]}" stop-opacity="0"/></radialGradient>`;
    rects += `<rect width="${w}" height="${h}" fill="url(#${id})"/>`;
  });
  // inject the gradient defs by piggybacking on inner (they are valid anywhere)
  return wrap({ w, h, name, base, inner: `<defs>${defs}</defs>${rects}`, focal: [w * 0.5, h * 0.42] });
}

// 4) Wavy bands — horizontal sine ribbons, for the iris conversion bands.
function waves({ w = 1600, h = 500, palette = PAL, base = '#4A47C9', name = 'w', bands = 5 }) {
  let ribbons = '';
  for (let i = 0; i < bands; i++) {
    const yBase = (h * (i + 1.6)) / (bands + 2.2);
    const amp = 34 + (i % 3) * 16;
    const period = 520 + (i % 2) * 240;
    const phase = i * 1.7;
    let d = `M 0 ${yBase.toFixed(1)}`;
    for (let x = 0; x <= w; x += 40) {
      const y = yBase + Math.sin((x / period) * 2 * Math.PI + phase) * amp;
      d += ` L ${x} ${y.toFixed(1)}`;
    }
    d += ` L ${w} ${h} L 0 ${h} Z`;
    ribbons += `<path d="${d}" fill="${palette[i % palette.length]}" fill-opacity="${i % 2 ? 0.34 : 0.55}"/>`;
  }
  return wrap({ w, h, name, base, inner: ribbons, focal: [w * 0.5, h * 0.35] });
}

// Sunburst (hero) — keep the existing look/palette.
fs.writeFileSync(`${OUT}/abstract-burst.svg`, burst({ cx: 900 * 0.4, cy: 700 * 0.44, name: 'a' }));
// Second sunburst variant (thin edge accent).
fs.writeFileSync(`${OUT}/abstract-burst-2.svg`, burst({ cx: 900 * 0.66, cy: 700 * 0.6, palette: ['#3AAFA4', '#E87A54', '#8480D9'], base: '#1B2440', name: 'a2' }));
// Rings (footer floor).
fs.writeFileSync(`${OUT}/abstract-rings.svg`, rings({ cx: -30, cy: 740, name: 'r' }));
// Blobs (report card).
fs.writeFileSync(`${OUT}/abstract-blobs.svg`, blobs({
  name: 'b',
  spots: [
    { x: 20, y: 26, r: 46, c: 0 },
    { x: 82, y: 20, r: 44, c: 1 },
    { x: 74, y: 82, r: 50, c: 2 },
    { x: 22, y: 86, r: 42, c: 3 },
    { x: 50, y: 52, r: 34, c: 1 },
  ],
}));
// Waves (iris conversion bands).
fs.writeFileSync(`${OUT}/abstract-waves.svg`, waves({ name: 'w' }));
console.log('wrote abstract-burst.svg, abstract-burst-2.svg, abstract-rings.svg, abstract-blobs.svg, abstract-waves.svg');
