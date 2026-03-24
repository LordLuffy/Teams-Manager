const fs = require("fs");
const path = require("path");

/* -------------------- Helpers -------------------- */

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function cleanVersion(version) {
  if (!version) return null;
  return String(version).trim().replace(/^[^\d]*/, "");
}

function firstExisting(paths) {
  for (const p of paths) {
    if (fileExists(p)) return p;
  }
  return null;
}

function badge(label, message, color, logo, logoColor = null) {
  let url = `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${color}?style=for-the-badge`;
  if (logo) url += `&logo=${encodeURIComponent(logo)}`;
  if (logoColor) url += `&logoColor=${encodeURIComponent(logoColor)}`;
  return `![${label}](${url})`;
}

/* -------------------- Config -------------------- */

const githubOwner = "LordLuffy";   // 🔁 à remplacer
const githubRepo = "Teams-Manager";    // 🔁 à remplacer

/* -------------------- Paths -------------------- */

const root = process.cwd();

const packageJsonPath = path.join(root, "package.json");

const cargoTomlPath = firstExisting([
  path.join(root, "src-tauri", "Cargo.toml"),
  path.join(root, "Cargo.toml"),
]);

const rustToolchainPath = firstExisting([
  path.join(root, "src-tauri", "rust-toolchain.toml"),
  path.join(root, "rust-toolchain.toml"),
  path.join(root, "rust-toolchain"),
]);

const readmePath = path.join(root, "README.md");

/* -------------------- Validation -------------------- */

if (!fileExists(readmePath)) {
  throw new Error("README.md introuvable.");
}

/* -------------------- Load files -------------------- */

let pkg = null;
if (fileExists(packageJsonPath)) {
  pkg = readJson(packageJsonPath);
}

let cargoToml = null;
if (cargoTomlPath) {
  cargoToml = readText(cargoTomlPath);
}

let rustToolchain = null;
if (rustToolchainPath) {
  rustToolchain = readText(rustToolchainPath);
}

/* -------------------- Extract versions -------------------- */

const allDeps = {
  ...(pkg?.dependencies || {}),
  ...(pkg?.devDependencies || {}),
};

const tsVersion = cleanVersion(allDeps.typescript);
const reactVersion = cleanVersion(allDeps.react);

/* Node */
let nodeVersion = null;
if (pkg?.engines?.node) {
  nodeVersion = pkg.engines.node;
} else {
  const nvmrc = path.join(root, ".nvmrc");
  if (fileExists(nvmrc)) {
    nodeVersion = readText(nvmrc).trim();
  }
}

/* Tauri */
let tauriVersion = null;

if (allDeps["@tauri-apps/api"]) {
  tauriVersion = cleanVersion(allDeps["@tauri-apps/api"]);
}

if (!tauriVersion && allDeps["@tauri-apps/cli"]) {
  tauriVersion = cleanVersion(allDeps["@tauri-apps/cli"]);
}

if (!tauriVersion && cargoToml) {
  const match = cargoToml.match(/tauri\s*=\s*["{]\s*([^"\n}]+)/);
  if (match) {
    tauriVersion = cleanVersion(match[1]);
  }
}

/* Rust */
let rustVersion = null;

if (rustToolchain) {
  const match = rustToolchain.match(/channel\s*=\s*"([^"]+)"/);
  if (match) {
    rustVersion = match[1];
  } else {
    rustVersion = rustToolchain.trim();
  }
}

if (!rustVersion && cargoTomlPath) {
  rustVersion = "stable";
}

/* License */
let license = null;

if (pkg?.license) {
  license = pkg.license;
} else {
  const licenseFiles = [
    path.join(root, "LICENSE"),
    path.join(root, "LICENSE.md"),
  ];

  const found = licenseFiles.find(fileExists);

  if (found) {
    const content = readText(found).toLowerCase();

    if (content.includes("mit license")) license = "MIT";
    else if (content.includes("apache")) license = "Apache-2.0";
    else if (content.includes("gnu")) license = "GPL";
    else license = "Custom";
  }
}

/* -------------------- Build badges -------------------- */

const badges = [];

/* Release (GitHub) */
if (githubOwner !== "TON-USER" && githubRepo !== "TON-REPO") {
  badges.push(
    `![Release](https://img.shields.io/github/v/release/${githubOwner}/${githubRepo}?style=for-the-badge)`
  );
}

/* License */
if (license) {
  badges.push(
    badge("License", license, "F4C430")
  );
}

/* Stack */
if (tauriVersion) {
  badges.push(
    badge("Tauri", tauriVersion, "24C8DB", "tauri", "white")
  );
}

if (rustVersion) {
  badges.push(
    badge("Rust", rustVersion, "000000", "rust")
  );
}

if (tsVersion) {
  badges.push(
    badge("TypeScript", tsVersion, "3178C6", "typescript", "white")
  );
}

if (reactVersion) {
  badges.push(
    badge("React", reactVersion, "20232A", "react", "61DAFB")
  );
}

if (nodeVersion) {
  badges.push(
    badge("Node.js", nodeVersion, "339933", "nodedotjs", "white")
  );
}

/* CSS (fixe) */
badges.push(
  badge("CSS", "3", "1572B6", "css3", "white")
);

/* -------------------- Inject into README -------------------- */

const readme = readText(readmePath);

const start = "<!-- BADGES:START -->";
const end = "<!-- BADGES:END -->";

if (!readme.includes(start) || !readme.includes(end)) {
  throw new Error("Markers BADGES manquants dans README.md");
}

const newBlock = `${start}
<p align="center">
  ${badges.join("\n  ")}
</p>
${end}`;

const updated = readme.replace(
  /<!-- BADGES:START -->([\s\S]*?)<!-- BADGES:END -->/,
  newBlock
);

fs.writeFileSync(readmePath, updated, "utf8");

console.log("✅ README mis à jour avec les badges !");