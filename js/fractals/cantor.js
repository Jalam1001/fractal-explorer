/**
 * Cantor set — geometric recursion.
 * Start with a line segment, remove its open middle third, and repeat on the
 * pieces that are left. Each row of bars below shows one more step.
 * The drawing is arranged so the whole picture is exactly self-similar:
 * the left third of it is a 1/3-size copy of the whole thing.
 */
import { hexToRgb, mix, css } from '../core/color.js';
import { intersects, extraLevels } from '../core/geometry.js';
import { depthParams } from './common-params.js';

const BAR = 0.09; // bar thickness as a fraction of the interval length
const GAP = 0.27; // vertical distance to the next row, as a fraction of interval length

function childRatio(params) {
  return (1 - +params.remove) / 2;
}

export default {
  id: 'cantor',
  name: 'Cantor set',
  kind: 'geometric',
  palette: 'forest',
  bounds: [-0.04, 1.04, -0.42, 0.06],
  getBounds(params) {
    const c = childRatio(params);
    const h = GAP / (1 - c) + BAR * 0.5;
    return [-0.04, 1.04, -h - 0.03, 0.06];
  },
  blurb:
    'The simplest fractal of all. Take a line segment and delete its middle third. Delete the middle third of each ' +
    'remaining piece, and keep going. What survives is a “dust” of points: uncountably many, but with total length zero.',
  rule: '[0, 1] → [0, ⅓] ∪ [⅔, 1]. &nbsp;Apply to every remaining piece, forever.',
  lookFor: [
    'Each row doubles the number of pieces and divides their length by 3: after n steps, 2ⁿ pieces of length 3⁻ⁿ.',
    'Zoom into the left-hand third: it looks exactly like the whole picture.',
    'Change “Fraction removed” to make a fatter or thinner dust; the dimension readout changes with it.',
  ],
  credit: 'Published by Georg Cantor in 1883 (Henry J. S. Smith had described a similar set in the 1870s).',
  dimension: (p) => {
    const c = childRatio(p);
    return `log 2 / log ${(1 / c).toFixed(3).replace(/\.?0+$/, '')} ≈ ${(Math.log(2) / Math.log(1 / c)).toFixed(4)}`;
  },
  params: [
    ...depthParams(6, 12, 'How many rows of “remove the middle” steps to draw at the starting zoom.'),
    { id: 'remove', label: 'Fraction removed from the middle', type: 'range', min: 0.1, max: 0.8, step: 0.01, value: 1 / 3, format: (v) => (+v).toFixed(2) },
  ],

  draw(rc) {
    const { ctx, params, bounds: b, k, X, Y } = rc;
    const bg = hexToRgb(rc.colors.bg);
    const fg = hexToRgb(rc.colors.fg);
    const a1 = hexToRgb(rc.colors.accents[0]);
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, rc.width, rc.height);

    const c = childRatio(params);
    const totalH = GAP / (1 - c) + BAR;
    const extra = params.autoDetail ? extraLevels(rc.zoom, c) : 0;
    const maxDepth = Math.min(+params.depth + extra, 60);
    const minPx = rc.quality === 'preview' ? 2 : 0.6;
    const levels = [];
    let bars = 0;

    const clampX = (x) => Math.max(-10, Math.min(rc.width + 10, x));
    const clampY = (y) => Math.max(-10, Math.min(rc.height + 10, y));

    const rec = (a, w, top, d) => {
      if (!intersects(a, a + w, top - totalH * w, top, b)) return;
      const x0 = clampX(X(a)), x1 = clampX(X(a + w));
      const y0 = clampY(Y(top)), y1 = clampY(Y(top - BAR * w));
      (levels[d] ||= []).push(x0, y0, Math.max(x1 - x0, 0.75), Math.max(y1 - y0, 0.75));
      bars++;
      if (d >= maxDepth || w * k < minPx || bars > 300000) return;
      const cw = w * c;
      rec(a, cw, top - GAP * w, d + 1);
      rec(a + w - cw, cw, top - GAP * w, d + 1);
    };
    rec(0, 1, 0, 0);

    levels.forEach((arr, d) => {
      const t = maxDepth ? d / Math.max(6, maxDepth) : 0;
      ctx.fillStyle = css(mix(fg, a1, Math.min(0.45, t * 0.45)));
      for (let i = 0; i < arr.length; i += 4) ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 3]);
    });
    return `${bars.toLocaleString()} bars · depth ${maxDepth}`;
  },
};
