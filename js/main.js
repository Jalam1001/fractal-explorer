/**
 * Fractal Explorer — page wiring.
 * Builds the tabs, controls and gallery from the fractal registry, and
 * connects them to the renderer. All fractal-specific maths lives in
 * js/fractals/*.js; all drawing machinery lives in js/core/*.js.
 */
import { FRACTALS, getFractal, defaultParams } from './fractals/index.js';
import { PALETTES, getPalette } from './core/palettes.js';
import { FractalRenderer } from './core/renderer.js';
import { WorkerPool } from './core/worker-pool.js';
import { attachInteraction } from './core/interaction.js';

const $ = (sel) => document.querySelector(sel);

const pool = new WorkerPool();
const paramsById = Object.fromEntries(FRACTALS.map((f) => [f.id, defaultParams(f)]));
const state = {
  fractal: null,
  colors: null, // { bg, fg, interior, accents, density, paletteId }
};

function paletteColors(id, density = 1) {
  const p = getPalette(id);
  return { bg: p.bg, fg: p.fg, interior: p.interior, accents: [...p.accents], density, paletteId: p.id };
}

// ------------------------------------------------------------------ main canvas
const canvas = $('#main-canvas');
const readout = $('#readout');
const busy = $('#busy');

function fmtZoom(z) {
  if (z < 1000) return `${z < 10 ? z.toFixed(2) : z.toFixed(1)}×`;
  const e = Math.floor(Math.log10(z));
  return `${(z / 10 ** e).toFixed(2)}·10^${e}×`;
}

const renderer = new FractalRenderer(canvas, {
  pool,
  interactive: true,
  priority: 0,
  onUpdate: ({ busy: isBusy, info, zoom, view }) => {
    busy.classList.toggle('on', !!isBusy);
    const digits = Math.max(4, Math.min(15, Math.ceil(Math.log10(zoom + 1)) + 4));
    const atMax = zoom >= renderer.maxZoom * 0.999 ? ' · max zoom' : '';
    readout.textContent = `zoom ${fmtZoom(zoom)} · x ${view.cx.toFixed(digits)} · y ${view.cy.toFixed(digits)}${info ? ' · ' + info : ''}${atMax}`;
  },
});

attachInteraction(canvas, renderer, { onReset: () => renderer.resetView() });

new ResizeObserver(() => renderer.resize()).observe(canvas);

$('#zoom-in').addEventListener('click', () => renderer.zoomCenter(2));
$('#zoom-out').addEventListener('click', () => renderer.zoomCenter(0.5));
$('#reset-view').addEventListener('click', () => renderer.resetView());
$('#fullscreen').addEventListener('click', () => {
  const stage = $('#stage');
  if (document.fullscreenElement) document.exitFullscreen?.();
  else (stage.requestFullscreen || stage.webkitRequestFullscreen)?.call(stage);
});
if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) $('#fullscreen').hidden = true;
$('#save-png').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fractal-explorer-${state.fractal.id}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
});

// ------------------------------------------------------------------ tabs
const tabs = $('#fractal-tabs');
for (const f of FRACTALS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'tab');
  b.id = `tab-${f.id}`;
  b.dataset.id = f.id;
  b.textContent = f.name;
  b.setAttribute('aria-controls', 'main-canvas');
  b.addEventListener('click', () => selectFractal(f.id));
  tabs.appendChild(b);
}
tabs.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const i = FRACTALS.indexOf(state.fractal);
  const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + FRACTALS.length) % FRACTALS.length;
  selectFractal(FRACTALS[j].id);
  $(`#tab-${FRACTALS[j].id}`).focus();
});

// ------------------------------------------------------------------ colors
const paletteSel = $('#palette');
const bgInput = $('#bg-color');
const fgInput = $('#fg-color');
const intInput = $('#interior-color');
const density = $('#density');
const densityOut = $('#density-out');

for (const p of PALETTES) paletteSel.add(new Option(p.name, p.id));
paletteSel.add(new Option('Custom (your picks)', 'custom'));

function syncColorInputs() {
  bgInput.value = state.colors.bg;
  fgInput.value = state.colors.fg;
  intInput.value = state.colors.interior;
  paletteSel.value = state.colors.paletteId;
  density.value = state.colors.density;
  densityOut.textContent = (+state.colors.density).toFixed(1);
}

paletteSel.addEventListener('change', () => {
  if (paletteSel.value === 'custom') return;
  // A preset sets all three pickers; the pickers stay in control afterwards.
  state.colors = paletteColors(paletteSel.value, state.colors.density);
  syncColorInputs();
  renderer.setColors({ ...state.colors });
});

