/**
 * Helpers for the geometric (recursive) fractals.
 */

/** True if a world-space box overlaps the visible world-space bounds. */
export function intersects(xmin, xmax, ymin, ymax, b) {
  return xmax >= b.xmin && xmin <= b.xmax && ymax >= b.ymin && ymin <= b.ymax;
}

/**
 * Clip a polygon (flat array [x0,y0,x1,y1,...] in device pixels) to a
 * rectangle using Sutherland–Hodgman. Used when zoomed very deep, where a
 * huge shape has corners millions of pixels off-screen: the canvas works in
 * 32-bit floats and would otherwise misplace the visible edges.
 */
export function clipPolygon(pts, x0, y0, x1, y1) {
  let out = pts;
  const edges = [
    (x, y) => x >= x0, (x, y) => x <= x1, (x, y) => y >= y0, (x, y) => y <= y1,
  ];
  const cut = [
    (ax, ay, bx, by) => [x0, ay + ((by - ay) * (x0 - ax)) / (bx - ax)],
    (ax, ay, bx, by) => [x1, ay + ((by - ay) * (x1 - ax)) / (bx - ax)],
    (ax, ay, bx, by) => [ax + ((bx - ax) * (y0 - ay)) / (by - ay), y0],
    (ax, ay, bx, by) => [ax + ((bx - ax) * (y1 - ay)) / (by - ay), y1],
  ];
  for (let e = 0; e < 4; e++) {
    const inp = out;
    out = [];
    const n = inp.length / 2;
    if (!n) break;
    let px = inp[inp.length - 2], py = inp[inp.length - 1];
    let pin = edges[e](px, py);
    for (let i = 0; i < n; i++) {
      const cx = inp[i * 2], cy = inp[i * 2 + 1];
      const cin = edges[e](cx, cy);
      if (cin) {
        if (!pin) out.push(...cut[e](px, py, cx, cy));
        out.push(cx, cy);
      } else if (pin) {
        out.push(...cut[e](px, py, cx, cy));
      }
      px = cx; py = cy; pin = cin;
    }
  }
  return out;
}

/** Add a polygon to a path, clipping it first only when it is enormous. */
export function addPolygon(path, pts, rc) {
  const LIMIT = 4e4;
  let big = false;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i] > LIMIT || pts[i] < -LIMIT) { big = true; break; }
  }
  if (big) {
    const m = 50;
    pts = clipPolygon(pts, -m, -m, rc.width + m, rc.height + m);
    if (pts.length < 6) return;
  }
  path.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
  path.closePath();
}

/** Extra recursion levels to add when zoomed in by `zoom`, for shapes that shrink by `ratio` per level. */
export function extraLevels(zoom, ratio) {
  if (zoom <= 1) return 0;
  return Math.ceil(Math.log(zoom) / Math.log(1 / ratio));
}
