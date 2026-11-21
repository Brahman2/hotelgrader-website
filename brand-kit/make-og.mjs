// Builds the link-preview image (public/og.png, 1200 x 630).
//
//   node brand-kit/make-og.mjs
//
// Writes brand-kit/og-src.html (the same contour lines as the homepage, drawn
// with the same noise + marching-squares method) and renders it with headless
// Chrome. Needs Google Chrome installed.

import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const W = 1200, H = 630, CELL = 12, STEP = 0.075, LEVELS = 20;

const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// A hill under the grade, so the lines gather around it.
const HILL = { x: 965, y: 285, r: 210 };
const cols = Math.ceil(W / CELL) + 1, rows = Math.ceil(H / CELL) + 1;
const f = new Float32Array(cols * rows);
for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
  const x = i * CELL, y = j * CELL;
  const dx = x - HILL.x, dy = y - HILL.y;
  f[j * cols + i] = 0.62 * noise(x / 300 + 4.2, y / 300 + 3.1) + 0.38 * noise(x / 120 + 1.7, y / 120 + 9.7)
    + 0.6 * Math.exp(-(dx * dx + dy * dy) / (2 * HILL.r * HILL.r));
}

const seg = [];
const p = (n) => n.toFixed(1);
for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
  const a = f[j * cols + i], b = f[j * cols + i + 1], c = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
  const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d), x = i * CELL, y = j * CELL;
  for (let n = Math.max(1, Math.ceil(lo / STEP)); n <= LEVELS && n * STEP < hi; n++) {
    const L = n * STEP;
    const code = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
    if (code === 0 || code === 15) continue;
    const T = [x + CELL * (L - a) / (b - a), y], R = [x + CELL, y + CELL * (L - b) / (c - b)];
    const B = [x + CELL * (L - d) / (c - d), y + CELL], Lf = [x, y + CELL * (L - a) / (d - a)];
    const line = (m, q) => seg.push(`M${p(m[0])} ${p(m[1])}L${p(q[0])} ${p(q[1])}`);
    switch (code) {
      case 1: case 14: line(Lf, B); break;
      case 2: case 13: line(B, R); break;
      case 3: case 12: line(Lf, R); break;
      case 4: case 11: line(T, R); break;
      case 6: case 9: line(T, B); break;
      case 7: case 8: line(T, Lf); break;
      case 5: line(T, R); line(Lf, B); break;
      case 10: line(T, Lf); line(B, R); break;
    }
  }
}

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @font-face { font-family: 'IBM Plex Mono'; font-weight: 400; src: url('../public/fonts/IBMPlexMono-400.woff2') format('woff2'); }
  @font-face { font-family: 'IBM Plex Mono'; font-weight: 500; src: url('../public/fonts/IBMPlexMono-500.woff2') format('woff2'); }
  @font-face { font-family: 'IBM Plex Mono'; font-weight: 600; src: url('../public/fonts/IBMPlexMono-600.woff2') format('woff2'); }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  /* The dark terminal theme, which is what the site opens in. */
  body { position: relative; background: #0B0D0C; color: #E6EAE7; font-family: 'IBM Plex Mono', monospace; }
  svg { position: absolute; inset: 0; }
  .fade { position: absolute; inset: 0; background: linear-gradient(90deg, #0B0D0C 0%, #0B0D0C 40%, rgba(11,13,12,0) 74%); }
  .brand { position: absolute; left: 72px; top: 62px; display: flex; align-items: center; font-size: 34px; font-weight: 600; letter-spacing: -0.03em; }
  .caret { display: inline-block; width: 19px; height: 36px; margin-left: 5px; background: #6EF3A5; }
  h1 { position: absolute; left: 72px; top: 196px; width: 690px; font-size: 68px; line-height: 1.1; font-weight: 600; letter-spacing: -0.045em; }
  .sub { position: absolute; left: 74px; top: 404px; font-size: 26px; line-height: 1.5; color: rgba(230,234,231,0.64); letter-spacing: -0.02em; }
  .url { position: absolute; left: 74px; top: 544px; font-size: 22px; color: #6EF3A5; }
  .url b { font-weight: 500; color: rgba(230,234,231,0.42); }
  .grade { position: absolute; left: 815px; top: 140px; width: 300px; text-align: center; }
  .letter { font-size: 262px; line-height: 0.9; font-weight: 600; letter-spacing: -0.06em; color: #B6E36A; }
  .letter sup { font-size: 0.5em; position: relative; top: -0.14em; }
  .score { margin-top: 26px; font-size: 26px; color: rgba(230,234,231,0.64); }
</style></head>
<body>
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${HILL.x}" cy="${HILL.y}" r="${HILL.r * 1.9}">
      <stop offset="0" stop-color="#6EF3A5" stop-opacity="0.75"/><stop offset="1" stop-color="#6EF3A5" stop-opacity="0"/>
    </radialGradient></defs>
    <path d="${seg.join('')}" fill="none" stroke="#E6EAE7" stroke-opacity="0.16" stroke-width="1"/>
    <path d="${seg.join('')}" fill="none" stroke="url(#g)" stroke-width="1"/>
  </svg>
  <div class="fade"></div>
  <div class="brand">hotelgrader<span class="caret"></span></div>
  <h1>Grade any hotel’s marketing.</h1>
  <p class="sub">Yours, or the one down the street.<br>Free. Takes two minutes.</p>
  <p class="url"><b>&gt;</b> hotelgrader.com</p>
  <div class="grade"><div class="letter">B<sup>+</sup></div><div class="score">87 / 100</div></div>
</body></html>`;

const src = join(here, 'og-src.html');
const out = join(here, '..', 'public', 'og.png');
writeFileSync(src, html);
execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=4000',
  `--window-size=${W},${H}`, `--screenshot=${out}`, `file://${src}`,
], { stdio: 'ignore' });
console.log('wrote', out);
