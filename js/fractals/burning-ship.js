/**
 * Burning Ship — escape-time fractal.
 * Like the Mandelbrot set, but the real and imaginary parts are made
 * positive (absolute value) before squaring. The picture is drawn with the
 * imaginary axis flipped, as is traditional, so the "ship" sits upright.
 */
import { BAILOUT2, smoothCount, periodicityEpsilon } from '../core/escape-time.js';
import { iterationParams } from './common-params.js';

export default {
  id: 'burning-ship',
  name: 'Burning Ship',
  kind: 'escape',
  palette: 'ember',
  bounds: [-2.25, 1.35, -1.15, 1.95],
  blurb:
    'A small change to the Mandelbrot rule — take absolute values of both parts of z before squaring — ' +
    'breaks its smooth symmetry and produces sharp, flame-like structures. Its best-known feature is a ' +
    'small “ship” with masts and flames on the left-hand antenna.',
  rule: 'z<sub>n+1</sub> = (|Re z<sub>n</sub>| + i·|Im z<sub>n</sub>|)<sup>2</sup> + c, &nbsp;z<sub>0</sub> = 0 &nbsp;(image flipped vertically)',
  lookFor: [
    'Zoom into the antenna on the far left (near x ≈ −1.76) to find the famous burning ship with its masts and rigging.',
    'Notice the hard, straight creases: the absolute value acts like a fold, so this fractal is not smooth like the Mandelbrot set.',
    'Smaller “ships” repeat along the antenna — approximately, not exactly, self-similar.',
  ],
  credit: 'Introduced by Michael Michelitsch and Otto E. Rössler in 1992.',
  dimension: () => '—',
  params: iterationParams(300),
  places: [
    { label: 'The burning ship', cx: -1.755, cy: 0.035, zoom: 35 },
    { label: 'Armada of small ships', cx: -1.625, cy: 0.012, zoom: 60 },
  ],

  computeRows(out, { x0, y0, dx, width, row0, rows, maxIter }) {
    const eps = periodicityEpsilon(dx);
    let o = 0;
    for (let j = 0; j < rows; j++) {
      const ci = -(y0 - (row0 + j) * dx); // flip so the ship is upright
      for (let i = 0; i < width; i++, o++) {
        const cr = x0 + i * dx;
        let zr = 0, zi = 0, zr2 = 0, zi2 = 0, n = 0;
        let pr = 0, pi = 0, lap = 8, step = 0, inside = true;
        while (n < maxIter) {
          zi = 2 * Math.abs(zr * zi) + ci;
          zr = zr2 - zi2 + cr;
          zr2 = zr * zr;
          zi2 = zi * zi;
          n++;
          if (zr2 + zi2 > BAILOUT2) { inside = false; break; }
          if (Math.abs(zr - pr) < eps && Math.abs(zi - pi) < eps) break;
          if (++step === lap) { step = 0; lap *= 2; pr = zr; pi = zi; }
        }
        out[o] = inside ? -1 : smoothCount(n, zr2 + zi2);
      }
    }
  },
};
