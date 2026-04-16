import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

import { makeMarkers } from "./install-data.js";

const SHELL_PATH = "assets/models/camaro-print-shell-trimmed.stl";
const SUPPORT_CUTOFF_Z = -8;

function formatVector(vector) {
  return `${vector.x.toFixed(1)} x ${vector.y.toFixed(1)} x ${vector.z.toFixed(1)} mm`;
}

function clampBounds(bounds, limits) {
  return {
    minX: Math.max(limits.min.x, Math.min(bounds.minX, bounds.maxX - 1)),
    maxX: Math.min(limits.max.x, Math.max(bounds.maxX, bounds.minX + 1)),
    minY: Math.max(limits.min.y, Math.min(bounds.minY, bounds.maxY - 1)),
    maxY: Math.min(limits.max.y, Math.max(bounds.maxY, bounds.minY + 1)),
    minZ: Math.max(limits.min.z, Math.min(bounds.minZ, bounds.maxZ - 1)),
    maxZ: Math.min(limits.max.z, Math.max(bounds.maxZ, bounds.minZ + 1)),
  };
}

function triangleBoxIntersects(positionArray, offset, bounds) {
  let triMinX = Infinity;
  let triMinY = Infinity;
  let triMinZ = Infinity;
  let triMaxX = -Infinity;
  let triMaxY = -Infinity;
  let triMaxZ = -Infinity;

  for (let index = 0; index < 9; index += 3) {
    const x = positionArray[offset + index];
    const y = positionArray[offset + index + 1];
    const z = positionArray[offset + index + 2];
    triMinX = Math.min(triMinX, x);
    triMinY = Math.min(triMinY, y);
    triMinZ = Math.min(triMinZ, z);
    triMaxX = Math.max(triMaxX, x);
    triMaxY = Math.max(triMaxY, y);
    triMaxZ = Math.max(triMaxZ, z);
  }

  return !(
    triMaxX < bounds.minX ||
    triMinX > bounds.maxX ||
    triMaxY < bounds.minY ||
    triMinY > bounds.maxY ||
    triMaxZ < bounds.minZ ||
    triMinZ > bounds.maxZ
  );
}

function filterGeometry(sourceGeometry, predicate) {
  const positions = sourceGeometry.attributes.position.array;
  const normals = sourceGeometry.attributes.normal?.array ?? null;
  const nextPositions = [];
  const nextNormals = [];

  for (let offset = 0; offset < positions.length; offset += 9) {
    if (!predicate(positions, offset)) {
      continue;
    }

    for (let index = 0; index < 9; index += 1) {
      nextPositions.push(positions[offset + index]);
      if (normals) {
        nextNormals.push(normals[offset + index]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(nextPositions, 3));

  if (normals && nextNormals.length === nextPositions.length) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nextNormals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeLabelTexture(text) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = 24;
  context.font = `600 ${fontSize}px "IBM Plex Mono"`;
  const width = Math.ceil(context.measureText(text).width + 28);
  const height = 54;
  canvas.width = width;
  canvas.height = height;

  context.font = `600 ${fontSize}px "IBM Plex Mono"`;
  context.fillStyle = "rgba(255, 255, 255, 0.94)";
  context.strokeStyle = "rgba(28, 120, 128, 0.52)";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(2, 2, width - 4, height - 4, 18);
  context.fill();
  context.stroke();

  context.fillStyle = "#26465c";
  context.textBaseline = "middle";
  context.fillText(text, 16, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMarker({ label, detail, x, y, z }) {
  const group = new THREE.Group();

  const stemGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 10),
  ]);
  const stem = new THREE.Line(
    stemGeometry,
    new THREE.LineBasicMaterial({ color: 0x1c7880, transparent: true, opacity: 0.82 }),
  );

  const point = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xd96f20 }),
  );

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeLabelTexture(label),
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(10, 2.4, 1);
  sprite.position.set(0, 0, 11.5);

  group.position.set(x, y, z);
  group.add(stem, point, sprite);
  return group;
}

