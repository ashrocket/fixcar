# Fixcar D3 Interactive Diagram — Design Spec

## Overview

Replace the static SVG diagram view in the fixcar fender installation guide with a D3.js-powered interactive experience. Two modes: **Guided** (step-through the 16-step install) and **Sandbox** (free practice with draggable fender overlay). Laptop-primary, mouse/trackpad interaction.

## Data Foundation

- **Car body outline**: potrace-traced bezier paths from the Sketchfab 3D model (`svg-body.svg` for smooth body, `svg-detail.svg` for windows/wheel arches/vents)
- **Fender piece**: separate traced path extracted from the fender zone of the detail SVG — the region from A-pillar forward including wheel arch, hood line, and nose
- **Bolt locations**: 10 positions with metadata (type, torque spec, tool required, difficulty rating). Positions mapped to potrace coordinate space (~1046 x 277 viewBox)
- **Step data**: existing `STEPS` array from `index.html` (16 steps with descriptions, fasteners, tools, tips, warnings, bolt groups, gap indicators)
- **Trace data**: `trace-data.json` containing potrace path strings, viewBox, and transform

## Guided Mode

Driven by the existing 16-step STEPS data array. The diagram is the visual companion to the side panel's text instructions.

### Per-Step Behavior
- D3 `zoom.transform()` transitions smoothly to the relevant area for each step (e.g., zooms to A-pillar for step 5, zooms to front nose for step 7)
- Bolt markers appear and pulse when referenced in a step's `showBolts` array
- Gap indicators (door 4-5mm, hood 3.5-5mm, bumper 1-3mm) render as dashed measurement lines during alignment steps 11-13
- Fender piece animates sliding onto the car body at step 4 ("Offer Up the Fender") — semi-transparent overlay moves from an offset position and settles into place
- Steps that don't involve the diagram (prep, inventory) show the full car at default zoom

### Controls
- Transport bar (prev/next/play/pause) drives step sequence — same as current app
- Timeline dots track completion — same as current app
- Mouse wheel zooms, drag pans (available at all times, auto-resets on step change)

## Sandbox Mode

Toggle via a "Practice Mode" button in the diagram toolbar (alongside the existing 3D Model / Diagram / Wireframe buttons).

### Fender Drag Interaction
- Full car visible at default zoom, free pan/zoom with mouse wheel + drag
- Fender piece starts detached, positioned to the right of the car body
- User drags fender onto the car body using `d3.drag()`
- Fender renders as semi-transparent (~30% opacity) with internal detail visible (wheel arch lip, bolt hole positions marked as circles)
- Fender snaps into correct position when aligned within a tolerance threshold (e.g., 15px in viewBox space)
- Visual feedback on snap: brief flash, opacity increases to 50%, bolt holes align and glow

### Bolt Installation
- Once fender is snapped in place, 10 bolt points become active
- Each bolt rendered as a circle with a numbered indicator showing recommended sequence
- Click a bolt to "install" it:
  - Visual: circle fills, turns green, brief torque spec tooltip appears (e.g., "10mm — 9 N·m")
  - Audio: none (laptop in garage, probably has music playing)
- Bolt order is NOT enforced — recommended sequence shown as numbered labels but user can install in any order
- Counter in toolbar: "3/10 bolts installed"
- Completion state: all 10 installed → success indicator, all bolts flash green

### Reset
- "Reset" button pulls fender back to starting position, clears all bolt states
- Allows unlimited practice reps

## D3 Technical Approach

### Rendering Layers (bottom to top)
1. **Grid background** — CSS background on the container (not D3-rendered)
2. **Car body (smooth)** — body potrace path, thick stroke, subtle fill
3. **Car body (detail)** — detail potrace path, thinner stroke showing windows/arches/vents
4. **Wheel circles** — geometric SVG circles with spoke detail at computed positions
5. **Fender zone highlight** — when in guided mode, fender area boundary pulses
6. **Fender piece** — draggable semi-transparent overlay (sandbox) or animated overlay (guided)
7. **Bolt markers** — data-bound circles, appear/disappear per step
8. **Gap indicators** — dashed measurement lines with dimension labels
9. **HUD annotations** — part info, dimension lines, zone labels
10. **Scan line** — CSS-animated horizontal sweep

### D3 Specifics
- `d3.zoom()` — handles pan/zoom with `scaleExtent([0.5, 8])` and smooth `d3.transition().duration(800)`
- `d3.drag()` — fender piece positioning with snap-to-target logic
- Potrace SVG paths rendered via `<path d="...">` elements appended by D3
- Bolt markers as D3 data-bound `<circle>` elements using enter/update/exit pattern
- Step transitions: `svg.transition().call(zoom.transform, d3.zoomIdentity.translate(x,y).scale(s))` with `d3.easeCubicInOut`
- All coordinates in potrace viewBox space (~1046 x 277), D3 zoom handles screen mapping automatically

### Zoom Targets per Step
Each step defines a zoom target as `{x, y, scale}` in viewBox coordinates:
- Overview steps (1, 2, 16): scale 1.0, centered on full car
- A-pillar steps (4, 5, 11): zoom to rear of fender zone, scale ~3
- Top rail steps (6, 12): zoom to hood line area, scale ~2.5
- Front/bumper steps (7, 13): zoom to nose, scale ~3
- Lower/rocker step (8): zoom to bottom of fender, scale ~3
- Hidden bolt step (9): zoom to front wheel arch area, scale ~4
- Side marker step (10): zoom to front fender mid-height, scale ~3
- Torque sequence (14): animated tour cycling through all bolt locations
- Liner step (15): zoom to wheel well area, scale ~2.5

## UI Integration

### What Changes
- The `#diagram-view` div in `index.html` becomes a D3-managed SVG canvas
- `toggleModel()` function updated to initialize D3 diagram when switching to diagram view
- Step navigation (`goToStep()`) calls D3 zoom transition instead of updating static SVG visibility
- New "Practice Mode" button added to the diagram toolbar

### What Stays the Same
- Side panel with step info (title, description, fasteners, tools, warnings)
- Header with car info, VIN, step counter, completion ring
- Transport bar (prev/next/play/pause/speed)
- 3D Model / Diagram / Wireframe toggle (D3 replaces old diagram, other views unchanged)
- Timeline dots
- Sketchfab 3D model embed (untouched)

## File Structure

```
fixcar/
  index.html              — main app (modified: loads D3 + diagram module)
  js/
    diagram.js             — D3 diagram module (guided + sandbox modes)
  data/
    trace-data.json        — potrace paths, bolt positions, zoom targets
  (existing files unchanged)
```

- `diagram.js` is a single ES module, imported by index.html
- `trace-data.json` is the existing file enriched with bolt positions and zoom targets
- D3 loaded via CDN (`https://d3js.org/d3.v7.min.js`)

## Out of Scope

- Mobile/touch optimization (laptop-primary)
- Sound effects
- Multiplayer / sharing
- Saving progress between sessions
- Modifying the 3D model view or Sketchfab integration
- React migration (stays vanilla JS)
