/**
 * View: which part of the infinite mathematical plane is on screen.
 *
 *   cx, cy  – world coordinates of the canvas centre
 *   scale   – world units per CSS pixel (smaller = more zoomed in)
 *
 * World y points UP (like a maths graph); screen y points down.
 */
export class View {
  constructor(cx = 0, cy = 0, scale = 0.01) {
    this.cx = cx;
    this.cy = cy;
    this.scale = scale;
  }

  clone() {
    return new View(this.cx, this.cy, this.scale);
  }

  equals(o) {
    return !!o && o.cx === this.cx && o.cy === this.cy && o.scale === this.scale;
  }

  /** CSS-pixel position -> world coordinates. */
  toWorld(px, py, w, h) {
    return [this.cx + (px - w / 2) * this.scale, this.cy - (py - h / 2) * this.scale];
  }

  /** World coordinates -> CSS-pixel position. */
  toScreen(wx, wy, w, h) {
    return [w / 2 + (wx - this.cx) / this.scale, h / 2 - (wy - this.cy) / this.scale];
  }

  /** Move the picture by (dx, dy) CSS pixels. */
  panBy(dx, dy) {
    this.cx -= dx * this.scale;
    this.cy += dy * this.scale;
  }

  /** Zoom by `factor` (>1 zooms in) keeping the point under (px, py) fixed. */
  zoomAt(px, py, factor, w, h) {
    const [wx, wy] = this.toWorld(px, py, w, h);
    this.scale /= factor;
    this.cx = wx - (px - w / 2) * this.scale;
    this.cy = wy + (py - h / 2) * this.scale;
  }

  /** Build a view that fits a world-space box into a w×h CSS-pixel canvas. */
  static fit(bounds, w, h, margin = 1.04) {
    const [xmin, xmax, ymin, ymax] = bounds;
    const scale = Math.max((xmax - xmin) / w, (ymax - ymin) / h) * margin;
    return new View((xmin + xmax) / 2, (ymin + ymax) / 2, scale);
  }
}
