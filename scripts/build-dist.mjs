import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(rootDir, "dist");

const filesToCopy = [
  "index.html",
  "js/app.js",
  "js/fender-viewer.js",
  "js/install-data.js",
  "assets/models/camaro-print-shell-trimmed.stl",
];

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const relativePath of filesToCopy) {
  cpSync(resolve(rootDir, relativePath), resolve(distDir, relativePath), { recursive: true });
}

console.log(`Built static bundle in ${distDir}`);