for (const [input, key] of [[bgInput, 'bg'], [fgInput, 'fg'], [intInput, 'interior']]) {
  input.addEventListener('input', () => {
    state.colors = { ...state.colors, [key]: input.value, paletteId: 'custom' };
    paletteSel.value = 'custom';
    renderer.setColors({ ...state.colors });
  });
}
density.addEventListener('input', () => {
  state.colors = { ...state.colors, density: +density.value };
  densityOut.textContent = (+density.value).toFixed(1);
  renderer.setColors({ ...state.colors });
});

// ------------------------------------------------------------------ fractal-specific controls
const paramBox = $('#param-controls');

function formatValue(def, v) {
  if (def.format) return def.format(v);
  const decimals = String(def.step).includes('.') ? String(def.step).split('.')[1].length : 0;
  return (+v).toFixed(decimals);
}

function buildParamControls(fractal) {
  const params = paramsById[fractal.id];
  paramBox.innerHTML = '';
  const rows = [];

  if (fractal.presets) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `<span>${fractal.presets.label}</span>`;
    const list = document.createElement('div');
    list.className = 'presets';
    for (const preset of fractal.presets.items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = preset.label;
      b.addEventListener('click', () => {
        Object.assign(params, preset.values);
        buildParamControls(fractal);
        renderer.setParams({ ...params }, { live: false });
        updateInfo();
      });
      list.appendChild(b);
    }
    wrap.appendChild(list);
    paramBox.appendChild(wrap);
  }

  if (fractal.places) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = '<span>Places to visit</span>';
    const list = document.createElement('div');
    list.className = 'presets';
    for (const place of fractal.places) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = place.label;
      b.addEventListener('click', () => renderer.goTo(place.cx, place.cy, place.zoom));
      list.appendChild(b);
    }
    wrap.appendChild(list);
    paramBox.appendChild(wrap);
  }

  for (const def of fractal.params) {
    const id = `param-${fractal.id}-${def.id}`;
    let row;
    if (def.type === 'checkbox') {
      row = document.createElement('label');
      row.className = 'check';
      row.innerHTML = `<input type="checkbox" id="${id}"> <span>${def.label}</span>`;
      const input = row.querySelector('input');
      input.checked = !!params[def.id];
      input.addEventListener('change', () => {
        params[def.id] = input.checked;
        renderer.setParams({ ...params }, { live: false });
        updateInfo();
      });
    } else if (def.type === 'select') {
      row = document.createElement('label');
      row.className = 'field';
      row.innerHTML = `<span>${def.label}</span><select id="${id}"></select>`;
      const sel = row.querySelector('select');
      for (const o of def.options) sel.add(new Option(o.label, o.value));
      sel.value = params[def.id];
      sel.addEventListener('change', () => {
        params[def.id] = sel.value;
        renderer.setParams({ ...params }, { live: false });
        refreshVisibility();
        updateInfo();
      });
    } else {
      row = document.createElement('label');
      row.className = 'field';
      row.innerHTML = `<span>${def.label} <output for="${id}"></output></span>
        <input type="range" id="${id}" min="${def.min}" max="${def.max}" step="${def.step}">
        ${def.help ? `<small class="help">${def.help}</small>` : ''}`;
      const input = row.querySelector('input');
      const out = row.querySelector('output');
      input.value = params[def.id];
      out.textContent = formatValue(def, params[def.id]);
      input.addEventListener('input', () => {
        params[def.id] = +input.value;
        out.textContent = formatValue(def, input.value);
        renderer.setParams({ ...params }, { live: true });
        updateInfo();
      });
    }
    row.dataset.param = def.id;
    rows.push([def, row]);
    paramBox.appendChild(row);
  }

  function refreshVisibility() {
    for (const [def, row] of rows) row.hidden = def.showIf ? !def.showIf(params) : false;
  }
  refreshVisibility();
}

function updateInfo() {
  const f = state.fractal;
  const p = paramsById[f.id];
  $('#fractal-name').textContent = f.name;
  $('#fractal-blurb').textContent = f.blurb;
  let rule = f.rule;
  if (f.id === 'julia') rule = rule.replace(/<span class="jc">.*?<\/span>/, `${(+p.cRe).toFixed(3)} ${p.cIm < 0 ? '−' : '+'} ${Math.abs(p.cIm).toFixed(3)}i`);
  $('#fractal-rule').innerHTML = rule;
  $('#fractal-dim').textContent = f.dimension ? f.dimension(p) : '—';
  const ul = $('#fractal-lookfor');
  ul.innerHTML = '';
  for (const t of f.lookFor) {
    const li = document.createElement('li');
    li.textContent = t;
    ul.appendChild(li);
  }
  $('#fractal-credit').textContent = f.credit || '';
}

