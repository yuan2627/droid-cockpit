import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function extractCargoVersion() {
  const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
  const match = cargo.match(/^\s*version\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error("Missing version in src-tauri/Cargo.toml");
  return match[1];
}

function extractAppVersion() {
  const appConfig = readFileSync("src/config/app.ts", "utf8");
  const match = appConfig.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("Missing APP_VERSION in src/config/app.ts");
  return match[1];
}

const versions = {
  packageJson: readJson("package.json").version,
  tauriConfig: readJson("src-tauri/tauri.conf.json").version,
  cargoToml: extractCargoVersion(),
  appConfig: extractAppVersion(),
};

const unique = new Set(Object.values(versions));
if (unique.size !== 1) {
  console.error("Version mismatch:");
  for (const [source, version] of Object.entries(versions)) {
    console.error(`- ${source}: ${version}`);
  }
  process.exit(1);
}

console.log(`Versions aligned: ${versions.packageJson}`);