export class FenderViewer {
  constructor({ canvas, onMetrics, onStatus, onReadout }) {
    this.canvas = canvas;
    this.onMetrics = onMetrics;
    this.onStatus = onStatus;
    this.onReadout = onReadout;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(160, 110, 240);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 40;
    this.controls.maxDistance = 1400;
    this.controls.enableZoom = false;
    this.controls.enabled = false;

    this.transformControls = new TransformControls(this.camera, canvas);
    this.transformControls.setSize(0.85);
    this.transformControls.translationSnap = 1;
    this.transformControls.rotationSnap = Math.PI / 36;
    this.transformControls.addEventListener("dragging-changed", (event) => {
      this.isTransformDragging = event.value;
      this.controls.enabled = !event.value && this.activeWorldInteraction !== null;
      this.updateCanvasCursor();
    });
    this.scene.add(this.transformControls.getHelper());

    this.sceneRoot = new THREE.Group();
    this.scene.add(this.sceneRoot);

    this.markerGroup = new THREE.Group();
    this.sceneRoot.add(this.markerGroup);

    this.selectionGroup = new THREE.Group();
    this.sceneRoot.add(this.selectionGroup);

    this.focusGroup = new THREE.Group();
    this.sceneRoot.add(this.focusGroup);

    this.ambient = new THREE.HemisphereLight(0xffffff, 0xd9e2ea, 1.45);
    this.scene.add(this.ambient);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    this.keyLight.position.set(180, 140, 120);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x9ad4d9, 0.36);
    this.fillLight.position.set(-160, -120, 40);
    this.scene.add(this.fillLight);

    const grid = new THREE.GridHelper(320, 20, 0xc8d4de, 0xe3ebf1);
    grid.material.transparent = true;
    grid.material.opacity = 0.88;
    grid.rotation.x = Math.PI / 2;
    this.scene.add(grid);

    this.clock = new THREE.Clock();
    this.animationTarget = null;
    this.activeWorldInteraction = null;
    this.bounds = null;
    this.boundsLimit = null;
    this.isTransformDragging = false;
    this.zoneId = "overview";
    this.style = "xray";

    this.handlePointerDownCapture = this.handlePointerDownCapture.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheelCapture = this.handleWheelCapture.bind(this);
    this.handleModifierStateChange = this.handleModifierStateChange.bind(this);

    this.canvas.addEventListener("pointerdown", this.handlePointerDownCapture, true);
    this.canvas.addEventListener("wheel", this.handleWheelCapture, { passive: false, capture: true });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
    window.addEventListener("keydown", this.handleModifierStateChange);
    window.addEventListener("keyup", this.handleModifierStateChange);
    window.addEventListener("blur", this.handlePointerUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.render = this.render.bind(this);
    this.updateCanvasCursor();
    requestAnimationFrame(this.render);
  }

