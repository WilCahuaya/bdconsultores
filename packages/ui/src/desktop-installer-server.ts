import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface DesktopInstallerFile {
  version: string;
  fileName: string;
  sizeBytes: number;
  updatedAt: Date;
  /** Ruta local. Vacía si la descarga es una URL externa. */
  filePath: string;
  externalUrl: string | null;
}

function repoRootFrom(start: string): string | null {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    const marker = path.join(dir, "apps", "desktop", "package.json");
    try {
      statSync(marker);
      return dir;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
  return null;
}

function desktopVersion(root: string | null): string {
  const fromEnv = process.env.DESKTOP_INSTALLER_VERSION?.trim();
  if (fromEnv) return fromEnv;
  if (!root) return "0.1.0";
  try {
    const raw = readFileSync(path.join(root, "apps", "desktop", "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version?.trim() || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

const PUBLISHED_INSTALLER = {
  repo: "WilCahuaya/bdconsultores",
  tag: "desktop-installer",
  assetName: "BD-Consultores-Inventario-Setup.exe",
  url: "https://github.com/WilCahuaya/bdconsultores/releases/download/desktop-installer/BD-Consultores-Inventario-Setup.exe",
};

function isInstallerExe(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".exe") && !lower.includes("unpacked") && !lower.includes("uninstaller");
}

function newestExe(dir: string): { filePath: string; updatedAt: Date; sizeBytes: number } | null {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  let best: { filePath: string; updatedAt: Date; sizeBytes: number } | null = null;
  for (const name of names) {
    if (!isInstallerExe(name)) continue;
    const filePath = path.join(dir, name);
    let st;
    try {
      st = statSync(filePath);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    if (!best || st.mtimeMs > best.updatedAt.getTime()) {
      best = { filePath, updatedAt: st.mtime, sizeBytes: st.size };
    }
  }
  return best;
}

function findLocalInstaller(cwd: string, version: string): DesktopInstallerFile | null {
  const root = repoRootFrom(cwd);
  const explicit = process.env.DESKTOP_INSTALLER_FILE?.trim();
  const dirs = [
    explicit ? path.dirname(explicit) : null,
    root ? path.join(root, "apps", "desktop", "release") : null,
    path.join(cwd, "public", "descargas"),
    root ? path.join(root, "apps", "inventarios", "public", "descargas") : null,
    root ? path.join(root, "apps", "web", "public", "descargas") : null,
  ].filter((dir): dir is string => Boolean(dir));

  if (explicit) {
    try {
      const st = statSync(explicit);
      if (st.isFile() && isInstallerExe(path.basename(explicit))) {
        return {
          version,
          fileName: path.basename(explicit),
          sizeBytes: st.size,
          updatedAt: st.mtime,
          filePath: explicit,
          externalUrl: null,
        };
      }
    } catch {
      // sigue con las carpetas conocidas
    }
  }

  let best: DesktopInstallerFile | null = null;
  for (const dir of dirs) {
    const found = newestExe(dir);
    if (!found) continue;
    if (best && found.updatedAt.getTime() <= best.updatedAt.getTime()) continue;
    best = {
      version,
      fileName: path.basename(found.filePath),
      sizeBytes: found.sizeBytes,
      updatedAt: found.updatedAt,
      filePath: found.filePath,
      externalUrl: null,
    };
  }
  return best;
}

async function findPublishedInstaller(version: string): Promise<DesktopInstallerFile> {
  const fallback: DesktopInstallerFile = {
    version,
    fileName: process.env.DESKTOP_INSTALLER_FILENAME?.trim() || PUBLISHED_INSTALLER.assetName,
    sizeBytes: Number(process.env.DESKTOP_INSTALLER_SIZE_BYTES || 0) || 0,
    updatedAt: new Date(0),
    filePath: "",
    externalUrl: process.env.DESKTOP_INSTALLER_URL?.trim() || PUBLISHED_INSTALLER.url,
  };

  try {
    const response = await fetch(
      `https://api.github.com/repos/${PUBLISHED_INSTALLER.repo}/releases/tags/${PUBLISHED_INSTALLER.tag}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "bdconsultores",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return fallback;
    const body = (await response.json()) as {
      assets?: { name?: string; size?: number; updated_at?: string; created_at?: string; browser_download_url?: string }[];
    };
    const assets = body.assets ?? [];
    const asset =
      assets.find((item) => item.name === PUBLISHED_INSTALLER.assetName) ??
      assets.find((item) => item.name?.toLowerCase().endsWith(".exe"));
    if (!asset?.browser_download_url) return fallback;
    const updatedAt = new Date(asset.updated_at || asset.created_at || 0);
    return {
      version,
      fileName: asset.name || fallback.fileName,
      sizeBytes: Number(asset.size) || fallback.sizeBytes,
      updatedAt: Number.isNaN(updatedAt.getTime()) ? fallback.updatedAt : updatedAt,
      filePath: "",
      externalUrl: asset.browser_download_url,
    };
  } catch {
    return fallback;
  }
}

/** El instalador más reciente: el compilado en esta máquina, o el último publicado. */
export async function findDesktopInstaller(cwd = process.cwd()): Promise<DesktopInstallerFile> {
  const version = desktopVersion(repoRootFrom(cwd));
  const [local, published] = await Promise.all([
    Promise.resolve(findLocalInstaller(cwd, version)),
    findPublishedInstaller(version),
  ]);
  if (local && local.updatedAt.getTime() > published.updatedAt.getTime()) return local;
  return published;
}

export function formatInstallerSize(sizeBytes: number): string | null {
  if (!sizeBytes) return null;
  const mb = sizeBytes / (1024 * 1024);
  return `${mb.toLocaleString("es-PE", { maximumFractionDigits: 1 })} MB`;
}

export function formatInstallerDate(date: Date): string {
  return date.toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
