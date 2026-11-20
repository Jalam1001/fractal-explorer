/**
 * FractalRenderer — owns one <canvas> and keeps it showing one fractal.
 *
 * The same class drives the big explorer canvas and every gallery preview.
 *
 * Rendering strategy
 *  - While you drag/zoom: the last finished image is instantly moved/scaled
 *    to follow your finger, and a low-resolution preview is computed.
 *  - When you pause (~200 ms): a full-resolution image is computed. For the
 *    escape-time fractals this happens in Web Workers, block by block, from
 *    the centre outwards, so the page never freezes.
 *  - Color changes re-color the stored iteration counts without redoing the maths.
 */
import { View } from './view.js';
import { hexToRgb } from './color.js';
import { buildExteriorLUT, colorizeField, effectiveIterations, minEscape } from './escape-time.js';

const REFINE_DELAY = 200;

export class FractalRenderer {
  constructor(canvas, { pool, interactive = true, maxPixels = 5.5e6, priority = 0, onUpdate = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.pool = pool;
    this.interactive = interactive;
    this.maxPixels = maxPixels;
    this.priority = priority;
    this.onUpdate = onUpdate;
    this.gen = 0;
    this.view = null;
    this.cssW = 0;
    this.cssH = 0;
    this.rs = 1; // device pixels per CSS pixel actually rendered
    this.lastFrame = null; // { canvas, left, top, perPx } — world rect of the last finished image
    this.field = null; // full-res escape-time counts for instant recoloring
    this.fullValid = false;
    this.fullActive = false;
    this.previewBusy = false;
    this.previewDirty = false;
    this.info = '';
    this.vmin = 0; // smallest escape count in view (color offset)
    this._raf = 0;
    this._refineTimer = 0;
  }

  // ---------------------------------------------------------------- state

  setFractal(fractal, params, colors, { keepView = false } = {}) {
    this.fractal = fractal;
    this.params = params;
    this.setColors(colors, { silent: true });
    this.field = null;
    this.lastFrame = null;
    this.fullValid = false;
    this.vmin = 0;
    this.measure();
    if (!keepView || !this.view) this.resetView({ silent: true });
    this.renderFull();
  }

  setParams(params, { live = true } = {}) {
    this.params = params;
    this.field = null;
    this.fullValid = false;
    if (live && this.interactive) this._interactiveUpdate();
    else this.renderFull();
  }

  setColors(colors, { silent = false } = {}) {
    this.colors = colors;
    this.lut = buildExteriorLUT(colors);
    this.interiorRgb = hexToRgb(colors.interior);
    if (!silent) this._scheduleRecolor();
  }

  get defaultScale() {
    const b = this.fractal.getBounds ? this.fractal.getBounds(this.params) : this.fractal.bounds;
    return View.fit(b, this.cssW || 1, this.cssH || 1).scale;
  }

  get zoom() {
    return this.view ? this._defaultScale / this.view.scale : 1;
  }

  get maxZoom() {
    return this.fractal.kind === 'escape' ? 2e11 : 1e8;
  }

  resetView({ silent = false } = {}) {
    const b = this.fractal.getBounds ? this.fractal.getBounds(this.params) : this.fractal.bounds;
    this.view = View.fit(b, this.cssW || 1, this.cssH || 1);
    this._defaultScale = this.view.scale;
    if (!silent) this._viewChanged();
  }

  /** Size the canvas backing store to its CSS size × device pixel ratio (with a pixel budget). */
  measure() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    // On low-density screens render at 2× and let the browser downsample: free anti-aliasing.
    let rs = this.interactive ? (dpr < 1.5 ? 2 : Math.min(dpr, 3)) : Math.max(dpr, 1.5);
    if (w * h * rs * rs > this.maxPixels) rs = Math.sqrt(this.maxPixels / (w * h));
    const W = Math.round(w * rs), H = Math.round(h * rs);
    const changed = W !== this.canvas.width || H !== this.canvas.height;
    if (this.view && this.cssW && (w !== this.cssW || h !== this.cssH)) {
      // keep the same zoom relative to the fitted view
      const old = this._defaultScale;
      this.cssW = w; this.cssH = h;
      const b = this.fractal.getBounds ? this.fractal.getBounds(this.params) : this.fractal.bounds;
      this._defaultScale = View.fit(b, w, h).scale;
      this.view.scale *= this._defaultScale / old;
    }
    this.cssW = w; this.cssH = h; this.rs = W / w;
    if (changed) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    return changed;
  }

  resize() {
    if (!this.fractal) return;
    if (this.measure()) {
      this.fullValid = false;
      this.field = null;
      this._drawTransformed();
      this._scheduleRefine(120);
    }
  }

  // ---------------------------------------------------------- navigation

