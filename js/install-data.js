export const SIDE_PRESETS = {
  frontRight: {
    id: "frontRight",
    label: "Front Right / Passenger",
    bounds: { minX: 8, maxX: 53, minY: -250, maxY: -105, minZ: -10, maxZ: 28 },
  },
  frontLeft: {
    id: "frontLeft",
    label: "Front Left / Driver",
    bounds: { minX: -53, maxX: -8, minY: -250, maxY: -105, minZ: -10, maxZ: 28 },
  },
};

export const CAMERA_PRESETS = [
  { id: "hero", label: "Whole Car" },
  { id: "passengerFront", label: "Front Corner" },
  { id: "wheelArch", label: "Wheel Arch" },
  { id: "rocker", label: "Rocker" },
  { id: "topRail", label: "Top Rail" },
  { id: "doorJamb", label: "A-Pillar" },
  { id: "bumper", label: "Bumper Edge" },
];

export const INSTALL_ZONES = [
  {
    id: "overview",
    title: "Whole Corner Read",
    summary: "Start with the whole front corner visible. You are checking how much of the shell is useful and where the extracted slice still contains bumper or door spillover.",
    fasteners: ["Context only", "Use this view to tune the box before worrying about bolts"],
  },
  {
    id: "topRail",
    title: "Top Rail Under Hood",
    summary: "Three top-edge bolts are the easiest reference line. Use this zone to align the crown of the extracted slice before touching the lower edge.",
    fasteners: ["3x top-rail bolts", "Target hood gap roughly 3.5-5.0 mm"],
  },
  {
    id: "doorJamb",
    title: "Rear A-Pillar Edge",
    summary: "The rear edge is the make-or-break fit check. If this slice is drifting into the door line, the install model is lying to you.",
    fasteners: ["Upper and lower A-pillar bolts", "Door gap target roughly 4.0-5.0 mm"],
  },
  {
    id: "wheelArch",
    title: "Wheel Arch and Hidden Lower",
    summary: "Community posts repeatedly call out the inner liner, lower arch, and hidden foam-covered fastener as the awkward section. Use this view to see how much lower-body noise is still in the slice.",
    fasteners: ["Wheel-liner screws / clips", "Hidden lower fastener behind foam"],
  },
  {
    id: "bumper",
    title: "Bumper Sandwich Edge",
    summary: "The front edge tucks behind the bumper bracket. This view is mainly for checking whether the extracted slice captures the correct nose profile.",
    fasteners: ["Front bumper-side fasteners", "Target bumper gap roughly 1.0-3.0 mm"],
  },
  {
    id: "rocker",
    title: "Rocker Return",
    summary: "Lower rocker access is still approximate here, but it helps you see if the slice box is reaching too far into the door shell or too low into the support structure.",
    fasteners: ["Lower rocker bolts", "Expect clip interference if the source geometry is dirty"],
  },
];

export const RESEARCH_LINKS = [
  {
    title: "Three.js `STLLoader` example",
    href: "https://threejs.org/examples/webgl_loader_stl.html",
    note: "Official baseline for loading the local binary STL instead of relying on a remote embed.",
  },
  {
    title: "Three.js `EdgesGeometry` docs",
    href: "https://threejs.org/docs/pages/EdgesGeometry.html",
    note: "The right primitive for engineering-style visible edge extraction from the mesh.",
  },
  {
    title: "Three.js `TransformControls` example",
    href: "https://threejs.org/examples/misc_controls_transform.html",
    note: "Gives the direct move / rotate gizmo needed for fitting the extracted slice into place.",
  },
  {
    title: "Online 3D Viewer",
    href: "https://github.com/kovacsv/Online3DViewer",
    note: "Open-source STL / CAD viewer proving that browser-based inspection, slicing, and engineering workflows are already solved patterns.",
  },
  {
    title: "xeokit SDK",
    href: "https://github.com/xeokit/xeokit-sdk",
    note: "Open-source engineering viewer stack with plugins, edges, and higher-end inspection workflows when the asset quality improves.",
  },
  {
    title: "Camaro5 fender well removal thread",
    href: "https://www.camaro5.com/forums/showthread.php?t=346814",
    note: "Community confirmation that the wheel liner / lower front corner is a real pain point, not something the current app surfaced clearly.",
  },
];

function interpolate(start, end, amount) {
  return start + (end - start) * amount;
}

export function makeMarkers(zoneId, bounds) {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const outerX = centerX >= 0 ? bounds.maxX : bounds.minX;
  const innerX = centerX >= 0 ? bounds.minX : bounds.maxX;
  const sideSign = centerX >= 0 ? 1 : -1;
  const topZ = bounds.maxZ;
  const lowZ = interpolate(bounds.minZ, bounds.maxZ, 0.22);
  const midZ = interpolate(bounds.minZ, bounds.maxZ, 0.48);
  const frontY = bounds.minY;
  const rearY = bounds.maxY;

  switch (zoneId) {
    case "topRail":
      return [
        { label: "Top 1", detail: "rear top-rail bolt", x: interpolate(innerX, outerX, 0.26), y: interpolate(rearY, frontY, 0.15), z: topZ - 1 },
        { label: "Top 2", detail: "mid top-rail bolt", x: interpolate(innerX, outerX, 0.48), y: interpolate(rearY, frontY, 0.42), z: topZ - 1 },
        { label: "Top 3", detail: "front top-rail bolt", x: interpolate(innerX, outerX, 0.65), y: interpolate(rearY, frontY, 0.72), z: topZ - 1 },
      ];
    case "doorJamb":
      return [
        { label: "A Upper", detail: "upper jamb bolt", x: interpolate(innerX, outerX, 0.2), y: rearY - 4, z: topZ - 3 },
        { label: "A Lower", detail: "lower jamb bolt", x: interpolate(innerX, outerX, 0.22), y: rearY - 6, z: midZ },
      ];
    case "wheelArch":
      return [
        { label: "Arch", detail: "wheel-liner / arch fasteners", x: outerX - sideSign * 4, y: interpolate(rearY, frontY, 0.52), z: lowZ + 4 },
        { label: "Hidden", detail: "foam-covered lower fastener", x: interpolate(innerX, outerX, 0.7), y: interpolate(rearY, frontY, 0.64), z: lowZ },
      ];
    case "bumper":
      return [
        { label: "Bumper", detail: "front bumper-side stack", x: outerX - sideSign * 2, y: frontY + 8, z: midZ + 4 },
        { label: "Corner", detail: "nose alignment edge", x: interpolate(innerX, outerX, 0.76), y: frontY + 6, z: topZ - 7 },
      ];
    case "rocker":
      return [
        { label: "Lower 1", detail: "rear lower bolt", x: interpolate(innerX, outerX, 0.22), y: interpolate(rearY, frontY, 0.2), z: lowZ - 2 },
        { label: "Lower 2", detail: "forward lower bolt", x: interpolate(innerX, outerX, 0.42), y: interpolate(rearY, frontY, 0.5), z: lowZ - 1 },
      ];
    case "overview":
    default:
      return [
        { label: "Door Edge", detail: "rear fit line", x: interpolate(innerX, outerX, 0.22), y: rearY - 5, z: midZ + 5 },
        { label: "Top Rail", detail: "hood edge reference", x: interpolate(innerX, outerX, 0.5), y: interpolate(rearY, frontY, 0.4), z: topZ - 1 },
        { label: "Bumper", detail: "front tuck zone", x: outerX - sideSign * 3, y: frontY + 7, z: midZ + 2 },
      ];
  }
}
