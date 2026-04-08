# D3 Interactive Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static SVG diagram view with a D3-powered interactive diagram supporting guided step-through and sandbox fender practice modes.

**Architecture:** Single vanilla JS module (`js/diagram.js`) manages a D3 SVG canvas inside the existing `#diagram-view` div. Potrace-traced car body paths loaded from `data/trace-data.json`. The module exports `initDiagram()`, `updateStep()`, and `enterSandbox()`/`exitSandbox()` — called from the existing app code in `index.html`. No build step, no framework.

**Tech Stack:** D3.js v7 (CDN), vanilla JS ES module, existing HTML/CSS app shell

---

### Task 1: Create enriched trace-data.json with bolt positions and zoom targets

**Files:**
- Create: `data/trace-data.json`

This is the data foundation. All coordinates are in potrace viewBox space (viewBox `0 0 1046.26 277.11`). The potrace `transform` flips Y axis: `translate(-19.99, 297.93) scale(0.1, -0.1)`, so all path `d` attributes are in a 10x-scaled, Y-inverted space. D3 will render the paths inside a `<g>` with this transform and the viewBox handles the rest.

- [ ] **Step 1: Create `data/` directory and write trace-data.json**

```bash
mkdir -p data
```

Write `data/trace-data.json` with:
- `viewBox`: `"0 0 1046.26 277.11"`
- `transform`: `"translate(-19.99,297.93) scale(0.1,-0.1)"`
- `bodyPath`: the single path string from `svg-body.svg` (smooth filled body)
- `detailPath`: the single path string from `svg-detail.svg` (windows, arches, vents)
- `bolts`: array of 10 bolt objects, each with `{id, group, label, x, y, torque, tool, sequence}` — positions estimated from the car proportions in viewBox space:
  - `a_pillar_upper`: {x: 498, y: 62} — rear of fender, upper
  - `a_pillar_lower`: {x: 494, y: 130} — rear of fender, lower
  - `top_rail_1`: {x: 590, y: 52} — first top rail bolt
  - `top_rail_2`: {x: 710, y: 46} — mid top rail
  - `top_rail_3`: {x: 840, y: 44} — front top rail
  - `front_upper`: {x: 938, y: 100} — nose upper
  - `front_mid`: {x: 938, y: 140} — nose mid
  - `front_lower`: {x: 938, y: 175} — nose lower
  - `lower_1`: {x: 580, y: 240} — rocker bolt 1
  - `lower_2`: {x: 640, y: 240} — rocker bolt 2
  - `hidden`: {x: 728, y: 195} — hidden bolt behind foam
  - `side_marker`: {x: 850, y: 55} — side marker connector
- `wheels`: array of 2 wheel objects `{cx, cy, r}` in viewBox space:
  - rear: {cx: 146, cy: 227, r: 68}
  - front: {cx: 752, cy: 227, r: 70}
- `zoomTargets`: object keyed by step index (0-15), each `{x, y, scale}`:
  - 0: {x: 523, y: 138, scale: 1} — full car overview
  - 1: {x: 523, y: 138, scale: 1}
  - 2: {x: 850, y: 100, scale: 2.5} — brackets & side marker
  - 3: {x: 500, y: 120, scale: 2.5} — dry fit, A-pillar area
  - 4: {x: 500, y: 120, scale: 2.5} — A-pillar bolts
  - 5: {x: 700, y: 50, scale: 2.5} — top rail
  - 6: {x: 920, y: 140, scale: 3} — front/bumper
  - 7: {x: 580, y: 230, scale: 3} — lower/rocker
  - 8: {x: 730, y: 200, scale: 4} — hidden bolt
  - 9: {x: 850, y: 80, scale: 3} — side marker
  - 10: {x: 500, y: 120, scale: 2.5} — door gap
  - 11: {x: 700, y: 50, scale: 2.5} — hood gap
  - 12: {x: 920, y: 140, scale: 3} — bumper junction
  - 13: {x: 523, y: 138, scale: 1} — torque sequence (overview)
  - 14: {x: 730, y: 200, scale: 2.5} — liner
  - 15: {x: 523, y: 138, scale: 1} — final inspection
- `fenderPath`: a rough subset of the body path covering the fender zone (from A-pillar to nose). For now, use the body path — we'll refine after visual testing.

Copy the actual path `d` strings from `svg-body.svg` and `svg-detail.svg` (the `<path d="...">` content, stripping newlines into single strings).

- [ ] **Step 2: Verify JSON is valid**