  async init(initialBounds) {
    this.onStatus("Loading STL...");
    const loader = new STLLoader();
    const rawGeometry = await loader.loadAsync(SHELL_PATH);
    rawGeometry.computeVertexNormals();
    rawGeometry.computeBoundingBox();

    const rawBounds = rawGeometry.boundingBox;
    this.boundsLimit = {
      min: rawBounds.min.clone(),
      max: rawBounds.max.clone(),
    };

    const trimmedGeometry = filterGeometry(
      rawGeometry,
      (positions, offset) => {
        let triMaxZ = -Infinity;
        for (let index = 2; index < 9; index += 3) {
          triMaxZ = Math.max(triMaxZ, positions[offset + index]);
        }
        return triMaxZ >= SUPPORT_CUTOFF_Z;
      },
    );

    this.rawBounds = rawBounds.clone();
    this.trimmedGeometry = trimmedGeometry;
    this.trimmedBounds = trimmedGeometry.boundingBox.clone();
    this.modelCenter = this.trimmedBounds.getCenter(new THREE.Vector3());
    this.sceneRoot.position.copy(this.modelCenter).multiplyScalar(-1);

    this.shellMesh = new THREE.Mesh(
      this.trimmedGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xb7c7d3,
        metalness: 0.05,
        roughness: 0.84,
        transparent: true,
        opacity: 0.68,
      }),
    );

    this.shellLine = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.trimmedGeometry, 26),
      new THREE.LineBasicMaterial({
        color: 0x294558,
        transparent: true,
        opacity: 0.96,
      }),
    );

    this.sceneRoot.add(this.shellMesh, this.shellLine);

    this.sliceHome = new THREE.Group();
    this.sliceLive = new THREE.Group();
    this.focusGroup.add(this.sliceHome, this.sliceLive);
    this.transformControls.attach(this.sliceLive);

    const size = this.trimmedBounds.getSize(new THREE.Vector3());
    const modelSpan = size.length();
    this.controls.minDistance = Math.max(28, modelSpan * 0.18);
    this.controls.maxDistance = Math.max(900, modelSpan * 4.2);
    this.controls.target.set(0, -size.y * 0.08, size.z * 0.25);
    this.camera.position.set(size.x * 1.35, size.y * 0.42, size.z * 1.9);

    this.setBounds(initialBounds);
    this.framePreset("hero");
    this.onStatus("Shell loaded. Tune the slice box until the front corner is isolated.");
  }

  getBoundsLimit() {
    return this.boundsLimit;
  }

  setBounds(nextBounds) {
    if (!this.boundsLimit) {
      this.bounds = nextBounds;
      return;
    }

    this.bounds = clampBounds(nextBounds, this.boundsLimit);
    this.updateSelectionBox();
    this.rebuildSlice();
    this.updateMarkers();
  }

  setZone(zoneId) {
    this.zoneId = zoneId;
    this.updateMarkers();
  }

  setStyle(style) {
    this.style = style;
    const showShell = style !== "slice";
    this.shellMesh.visible = showShell;
    this.shellLine.visible = showShell;

    if (style === "xray") {
      this.shellMesh.material.opacity = 0.68;
      this.shellLine.material.opacity = 0.96;
    } else if (style === "line") {
      this.shellMesh.material.opacity = 0.18;
      this.shellLine.material.opacity = 1;
    } else {
      this.shellMesh.material.opacity = 0;
      this.shellLine.material.opacity = 0;
    }
  }

  setTransformMode(mode) {
    this.transformControls.setMode(mode);
  }

  resetSliceTransform() {
    if (!this.sliceLive) {
      return;
    }
    this.sliceLive.position.set(0, 0, 0);
    this.sliceLive.rotation.set(0, 0, 0);
    this.sliceLive.scale.set(1, 1, 1);
  }

  snapSliceHome() {
    this.resetSliceTransform();
  }

  resolveWorldInteraction(event) {
    if (this.isTransformDragging) {
      return null;
    }

    if (event.ctrlKey || event.metaKey) {
      return "rotate";
    }

    if (event.shiftKey) {
      return "pan";
    }

    return null;
  }

  setWorldInteraction(mode) {
    this.activeWorldInteraction = mode;

    if (!mode) {
      this.controls.enabled = false;
      this.updateCanvasCursor();
      return;
    }

    const action = mode === "rotate" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    this.controls.mouseButtons.LEFT = action;
    this.controls.mouseButtons.MIDDLE = action;
    this.controls.mouseButtons.RIGHT = action;
    this.controls.enabled = true;
    this.updateCanvasCursor();
  }

  handlePointerDownCapture(event) {
    this.setWorldInteraction(this.resolveWorldInteraction(event));
  }

  handlePointerUp() {
    if (!this.isTransformDragging) {
      this.setWorldInteraction(null);
    }
  }

  handleModifierStateChange(event) {
    if (this.isTransformDragging) {
      return;
    }

    if (event.type === "keyup" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      this.setWorldInteraction(null);
      return;
    }

    this.updateCanvasCursor(event);
  }

  handleWheelCapture(event) {
    if (!event.shiftKey || this.isTransformDragging) {
      return;
    }

    event.preventDefault();

    const offset = this.camera.position.clone().sub(this.controls.target);
    const currentDistance = offset.length();
    const multiplier = Math.exp(event.deltaY * 0.0012);
    const nextDistance = THREE.MathUtils.clamp(
      currentDistance * multiplier,
      this.controls.minDistance,
      this.controls.maxDistance,
    );

    offset.setLength(nextDistance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.updateProjectionMatrix();
    this.updateCanvasCursor({ shiftKey: true });
  }

  updateCanvasCursor(event = null) {
    if (this.isTransformDragging) {
      this.canvas.style.cursor = "grabbing";
      return;
    }

    const shiftActive = Boolean(event?.shiftKey);
    const ctrlActive = Boolean(event?.ctrlKey || event?.metaKey);

    if (this.activeWorldInteraction === "rotate" || ctrlActive) {
      this.canvas.style.cursor = "grab";
      return;
    }

    if (this.activeWorldInteraction === "pan" || shiftActive) {
      this.canvas.style.cursor = "all-scroll";
      return;
    }

    this.canvas.style.cursor = "default";
  }

  framePreset(presetId) {
    if (!this.bounds) {
      return;
    }

    const bounds = this.bounds;
    const center = new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      (bounds.minZ + bounds.maxZ) / 2,
    );
    const sideSign = center.x >= 0 ? 1 : -1;
    let target = center.clone();
    let eye = new THREE.Vector3();
    let span = spanFromBounds(bounds);

    switch (presetId) {
      case "passengerFront":
        target.set(center.x + sideSign * 8, bounds.minY + 22, center.z + 16);
        span = new THREE.Vector3(span.x * 1.15, span.y * 1.18, span.z * 1.2);
        eye = this.computeEye(target, new THREE.Vector3(sideSign * 0.95, -1.02, 0.66), span, 1.6);
        break;
      case "wheelArch":
        target.set(center.x + sideSign * 10, center.y - 6, bounds.minZ + 12);
        span = new THREE.Vector3(span.x * 0.9, span.y * 0.92, span.z * 0.9);
        eye = this.computeEye(target, new THREE.Vector3(sideSign * 1.1, -0.28, 0.48), span, 1.34);
        break;
      case "rocker":
        target.set(center.x + sideSign * 4, bounds.maxY - span.y * 0.14, bounds.minZ + span.z * 0.12);
        span = new THREE.Vector3(span.x * 0.88, span.y * 0.84, span.z * 0.74);
        eye = this.computeEye(target, new THREE.Vector3(sideSign * 0.72, 1.02, 0.2), span, 1.28);
        break;
      case "topRail":
        target.set(center.x, center.y - 12, bounds.maxZ - 4);
        span = new THREE.Vector3(span.x * 0.98, span.y * 1.02, span.z * 0.86);
        eye = this.computeEye(target, new THREE.Vector3(sideSign * 0.2, -0.42, 1.36), span, 1.48);
        break;
      case "doorJamb":
        target.set(center.x, bounds.maxY - 8, center.z + 6);
        span = new THREE.Vector3(span.x * 0.92, span.y * 0.94, span.z * 1.05);
        eye = this.computeEye(target, new THREE.Vector3(sideSign * 0.98, 0.98, 0.56), span, 1.42);
        break;
      case "bumper":
        target.set(center.x + sideSign * 10, bounds.minY + 8, center.z + 6);
        span = new THREE.Vector3(span.x * 1.02, span.y * 0.86, span.z * 0.92);
        eye = this.computeEye(target, new THREE.Vector3(sideSign, -0.82, 0.42), span, 1.34);
        break;
      case "hero":
      default:
        target.copy(this.trimmedBounds.getCenter(new THREE.Vector3()));
        target.y += this.trimmedBounds.getSize(new THREE.Vector3()).y * 0.02;
        target.z += this.trimmedBounds.getSize(new THREE.Vector3()).z * 0.1;
        span = this.trimmedBounds.getSize(new THREE.Vector3());
        eye = this.computeEye(target, new THREE.Vector3(1.12, -1.16, 0.74), span, 2.04);
        break;
    }

    eye.sub(this.modelCenter);
    target.sub(this.modelCenter);
    this.animateCamera(eye, target);
    this.onReadout({
      presetId,
      bounds,
      sliceSize: span,
      style: this.style,
      zoneId: this.zoneId,
    });
  }

  animateCamera(position, target) {
    this.animationTarget = {
      startPosition: this.camera.position.clone(),
      startTarget: this.controls.target.clone(),
      endPosition: position.clone(),
      endTarget: target.clone(),
      elapsed: 0,
      duration: 0.35,
    };
  }

  computeEye(target, direction, span, padding = 1.18) {
    const radius = Math.max(span.length() * 0.5, 18);
    const fovRadians = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (radius / Math.sin(fovRadians / 2)) * padding;
    return target.clone().add(direction.normalize().multiplyScalar(distance));
  }

  updateSelectionBox() {
    this.selectionGroup.clear();

    const box = new THREE.Box3(
      new THREE.Vector3(this.bounds.minX, this.bounds.minY, this.bounds.minZ),
      new THREE.Vector3(this.bounds.maxX, this.bounds.maxY, this.bounds.maxZ),
    );
    const helper = new THREE.Box3Helper(box, 0xfd7f2c);
    helper.material.transparent = true;
    helper.material.opacity = 0.52;
    this.selectionGroup.add(helper);
  }

  rebuildSlice() {
    this.sliceHome.clear();
    this.sliceLive.clear();

    const sliceGeometry = filterGeometry(
      this.trimmedGeometry,
      (positions, offset) => triangleBoxIntersects(positions, offset, this.bounds),
    );

    const sliceTriangles = Math.round(sliceGeometry.attributes.position.count / 3);
    const sliceSize = sliceGeometry.boundingBox
      ? sliceGeometry.boundingBox.getSize(new THREE.Vector3())
      : new THREE.Vector3();

    const ghostMesh = new THREE.Mesh(
      sliceGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x86c9d0,
        transparent: true,
        opacity: 0.14,
        roughness: 0.85,
        metalness: 0.02,
      }),
    );
    const ghostEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(sliceGeometry, 18),
      new THREE.LineBasicMaterial({
        color: 0x5a92a0,
        transparent: true,
        opacity: 0.42,
      }),
    );

    const liveMesh = new THREE.Mesh(
      sliceGeometry.clone(),
      new THREE.MeshStandardMaterial({
        color: 0xe9a15e,
        transparent: true,
        opacity: 0.32,
        roughness: 0.55,
        metalness: 0.06,
      }),
    );
    const liveEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(sliceGeometry, 10),
      new THREE.LineBasicMaterial({
        color: 0xb95d18,
        transparent: true,
        opacity: 0.92,
      }),
    );

    this.sliceHome.add(ghostMesh, ghostEdges);
    this.sliceLive.add(liveMesh, liveEdges);
    this.resetSliceTransform();
    this.transformControls.attach(this.sliceLive);

    this.onMetrics({
      shellTriangles: Math.round(this.trimmedGeometry.attributes.position.count / 3),
      modelSize: this.trimmedBounds.getSize(new THREE.Vector3()),
      rawSize: this.rawBounds.getSize(new THREE.Vector3()),
      sliceTriangles,
      sliceSize,
    });
  }

  updateMarkers() {
    this.markerGroup.clear();

    if (!this.bounds) {
      return;
    }

    const markers = makeMarkers(this.zoneId, this.bounds);
    markers.forEach((markerData) => {
      this.markerGroup.add(makeMarker(markerData));
    });
  }

  resize() {
    const width = this.canvas.clientWidth || this.canvas.parentElement.clientWidth;
    const height = this.canvas.clientHeight || this.canvas.parentElement.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render() {
    const delta = this.clock.getDelta();

    if (this.animationTarget) {
      this.animationTarget.elapsed += delta;
      const t = Math.min(this.animationTarget.elapsed / this.animationTarget.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(this.animationTarget.startPosition, this.animationTarget.endPosition, eased);
      this.controls.target.lerpVectors(this.animationTarget.startTarget, this.animationTarget.endTarget, eased);
      if (t >= 1) {
        this.animationTarget = null;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render);
  }
}

function spanFromBounds(bounds) {
  return new THREE.Vector3(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
    bounds.maxZ - bounds.minZ,
  );
}

export function summarizeMetrics(metrics) {
  return {
    shellTriangles: metrics.shellTriangles.toLocaleString(),
    sliceTriangles: metrics.sliceTriangles.toLocaleString(),
    modelSize: formatVector(metrics.modelSize),
    sliceSize: formatVector(metrics.sliceSize),
  };
}
