/**
 * Barnsley fern — iterated function system (IFS).
 * Four affine maps, each shrinking/rotating the plane. Applying a randomly
 * chosen map (with fixed probabilities) to a point again and again — the
 * "chaos game" — makes the point dance over the fern.
 *
 * Two drawing methods:
 *  - chaos: the classic random-point method (fast, but zooming leaves few points on screen)
 *  - exact: follow every sequence of maps, skip pieces that are off-screen
 *    and stop when a piece is smaller than a pixel. Same picture, but it keeps
 *    full detail at any zoom.
 */
import { hexToRgb, mix, buildLUT } from '../core/color.js';
import { intersects } from '../core/geometry.js';

// Barnsley's coefficients: x' = a·x + b·y + e,  y' = c·x + d·y + f,  probability p
export const FERN_MAPS = [
  { a: 0, b: 0, c: 0, d: 0.16, e: 0, f: 0, p: 0.01, part: 'stem' },
  { a: 0.85, b: 0.04, c: -0.04, d: 0.85, e: 0, f: 1.6, p: 0.85, part: 'successively smaller leaflets' },
  { a: 0.2, b: -0.26, c: 0.23, d: 0.22, e: 0, f: 1.6, p: 0.07, part: 'largest left leaflet' },
  { a: -0.15, b: 0.28, c: 0.26, d: 0.24, e: 0, f: 0.44, p: 0.07, part: 'largest right leaflet' },
];
// Bounding box of the whole fern (the attractor).
const BX = (-2.1820 + 2.6558) / 2, BY = 9.9983 / 2;
const HX = (2.6558 + 2.1820) / 2 + 0.01, HY = 9.9983 / 2 + 0.01;

let cache = { key: '', density: null, max: 0 };

// The stem map squashes the whole fern onto a line segment. Recursing into
// such a segment is wasteful (thousands of overlapping pieces on one line), so
// we draw it directly using the fern's height profile, measured once here.
const STEM_BINS = 512;
const stemProfile = (() => {
  const hist = new Float64Array(STEM_BINS);
  let x = 0, y = 0;
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const N = 200000;
  for (let i = 0; i < N + 20; i++) {
    const r = rand();
    const m = r < 0.01 ? FERN_MAPS[0] : r < 0.86 ? FERN_MAPS[1] : r < 0.93 ? FERN_MAPS[2] : FERN_MAPS[3];
    const nx = m.a * x + m.b * y + m.e;
    y = m.c * x + m.d * y + m.f;
    x = nx;
    if (i >= 20) hist[Math.min(STEM_BINS - 1, Math.max(0, Math.floor((y / 10) * STEM_BINS)))] += 1 / N;
  }
  return hist;
})();

/**
 * Exact method: walk the tree of map compositions, skipping pieces whose
 * bounding box is off-screen and stopping when a piece is smaller than
 * `minPx` pixels. Each leaf adds its probability weight to the density image.
 * Returns the number of pieces examined.
 */
