import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.join(__dirname, "..", "release");
const repo = "WilCahuaya/bdconsultores";
const tag = "desktop-installer";
const assetName = "BD-Consultores-Inventario-Setup.exe";

function gitToken() {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv?.trim()) return fromEnv.trim();
  const output = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const line = output.split(/\r?\n/).find((row) => row.startsWith("password="));
  const token = line?.slice("password=".length).trim();
  if (!token) throw new Error("GitHub no devolvió una credencial para publicar el instalador.");
  return token;
}

function newestSetup() {
  const names = fs.readdirSync(releaseDir).filter((name) => {
    const lower = name.toLowerCase();
    return lower.endsWith(".exe") && lower.includes("setup") && !lower.includes("uninstaller");
  });
  if (names.length === 0) {
    throw new Error(`No hay un instalador en ${releaseDir}.`);
  }
  names.sort((a, b) => {
    const am = fs.statSync(path.join(releaseDir, a)).mtimeMs;
    const bm = fs.statSync(path.join(releaseDir, b)).mtimeMs;
    return bm - am;
  });
  return path.join(releaseDir, names[0]);
}

async function github(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "bdconsultores-installer",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const message = typeof body === "object" && body?.message ? body.message : response.statusText;
    throw new Error(`GitHub ${response.status}: ${message}`);
  }
  return body;
}

async function ensureRelease(token) {
  const byTag = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "bdconsultores-installer",
    },
  });
  if (byTag.ok) return byTag.json();
  if (byTag.status !== 404) {
    const message = await byTag.text();
    throw new Error(`GitHub ${byTag.status}: ${message}`);
  }
  return github(token, `https://api.github.com/repos/${repo}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      name: "Instalador de escritorio",
      body: "Instalador vigente de B&D Consultores Inventario para Windows.",
      target_commitish: "main",
    }),
  });
}

const setupPath = newestSetup();
const token = gitToken();
const release = await ensureRelease(token);
const existing = (release.assets ?? []).find((asset) => asset.name === assetName);
if (existing) {
  await github(token, `https://api.github.com/repos/${repo}/releases/assets/${existing.id}`, {
    method: "DELETE",
  });
}

const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(assetName)}`;
const file = fs.readFileSync(setupPath);
const asset = await github(token, uploadUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/octet-stream",
    "Content-Length": String(file.length),
  },
  body: file,
});

const downloadUrl = asset.browser_download_url;
console.log(downloadUrl);
console.log(`size=${file.length}`);
