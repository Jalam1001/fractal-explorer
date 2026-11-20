/** Small color helpers shared by every renderer. */

export function hexToRgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear blend between two RGB triples (t = 0 → a, t = 1 → b). */
export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function css(rgb, alpha = 1) {
  const [r, g, b] = rgb.map((v) => Math.round(v));
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/** Relative luminance (0..1), used to pick readable highlight colors. */
export function luminance([r, g, b]) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Build a lookup table from color stops.
 * stops: [{ pos: 0..1, rgb: [r,g,b] }, ...] sorted by pos.
 * Returns Uint8ClampedArray(size * 3).
 */
export function buildLUT(stops, size = 2048) {
  const lut = new Uint8ClampedArray(size * 3);
  let k = 0;
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    while (k < stops.length - 2 && t > stops[k + 1].pos) k++;
    const a = stops[k];
    const b = stops[Math.min(k + 1, stops.length - 1)];
    const span = b.pos - a.pos || 1;
    const u = Math.max(0, Math.min(1, (t - a.pos) / span));
    // smoothstep easing gives softer transitions between stops
    const s = u * u * (3 - 2 * u);
    const c = mix(a.rgb, b.rgb, s);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
  return lut;
}