```bash
python3 -c "import json; json.load(open('data/trace-data.json')); print('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add data/trace-data.json
git commit -m "Add enriched trace data with bolt positions and zoom targets"
```

---

### Task 2: Create D3 diagram module — car body rendering

**Files:**
- Create: `js/diagram.js`

The core module. This task renders just the static car body (no interactivity yet).

- [ ] **Step 1: Create `js/` directory**

```bash
mkdir -p js
```

- [ ] **Step 2: Write `js/diagram.js` with car body rendering**

```javascript
// js/diagram.js — D3 interactive diagram for fixcar
// Renders potrace-traced car body, manages zoom/pan, guided + sandbox modes

const HUD_CYAN = 'rgba(0,130,170,';
const ACCENT = '#d4500a';

let svg, g, zoomBehavior, traceData;
let currentMode = 'guided'; // 'guided' | 'sandbox'
let diagramInitialized = false;

export async function initDiagram(containerSelector) {
  if (diagramInitialized) return;

  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  // Load trace data
  traceData = await d3.json('data/trace-data.json');
  const [vbX, vbY, vbW, vbH] = traceData.viewBox.split(' ').map(Number);

  // Create SVG
  svg = container.append('svg')
    .attr('viewBox', traceData.viewBox)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%')
    .style('background', '#fafbfe');

  // Defs
  const defs = svg.append('defs');
  const glowFilter = defs.append('filter').attr('id', 'glow');
  glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
  const glowMerge = glowFilter.append('feMerge');
  glowMerge.append('feMergeNode').attr('in', 'blur');
  glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Zoom behavior
  zoomBehavior = d3.zoom()
    .scaleExtent([0.5, 8])
    .on('zoom', (event) => { g.attr('transform', event.transform); });
  svg.call(zoomBehavior);

  // Main group (zoom target)
  g = svg.append('g');

  // --- Layer 1: Body glow ---
  const bodyGlow = g.append('g').attr('class', 'layer-body-glow')
    .attr('transform', traceData.transform);
  bodyGlow.append('path')
    .attr('d', traceData.bodyPath)
    .attr('fill', 'none')
    .attr('stroke', HUD_CYAN + '0.06)')
    .attr('stroke-width', 28)
    .attr('stroke-linejoin', 'round')
    .attr('filter', 'url(#glow)');

  // --- Layer 2: Body fill ---
  const bodyFill = g.append('g').attr('class', 'layer-body-fill')
    .attr('transform', traceData.transform);
  bodyFill.append('path')
    .attr('d', traceData.bodyPath)
    .attr('fill', HUD_CYAN + '0.025)')
    .attr('stroke', 'none');

  // --- Layer 3: Body outline ---
  const bodyOutline = g.append('g').attr('class', 'layer-body-outline')
    .attr('transform', traceData.transform);
  bodyOutline.append('path')
    .attr('d', traceData.bodyPath)
    .attr('fill', 'none')
    .attr('stroke', HUD_CYAN + '0.35)')
    .attr('stroke-width', 5)
    .attr('stroke-linejoin', 'round');

  // --- Layer 4: Detail trace ---
  const detailTrace = g.append('g').attr('class', 'layer-detail')
    .attr('transform', traceData.transform);
  detailTrace.append('path')
    .attr('d', traceData.detailPath)
    .attr('fill', 'none')
    .attr('stroke', HUD_CYAN + '0.5)')
    .attr('stroke-width', 2.5);

  // --- Layer 5: Sharp highlight ---
  const highlight = g.append('g').attr('class', 'layer-highlight')
    .attr('transform', traceData.transform);
  highlight.append('path')
    .attr('d', traceData.detailPath)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(0,180,220,0.6)')
    .attr('stroke-width', 1);

  // --- Layer 6: Wheels ---
  const wheelsG = g.append('g').attr('class', 'layer-wheels');
  traceData.wheels.forEach(w => {
    const wg = wheelsG.append('g');
    wg.append('circle').attr('cx', w.cx).attr('cy', w.cy).attr('r', w.r)
      .attr('fill', HUD_CYAN + '0.03)').attr('stroke', HUD_CYAN + '0.3)').attr('stroke-width', 2);
    wg.append('circle').attr('cx', w.cx).attr('cy', w.cy).attr('r', w.r * 0.78)
      .attr('fill', 'none').attr('stroke', HUD_CYAN + '0.15)').attr('stroke-width', 1);
    wg.append('circle').attr('cx', w.cx).attr('cy', w.cy).attr('r', w.r * 0.35)
      .attr('fill', 'none').attr('stroke', HUD_CYAN + '0.2)').attr('stroke-width', 1);
    wg.append('circle').attr('cx', w.cx).attr('cy', w.cy).attr('r', w.r * 0.12)
      .attr('fill', HUD_CYAN + '0.08)').attr('stroke', HUD_CYAN + '0.25)').attr('stroke-width', 0.5);
    // 5 spokes
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 90) * Math.PI / 180;
      wg.append('line')
        .attr('x1', w.cx + Math.cos(angle) * w.r * 0.38)
        .attr('y1', w.cy + Math.sin(angle) * w.r * 0.38)
        .attr('x2', w.cx + Math.cos(angle) * w.r * 0.78)
        .attr('y2', w.cy + Math.sin(angle) * w.r * 0.78)
        .attr('stroke', HUD_CYAN + '0.12)').attr('stroke-width', 1.5);
    }
  });

  // --- Placeholder groups for later layers ---
  g.append('g').attr('class', 'layer-fender-zone');
  g.append('g').attr('class', 'layer-fender-piece');
  g.append('g').attr('class', 'layer-bolts');
  g.append('g').attr('class', 'layer-gaps');
  g.append('g').attr('class', 'layer-hud');

  diagramInitialized = true;
}

export function zoomToTarget(stepIndex, animate = true) {
  if (!svg || !traceData) return;
  const target = traceData.zoomTargets[stepIndex] || traceData.zoomTargets[0];
  const [,, vbW, vbH] = traceData.viewBox.split(' ').map(Number);

  const transform = d3.zoomIdentity
    .translate(vbW / 2, vbH / 2)
    .scale(target.scale)
    .translate(-target.x, -target.y);

  if (animate) {
    svg.transition().duration(800).ease(d3.easeCubicInOut)
      .call(zoomBehavior.transform, transform);
  } else {
    svg.call(zoomBehavior.transform, transform);
  }
}

export function resetZoom() {
  zoomToTarget(0, true);
}
```

