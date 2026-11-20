/**
 * Mouse, touch, pen, wheel and keyboard navigation for a canvas.
 * Uses Pointer Events, so one code path handles mouse drags, one-finger
 * pans and two-finger pinch-zoom. Only the canvas captures gestures
 * (it has `touch-action: none` in CSS); the rest of the page scrolls normally.
 */
export function attachInteraction(canvas, renderer, { onInteract = () => {}, onReset = () => {} } = {}) {
  const pointers = new Map();
  let last = null; // { x, y, dist } of the previous gesture frame

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const gesture = () => {
    const pts = [...pointers.values()];
    if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, dist: 0 };
    const [a, b] = pts;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, local(e));
    last = gesture();
    canvas.classList.add('dragging');
    onInteract('start');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, local(e));
    const g = gesture();
    if (!last) { last = g; return; }
    if (pointers.size >= 2 && last.dist > 0 && g.dist > 0) {
      // Pinch: zoom around the midpoint of the two fingers, and follow it as it moves.
      renderer.view.panBy(g.x - last.x, g.y - last.y);
      renderer.zoomAt(g.x, g.y, g.dist / last.dist);
    } else if (g.x !== last.x || g.y !== last.y) {
      renderer.panBy(g.x - last.x, g.y - last.y);
    }
    last = g;
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    last = pointers.size ? gesture() : null;
    if (!pointers.size) canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); // zoom the fractal instead of scrolling the page
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dy = Math.max(-300, Math.min(300, e.deltaY * unit));
    const p = local(e);
    renderer.zoomAt(p.x, p.y, Math.exp(-dy * 0.0022));
    onInteract('wheel');
  }, { passive: false });

  canvas.addEventListener('dblclick', (e) => {
    const p = local(e);
    renderer.zoomAt(p.x, p.y, e.shiftKey ? 0.5 : 2);
    onInteract('dblclick');
  });

  canvas.addEventListener('keydown', (e) => {
    const step = 60;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': renderer.panBy(step, 0); break;
      case 'ArrowRight': renderer.panBy(-step, 0); break;
      case 'ArrowUp': renderer.panBy(0, step); break;
      case 'ArrowDown': renderer.panBy(0, -step); break;
      case '+': case '=': renderer.zoomCenter(1.5); break;
      case '-': case '_': renderer.zoomCenter(1 / 1.5); break;
      case '0': case 'Home': onReset(); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); onInteract('key'); }
  });
}
