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
// Bolt group → individual bolt ID mapping
// ---------------------------------------------------------------------------
const BOLT_GROUPS = {
  a_pillar:    ['a_pillar_upper', 'a_pillar_lower'],
  top_rail:    ['top_rail_1', 'top_rail_2', 'top_rail_3'],
  front:       ['front_upper', 'front_mid', 'front_lower'],
  lower:       ['lower_1', 'lower_2'],
  hidden:      ['hidden'],
  side_marker: ['side_marker'],
};

// ---------------------------------------------------------------------------
// Gap indicator definitions
// ---------------------------------------------------------------------------
const GAP_INDICATORS = {
  door:   { x1: 490, y1:  50, x2: 490, y2: 240, label: 'DOOR GAP',  spec: '4.0-5.0mm', color: 'rgba(26,122,58,'   },
  hood:   { x1: 540, y1:  40, x2: 920, y2:  40, label: 'HOOD GAP',  spec: '3.5-5.0mm', color: 'rgba(26,90,170,'   },
  bumper: { x1: 945, y1:  80, x2: 945, y2: 220, label: 'BUMPER',    spec: '1.0-3.0mm', color: 'rgba(176,102,0,'   },
};

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
let currentMode        = 'guided'; // 'guided' | 'sandbox'

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
 * Zooms to the step target, then re-renders bolts, fender overlay, and gap indicators.
 */
export function updateStep(stepIndex, stepData) {
  // --- 1. Zoom ---
  zoomToTarget(stepIndex, true);

  if (!mainGroup || !traceData) return;

  // -------------------------------------------------------------------------
  // Task 4: Bolt markers (guided mode only)
  // -------------------------------------------------------------------------
  const boltLayer = mainGroup.select('.layer-bolts');
  boltLayer.selectAll('*').remove();

  if (currentMode === 'guided' && stepData && stepData.showBolts) {
    // Resolve the list of bolt IDs to show
    const showBolts = stepData.showBolts;
    let boltIds = [];

    if (showBolts.includes('all')) {
      // Every bolt in every group
      boltIds = Object.values(BOLT_GROUPS).flat();
    } else {
      showBolts.forEach((groupKey) => {
        if (BOLT_GROUPS[groupKey]) {
          boltIds = boltIds.concat(BOLT_GROUPS[groupKey]);
        }
      });
    }

    // Look up each bolt object from traceData.bolts (keyed by id)
    const boltsMap = traceData.bolts || {};
    boltIds.forEach((boltId) => {
      const bolt = boltsMap[boltId];
      if (!bolt) return;

      const bg = boltLayer.append('g')
        .attr('class', 'bolt-marker')
        .attr('transform', `translate(${bolt.x},${bolt.y})`);

      // Outer ring — animate r from 0
      bg.append('circle')
        .attr('r', 0)
        .attr('stroke', ACCENT)
        .attr('stroke-width', 1.5)
        .attr('fill', 'none')
        .attr('opacity', 0.4)
        .transition().duration(400).ease(d3.easeCubicOut)
        .attr('r', 8);

      // Inner dot — animate r from 0
      bg.append('circle')
        .attr('r', 0)
        .attr('fill', ACCENT)
        .attr('opacity', 0.7)
        .transition().duration(400).ease(d3.easeCubicOut)
        .attr('r', 3);

      // Label
      bg.append('text')
        .attr('x', 10)
        .attr('y', 4)
        .attr('font-size', 6)
        .attr('fill', ACCENT)
        .attr('opacity', 0.9)
        .text(bolt.label || boltId);
    });
  }

  // -------------------------------------------------------------------------
  // Task 5: Fender overlay
  // -------------------------------------------------------------------------
  const fenderLayer = mainGroup.select('.layer-fender-zone');
  fenderLayer.selectAll('*').remove();

  if (stepData && stepData.fenderOn && traceData.fenderPath) {
    const isDryFit = stepIndex === 3;

    const fg = fenderLayer.append('g')
      .attr('transform', traceData.transform);

    const fenderPath = fg.append('path')
      .attr('d', traceData.fenderPath)
      .attr('fill', 'rgba(212,80,10,0.04)')
      .attr('stroke', 'rgba(212,80,10,0.3)')
      .attr('stroke-width', 3)
      .attr('opacity', 0);

    if (isDryFit) {
      fenderPath
        .attr('stroke-dasharray', '8 4')
        .transition().duration(1500).ease(d3.easeCubicInOut)
        .attr('opacity', 1);
    } else {
      fenderPath
        .transition().duration(400).ease(d3.easeCubicInOut)
        .attr('opacity', 1);
    }
  }

  // -------------------------------------------------------------------------
  // Task 6: Gap indicators
  // -------------------------------------------------------------------------
  const gapLayer = mainGroup.select('.layer-gaps');
  gapLayer.selectAll('*').remove();

  if (stepData && stepData.showGaps && stepData.showGaps.length > 0) {
    stepData.showGaps.forEach((gapKey) => {
      const gap = GAP_INDICATORS[gapKey];
      if (!gap) return;

      const isVertical = gap.x1 === gap.x2;
      const gg = gapLayer.append('g').attr('class', `gap-${gapKey}`);

      // Two parallel dashed lines offset by ±2 on the perpendicular axis
      [-2, 2].forEach((offset) => {
        const x1 = isVertical ? gap.x1 + offset : gap.x1;
        const y1 = isVertical ? gap.y1 : gap.y1 + offset;
        const x2 = isVertical ? gap.x2 + offset : gap.x2;
        const y2 = isVertical ? gap.y2 : gap.y2 + offset;

        gg.append('line')
          .attr('x1', x1).attr('y1', y1)
          .attr('x2', x2).attr('y2', y2)
          .attr('stroke', gap.color + '0.7)')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '6 3');
      });

      // Label box at midpoint
      const mx = (gap.x1 + gap.x2) / 2;
      const my = (gap.y1 + gap.y2) / 2;

      const labelG = gg.append('g')
        .attr('transform', `translate(${mx},${my})`);

      // Background rect
      labelG.append('rect')
        .attr('x', -22).attr('y', -14)
        .attr('width', 44).attr('height', 20)
        .attr('rx', 2).attr('ry', 2)
        .attr('fill', gap.color + '0.15)')
        .attr('stroke', gap.color + '0.5)')
        .attr('stroke-width', 0.75);

      // Gap name
      labelG.append('text')
        .attr('x', 0).attr('y', -4)
        .attr('text-anchor', 'middle')
        .attr('font-size', 5)
        .attr('font-weight', 'bold')
        .attr('fill', gap.color + '1)')
        .text(gap.label);

      // Spec
      labelG.append('text')
        .attr('x', 0).attr('y', 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', 4.5)
        .attr('fill', gap.color + '0.85)')
        .text(gap.spec);
    });
  }
}

/**
 * enterSandbox()
 * Switches to sandbox mode.
 */
export function enterSandbox() {
  sandboxMode = true;
  currentMode = 'sandbox';
}

/**
 * exitSandbox()
 * Returns to guided mode.
 */
export function exitSandbox() {
  sandboxMode = false;
  currentMode = 'guided';
}

/**
 * resetSandbox()
 * Resets sandbox state and returns to guided mode.
 */
export function resetSandbox() {
  sandboxMode = false;
  currentMode = 'guided';
}
