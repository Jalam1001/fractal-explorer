/**
 * Mandelbrot set — escape-time fractal.
 * For every pixel c, iterate z → z² + c starting at z = 0 and count how many
 * steps it takes |z| to escape. Points that never escape are in the set.
 */
import { BAILOUT2, smoothCount, periodicityEpsilon } from '../core/escape-time.js';
import { iterationParams } from './common-params.js';

export default {
  id: 'mandelbrot',
  name: 'Mandelbrot set',
  kind: 'escape',
  palette: 'ember',
  // world-space box shown by "Reset view": [xmin, xmax, ymin, ymax]
  bounds: [-2.35, 0.85, -1.22, 1.22],
  blurb:
    'Every pixel is a number c on the complex plane. Start at zero, square and add c again and again. ' +
    'If the result stays small forever, c belongs to the set (drawn in the interior color); if it runs ' +
    'off to infinity, the color shows how fast it escaped.',
  rule: 'z<sub>n+1</sub> = z<sub>n</sub><sup>2</sup> + c,&nbsp;&nbsp; z<sub>0</sub> = 0. &nbsp;c is in the set if |z<sub>n</sub>| never exceeds 2.',
  lookFor: [
    'Zoom into the “seahorse valley” between the main cardioid and the round bulb on its left: spirals of seahorse tails appear.',
    'Tiny copies of the whole set (“minibrots”) sit along the filaments — they are similar to the whole, but never exact copies.',
    'Raise the iteration limit when you zoom deep: the black regions shrink as more boundary points are revealed.',
  ],
  credit: 'Named after Benoît Mandelbrot, who made and studied computer pictures of it at IBM around 1980.',
  dimension: () => 'Boundary: 2 (proved by M. Shishikura, 1998)',
  params: iterationParams(400),
  // Interesting places: clicking one moves the view there.
  places: [
    { label: 'Seahorse valley', cx: -0.7453, cy: 0.1127, zoom: 150 },
    { label: 'Elephant valley', cx: 0.2925, cy: 0.0164, zoom: 100 },
    { label: 'Mini Mandelbrot', cx: -1.75488, cy: 0, zoom: 85 },
    { label: 'Deep spiral', cx: -0.743644786, cy: 0.1318252536, zoom: 4000 },
  ],

  /** Fill `out` with smooth escape counts for a block of rows (runs in a Web Worker). */
  computeRows(out, { x0, y0, dx, width, row0, rows, maxIter }) {
    const eps = periodicityEpsilon(dx);
    let o = 0;
    for (let j = 0; j < rows; j++) {
      const ci = y0 - (row0 + j) * dx;
      for (let i = 0; i < width; i++, o++) {
        const cr = x0 + i * dx;
        // Skip the main cardioid and the period-2 bulb analytically: they are inside.
        const xq = cr - 0.25;
        const q = xq * xq + ci * ci;
        if (q * (q + xq) <= 0.25 * ci * ci || (cr + 1) * (cr + 1) + ci * ci <= 0.0625) {
          out[o] = -1;
          continue;
        }
        let zr = 0, zi = 0, zr2 = 0, zi2 = 0, n = 0;
        let pr = 0, pi = 0, lap = 8, step = 0, inside = true;
        while (n < maxIter) {
          zi = 2 * zr * zi + ci;
          zr = zr2 - zi2 + cr;
          zr2 = zr * zr;
          zi2 = zi * zi;
          n++;
          if (zr2 + zi2 > BAILOUT2) { inside = false; break; }
          // Periodicity check: an orbit that repeats will never escape.
          if (Math.abs(zr - pr) < eps && Math.abs(zi - pi) < eps) break;
          if (++step === lap) { step = 0; lap *= 2; pr = zr; pi = zi; }
        }
        out[o] = inside ? -1 : smoothCount(n, zr2 + zi2);
      }
    }
  },
};
