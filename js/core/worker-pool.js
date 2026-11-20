/**
 * A small pool of Web Workers for escape-time rendering, with a priority
 * queue and cancellation of stale jobs. If module workers are unavailable it
 * falls back to computing on the main thread in small slices.
 */
import { getFractal } from '../fractals/index.js';

export class WorkerPool {
  constructor(size = Math.min(8, Math.max(2, (navigator.hardwareConcurrency || 4) - 1))) {
    this.queue = [];
    this.idle = [];
    this.pending = new Map();
    this.nextId = 1;
    this.inline = false;
    try {
      for (let i = 0; i < size; i++) {
        const w = new Worker(new URL('../workers/escape-worker.js', import.meta.url), { type: 'module' });
        w.onmessage = (e) => this._done(w, e.data);
        w.onerror = (e) => this._fail(w, e);
        this.idle.push(w);
      }
    } catch (err) {
      console.warn('Web Workers unavailable, rendering on the main thread.', err);
      this.inline = true;
      this.idle = [];
    }
    this.size = this.inline ? 1 : size;
  }

  /**
   * Queue a job. `isStale()` is checked just before the job starts; stale
   * jobs are dropped (their promise resolves to null).
   */
  run(job, { priority = 0, isStale = () => false } = {}) {
    return new Promise((resolve) => {
      const entry = { job: { ...job, id: this.nextId++ }, priority, isStale, resolve };
      // Insert keeping the queue sorted by priority (lower first), FIFO within a priority.
      let i = this.queue.length;
      while (i > 0 && this.queue[i - 1].priority > priority) i--;
      this.queue.splice(i, 0, entry);
      this._pump();
    });
  }

  _pump() {
    if (this.inline) {
      if (this._inlineBusy) return;
      this._inlineBusy = true;
      const step = () => {
        const entry = this._nextEntry();
        if (!entry) { this._inlineBusy = false; return; }
        const out = new Float32Array(entry.job.width * entry.job.rows);
        getFractal(entry.job.fractalId).computeRows(out, entry.job);
        entry.resolve(out);
        setTimeout(step, 0);
      };
      setTimeout(step, 0);
      return;
    }
    while (this.idle.length) {
      const entry = this._nextEntry();
      if (!entry) return;
      const w = this.idle.pop();
      this.pending.set(w, entry);
      w.postMessage(entry.job);
    }
  }

  _nextEntry() {
    while (this.queue.length) {
      const entry = this.queue.shift();
      if (entry.isStale()) { entry.resolve(null); continue; }
      return entry;
    }
    return null;
  }

  _done(w, data) {
    const entry = this.pending.get(w);
    this.pending.delete(w);
    this.idle.push(w);
    if (entry) entry.resolve(data.out);
    this._pump();
  }

  _fail(w, err) {
    console.warn('Worker failed; switching to main-thread rendering.', err?.message || err);
    // Re-queue everything that was running and switch to main-thread mode.
    for (const entry of this.pending.values()) this.queue.unshift(entry);
    this.pending.clear();
    for (const worker of this.idle) worker.terminate();
    w.terminate();
    this.idle = [];
    this.inline = true;
    this.size = 1;
    this._pump();
  }
}