function walkFern(rc, minPx, budget, density) {
  const { bounds: b, k, width: W, height: Hh, view } = rc;
  const ox = view.cx, oy = view.cy;
  let nodes = 0;
  const maps = FERN_MAPS;
  const deposit = (x, y, hx, hy, w) => {
    if (!density) return;
    const px = (x - ox) * k + W / 2;
    const py = Hh / 2 - (y - oy) * k;
    const rx = hx * k, ry = hy * k;
    if (rx < 0.75 && ry < 0.75) {
      const ix = px | 0, iy = py | 0;
      if (ix >= 0 && iy >= 0 && ix < W && iy < Hh) density[iy * W + ix] += w;
      return;
    }
    // Leaf bigger than a pixel: spread its weight over the pixels it covers.
    const x0 = Math.max(0, Math.floor(px - rx)), x1 = Math.min(W - 1, Math.floor(px + rx));
    const y0 = Math.max(0, Math.floor(py - ry)), y1 = Math.min(Hh - 1, Math.floor(py + ry));
    if (x1 < x0 || y1 < y0) return;
    const share = w / ((x1 - x0 + 1) * (y1 - y0 + 1));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) density[yy * W + xx] += share;
  };
  // Draw T∘(stem map) = a segment from T(0,0) to T(0,1.6), weighted by the fern's height profile.
  const stem = (ta, tb, tc, td, te, tf, w) => {
    const x0 = (te - ox) * k + W / 2, y0 = Hh / 2 - (tf - oy) * k;
    const dx = tb * 1.6 * k, dy = -td * 1.6 * k;
    // Liang–Barsky clip of the parameter range [u0, u1] to the canvas.
    let u0 = 0, u1 = 1;
    const clip = (pp, q) => {
      if (pp === 0) return q >= 0;
      const r = q / pp;
      if (pp < 0) { if (r > u1) return false; if (r > u0) u0 = r; } else { if (r < u0) return false; if (r < u1) u1 = r; }
      return true;
    };
    if (!clip(-dx, x0) || !clip(dx, W - 1e-6 - x0) || !clip(-dy, y0) || !clip(dy, Hh - 1e-6 - y0)) return;
    const len = Math.hypot(dx, dy) * (u1 - u0);
    const n = Math.max(1, Math.ceil(len * 1.5));
    const du = (u1 - u0) / n;
    for (let i = 0; i < n; i++) {
      const u = u0 + (i + 0.5) * du;
      const px = (x0 + dx * u) | 0, py = (y0 + dy * u) | 0;
      if (px < 0 || py < 0 || px >= W || py >= Hh) continue;
      density[py * W + px] += w * stemProfile[(u * STEM_BINS) | 0] * STEM_BINS * du;
    }
  };
  // T = [ta tb; tc td] + (te, tf): the composition of the maps chosen so far.
  const rec = (ta, tb, tc, td, te, tf, w, depth) => {
    nodes++;
    const cx = ta * BX + tb * BY + te, cy = tc * BX + td * BY + tf;
    const hx = Math.abs(ta) * HX + Math.abs(tb) * HY;
    const hy = Math.abs(tc) * HX + Math.abs(td) * HY;
    if (!intersects(cx - hx, cx + hx, cy - hy, cy + hy, b)) return;
    if (Math.max(hx, hy) * 2 * k < minPx || depth > 250 || nodes > budget) {
      deposit(cx, cy, hx * 0.5, hy * 0.5, w);
      return;
    }
    if (density) stem(ta, tb, tc, td, te, tf, w * maps[0].p);
    for (let i = 1; i < 4; i++) {
      const m = maps[i];
      rec(
        ta * m.a + tb * m.c, ta * m.b + tb * m.d,
        tc * m.a + td * m.c, tc * m.b + td * m.d,
        ta * m.e + tb * m.f + te, tc * m.e + td * m.f + tf,
        w * m.p, depth + 1,
      );
    }
  };
  rec(1, 0, 0, 1, 0, 0, 1, 0);
  return nodes;
}

function exactDensity(rc, density, minPx, budget) {
  // Overlapping leaflets mean the work grows quickly as you zoom in. Do a cheap
  // coarse pass to estimate the cost, then pick the finest piece size that fits the budget.
  const coarse = 8;
  const n8 = walkFern(rc, coarse, budget, null);
  const predicted = (m) => n8 * Math.pow(coarse / m, 1.7);
  let m = minPx;
  if (predicted(m) > budget) m = Math.min(coarse, coarse * Math.pow(n8 / budget, 1 / 1.7));
  const nodes = walkFern(rc, m, budget * 1.5, density);
  return { nodes, minPx: m };
}

function chaosDensity(rc, density, n) {
  const { k, width: W, height: Hh, view } = rc;
  let x = 0, y = 0, hits = 0;
  const m0 = FERN_MAPS[0], m1 = FERN_MAPS[1], m2 = FERN_MAPS[2], m3 = FERN_MAPS[3];
  for (let i = 0; i < n + 20; i++) {
    const r = Math.random();
    const m = r < 0.01 ? m0 : r < 0.86 ? m1 : r < 0.93 ? m2 : m3;
    const nx = m.a * x + m.b * y + m.e;
    y = m.c * x + m.d * y + m.f;
    x = nx;
    if (i < 20) continue; // let the point settle onto the fern first
    const px = ((x - view.cx) * k + W / 2) | 0;
    const py = (Hh / 2 - (y - view.cy) * k) | 0;
    if (px >= 0 && py >= 0 && px < W && py < Hh) { density[py * W + px] += 1; hits++; }
  }
  return hits;
}

