# Fractal Explorer

An educational website that explains fractals in plain English and lets you generate and explore eight famous fractals live in your browser. Drag, zoom and pinch on a large canvas, change colors and parameters, and read about the people and ideas behind fractal geometry.

It's a plain static site (HTML, CSS and JavaScript modules). There's no backend, no build step, no API keys and no third-party services, so it runs on GitHub Pages as-is.

**Live site:** https://jalam1001.github.io/fractal-explorer/

## Features

- **The canvas comes first.** The page opens on a fully rendered Mandelbrot set that you can explore straight away.
- **Pan and zoom on every fractal.**
  - Drag with a mouse, finger or pen to pan.
  - Use the scroll wheel to zoom around the cursor, or pinch with two fingers on a phone or tablet.
  - Double-click to zoom in, and Shift + double-click to zoom out.
  - The canvas also has zoom-in, zoom-out, reset-view, full-screen and save-PNG buttons.
- **Keyboard support.** Every button can be reached with Tab. When the canvas has focus, the arrow keys pan, `+` and `-` zoom, and `0` resets the view.
- **The rest of the page scrolls normally.** Gestures are captured only on the canvas (`touch-action: none` is set on the canvas alone).
- **Sharp images.** The canvas resolution matches your screen's devicePixelRatio. Screens with a ratio below 1.5 render at 2× and are scaled down, which smooths the edges.
- **Fast while you move, detailed when you stop.**
  - During a gesture, the last finished image is moved and scaled instantly, and a low-resolution preview is computed.
  - About 200 ms after you stop, a full-resolution image is drawn.
  - The Mandelbrot set, Julia sets and Burning Ship are computed in a pool of **Web Workers**, block by block from the centre outwards, so the page never freezes.
- **Detail keeps coming as you zoom.**
  - The Mandelbrot set, Julia sets and Burning Ship raise their iteration limit automatically.
  - The recursive fractals add recursion levels, skip branches that are off-screen, and stop at the pixel level, so you never reach the bottom.
  - The Barnsley fern has an exact mode that keeps full detail at any zoom.
- **Colors.**
  - Two independent pickers, **Background color** and **Fractal color**, apply to the live drawing.
  - For the Mandelbrot set, Julia sets and Burning Ship, a separate **Interior color** picker colors the points inside the set, and the fractal color forms part of the exterior gradient.
  - Six palette presets set all three pickers, and changing a picker afterwards always takes effect.
  - For the Mandelbrot set, Julia sets and Burning Ship, a **Color density** slider and smooth (continuous) coloring are also available.
- **Controls for each fractal.**
  - Iteration limit.
  - Recursion depth.
  - The real and imaginary parts of the Julia parameter c, plus famous presets.
  - Branch angle for the Pythagoras tree.
  - Fraction removed for the Cantor set.
  - Drawing method (exact or chaos game) and point count for the Barnsley fern.
  - "Places to visit" shortcuts for the Mandelbrot set and Burning Ship.
- **Gallery.** Each fractal has a short explanation, its rule or equation, and what to look for. The previews are drawn by the same renderer and fractal modules as the main explorer.
- **Learning content.**
  - What a fractal is.
  - How simple rules produce complex patterns.
  - Exact, approximate and statistical self-similarity.
  - A worked Koch-curve example covering recursion and fractal dimension.
  - Mathematical fractals compared with natural ones.
  - Real-world uses: coastlines, branching structures and computer-generated terrain.
  - A short history centred on Benoît Mandelbrot at IBM.
  - Clickable sources.
- **Layout and accessibility.** The layout is responsive, touch targets are at least 44 px, and controls are labelled.

## Supported fractals

| Fractal | Type | Rule |
|---|---|---|
| Mandelbrot set | escape-time | z → z² + c, z₀ = 0, c = pixel |
| Julia sets | escape-time | z → z² + c, z₀ = pixel, c fixed (sliders + presets) |
| Burning Ship | escape-time | z → (\|Re z\| + i\|Im z\|)² + c |
| Sierpiński triangle | recursive geometry | triangle → 3 half-size corner triangles |
| Koch snowflake | recursive geometry | segment → 4 segments of 1/3 length |
| Barnsley fern | iterated function system | 4 affine maps, probabilities 1/85/7/7 % |
| Cantor set | recursive geometry | [0,1] → [0,⅓] ∪ [⅔,1] (removed fraction adjustable) |
| Pythagoras tree | recursive geometry | square → two squares on a right triangle (angle adjustable) |

## Run it locally

ES modules and Web Workers don't load from `file://` URLs, so the site has to be served over HTTP. Any static server works:

```bash
cd fractal-explorer
python3 -m http.server 8000
# then open http://localhost:8000/
```

If you prefer Node.js: `npx serve .` or `npx http-server .`

## File structure

```
fractal-explorer/
├── index.html                 # page: explorer, gallery, learning content, history, sources
├── favicon.svg
├── css/style.css              # all styles (responsive, no frameworks)
├── js/
│   ├── main.js                # page wiring: tabs, controls, colors, gallery, Koch figures
│   ├── core/
│   │   ├── renderer.js        # FractalRenderer: canvas sizing, preview → refine, recoloring
│   │   ├── interaction.js     # pointer/touch/pinch/wheel/keyboard navigation
│   │   ├── view.js            # View: centre + scale, screen ↔ world coordinates
│   │   ├── worker-pool.js     # Web Worker pool with priorities and cancellation
│   │   ├── escape-time.js     # smooth iteration count, exterior gradient, colorizing
│   │   ├── geometry.js        # culling and polygon clipping helpers for recursive fractals
│   │   ├── color.js           # hex/RGB helpers, gradient lookup tables
│   │   └── palettes.js        # palette presets
│   ├── fractals/
│   │   ├── index.js           # the registry (list of all fractals)
│   │   ├── common-params.js   # shared parameter definitions
│   │   ├── mandelbrot.js
│   │   ├── julia.js
│   │   ├── burning-ship.js
│   │   ├── sierpinski.js
│   │   ├── koch.js
│   │   ├── barnsley-fern.js
│   │   ├── cantor.js
│   │   └── pythagoras-tree.js
│   └── workers/
│       └── escape-worker.js   # runs a Mandelbrot, Julia or Burning Ship module's computeRows() off the main thread
├── .github/workflows/deploy.yml   # GitHub Pages deployment
├── .nojekyll                  # only needed if you deploy from a branch instead
├── LICENSE                    # MIT
└── README.md
```

