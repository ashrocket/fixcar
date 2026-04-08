/**
 * diagram.js — D3.js car body diagram module
 * Renders potrace-traced SVG paths with multi-layer HUD styling.
 * D3 v7 is expected as a global (loaded via CDN).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const HUD_CYAN = 'rgba(0,130,170,';   // append opacity + ')'
const ACCENT   = '#d4500a';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------
let diagramInitialized = false;
let traceData          = null;
let svgEl              = null;
let mainGroup          = null;   // the <g> that zoom transforms
let zoomBehavior       = null;
let containerWidth     = 0;
let containerHeight    = 0;
let sandboxMode        = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * initDiagram(containerSelector)
 * Fetches trace-data.json, builds the SVG, and attaches D3 zoom.
 */
export async function initDiagram(containerSelector) {
  if (diagramInitialized) return;
  diagramInitialized = true;

  // --- fetch data ---
  const response = await fetch('data/trace-data.json');
  traceData = await response.json();

  const container = d3.select(containerSelector);
  const node      = container.node();
  containerWidth  = node.clientWidth  || 1046;
  containerHeight = node.clientHeight || 277;

  // --- create SVG ---
  svgEl = container
    .append('svg')
    .attr('viewBox', traceData.viewBox)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width',  '100%')
    .style('height', '100%')
    .style('overflow', 'hidden')
    .style('display', 'block');

  // --- define blur filter ---
  const defs = svgEl.append('defs');
  defs.append('filter')
    .attr('id', 'hud-glow')
    .attr('x', '-20%')
    .attr('y', '-20%')
    .attr('width', '140%')
    .attr('height', '140%')
    .append('feGaussianBlur')
    .attr('in', 'SourceGraphic')
    .attr('stdDeviation', 6);

  // --- main group (zoom target) ---
  mainGroup = svgEl.append('g').attr('class', 'main-group');

  // --- path group: apply potrace transform ---
  const pathGroup = mainGroup
    .append('g')
    .attr('class', 'path-group')
    .attr('transform', traceData.transform)
    .attr('fill', 'none');

  // Layer 1 — body glow (thick, blurred, low opacity)
  pathGroup.append('path')
    .attr('class', 'layer-body-glow')
    .attr('d', traceData.bodyPath)
    .attr('stroke', HUD_CYAN + '0.15)')
    .attr('stroke-width', 40)
    .attr('fill', 'none')
    .attr('filter', 'url(#hud-glow)');

  // Layer 2 — body fill (very subtle)
  pathGroup.append('path')
    .attr('class', 'layer-body-fill')
    .attr('d', traceData.bodyPath)
    .attr('fill', 'rgba(0,160,200,0.025)')
    .attr('stroke', 'none');

  // Layer 3 — body outline
  pathGroup.append('path')
    .attr('class', 'layer-body-outline')
    .attr('d', traceData.bodyPath)
    .attr('stroke', HUD_CYAN + '0.35)')
    .attr('stroke-width', 5)
    .attr('fill', 'none');

  // Layer 4 — detail trace
  pathGroup.append('path')
    .attr('class', 'layer-detail-trace')
    .attr('d', traceData.detailPath)
    .attr('stroke', HUD_CYAN + '0.5)')
    .attr('stroke-width', 2.5)
    .attr('fill', 'none');

  // Layer 5 — sharp highlight
  pathGroup.append('path')
    .attr('class', 'layer-detail-highlight')
    .attr('d', traceData.detailPath)
    .attr('stroke', 'rgba(0,180,220,0.6)')
    .attr('stroke-width', 1)
    .attr('fill', 'none');

  // --- wheels (viewBox coordinates, NOT inside transform group) ---
  const wheelGroup = mainGroup.append('g').attr('class', 'layer-wheels');

  traceData.wheels.forEach((wheel) => {
    const { cx, cy, r } = wheel;
    const rimR  = r * 0.68;
    const hubR  = r * 0.22;
    const wg    = wheelGroup.append('g').attr('class', 'wheel');

    // Outer tire ring
    wg.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', r)
      .attr('stroke', HUD_CYAN + '0.45)')
      .attr('stroke-width', 3)
      .attr('fill', 'rgba(0,130,170,0.04)');

    // Rim ring
    wg.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', rimR)
      .attr('stroke', HUD_CYAN + '0.55)')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none');

    // Hub circle
    wg.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', hubR)
      .attr('stroke', HUD_CYAN + '0.7)')
      .attr('stroke-width', 1.5)
      .attr('fill', 'rgba(0,130,170,0.15)');

    // 5 spokes
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x1 = cx + Math.cos(angle) * hubR;
      const y1 = cy + Math.sin(angle) * hubR;
      const x2 = cx + Math.cos(angle) * rimR;
      const y2 = cy + Math.sin(angle) * rimR;
      wg.append('line')
        .attr('x1', x1).attr('y1', y1)
        .attr('x2', x2).attr('y2', y2)
        .attr('stroke', HUD_CYAN + '0.5)')
        .attr('stroke-width', 1.2);
    }
  });

  // --- empty placeholder layers ---
  ['layer-fender-zone', 'layer-fender-piece', 'layer-bolts', 'layer-gaps', 'layer-hud']
    .forEach((id) => mainGroup.append('g').attr('id', id).attr('class', id));

  // --- D3 zoom ---
  zoomBehavior = d3.zoom()
    .scaleExtent([0.5, 8])
    .on('zoom', (event) => {
      mainGroup.attr('transform', event.transform);
    });

  svgEl.call(zoomBehavior);

  // Start at step 0 (full overview), no animation
  zoomToTarget(0, false);
}

/**
 * zoomToTarget(stepIndex, animate)
 * Transitions the D3 zoom to the target for the given step.
 */
export function zoomToTarget(stepIndex, animate = true) {
  if (!svgEl || !zoomBehavior || !traceData) return;

  const targets = traceData.zoomTargets;
  const key     = String(stepIndex);
  const target  = targets[key] || targets['0'];

  // Resolve SVG element dimensions for centering
  const svgNode  = svgEl.node();
  const svgW     = svgNode.clientWidth  || containerWidth  || 1046;
  const svgH     = svgNode.clientHeight || containerHeight || 277;

  const scale = target.scale;
  const tx    = svgW / 2 - target.x * scale;
  const ty    = svgH / 2 - target.y * scale;

  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

  if (animate) {
    svgEl.transition().duration(600).ease(d3.easeCubicInOut)
      .call(zoomBehavior.transform, transform);
  } else {
    svgEl.call(zoomBehavior.transform, transform);
  }
}

/**
 * resetZoom()
 * Returns to step 0 (full car overview).
 */
export function resetZoom() {
  zoomToTarget(0, true);
}

/**
 * updateStep(stepIndex, stepData)
 * Placeholder — delegates to zoomToTarget.
 */
export function updateStep(stepIndex, stepData) {
  zoomToTarget(stepIndex, true);
}

/**
 * enterSandbox()
 * Placeholder — sets sandbox mode flag.
 */
export function enterSandbox() {
  sandboxMode = true;
}

/**
 * exitSandbox()
 * Placeholder — clears sandbox mode flag.
 */
export function exitSandbox() {
  sandboxMode = false;
}

/**
 * resetSandbox()
 * Placeholder — resets any sandbox state.
 */
export function resetSandbox() {
  sandboxMode = false;
}
