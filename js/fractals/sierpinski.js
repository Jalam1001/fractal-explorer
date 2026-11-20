/**
 * Sierpiński triangle — geometric recursion.
 * Take a triangle, connect the midpoints of its sides, remove the middle
 * piece, and repeat on the three corner triangles that are left.
 */
import { hexToRgb, mix, css } from '../core/color.js';
import { intersects, addPolygon, extraLevels } from '../core/geometry.js';
import { depthParams } from './common-params.js';

// Equilateral triangle with side 2 standing on the x-axis.
const TOP = Math.sqrt(3);

export default {
  id: 'sierpinski',
  name: 'Sierpiński triangle',
  kind: 'geometric',
  palette: 'aurora',
  bounds: [-1.06, 1.06, -0.06, 1.79],
  blurb:
    'Start with a solid triangle. Join the midpoints of its sides and cut out the middle triangle, leaving three ' +
    'smaller copies. Do the same to each copy, forever. What remains has zero area yet is made of infinitely many pieces.',
  rule: 'Triangle → 3 half-size triangles at its corners (middle removed). Repeat on each.',
  lookFor: [
    'Increase the recursion depth one step at a time and count: 1, 3, 9, 27… triangles (3ⁿ at depth n).',
    'Zoom into any corner: with “add detail” on, the view is an exact copy of the whole — this is exact self-similarity.',
    'Each level halves the size and triples the count, so its dimension is log 3 / log 2 ≈ 1.585.',
  ],
  credit: 'Described by Wacław Sierpiński in 1915.',
  dimension: () => 'log 3 / log 2 ≈ 1.585',
  params: depthParams(7, 12, 'How many times the “cut out the middle” rule is applied at the starting zoom.'),

  draw(rc) {
    const { ctx, params, bounds: b, k, X, Y } = rc;
    const bg = hexToRgb(rc.colors.bg);
    const fg = hexToRgb(rc.colors.fg);
    const a1 = hexToRgb(rc.colors.accents[0]);
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, rc.width, rc.height);

    const extra = params.autoDetail ? extraLevels(rc.zoom, 0.5) : 0;
    const maxDepth = Math.min(+params.depth + extra, 60);
    const minPx = rc.quality === 'preview' ? 3 : 1.25;
    const path = new Path2D();
    let count = 0;

    const rec = (ax, ay, bx, by, cx, cy, d) => {
      const xmin = Math.min(ax, bx, cx), xmax = Math.max(ax, bx, cx);
      const ymin = Math.min(ay, by, cy), ymax = Math.max(ay, by, cy);
      if (!intersects(xmin, xmax, ymin, ymax, b)) return; // off-screen: skip whole branch
      if (d >= maxDepth || (xmax - xmin) * k < minPx || count > 400000) {
        addPolygon(path, [X(ax), Y(ay), X(bx), Y(by), X(cx), Y(cy)], rc);
        count++;
        return;
      }
      const abx = (ax + bx) / 2, aby = (ay + by) / 2;
      const bcx = (bx + cx) / 2, bcy = (by + cy) / 2;
      const cax = (cx + ax) / 2, cay = (cy + ay) / 2;
      rec(ax, ay, abx, aby, cax, cay, d + 1);
      rec(abx, aby, bx, by, bcx, bcy, d + 1);
      rec(cax, cay, bcx, bcy, cx, cy, d + 1);
    };
    rec(-1, 0, 1, 0, 0, TOP, 0);

    // Fractal color, brightening slightly towards the top using the palette accent.
    const g = ctx.createLinearGradient(0, Y(0), 0, Y(TOP));
    g.addColorStop(0, css(fg));
    g.addColorStop(1, css(mix(fg, a1, 0.35)));
    ctx.fillStyle = g;
    ctx.fill(path);
    return `${count.toLocaleString()} triangles · depth ${maxDepth}`;
  },
};