Each fractal's maths lives in exactly one file in `js/fractals/`. The machinery in `js/core/` (renderer, interaction, workers and coloring) is shared by all of them.

## Deploying to GitHub Pages

The repository includes `.github/workflows/deploy.yml`. It publishes the site on every push to `main`, using `actions/upload-pages-artifact` and `actions/deploy-pages`.

1. Create a GitHub repository, for example `fractal-explorer`, and push this folder to its `main` branch:
   ```bash
   git init -b main
   git add .
   git commit -m "Fractal Explorer"
   git remote add origin https://github.com/<you>/fractal-explorer.git
   git push -u origin main
   ```
2. Turn on Pages with the workflow as the source. You can do this in the browser: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Or use the GitHub CLI:
   ```bash
   gh api -X POST repos/<you>/fractal-explorer/pages -f build_type=workflow
   ```
3. Run the workflow. Either push again, or go to **Actions → Deploy to GitHub Pages → Run workflow** (or run `gh workflow run deploy.yml`).
4. The site appears at `https://<you>.github.io/fractal-explorer/`.

All paths in the site are relative, so it works under a repository sub-path without any configuration.

If you'd rather deploy from a branch without Actions, choose **Settings → Pages → Deploy from a branch → main / (root)**. The `.nojekyll` file stops Jekyll from processing the site.

## Adding a new fractal

1. **Create a module** in `js/fractals/`, for example `js/fractals/tricorn.js`. Export a default object with the following fields:

   ```js
   export default {
     id: 'tricorn',                  // unique, used in URLs (?fractal=tricorn)
     name: 'Tricorn',
     kind: 'escape',                 // 'escape' (per-pixel, runs in workers) or 'geometric' (draws on a canvas)
     palette: 'neon',                // default palette id from js/core/palettes.js
     bounds: [-2.2, 1.6, -1.6, 1.6], // world box shown by "Reset view": [xmin, xmax, ymin, ymax]
     blurb: 'Plain-English description…',
     rule: 'z<sub>n+1</sub> = conj(z<sub>n</sub>)<sup>2</sup> + c',  // HTML allowed
     lookFor: ['What to notice when zooming…', '…'],
     credit: 'Who discovered it, and when.',
     dimension: (params) => '—',     // optional text
     params: [                       // UI controls are generated from this list
       { id: 'maxIter', label: 'Iteration limit', type: 'range', min: 50, max: 3000, step: 10, value: 300 },
       { id: 'autoIter', label: 'Raise iterations automatically as I zoom', type: 'checkbox', value: true },
     ],
     // For kind 'escape': fill `out` with smooth escape counts (−1 = inside).
     computeRows(out, { x0, y0, dx, width, row0, rows, maxIter, params }) { /* … */ },
     // For kind 'geometric' instead: draw(rc) { … }
   };
   ```

   - **Escape-time fractals** implement `computeRows`. Look at `mandelbrot.js`: loop over the pixels, iterate, and store `smoothCount(n, |z|²)` from `core/escape-time.js`, or `-1` for points inside the set. The module runs inside a Web Worker, so it must not touch the DOM. Coloring, previews, workers and recoloring are handled for you.
   - **Geometric fractals** implement `draw(rc)`. The render context `rc` provides:
     - `ctx`, `width` and `height` (in device pixels);
     - `X(x)` and `Y(y)`, which convert world coordinates to pixels;
     - `k`, the number of pixels per world unit;
     - `bounds`, the visible world box, which you can use to skip off-screen branches;
     - `zoom`, `quality` (`'preview'` or `'full'`), `params` and `colors`.

     Fill the background with `colors.bg` and draw the shape with `colors.fg`. To keep detail when the user zooms in, add recursion levels as `zoom` grows (`extraLevels()` in `core/geometry.js`) and stop recursing once a piece is smaller than about one pixel. Return a short status string for the on-canvas readout.
   - Parameter types are `range`, `checkbox` and `select`. Each one can also have `help`, `format(v)` and `showIf(params)`. Optional `presets` (parameter sets) and `places` (`{label, cx, cy, zoom}`) add buttons to the panel.
2. **Register it.** Import the module in `js/fractals/index.js` and add it to the `FRACTALS` array. The tab, controls, gallery card and preview all appear automatically.
3. Reload the page and test pan, zoom, reset and the color pickers on the new fractal.

## Verification

The site has been tested in headless Chromium with Playwright on a desktop viewport and an emulated Pixel 7 (touch, devicePixelRatio 2.625). The tests check that:

- every fractal renders, pans, zooms around the cursor, resets and keeps detail when deep-zoomed;
- the color pickers and presets update the live drawing;
- the parameter controls work;
- keyboard controls work;
- the page still scrolls outside the canvas;
- touch pan and pinch-zoom work;
- there are no console errors.

## Credits and license

The historical sources are listed on the page itself. The code is released under the MIT License (see `LICENSE`). © 2026 Javed Alam.