- [ ] **Step 3: Verify file exists and has no syntax errors**

```bash
node -e "import('./js/diagram.js').catch(e => console.log('Module check:', e.message))"
```

Note: this will fail because D3 isn't available in Node, but it should NOT fail with a SyntaxError. If it says `Cannot use import statement outside a module` or `d3 is not defined`, the syntax is fine.

- [ ] **Step 4: Commit**

```bash
git add js/diagram.js
git commit -m "Add D3 diagram module with car body rendering and zoom"
```

---

### Task 3: Integrate D3 diagram into index.html

**Files:**
- Modify: `index.html` (lines 1-5 for script tag, lines 98-99 for diagram-view, lines 442-461 for toggleModel, lines 495-502 for updateScene)

Wire the D3 module into the existing app. Replace the old static SVG diagram with the D3 canvas.

- [ ] **Step 1: Add D3 CDN script to `<head>`**

In `index.html`, after line 4 (`<title>` tag), add:

```html
<script src="https://d3js.org/d3.v7.min.js"></script>
```

- [ ] **Step 2: Replace `#diagram-view` contents**

Replace the entire `<div id="diagram-view">` block (line 98 through line 189, the closing `</div>` before the model-toggle button) with:

```html
<div id="diagram-view" style="display:none; flex:1; overflow:hidden; background:#fafbfe;
  background-image:
    linear-gradient(90deg, rgba(0,180,216,0.05) 1px, transparent 1px),
    linear-gradient(0deg, rgba(0,180,216,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,180,216,0.02) 1px, transparent 1px),
    linear-gradient(0deg, rgba(0,180,216,0.02) 1px, transparent 1px);
  background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px;">
</div>
```

- [ ] **Step 3: Add diagram.js import and update toggleModel()**

At the bottom of the `<script>` block (before the closing `</script>` tag), add the diagram import and modify `toggleModel`:

```javascript
// ==========================================
// D3 DIAGRAM INTEGRATION
// ==========================================
let d3DiagramReady = false;

async function initD3Diagram() {
  if (d3DiagramReady) return;
  // Dynamic import of diagram module
  const mod = await import('./js/diagram.js');
  await mod.initDiagram('#diagram-view');
  d3DiagramReady = true;
  window._diagram = mod; // expose for updateScene
}
```

Then modify the existing `toggleModel()` function. Replace:
```javascript
updateDiagram(currentStep);
```
with:
```javascript
initD3Diagram().then(() => {
  window._diagram.updateStep(currentStep);
});
```

