/**
 * Pythagoras tree — geometric recursion.
 * On top of a square build a right triangle; on the triangle's two short
 * sides build two new squares; repeat for each new square.
 */
import { hexToRgb, mix, css } from '../core/color.js';
import { intersects, addPolygon, extraLevels } from '../core/geometry.js';
import { depthParams } from './common-params.js';

/** Walk the tree; calls visit(p0x,p0y,vx,vy,depth) for every visible square. */
function walk(params, maxDepth, minSize, bounds, visit, budget = 500000) {
  const th = (+params.angle * Math.PI) / 180;
  const cos = Math.cos(th), sin = Math.sin(th);
  const kmax = Math.max(cos, sin);
  // Everything grown from a square of side s fits in a circle of this radius around its centre.
  const reach = (1 + kmax / 2) / (1 - kmax) + 0.72;
  let count = 0;
  const rec = (x, y, vx, vy, d) => {
    const s = Math.hypot(vx, vy);
    const cx = x + (vx - vy) / 2, cy = y + (vy + vx) / 2; // square centre
    const r = s * reach;
    if (bounds && !intersects(cx - r, cx + r, cy - r, cy + r, bounds)) return;
    visit(x, y, vx, vy, d);
    if (++count > budget || d >= maxDepth || s < minSize) return;
    // Top edge runs from p3 = p0 + n to p2 = p0 + v + n, where n = v rotated 90°.
    const p3x = x - vy, p3y = y + vx;
    const p2x = p3x + vx, p2y = p3y + vy;
    // Apex of the right triangle built on the top edge.
    const qx = p3x + cos * (vx * cos - vy * sin);
    const qy = p3y + cos * (vx * sin + vy * cos);
    rec(p3x, p3y, qx - p3x, qy - p3y, d + 1);
    rec(qx, qy, p2x - qx, p2y - qy, d + 1);
  };
  rec(-0.5, 0, 1, 0, 0);
  return count;
}

export default {
  id: 'pythagoras-tree',
  name: 'Pythagoras tree',
  kind: 'geometric',
  palette: 'forest',
  bounds: [-3.1, 3.1, -0.1, 4.1],
  getBounds(params) {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    walk(params, 11, 0, null, (x, y, vx, vy) => {
      for (const [px, py] of [[x, y], [x + vx, y + vy], [x + vx - vy, y + vy + vx], [x - vy, y + vx]]) {
        if (px < xmin) xmin = px; if (px > xmax) xmax = px;
        if (py < ymin) ymin = py; if (py > ymax) ymax = py;
      }
    });
    const pad = 0.04 * (xmax - xmin);
    return [xmin - pad, xmax + pad, ymin - pad, ymax + pad];
  },
  blurb:
    'Build a right triangle on top of a square, then a square on each of the triangle’s two shorter sides. ' +
    'Repeat on every new square. By Pythagoras’ theorem the two new squares together have the same area as the ' +
    'one below — a simple rule that grows something that looks remarkably like a tree or a head of broccoli.',
  rule: 'Square of side s → two squares of sides s·cos θ and s·sin θ on a right triangle (θ = branch angle).',
  lookFor: [
    'At 45° the tree is symmetric; move the angle slider and it leans, curls and starts to spiral.',
    'From about depth 5 the branches begin to overlap — the tree “grows into itself”.',
    'Zoom into the tips: each branch is a smaller copy of the whole tree (exact self-similarity).',
  ],
  credit: 'First drawn by the Dutch engineer and teacher Albert E. Bosman in 1942.',
  dimension: (p) => (+p.angle === 45 ? '2 (the full tree has positive area)' : '—'),
  params: [
    ...depthParams(10, 16, 'How many generations of squares to grow at the starting zoom.'),
    { id: 'angle', label: 'Branch angle θ (degrees)', type: 'range', min: 15, max: 75, step: 1, value: 45, format: (v) => `${v}°`, resetsView: true },
  ],

  draw(rc) {
    const { ctx, params, bounds: b, k, X, Y } = rc;
    const bg = hexToRgb(rc.colors.bg);
    const fg = hexToRgb(rc.colors.fg);
    const a1 = hexToRgb(rc.colors.accents[0]);
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, rc.width, rc.height);

    const th = (+params.angle * Math.PI) / 180;
    const ratio = Math.max(Math.cos(th), Math.sin(th));
    const base = +params.depth;
    const extra = params.autoDetail ? extraLevels(rc.zoom, ratio) : 0;
    const maxDepth = Math.min(base + extra, 80);
    const minSize = (rc.quality === 'preview' ? 2.5 : 0.7) / k;

    const paths = [];
    const outline = new Path2D();
    const count = walk(params, maxDepth, minSize, b, (x, y, vx, vy, d) => {
      const pts = [X(x), Y(y), X(x + vx), Y(y + vy), X(x + vx - vy), Y(y + vy + vx), X(x - vy), Y(y + vx)];
      addPolygon((paths[d] ||= new Path2D()), pts, rc);
      if (Math.hypot(vx, vy) * k > 10) addPolygon(outline, pts, rc);
    });

    // Color by generation: darker trunk → fractal color → hint of accent at the tips.
    const trunk = mix(fg, bg, 0.55);
    const tip = mix(fg, a1, 0.4);
    const span = Math.max(base, 1);
    paths.forEach((p, d) => {
      if (!p) return;
      const t = Math.min(1, d / span);
      const col = t < 0.6 ? mix(trunk, fg, t / 0.6) : mix(fg, tip, (t - 0.6) / 0.4);
      ctx.fillStyle = css(col);
      ctx.fill(p);
    });
    ctx.lineWidth = Math.max(1, rc.dpr * 0.8);
    ctx.strokeStyle = css(bg, 0.35);
    ctx.stroke(outline);
    return `${count.toLocaleString()} squares · depth ${maxDepth}`;
  },
};
