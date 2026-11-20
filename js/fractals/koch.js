/**
 * Koch snowflake — geometric recursion.
 * Replace every straight segment by four segments one-third as long, with a
 * triangular bump in the middle. Start from a triangle and repeat.
 */
import { hexToRgb, mix, css } from '../core/color.js';
import { intersects, clipPolygon, extraLevels } from '../core/geometry.js';
import { depthParams } from './common-params.js';

const R = 1 / Math.sqrt(3); // circumradius of a triangle with side 1
const COS60 = 0.5, SIN60 = Math.sqrt(3) / 2;

export default {
  id: 'koch',
  name: 'Koch snowflake',
  kind: 'geometric',
  palette: 'ocean',
  bounds: [-0.6, 0.6, -0.6, 0.6],
  blurb:
    'Take a triangle. Split each side into thirds and build a smaller triangle on the middle third, pointing out. ' +
    'Repeat on every new edge. The outline gets longer by a factor of 4/3 every step, so after infinitely many ' +
    'steps it is infinitely long — yet it never leaves a small circle.',
  rule: 'Each segment ⟶ 4 segments, each 1/3 as long: &nbsp;<span class="mono">_/\\_</span>',
  lookFor: [
    'Step the depth from 0 to 6: the edge count goes 3, 12, 48, 192… (3·4ⁿ) and the perimeter grows by 4/3 each time.',
    'Zoom into any edge — every piece is an exact copy of the whole Koch curve scaled by 1/3.',
    'The area stays finite (8/5 of the starting triangle) even though the perimeter is infinite.',
  ],
  credit: 'Introduced by Helge von Koch in 1904 as a curve with no tangent anywhere.',
  dimension: () => 'log 4 / log 3 ≈ 1.262',
  params: [
    ...depthParams(5, 8, 'How many times every edge is replaced by the four-segment “bump” at the starting zoom.'),
    { id: 'fill', label: 'Fill the snowflake', type: 'checkbox', value: true },
  ],

  draw(rc) {
    const { ctx, params, bounds: b, k, X, Y } = rc;
    const bg = hexToRgb(rc.colors.bg);
    const fg = hexToRgb(rc.colors.fg);
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, rc.width, rc.height);

    const extra = params.autoDetail ? extraLevels(rc.zoom, 1 / 3) : 0;
    const maxDepth = Math.min(+params.depth + extra, 40);
    const minPx = rc.quality === 'preview' ? 4 : 1.5;
    const pts = [];
    let segments = 0;

    const seg = (x1, y1, x2, y2, d) => {
      const dx = x2 - x1, dy = y2 - y1;
      const L = Math.hypot(dx, dy);
      const pad = L * 0.3; // the curve built on this segment stays within this margin
      const off = !intersects(Math.min(x1, x2) - pad, Math.max(x1, x2) + pad, Math.min(y1, y2) - pad, Math.max(y1, y2) + pad, b);
      if (off || d >= maxDepth || L * k < minPx || segments > 600000) {
        // Off-screen or small enough: a straight chord is visually identical.
        pts.push(X(x2), Y(y2));
        segments++;
        return;
      }
      const ax = x1 + dx / 3, ay = y1 + dy / 3;
      const bx = x1 + (2 * dx) / 3, by = y1 + (2 * dy) / 3;
      // Peak: rotate the middle third by −60° (outwards for a counter-clockwise outline).
      const ux = dx / 3, uy = dy / 3;
      const px = ax + ux * COS60 + uy * SIN60;
      const py = ay - ux * SIN60 + uy * COS60;
      seg(x1, y1, ax, ay, d + 1);
      seg(ax, ay, px, py, d + 1);
      seg(px, py, bx, by, d + 1);
      seg(bx, by, x2, y2, d + 1);
    };

    // Triangle vertices in counter-clockwise order.
    const v = [90, 210, 330].map((deg) => [R * Math.cos((deg * Math.PI) / 180), R * Math.sin((deg * Math.PI) / 180) - 0.04]);
    pts.push(X(v[0][0]), Y(v[0][1]));
    for (let i = 0; i < 3; i++) {
      const p = v[i], q = v[(i + 1) % 3];
      seg(p[0], p[1], q[0], q[1], 0);
    }

    let poly = pts;
    if (rc.zoom > 1000) poly = clipPolygon(pts, -50, -50, rc.width + 50, rc.height + 50);
    if (poly.length >= 6) {
      const path = new Path2D();
      path.moveTo(poly[0], poly[1]);
      for (let i = 2; i < poly.length; i += 2) path.lineTo(poly[i], poly[i + 1]);
      path.closePath();
      if (params.fill) {
        ctx.fillStyle = css(mix(bg, fg, 0.22));
        ctx.fill(path);
      }
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, rc.dpr * 1.1);
      ctx.strokeStyle = css(fg);
      ctx.stroke(path);
    }
    return `${segments.toLocaleString()} edges drawn · depth ${maxDepth}`;
  },
};