And modify `updateScene()`. Replace:
```javascript
if (!showingModel) {
    updateDiagram(idx);
```
with:
```javascript
if (!showingModel) {
    if (window._diagram) window._diagram.updateStep(idx);
```

- [ ] **Step 4: Test in browser**

```bash
python3 -m http.server 8787
```

Open `http://localhost:8787/index.html`, click "Switch to Diagram". Should see the traced Camaro body with HUD styling on the grid background. Mouse wheel should zoom, drag should pan.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Integrate D3 diagram into main app, replace static SVG"
```

---

### Task 4: Add bolt markers and step-driven updates

**Files:**
- Modify: `js/diagram.js`

Add bolt rendering layer and the `updateStep()` function that shows/hides bolts and zooms per step.

- [ ] **Step 1: Add `updateStep()` function to diagram.js**

Add to the bottom of `js/diagram.js`:

```javascript
const BOLT_GROUPS = {
  a_pillar: ['a_pillar_upper', 'a_pillar_lower'],
  top_rail: ['top_rail_1', 'top_rail_2', 'top_rail_3'],
  front: ['front_upper', 'front_mid', 'front_lower'],
  lower: ['lower_1', 'lower_2'],
  hidden: ['hidden'],
  side_marker: ['side_marker'],
};

export function updateStep(stepIndex, stepData) {
  if (!svg || !traceData) return;

  // Zoom to target
  zoomToTarget(stepIndex);

  // Update bolts
  const boltsG = g.select('.layer-bolts');
  boltsG.selectAll('*').remove();

  // Determine which bolts to show from STEPS data
  // The caller passes stepData with showBolts array
  // If not provided, show no bolts
  if (!stepData) return;

  let visibleBoltIds = [];
  const showBolts = stepData.showBolts || [];
  if (showBolts.includes('all')) {
    visibleBoltIds = traceData.bolts.map(b => b.id);
  } else {
    showBolts.forEach(group => {
      if (BOLT_GROUPS[group]) {
        visibleBoltIds.push(...BOLT_GROUPS[group]);
      }
    });
  }

  const visibleBolts = traceData.bolts.filter(b => visibleBoltIds.includes(b.id));

  // Render bolts
  const boltSel = boltsG.selectAll('.bolt-marker')
    .data(visibleBolts, d => d.id);

  const boltEnter = boltSel.enter().append('g')
    .attr('class', 'bolt-marker')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  // Outer pulse ring
  boltEnter.append('circle')
    .attr('r', 0)
    .attr('fill', 'none')
    .attr('stroke', ACCENT)
    .attr('stroke-width', 0.8)
    .attr('opacity', 0.4)
    .transition().duration(600).attr('r', 8);

  // Inner dot
  boltEnter.append('circle')
    .attr('r', 0)
    .attr('fill', ACCENT)
    .attr('opacity', 0.7)
    .transition().duration(400).delay(200).attr('r', 3);

  // Label
  boltEnter.append('text')
    .attr('x', 10).attr('y', 4)
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', 6)
    .attr('fill', ACCENT)
    .attr('opacity', 0)
    .text(d => d.label)
    .transition().duration(400).delay(400).attr('opacity', 0.7);
}
```

- [ ] **Step 2: Update the integration in index.html**

Modify the `initD3Diagram().then()` call and `updateScene()` to pass step data:

```javascript
// In the toggleModel diagram branch:
initD3Diagram().then(() => {
  window._diagram.updateStep(currentStep, STEPS[currentStep]);
});

// In updateScene:
if (window._diagram) window._diagram.updateStep(idx, STEPS[idx]);
```

- [ ] **Step 3: Test in browser**

Navigate between steps using arrow keys or transport buttons while in Diagram view. Bolts should appear/disappear and the view should zoom to different areas per step.

- [ ] **Step 4: Commit**

```bash
git add js/diagram.js index.html
git commit -m "Add bolt markers and step-driven zoom transitions"
```

---

### Task 5: Add fender overlay for guided mode

**Files:**
- Modify: `js/diagram.js`

The fender slides onto the car at step 4 and stays for all subsequent steps.

- [ ] **Step 1: Add fender rendering to `updateStep()`**

Add this to `updateStep()` in `js/diagram.js`, after the bolt rendering:

```javascript
  // Fender overlay
  const fenderG = g.select('.layer-fender-zone');
  fenderG.selectAll('*').remove();

  if (stepData.fenderOn) {
    // Use the body path as fender outline (it covers the fender zone)
    // In guided mode, highlight the fender zone area
    const fender = fenderG.append('g').attr('transform', traceData.transform);

    // Fender zone highlight (reuse body path with clip to fender area)
    fender.append('path')
      .attr('d', traceData.fenderPath || traceData.bodyPath)
      .attr('fill', 'rgba(212,80,10,0.04)')
      .attr('stroke', 'rgba(212,80,10,0.3)')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', stepIndex === 3 ? '8 4' : 'none')
      .attr('opacity', 0)
      .transition().duration(stepIndex === 3 ? 1500 : 400)
      .attr('opacity', 1);
  }