export default {
  id: 'barnsley-fern',
  name: 'Barnsley fern',
  kind: 'geometric',
  palette: 'forest',
  bounds: [-2.4, 2.9, -0.15, 10.15],
  blurb:
    'Four simple “shrink, rotate and shift” rules are enough to draw a convincing fern. Start with any point, ' +
    'pick one rule at random (rule 2 most of the time), apply it, plot the point, and repeat. ' +
    'Each rule maps the whole fern onto one part of itself: the stem, the next-smaller frond, or the bottom-left or bottom-right leaflet.',
  rule:
    '(x, y) → (a·x + b·y + e, &nbsp;c·x + d·y + f), choosing one of 4 maps with probabilities 1%, 85%, 7%, 7%. ' +
    '<br>Main map: (x, y) → (0.85x + 0.04y, &nbsp;−0.04x + 0.85y + 1.6)',
  lookFor: [
    'Every leaflet is a small fern, and every leaflet of a leaflet is too — zoom in on a lower leaflet to see it.',
    'Switch to “Chaos game” and change the point count: the fern appears from random dots, densest where the rules overlap.',
    'In chaos-game mode, zooming in leaves fewer dots on screen; “Exact” mode keeps the detail at any zoom.',
  ],
  credit: 'Popularised by Michael Barnsley in his 1988 book “Fractals Everywhere”.',
  dimension: () => 'not a simple formula (overlapping maps)',
  params: [
    {
      id: 'method', label: 'Drawing method', type: 'select', value: 'exact',
      options: [{ value: 'exact', label: 'Exact (keeps detail when zooming)' }, { value: 'chaos', label: 'Chaos game (random points)' }],
    },
    {
      id: 'points', label: 'Number of points', type: 'range', min: 10000, max: 3000000, step: 10000, value: 1000000,
      format: (v) => (+v).toLocaleString(), showIf: (p) => p.method === 'chaos',
    },
  ],

  draw(rc) {
    const { ctx, params, width: W, height: Hh } = rc;
    const key = [rc.width, rc.height, rc.view.cx, rc.view.cy, rc.view.scale, rc.quality, params.method, params.points].join('|');
    let info;
    if (cache.key !== key || params.method === 'chaos' && rc.reseed) {
      const density = new Float32Array(W * Hh);
      let n;
      if (params.method === 'chaos') {
        const pts = rc.quality === 'preview' ? Math.min(+params.points, 150000) : +params.points;
        n = chaosDensity(rc, density, pts);
        info = `${(+params.points).toLocaleString()} points · ${n.toLocaleString()} on screen`;
      } else {
        const minPx = rc.quality === 'preview' ? 3.5 : 1.5;
        const r = exactDensity(rc, density, minPx, rc.quality === 'preview' ? 250000 : 4000000);
        info = `${r.nodes.toLocaleString()} pieces examined (smallest ${r.minPx.toFixed(1)} px)`;
      }
      // Robust brightness scale: the median and 99th percentile of the lit pixels.
      const sample = [];
      const stride = Math.max(1, Math.floor(density.length / 200000));
      for (let i = 0; i < density.length; i += stride) if (density[i] > 0) sample.push(density[i]);
      sample.sort((a, b) => a - b);
      const med = sample.length ? sample[sample.length >> 1] : 1;
      const p99 = sample.length ? sample[Math.floor(sample.length * 0.995)] : 1;
      cache = { key, density, med, p99, info };
    }
    info = cache.info;

    const bg = hexToRgb(rc.colors.bg);
    const fg = hexToRgb(rc.colors.fg);
    const a2 = hexToRgb(rc.colors.accents[1] || '#ffffff');
    const lut = buildLUT([
      { pos: 0, rgb: mix(bg, fg, 0.4) },
      { pos: 0.35, rgb: mix(bg, fg, 0.8) },
      { pos: 0.7, rgb: fg },
      { pos: 1, rgb: mix(fg, a2, 0.55) },
    ], 1024);
    const img = ctx.createImageData(W, Hh);
    const out = img.data;
    const { density, med, p99 } = cache;
    // Logarithmic brightness, scaled relative to the typical density so any zoom looks balanced.
    const s = 4 / med;
    const norm = Math.log1p(p99 * s) || 1;
    const [br, bgc, bb] = bg;
    for (let i = 0, o = 0; i < density.length; i++, o += 4) {
      const v = density[i];
      if (v <= 0) { out[o] = br; out[o + 1] = bgc; out[o + 2] = bb; out[o + 3] = 255; continue; }
      const t = Math.min(1, Math.log1p(v * s) / norm);
      const j = ((t * 1023) | 0) * 3;
      out[o] = lut[j]; out[o + 1] = lut[j + 1]; out[o + 2] = lut[j + 2]; out[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return info;
  },
};
