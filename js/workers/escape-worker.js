/**
 * Web Worker that runs the escape-time maths off the main thread, so the
 * page stays responsive while a big image is being computed.
 * It receives a block of rows, asks the fractal module to fill them with
 * smooth iteration counts, and sends the numbers back.
 */
import { getFractal } from '../fractals/index.js';

self.onmessage = (event) => {
  const job = event.data;
  const fractal = getFractal(job.fractalId);
  const out = new Float32Array(job.width * job.rows);
  fractal.computeRows(out, job);
  self.postMessage({ id: job.id, out }, [out.buffer]);
};
