/**
 * Shared helpers for escape-time fractals (Mandelbrot, Julia, Burning Ship).
 *
 * Each escape-time fractal module only has to fill a Float32Array with a
 * "smooth iteration count" per pixel (or -1 for points that never escaped).
 * Coloring happens afterwards, so changing a color never needs the
 * expensive maths to be redone.
 */
import { buildLUT, hexToRgb, mix } from './color.js';

/** Escape radius. A large radius makes the smooth coloring very even. */
export const BAILOUT = 256;
export const BAILOUT2 = BAILOUT * BAILOUT;
const LOG2_BAILOUT = Math.log2(BAILOUT);

/**
 * Continuous ("smooth") iteration count. For a point that escaped after n
 * steps with |z|² = mod2, returns a real number in [n-1, n) that varies
 * continuously across the image, which removes visible color bands.
 */
export function smoothCount(n, mod2) {
  const v = n - Math.log2((0.5 * Math.log2(mod2)) / LOG2_BAILOUT);
  return v > 0 ? v : 0;
}

/** Iteration limit that grows gently as you zoom, so deep views keep detail. */
export function effectiveIterations(base, zoom, auto) {
  if (!auto || zoom <= 1) return Math.round(base);
  return Math.min(20000, Math.round(base * (1 + 0.28 * Math.log2(zoom))));
}

/**
 * Exterior gradient. Built from the picker colors (background + fractal
 * color) plus the palette's two accents. It is cyclic so that deep zooms
 * keep showing contrast; it starts at the background color so the area far
 * from the set blends into the page.
 */
export function buildExteriorLUT(colors) {
  const bg = hexToRgb(colors.bg);
  const fg = hexToRgb(colors.fg);
  const a1 = hexToRgb(colors.accents?.[0] || colors.fg);
  const a2 = hexToRgb(colors.accents?.[1] || '#ffffff');
  return buildLUT([
    { pos: 0.0, rgb: bg },
    { pos: 0.2, rgb: mix(bg, fg, 0.3) },
    { pos: 0.38, rgb: fg },
    { pos: 0.55, rgb: a1 },
    { pos: 0.68, rgb: a2 },
    { pos: 0.84, rgb: mix(fg, bg, 0.4) },
    { pos: 1.0, rgb: bg },
  ], 2048);
}

/**
 * Turn a field of smooth counts into RGBA pixels.
 *  field   Float32Array (w*h), -1 = inside
 *  out     Uint8ClampedArray (w*h*4) – e.g. ImageData.data
 *  start/end  pixel index range to color (for progressive drawing)
 */
export function colorizeField(field, out, lut, interiorRgb, density, vmin = 0, start = 0, end = field.length) {
  const size = lut.length / 3 - 1;
  const k = 0.085 * density;
  // Measure color from the slowest-escaping point in view, so that at any zoom
  // the "far away" parts start at the background color and detail stands out.
  const base = Math.sqrt(Math.max(0, vmin));
  const ir = interiorRgb[0], ig = interiorRgb[1], ib = interiorRgb[2];
  for (let i = start; i < end; i++) {
    const v = field[i];
    const o = i * 4;
    if (v < 0) {
      out[o] = ir; out[o + 1] = ig; out[o + 2] = ib; out[o + 3] = 255;
      continue;
    }
    let t = (Math.sqrt(v) - base) * k;
    t = t > 0 ? t - Math.floor(t) : 0;
    const j = ((t * size) | 0) * 3;
    out[o] = lut[j]; out[o + 1] = lut[j + 1]; out[o + 2] = lut[j + 2]; out[o + 3] = 255;
  }
}

/** Smallest escape value in a field (ignoring interior points). */
export function minEscape(field) {
  let m = Infinity;
  for (let i = 0; i < field.length; i++) {
    const v = field[i];
    if (v >= 0 && v < m) m = v;
  }
  return m === Infinity ? 0 : m;
}

/**
 * Cheap interior test used by escape loops: detects orbits that have settled
 * into a cycle (Brent-style periodicity check). Returned as a tiny helper so
 * fractal modules stay readable.
 */
export function periodicityEpsilon(dx) {
  return Math.min(1e-12, dx * 1e-4);
}