```

- [ ] **Step 2: Test step 4 transition**

In browser, go to step 4. The fender zone should animate in with a dashed outline (sliding on). Steps 5+ should show it solid.

- [ ] **Step 3: Commit**

```bash
git add js/diagram.js
git commit -m "Add fender overlay animation for guided mode"
```

---

### Task 6: Add gap indicators

**Files:**
- Modify: `js/diagram.js`

Gap measurement lines appear during alignment steps 11-13.

- [ ] **Step 1: Add gap rendering data and display logic**

Add gap definitions and rendering to `updateStep()`:

```javascript
const GAP_INDICATORS = {
  door: {
    x1: 490, y1: 50, x2: 490, y2: 240,
    label: 'DOOR GAP', spec: '4.0-5.0mm', color: 'rgba(26,122,58,'
  },
  hood: {
    x1: 540, y1: 40, x2: 920, y2: 40,
    label: 'HOOD GAP', spec: '3.5-5.0mm', color: 'rgba(26,90,170,'
  },
  bumper: {
    x1: 945, y1: 80, x2: 945, y2: 220,
    label: 'BUMPER', spec: '1.0-3.0mm', color: 'rgba(176,102,0,'
  },
};

// Inside updateStep(), after fender rendering:
  const gapsG = g.select('.layer-gaps');
  gapsG.selectAll('*').remove();

  (stepData.showGaps || []).forEach(gapKey => {
    const gap = GAP_INDICATORS[gapKey];
    if (!gap) return;

    const gg = gapsG.append('g');

    // Dashed measurement lines (two parallel)
    for (let offset of [-2, 2]) {
      gg.append('line')
        .attr('x1', gap.x1 + (gap.x1 === gap.x2 ? offset : 0))
        .attr('y1', gap.y1 + (gap.y1 === gap.y2 ? offset : 0))
        .attr('x2', gap.x2 + (gap.x1 === gap.x2 ? offset : 0))
        .attr('y2', gap.y2 + (gap.y1 === gap.y2 ? offset : 0))
        .attr('stroke', gap.color + '0.5)')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 3');
    }

    // Label box
    const midX = (gap.x1 + gap.x2) / 2;
    const midY = (gap.y1 + gap.y2) / 2;
    const labelG = gg.append('g').attr('transform', `translate(${midX + 15},${midY})`);
    labelG.append('rect')
      .attr('x', -2).attr('y', -10).attr('width', 60).attr('height', 22)
      .attr('rx', 3).attr('fill', 'white').attr('fill-opacity', 0.9)
      .attr('stroke', gap.color + '0.3)').attr('stroke-width', 1);
    labelG.append('text').attr('x', 2).attr('y', 0)
      .attr('font-family', 'DM Mono, monospace').attr('font-size', 5)
      .attr('fill', gap.color + '0.8)').attr('font-weight', 700)
      .text(gap.label);
    labelG.append('text').attr('x', 2).attr('y', 8)
      .attr('font-family', 'DM Mono, monospace').attr('font-size', 5)
      .attr('fill', 'rgba(0,0,0,0.4)')
      .text(gap.spec);
  });
