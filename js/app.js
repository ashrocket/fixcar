import { CAMERA_PRESETS, INSTALL_ZONES, RESEARCH_LINKS, SIDE_PRESETS } from "./install-data.js";
import { FenderViewer, summarizeMetrics } from "./fender-viewer.js";

const viewerCanvas = document.querySelector("#viewer");
const readoutEl = document.querySelector("#viewer-readout");
const shellTrianglesEl = document.querySelector("#shell-triangles");
const sliceTrianglesEl = document.querySelector("#slice-triangles");
const modelSizeEl = document.querySelector("#model-size");
const sliceSizeEl = document.querySelector("#slice-size");
const statusLineEl = document.querySelector("#status-line");
const boundsSlidersEl = document.querySelector("#bounds-sliders");
const sidePresetsEl = document.querySelector("#side-presets");
const cameraPresetsEl = document.querySelector("#camera-presets");
const installZonesEl = document.querySelector("#install-zones");
const researchLinksEl = document.querySelector("#research-links");

const sliderState = {};
let activeSide = SIDE_PRESETS.frontRight;
let activeZone = INSTALL_ZONES[0];
let cameraButtons = [];
let sideButtons = [];
let zoneCards = [];
let viewerReady = false;

const viewer = new FenderViewer({
  canvas: viewerCanvas,
  onMetrics(metrics) {
    const formatted = summarizeMetrics(metrics);
    shellTrianglesEl.textContent = formatted.shellTriangles;
    sliceTrianglesEl.textContent = formatted.sliceTriangles;
    modelSizeEl.textContent = formatted.modelSize;
    sliceSizeEl.textContent = formatted.sliceSize;
  },
  onStatus(message) {
    statusLineEl.textContent = message;
  },
  onReadout({ presetId, bounds, sliceSize, style, zoneId }) {
    const zone = INSTALL_ZONES.find((entry) => entry.id === zoneId) ?? activeZone;
    const preset = CAMERA_PRESETS.find((entry) => entry.id === presetId);
    readoutEl.innerHTML = `
      <div><strong>Preset</strong> ${preset?.label ?? presetId}</div>
      <div><strong>Zone</strong> ${zone.title}</div>
      <div><strong>Shell Style</strong> ${style}</div>
      <div><strong>Slice</strong> ${sliceSize.x.toFixed(1)} x ${sliceSize.y.toFixed(1)} x ${sliceSize.z.toFixed(1)} mm</div>
      <div><strong>Bounds</strong> x ${bounds.minX.toFixed(1)}..${bounds.maxX.toFixed(1)} | y ${bounds.minY.toFixed(1)}..${bounds.maxY.toFixed(1)} | z ${bounds.minZ.toFixed(1)}..${bounds.maxZ.toFixed(1)}</div>
    `;
  },
});

function createButton(label, dataset = {}, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  Object.entries(dataset).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  return button;
}

function renderSideButtons() {
  sidePresetsEl.innerHTML = "";
  sideButtons = Object.values(SIDE_PRESETS).map((preset) => {
    const button = createButton(preset.label, { sidePreset: preset.id });
    if (preset.id === activeSide.id) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      activeSide = preset;
      syncSideButtons();
      updateSliderValues(preset.bounds, true);
      viewer.setBounds(preset.bounds);
      viewer.framePreset(
        document.querySelector("[data-camera-preset].active")?.dataset.cameraPreset ?? "hero",
      );
      statusLineEl.textContent = `Loaded ${preset.label} slice preset. Tighten the box to remove extra shell.`;
    });
    sidePresetsEl.append(button);
    return button;
  });
}

function renderCameraButtons() {
  cameraPresetsEl.innerHTML = "";
  cameraButtons = CAMERA_PRESETS.map((preset, index) => {
    const button = createButton(preset.label, { cameraPreset: preset.id });
    if (preset.id === "hero") {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      setActiveCameraButton(preset.id);
      viewer.framePreset(preset.id);
    });
    cameraPresetsEl.append(button);
    return button;
  });
}

function renderZoneCards() {
  installZonesEl.innerHTML = "";
  zoneCards = INSTALL_ZONES.map((zone, index) => {
    const card = document.createElement("article");
    card.className = "step-card";
    if (index === 0) {
      card.classList.add("active");
    }

    const metaHtml = zone.fasteners
      .map((text) => `<span class="meta-pill">${text}</span>`)
      .join("");

    card.innerHTML = `
      <h3>${zone.title}</h3>
      <p>${zone.summary}</p>
      <div class="step-meta">${metaHtml}</div>
    `;
    card.addEventListener("click", () => {
      activeZone = zone;
      syncZoneCards();
      viewer.setZone(zone.id);
      const fallbackPreset = zone.id === "overview" ? "hero" : zone.id === "doorJamb" ? "doorJamb" : zone.id;
      setActiveCameraButton(fallbackPreset);
      viewer.framePreset(fallbackPreset);
      statusLineEl.textContent = `${zone.title} focused. Marker dots are approximate install references.`;
    });
    installZonesEl.append(card);
    return card;
  });
}

