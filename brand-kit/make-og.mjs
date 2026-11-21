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
  @font-face { font-family: 'Schibsted Grotesk'; font-weight: 400 900;
    src: url('../node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2') format('woff2-variations'); }
  @font-face { font-family: 'IBM Plex Mono'; font-weight: 500; src: url('../public/fonts/IBMPlexMono-500.woff2') format('woff2'); }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { position: relative; background: #F5F5F7; color: #14151A; font-family: 'Schibsted Grotesk', sans-serif; }
  svg { position: absolute; inset: 0; }
  .fade { position: absolute; inset: 0; background: linear-gradient(90deg, #F5F5F7 0%, #F5F5F7 38%, rgba(245,245,247,0) 72%); }
  .brand { position: absolute; left: 72px; top: 60px; display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 650; letter-spacing: -0.03em; }
  .mark { width: 52px; height: 52px; border-radius: 11px; background: #5B5BD6; color: #fff; display: grid; place-items: center; font-size: 27px; font-weight: 600; letter-spacing: -0.04em; }
  h1 { position: absolute; left: 72px; top: 178px; width: 640px; font-size: 76px; line-height: 1.04; font-weight: 680; letter-spacing: -0.04em; }
  .sub { position: absolute; left: 74px; top: 498px; font-size: 27px; color: rgba(20,21,26,0.66); }
  .url { position: absolute; left: 74px; top: 546px; font-family: 'IBM Plex Mono', monospace; font-size: 22px; color: #5B5BD6; }
  .grade { position: absolute; left: 815px; top: 150px; width: 300px; text-align: center; }
  .letter { font-size: 250px; line-height: 0.9; font-weight: 720; letter-spacing: -0.05em; color: #1E8E5A; }
  .letter sup { font-size: 0.5em; position: relative; top: -0.12em; margin-left: -0.02em; }
  .score { margin-top: 20px; font-family: 'IBM Plex Mono', monospace; font-size: 26px; color: rgba(20,21,26,0.66); }
</style></head>
<body>
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${seg.join('')}" fill="none" stroke="#14151A" stroke-opacity="0.14" stroke-width="1"/></svg>
  <div class="fade"></div>
  <div class="brand"><span class="mark">hg</span>hotelgrader</div>
  <h1>Your hotel has a grade. You just haven’t seen it.</h1>
  <p class="sub">A free report card on how guests find and book it.</p>
  <p class="url">hotelgrader.com</p>
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