```

- [ ] **Step 2: Test steps 11-13**

Navigate to steps 11, 12, 13. Gap indicators should appear with dashed lines and labels.

- [ ] **Step 3: Commit**

```bash
git add js/diagram.js
git commit -m "Add gap measurement indicators for alignment steps"
```

---

### Task 7: Add sandbox mode — fender drag and bolt installation

**Files:**
- Modify: `js/diagram.js`
- Modify: `index.html` (add Practice Mode button)

The big feature: draggable fender piece with bolt click-to-install.

- [ ] **Step 1: Add Practice Mode button to index.html**

In the model-toggle button area (around line 190), add a new button:

```html
<button id="practice-toggle" style="display:none; position:absolute;top:10px;right:180px;z-index:10;background:#1a7a3a;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;" onclick="togglePractice()">Practice Mode</button>
```

Add the toggle function in the `<script>` block:

```javascript
function togglePractice() {
  const btn = document.getElementById('practice-toggle');
  if (currentMode === 'guided') {
    window._diagram.enterSandbox();
    btn.textContent = 'Exit Practice';
    btn.style.background = '#c02020';
  } else {
    window._diagram.exitSandbox();
    btn.textContent = 'Practice Mode';
    btn.style.background = '#1a7a3a';
  }
}
```

Show/hide the button when toggling to/from diagram view:

```javascript
// In toggleModel(), when showing diagram:
document.getElementById('practice-toggle').style.display = 'block';
// When showing 3D model:
document.getElementById('practice-toggle').style.display = 'none';
```

- [ ] **Step 2: Add sandbox functions to diagram.js**

Add to `js/diagram.js`:

```javascript
let fenderSnapped = false;
let installedBolts = new Set();
const FENDER_TARGET = { x: 523, y: 138 }; // correct position
const FENDER_START = { x: 1100, y: 138 }; // starting position (off to the right)
const SNAP_THRESHOLD = 15;

export function enterSandbox() {
  currentMode = 'sandbox';

  // Reset zoom to full view
  resetZoom();

  // Clear guided layers
  g.select('.layer-bolts').selectAll('*').remove();
  g.select('.layer-gaps').selectAll('*').remove();
  g.select('.layer-fender-zone').selectAll('*').remove();

  // Reset state
  fenderSnapped = false;
  installedBolts = new Set();

  // Render draggable fender piece
  renderSandboxFender();
  updateBoltCounter();
}

export function exitSandbox() {
  currentMode = 'guided';

  // Clean sandbox elements
  g.select('.layer-fender-piece').selectAll('*').remove();
  g.select('.layer-bolts').selectAll('*').remove();

  // Remove counter
  svg.select('.bolt-counter').remove();

  // Re-render current step
  // The caller will call updateStep() after this
}

function renderSandboxFender() {
  const fenderG = g.select('.layer-fender-piece');
  fenderG.selectAll('*').remove();

  const fenderGroup = fenderG.append('g')
    .attr('class', 'fender-draggable')
    .attr('transform', `translate(${FENDER_START.x - FENDER_TARGET.x},${FENDER_START.y - FENDER_TARGET.y})`);

  // The fender shape (reuse body path, semi-transparent)
  const pathG = fenderGroup.append('g').attr('transform', traceData.transform);
  pathG.append('path')
    .attr('d', traceData.fenderPath || traceData.bodyPath)
    .attr('fill', 'rgba(212,80,10,0.08)')
    .attr('stroke', 'rgba(212,80,10,0.5)')
    .attr('stroke-width', 3)
    .style('cursor', 'grab');

  // Bolt holes on fender piece
  traceData.bolts.forEach(bolt => {
    fenderGroup.append('circle')
      .attr('cx', bolt.x).attr('cy', bolt.y).attr('r', 4)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(212,80,10,0.4)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2 2');
  });

  // Drag behavior
  const drag = d3.drag()
    .on('start', function() { d3.select(this).style('cursor', 'grabbing'); })
    .on('drag', function(event) {
      if (fenderSnapped) return;
      const current = d3.select(this);
      const dx = event.dx, dy = event.dy;
      const t = current.attr('transform');
      const match = t.match(/translate\(([^,]+),([^)]+)\)/);
      const cx = parseFloat(match[1]) + dx;
      const cy = parseFloat(match[2]) + dy;
      current.attr('transform', `translate(${cx},${cy})`);

      // Check snap
      if (Math.abs(cx) < SNAP_THRESHOLD && Math.abs(cy) < SNAP_THRESHOLD) {
        snapFender(current);
      }
    })
    .on('end', function() { d3.select(this).style('cursor', 'grab'); });

  fenderGroup.call(drag);
}

function snapFender(fenderGroup) {
  fenderSnapped = true;

  // Animate to exact position
  fenderGroup.transition().duration(300).ease(d3.easeCubicOut)
    .attr('transform', 'translate(0,0)');

  // Flash effect
  fenderGroup.select('path')
    .transition().duration(150)
    .attr('fill', 'rgba(212,80,10,0.2)')
    .transition().duration(300)
    .attr('fill', 'rgba(212,80,10,0.06)');

  // Activate bolt installation
  setTimeout(() => renderSandboxBolts(), 400);
}