function renderResearchLinks() {
  researchLinksEl.innerHTML = RESEARCH_LINKS.map((link) => `
    <a class="source-link" href="${link.href}" target="_blank" rel="noreferrer">
      ${link.title}
      <small>${link.note}</small>
    </a>
  `).join("");
}

function setActiveCameraButton(presetId) {
  cameraButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.cameraPreset === presetId);
  });
}

function syncSideButtons() {
  sideButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sidePreset === activeSide.id);
  });
}

function syncZoneCards() {
  zoneCards.forEach((card, index) => {
    card.classList.toggle("active", INSTALL_ZONES[index].id === activeZone.id);
  });
}

function scheduleBoundsUpdate() {
  if (!viewerReady) {
    return;
  }

  window.clearTimeout(scheduleBoundsUpdate.timer);
  scheduleBoundsUpdate.timer = window.setTimeout(() => {
    const bounds = getCurrentBounds();
    viewer.setBounds(bounds);
  }, 80);
}

function getCurrentBounds() {
  return Object.fromEntries(
    Object.entries(sliderState).map(([key, state]) => [key, Number(state.input.value)]),
  );
}

function updateSliderValues(bounds, immediate = false) {
  Object.entries(bounds).forEach(([key, value]) => {
    if (!sliderState[key]) {
      return;
    }
    sliderState[key].input.value = value;
    sliderState[key].valueEl.textContent = `${Number(value).toFixed(1)} mm`;
  });
  if (immediate && viewerReady) {
    viewer.setBounds(bounds);
  }
}

function renderBoundsSliders(limits, initialBounds) {
  const sliderDefs = [
    { key: "minX", label: "Min X", min: limits.min.x, max: limits.max.x },
    { key: "maxX", label: "Max X", min: limits.min.x, max: limits.max.x },
    { key: "minY", label: "Min Y", min: limits.min.y, max: limits.max.y },
    { key: "maxY", label: "Max Y", min: limits.min.y, max: limits.max.y },
    { key: "minZ", label: "Min Z", min: limits.min.z, max: limits.max.z },
    { key: "maxZ", label: "Max Z", min: limits.min.z, max: limits.max.z },
  ];

  boundsSlidersEl.innerHTML = "";

  sliderDefs.forEach((definition) => {
    const wrapper = document.createElement("label");
    wrapper.className = "slider-row";

    const label = document.createElement("div");
    label.className = "slider-label";
    label.innerHTML = `<span>${definition.label}</span>`;

    const valueEl = document.createElement("span");
    valueEl.textContent = `${initialBounds[definition.key].toFixed(1)} mm`;
    label.append(valueEl);

    const input = document.createElement("input");
    input.type = "range";
    input.min = definition.min;
    input.max = definition.max;
    input.step = "0.5";
    input.value = initialBounds[definition.key];
    input.addEventListener("input", () => {
      valueEl.textContent = `${Number(input.value).toFixed(1)} mm`;
      scheduleBoundsUpdate();
    });

    wrapper.append(label, input);
    boundsSlidersEl.append(wrapper);
    sliderState[definition.key] = { input, valueEl };
  });
}

document.querySelectorAll("[data-style]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-style]").forEach((entry) => {
      entry.classList.toggle("active", entry === button);
    });
    viewer.setStyle(button.dataset.style);
    viewer.framePreset(
      document.querySelector("[data-camera-preset].active")?.dataset.cameraPreset ?? "hero",
    );
  });
});

document.querySelectorAll(".transform-mode").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".transform-mode").forEach((entry) => {
      entry.classList.toggle("active", entry === button);
    });
    viewer.setTransformMode(button.dataset.mode);
  });
});

document.querySelector("#reset-slice").addEventListener("click", () => {
  viewer.resetSliceTransform();
  statusLineEl.textContent = "Slice transform reset.";
});

document.querySelector("#snap-slice").addEventListener("click", () => {
  viewer.snapSliceHome();
  statusLineEl.textContent = "Slice snapped back to its original shell position.";
});

renderSideButtons();
renderCameraButtons();
renderZoneCards();
renderResearchLinks();

async function boot() {
  try {
    await viewer.init(activeSide.bounds);
    viewerReady = true;
    renderBoundsSliders(viewer.getBoundsLimit(), activeSide.bounds);
    viewer.setZone(activeZone.id);
    viewer.setStyle("xray");
    setActiveCameraButton("hero");
    viewer.framePreset("hero");
    statusLineEl.textContent = "Shell ready. Start with the whole car, then trim the box and move the slice with the gizmo.";
  } catch (error) {
    console.error(error);
    statusLineEl.textContent = "Failed to load the STL. Serve the folder over HTTP instead of opening index.html directly.";
    readoutEl.innerHTML = `
      <div><strong>Load failed</strong></div>
      <div>Three.js could not fetch <code>assets/models/camaro-print-shell-trimmed.stl</code>.</div>
      <div>Run a local server such as <code>python3 -m http.server 4173</code> in this folder.</div>
    `;
  }
}

boot();
