/**
 * Fractal registry. To add a fractal, write a module in this folder that
 * follows the same shape as the others (see README → "Adding a new fractal")
 * and add it to this list. The order here is the order of the tabs/gallery.
 */
import mandelbrot from './mandelbrot.js';
import julia from './julia.js';
import burningShip from './burning-ship.js';
import sierpinski from './sierpinski.js';
import koch from './koch.js';
import barnsleyFern from './barnsley-fern.js';
import cantor from './cantor.js';
import pythagorasTree from './pythagoras-tree.js';

export const FRACTALS = [mandelbrot, julia, burningShip, sierpinski, koch, barnsleyFern, cantor, pythagorasTree];

export function getFractal(id) {
  return FRACTALS.find((f) => f.id === id);
}

/** Default parameter values for a fractal, as a plain object. */
export function defaultParams(fractal) {
  const p = {};
  for (const def of fractal.params) p[def.id] = def.value;
  return p;
}