function renderSandboxBolts() {
  const boltsG = g.select('.layer-bolts');
  boltsG.selectAll('*').remove();

  const boltSel = boltsG.selectAll('.sandbox-bolt')
    .data(traceData.bolts, d => d.id)
    .enter().append('g')
    .attr('class', 'sandbox-bolt')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .style('cursor', 'pointer')
    .on('click', function(event, d) {
      if (installedBolts.has(d.id)) return;
      installBolt(d, d3.select(this));
    });

  // Outer ring
  boltSel.append('circle')
    .attr('r', 6)
    .attr('fill', 'rgba(212,80,10,0.08)')
    .attr('stroke', ACCENT)
    .attr('stroke-width', 1.2);

  // Sequence number
  boltSel.append('text')
    .attr('text-anchor', 'middle').attr('dy', 2.5)
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', 5).attr('font-weight', 700)
    .attr('fill', ACCENT)
    .text(d => d.sequence);
}

function installBolt(bolt, el) {
  installedBolts.add(bolt.id);

  // Animate: fill green, show torque spec
  el.select('circle')
    .transition().duration(300)
    .attr('fill', 'rgba(26,122,58,0.3)')
    .attr('stroke', '#1a7a3a')
    .attr('stroke-width', 2);

  el.select('text')
    .transition().duration(200)
    .attr('fill', '#1a7a3a');

  // Torque tooltip (briefly)
  const tooltip = el.append('text')
    .attr('x', 10).attr('y', -4)
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', 4.5)
    .attr('fill', 'rgba(0,0,0,0.5)')
    .text(`${bolt.tool} — ${bolt.torque}`)
    .attr('opacity', 0)
    .transition().duration(200).attr('opacity', 1)
    .transition().delay(2000).duration(500).attr('opacity', 0).remove();

  updateBoltCounter();

  // Check completion
  if (installedBolts.size === traceData.bolts.length) {
    celebrateCompletion();
  }
}

function updateBoltCounter() {
  svg.select('.bolt-counter').remove();
  const [,, vbW] = traceData.viewBox.split(' ').map(Number);

  if (currentMode !== 'sandbox') return;

  const counter = svg.append('text')
    .attr('class', 'bolt-counter')
    .attr('x', vbW - 10).attr('y', 15)
    .attr('text-anchor', 'end')
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', 8)
    .attr('fill', installedBolts.size === traceData.bolts.length ? '#1a7a3a' : 'rgba(0,0,0,0.3)')
    .text(`${installedBolts.size}/${traceData.bolts.length} bolts installed`);
}

function celebrateCompletion() {
  // Flash all bolts green
  g.select('.layer-bolts').selectAll('.sandbox-bolt circle')
    .transition().duration(200)
    .attr('fill', 'rgba(26,122,58,0.5)')
    .attr('r', 8)
    .transition().duration(300)
    .attr('r', 6);

  updateBoltCounter();
}

export function resetSandbox() {
  if (currentMode !== 'sandbox') return;
  fenderSnapped = false;
  installedBolts = new Set();
  g.select('.layer-bolts').selectAll('*').remove();
  renderSandboxFender();
  updateBoltCounter();
}
```

- [ ] **Step 3: Add Reset button to index.html**

Next to the Practice Mode button:

```html
<button id="reset-practice" style="display:none; position:absolute;top:10px;right:300px;z-index:10;background:#445566;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;" onclick="window._diagram && window._diagram.resetSandbox()">Reset</button>
```

Show/hide in `togglePractice()`:

```javascript
document.getElementById('reset-practice').style.display = 
  currentMode === 'guided' ? 'block' : 'none';