  panBy(dx, dy) {
    this.view.panBy(dx, dy);
    this._viewChanged();
  }

  zoomAt(px, py, factor) {
    const z = this.zoom;
    const target = Math.min(this.maxZoom, Math.max(0.1, z * factor));
    factor = target / z;
    if (Math.abs(factor - 1) < 1e-9) { this._update(); return; }
    this.view.zoomAt(px, py, factor, this.cssW, this.cssH);
    this._viewChanged();
  }

  zoomCenter(factor) {
    this.zoomAt(this.cssW / 2, this.cssH / 2, factor);
  }

  /** Jump to a named place: centre (world units) and zoom relative to the reset view. */
  goTo(cx, cy, zoom) {
    this.view.cx = cx;
    this.view.cy = cy;
    this.view.scale = this._defaultScale / Math.min(this.maxZoom, Math.max(0.1, zoom));
    this._viewChanged();
  }

  _viewChanged() {
    this.fullValid = false;
    if (!this.interactive) { this.renderFull(); return; }
    this._interactiveUpdate();
  }

  _interactiveUpdate() {
    this.gen++; // cancels any full render in progress
    this.fullActive = false;
    if (!this._raf) {
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        if (this.fractal.kind === 'escape') {
          this._drawTransformed();
          this._startPreview();
        } else {
          this._drawGeometric('preview');
        }
        this._update(true);
      });
    }
    this._scheduleRefine(REFINE_DELAY);
  }

  _scheduleRefine(delay) {
    clearTimeout(this._refineTimer);
    this._refineTimer = setTimeout(() => this.renderFull(), delay);
  }

  _scheduleRecolor() {
    if (this._recolorRaf) return;
    this._recolorRaf = requestAnimationFrame(() => {
      this._recolorRaf = 0;
      if (this.fractal.kind !== 'escape') { this._drawGeometric('full'); this._update(false); return; }
      if (this.fullValid && this.field) {
        this._paintField(this.field);
        this._snapshot();
      } else {
        if (this.lastFrame?.field) this._repaintPreviewFrame();
        this.gen++;
        this.renderFull();
      }
    });
  }

  // ------------------------------------------------------------ rendering

  /** Build the "render context" handed to geometric fractal modules. */
  _rc(quality) {
    const v = this.view;
    const W = this.canvas.width, H = this.canvas.height;
    const k = this.rs / v.scale; // device pixels per world unit
    const halfW = W / 2 / k, halfH = H / 2 / k;
    return {
      ctx: this.ctx, width: W, height: H, dpr: this.rs, view: v, k,
      zoom: this.zoom, quality, params: this.params, colors: this.colors,
      bounds: { xmin: v.cx - halfW, xmax: v.cx + halfW, ymin: v.cy - halfH, ymax: v.cy + halfH },
      X: (x) => (x - v.cx) * k + W / 2,
      Y: (y) => H / 2 - (y - v.cy) * k,
    };
  }

  renderFull() {
    clearTimeout(this._refineTimer);
    if (!this.fractal || !this.view) return;
    if (this.fractal.kind === 'escape') this._renderEscapeFull();
    else { this._drawGeometric('full'); this._update(false); }
  }

  _drawGeometric(quality) {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    try {
      const t0 = performance.now();
      const info = this.fractal.draw(this._rc(quality)) || '';
      this.info = `${info}${info ? ' · ' : ''}${Math.round(performance.now() - t0)} ms`;
    } catch (err) {
      console.error(err);
    }
    if (quality === 'full') this.fullValid = true;
  }

  _maxIter() {
    return effectiveIterations(+this.params.maxIter, this.zoom, this.params.autoIter);
  }

  _escapeJobBase(view, W, perPx) {
    return {
      fractalId: this.fractal.id,
      params: { ...this.params },
      maxIter: this._maxIter(),
      x0: view.cx - (W / 2 - 0.5) * perPx,
      dx: perPx,
      width: W,
    };
  }

  async _renderEscapeFull() {
    const gen = ++this.gen;
    this.fullActive = true;
    this._update(true);
    const W = this.canvas.width, H = this.canvas.height;
    const v = this.view.clone();
    const perPx = v.scale / this.rs;
    const base = this._escapeJobBase(v, W, perPx);
    base.y0 = v.cy + (H / 2 - 0.5) * perPx;
    const field = new Float32Array(W * H);
    const rowsPer = Math.max(4, Math.ceil(H / (this.pool.size * 6)));
    const chunks = [];
    for (let r = 0; r < H; r += rowsPer) chunks.push([r, Math.min(rowsPer, H - r)]);
    // Centre-out order so the interesting middle sharpens first.
    chunks.sort((a, b) => Math.abs(a[0] + a[1] / 2 - H / 2) - Math.abs(b[0] + b[1] / 2 - H / 2));
    const stale = () => gen !== this.gen;
    const t0 = performance.now();
    await Promise.all(chunks.map(([row0, rows]) =>
      this.pool.run({ ...base, row0, rows }, { priority: this.priority, isStale: stale }).then((out) => {
        if (!out || stale()) return;
        field.set(out, row0 * W);
        const img = this.ctx.createImageData(W, rows);
        colorizeField(out, img.data, this.lut, this.interiorRgb, +this.colors.density || 1, this.vmin);
        this.ctx.putImageData(img, 0, row0);
      })));
    if (stale()) return;
    // The color offset was estimated from the preview; if the exact value differs, repaint once
    // (so the same view always gets exactly the same colors).
    const vmin = minEscape(field);
    if (vmin !== this.vmin) {
      this.vmin = vmin;
      this._paintField(field);
    }
    this.field = field;
    this.fullValid = true;
    this.fullActive = false;
    this.info = `${base.maxIter.toLocaleString()} iterations · ${Math.round(performance.now() - t0)} ms`;
    this._snapshot();
    this._update(false);
    this.onRendered?.();
  }

  async _startPreview() {
    if (this.previewBusy) { this.previewDirty = true; return; }
    this.previewBusy = true;
    this.previewDirty = false;
    const W = this.canvas.width, H = this.canvas.height;
    const f = Math.max(2, Math.ceil(Math.sqrt((W * H) / 140000)));
    const w = Math.ceil(W / f), h = Math.ceil(H / f);
    const v = this.view.clone();
    const perPx = (v.scale / this.rs) * f;
    const base = this._escapeJobBase(v, w, perPx);
    base.y0 = v.cy + (h / 2 - 0.5) * perPx;
    const n = Math.max(1, this.pool.size);
    const rowsPer = Math.ceil(h / n);
    const field = new Float32Array(w * h);
    const jobs = [];
    for (let r = 0; r < h; r += rowsPer) {
      const rows = Math.min(rowsPer, h - r);
      jobs.push(this.pool.run({ ...base, row0: r, rows }, { priority: -1 }).then((out) => out && field.set(out, r * w)));
    }
    await Promise.all(jobs);
    this.previewBusy = false;
    if (!this.fullActive && !this.fullValid) {
      this.vmin = minEscape(field);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      this.lastFrame = {
        canvas: c, field, w, h,
        left: v.cx - (w / 2) * perPx, top: v.cy + (h / 2) * perPx, perPx,
      };
      this._repaintPreviewFrame();
    }
    if (this.previewDirty) this._startPreview();
  }

  _repaintPreviewFrame() {
    const lf = this.lastFrame;
    const cx = lf.canvas.getContext('2d');
    const img = cx.createImageData(lf.w, lf.h);
    colorizeField(lf.field, img.data, this.lut, this.interiorRgb, +this.colors.density || 1, this.vmin);
    cx.putImageData(img, 0, 0);
    this._drawTransformed();
  }

  _paintField(field) {
    const W = this.canvas.width, H = this.canvas.height;
    if (field.length !== W * H) return;
    const img = this.ctx.createImageData(W, H);
    colorizeField(field, img.data, this.lut, this.interiorRgb, +this.colors.density || 1, this.vmin);
    this.ctx.putImageData(img, 0, 0);
  }

  /** Copy the finished canvas so it can be shown moved/scaled during the next gesture. */
  _snapshot() {
    const W = this.canvas.width, H = this.canvas.height;
    let c = this.lastFrame?.canvas;
    if (!c || this.lastFrame.field || c.width !== W || c.height !== H) {
      c = document.createElement('canvas');
      c.width = W; c.height = H;
    }
    c.getContext('2d').drawImage(this.canvas, 0, 0);
    const v = this.view, perPx = v.scale / this.rs;
    this.lastFrame = { canvas: c, left: v.cx - (W / 2) * perPx, top: v.cy + (H / 2) * perPx, perPx };
  }

  /** Instantly show the last finished image, moved/scaled to the current view. */
  _drawTransformed() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, W, H);
    const lf = this.lastFrame;
    if (!lf) return;
    const v = this.view, perPx = v.scale / this.rs;
    const x = (lf.left - v.cx) / perPx + W / 2;
    const y = H / 2 - (lf.top - v.cy) / perPx;
    const s = lf.perPx / perPx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(lf.canvas, x, y, lf.canvas.width * s, lf.canvas.height * s);
  }

  _update(busy) {
    this.onUpdate({ busy, info: this.info, zoom: this.zoom, view: this.view, maxIter: this.fractal.kind === 'escape' ? this._maxIter() : null });
  }
}