// ------------------------------------------------------------------ switching fractals
function selectFractal(id, { scroll = false } = {}) {
  const f = getFractal(id) || FRACTALS[0];
  state.fractal = f;
  if (!state.colors || !$('#keep-colors').checked) {
    state.colors = paletteColors(f.palette, state.colors?.density || 1);
  }
  syncColorInputs();
  document.querySelector('.panel').classList.toggle('hide-geometric', f.kind !== 'escape');
  for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.id === f.id));
  // Keep the active tab visible in the horizontally scrolling tab strip (without scrolling the page).
  const btn = $(`#tab-${f.id}`);
  const left = btn.offsetLeft - tabs.offsetLeft;
  if (left < tabs.scrollLeft || left + btn.offsetWidth > tabs.scrollLeft + tabs.clientWidth) {
    tabs.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
  }
  buildParamControls(f);
  updateInfo();
  renderer.setFractal(f, { ...paramsById[f.id] }, { ...state.colors });
  const url = new URL(location.href);
  url.searchParams.set('fractal', f.id);
  history.replaceState(null, '', url);
  if (scroll) $('#explorer').scrollIntoView({ behavior: 'smooth' });
}

// ------------------------------------------------------------------ gallery (same renderer, small canvases)
function buildGallery() {
  const grid = $('#gallery-grid');
  const thumbs = [];
  for (const f of FRACTALS) {
    const card = document.createElement('article');
    card.className = 'gcard';
    card.innerHTML = `
      <canvas aria-label="Live preview of the ${f.name}" role="img"></canvas>
      <div class="gbody">
        <h3>${f.name}</h3>
        <p>${f.blurb}</p>
        <p class="rule">${f.rule.replace(/<span class="jc">(.*?)<\/span>/, '$1')}</p>
        <p class="look"><strong>Look for:</strong> ${f.lookFor[0]}</p>
        <button type="button">Explore the ${f.name}</button>
      </div>`;
    card.querySelector('button').addEventListener('click', () => selectFractal(f.id, { scroll: true }));
    grid.appendChild(card);
    thumbs.push({ f, canvas: card.querySelector('canvas') });
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const t = thumbs.find((x) => x.canvas === e.target);
      const r = new FractalRenderer(t.canvas, { pool, interactive: false, maxPixels: 450000, priority: 5 });
      t.renderer = r;
      r.setFractal(t.f, defaultParams(t.f), paletteColors(t.f.palette));
    }
  }, { rootMargin: '300px' });
  for (const t of thumbs) io.observe(t.canvas);
  return thumbs;
}

// ------------------------------------------------------------------ Koch worked example (drawn by code)
function kochPoints(depth) {
  let pts = [[0, 0], [1, 0]];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const dx = (x2 - x1) / 3, dy = (y2 - y1) / 3;
      const a = [x1 + dx, y1 + dy], b = [x1 + 2 * dx, y1 + 2 * dy];
      const peak = [a[0] + dx * 0.5 - dy * Math.sqrt(3) / 2, a[1] + dy * 0.5 + dx * Math.sqrt(3) / 2];
      next.push(a, peak, b, [x2, y2]);
    }
    pts = next;
  }
  return pts;
}
function buildKochSteps() {
  const box = $('#koch-steps');
  for (let n = 0; n <= 4; n++) {
    const pts = kochPoints(n).map(([x, y]) => `${(5 + x * 190).toFixed(2)},${(62 - y * 190).toFixed(2)}`).join(' ');
    const fig = document.createElement('figure');
    fig.innerHTML = `<svg viewBox="0 0 200 70" role="img" aria-label="Koch curve generation ${n}">
      <polyline points="${pts}" fill="none" stroke="#6fd3ff" stroke-width="1.6" stroke-linejoin="round"/></svg>
      <figcaption>Generation ${n}: ${4 ** n} segment${n ? 's' : ''}</figcaption>`;
    box.appendChild(fig);
  }
}

// ------------------------------------------------------------------ start
const start = new URL(location.href).searchParams.get('fractal');
selectFractal(getFractal(start) ? start : 'mandelbrot');
const thumbs = buildGallery();
buildKochSteps();

// Small hook for automated tests / the curious console user.
window.fractalExplorer = { renderer, pool, state, selectFractal, paramsById, thumbs };