```

- [ ] **Step 4: Test sandbox mode**

1. Switch to Diagram view
2. Click "Practice Mode"
3. Drag the orange fender shape onto the car body
4. It should snap when aligned
5. Click bolt markers to install them (should turn green)
6. Counter should update
7. Click "Reset" to start over
8. Click "Exit Practice" to return to guided mode

- [ ] **Step 5: Commit**

```bash
git add js/diagram.js index.html
git commit -m "Add sandbox mode with draggable fender and bolt installation"
```

---

### Task 8: Add HUD annotations layer

**Files:**
- Modify: `js/diagram.js`

Add dimension lines, part info, and zone labels that render in guided mode.

- [ ] **Step 1: Add HUD rendering function**

Add to `js/diagram.js`:

```javascript
function renderHUD() {
  const hudG = g.select('.layer-hud');
  hudG.selectAll('*').remove();

  const [,, vbW, vbH] = traceData.viewBox.split(' ').map(Number);
  const rearX = traceData.wheels[0].cx;
  const frontX = traceData.wheels[1].cx;

  const font = 'DM Mono, monospace';
  const dimColor = 'rgba(0,140,180,0.3)';
  const dimStroke = 'rgba(0,160,200,0.15)';

  // Wheelbase dimension
  hudG.append('line').attr('x1', rearX).attr('y1', vbH + 8).attr('x2', frontX).attr('y2', vbH + 8)
    .attr('stroke', dimStroke).attr('stroke-width', 0.5);
  hudG.append('line').attr('x1', rearX).attr('y1', vbH + 4).attr('x2', rearX).attr('y2', vbH + 12)
    .attr('stroke', dimStroke).attr('stroke-width', 0.5);
  hudG.append('line').attr('x1', frontX).attr('y1', vbH + 4).attr('x2', frontX).attr('y2', vbH + 12)
    .attr('stroke', dimStroke).attr('stroke-width', 0.5);
  hudG.append('text').attr('x', (rearX + frontX) / 2).attr('y', vbH + 18)
    .attr('text-anchor', 'middle').attr('font-family', font).attr('font-size', 5)
    .attr('fill', dimColor).text('2852mm WB');

  // Part info
  hudG.append('text').attr('x', 5).attr('y', 10)
    .attr('font-family', font).attr('font-size', 5.5).attr('font-weight', 700)
    .attr('fill', 'rgba(212,80,10,0.5)').attr('letter-spacing', 1)
    .text('FENDER GM 20943622');
  hudG.append('text').attr('x', 5).attr('y', 18)
    .attr('font-family', font).attr('font-size', 4.5)
    .attr('fill', 'rgba(0,0,0,0.2)')
    .text('STAMPED STEEL · 11.8 LBS · 7-8x 10MM HEX');

  // Zone labels
  hudG.append('text').attr('x', rearX).attr('y', vbH + 5)
    .attr('text-anchor', 'middle').attr('font-family', font).attr('font-size', 4.5)
    .attr('fill', 'rgba(0,140,180,0.2)').attr('letter-spacing', 1.5).text('REAR');
  hudG.append('text').attr('x', frontX).attr('y', vbH + 5)
    .attr('text-anchor', 'middle').attr('font-family', font).attr('font-size', 4.5)
    .attr('fill', 'rgba(0,140,180,0.2)').attr('letter-spacing', 1.5).text('FRONT');
}
```

- [ ] **Step 2: Call renderHUD() at end of initDiagram()**

Add before `diagramInitialized = true;`:

```javascript
  renderHUD();
```

- [ ] **Step 3: Test — HUD annotations should appear on diagram load**

- [ ] **Step 4: Commit**

```bash
git add js/diagram.js
git commit -m "Add HUD dimension annotations and part info"
```

---

### Task 9: Final polish and cleanup

**Files:**
- Modify: `js/diagram.js`
- Modify: `index.html`

Clean up, remove old static SVG code, add CSS scan line animation.

- [ ] **Step 1: Remove old static SVG from index.html**

Delete the old `<svg id="car-svg">` element and all its children (lines 99-188 approximately — everything between `<div id="diagram-view">` and `</div>` that was the old SVG).

Also remove the old `updateDiagram()` function, `svgBoltMap`, and `svgGapMap` from the `<script>` block since they're no longer used.

- [ ] **Step 2: Add CSS scan line animation**

Add to the `<style>` block in `index.html`:

```css
@keyframes diagram-scan {
  0%, 100% { transform: translateY(-100%); }
  50% { transform: translateY(100%); }
}
#diagram-view::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  background: rgba(0,180,216,0.06);
  animation: diagram-scan 6s linear infinite;
  pointer-events: none;
  z-index: 5;
}
```

- [ ] **Step 3: Test full flow end-to-end**

1. Load page — 3D model shows
2. Click "Switch to Diagram" — D3 diagram renders with traced car body, wheels, HUD
3. Navigate steps 1-16 — zoom transitions, bolts appear/disappear, fender slides on at step 4, gaps show at 11-13
4. Click "Practice Mode" — fender detaches, drag it back on, snap, install bolts
5. Click "Reset" — starts over
6. Click "Exit Practice" — back to guided mode
7. Click "Switch to 3D Model" — back to Sketchfab

- [ ] **Step 4: Commit**

```bash
git add index.html js/diagram.js
git commit -m "Polish: remove old SVG diagram, add scan line, cleanup"
```

---
