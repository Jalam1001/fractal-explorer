/**
 * Julia sets — escape-time fractal.
 * Same rule as the Mandelbrot set, but c is fixed (chosen with the sliders)
 * and the pixel is the starting value z₀.
 */
import { BAILOUT2, smoothCount, periodicityEpsilon } from '../core/escape-time.js';
import { iterationParams } from './common-params.js';

export const JULIA_PRESETS = [
  { label: 'Dragon', re: -0.8, im: 0.156 },
  { label: 'Douady rabbit', re: -0.123, im: 0.745 },
  { label: 'Spiral galaxy', re: 0.285, im: 0.01 },
  { label: 'Siegel disk', re: -0.390541, im: -0.586788 },
  { label: 'Dendrite (c = i)', re: 0, im: 1 },
  { label: 'San Marco', re: -0.75, im: 0 },
  { label: 'Dust (disconnected)', re: 0.4, im: 0.3 },
];

export default {
  id: 'julia',
  name: 'Julia set',
  kind: 'escape',
  palette: 'ocean',
  bounds: [-1.75, 1.75, -1.0, 1.0],
  blurb:
    'Fix one complex number c and let every pixel be a starting point z₀. Apply z → z² + c repeatedly. ' +
    'Starting points that stay bounded form the “filled Julia set”; its edge is the Julia set. ' +
    'Every value of c gives a different shape.',
  rule: 'z<sub>n+1</sub> = z<sub>n</sub><sup>2</sup> + c, &nbsp;z<sub>0</sub> = the pixel, &nbsp;c = <span class="jc">c<sub>re</sub> + c<sub>im</sub>·i</span> (fixed)',
  lookFor: [
    'Move the c sliders slowly: when c lies inside the Mandelbrot set the Julia set is one connected piece; step outside and it shatters into “dust”.',
    'Zoom into any edge: the same curls repeat at every scale, because the rule maps the set onto itself.',
    'Try the Douady rabbit preset and count the “ears” meeting at each junction.',
  ],
  credit: 'Studied by Gaston Julia and Pierre Fatou around 1917–1920, long before computers could draw them.',
  dimension: () => 'Depends on c (between 1 and 2 for connected sets)',
  presets: { label: 'Famous values of c', items: JULIA_PRESETS.map((p) => ({ label: p.label, values: { cRe: p.re, cIm: p.im } })) },
  params: [
    { id: 'cRe', label: 'c — real part', type: 'range', min: -1.5, max: 1.5, step: 0.001, value: -0.8 },
    { id: 'cIm', label: 'c — imaginary part', type: 'range', min: -1.5, max: 1.5, step: 0.001, value: 0.156 },
    ...iterationParams(300),
  ],

  computeRows(out, { x0, y0, dx, width, row0, rows, maxIter, params }) {
    const cr = +params.cRe, ci = +params.cIm;
    const eps = periodicityEpsilon(dx);
    let o = 0;
    for (let j = 0; j < rows; j++) {
      const y = y0 - (row0 + j) * dx;
      for (let i = 0; i < width; i++, o++) {
        let zr = x0 + i * dx, zi = y;
        let zr2 = zr * zr, zi2 = zi * zi, n = 0;
        let pr = zr, pi = zi, lap = 8, step = 0, inside = true;
        if (zr2 + zi2 > BAILOUT2) { out[o] = 0; continue; }
        while (n < maxIter) {
          zi = 2 * zr * zi + ci;
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
