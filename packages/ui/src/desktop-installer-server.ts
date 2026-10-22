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

function newestExe(dir: string): { filePath: string; updatedAt: Date; sizeBytes: number } | null {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  let best: { filePath: string; updatedAt: Date; sizeBytes: number } | null = null;
  for (const name of names) {
    if (!name.toLowerCase().endsWith(".exe")) continue;
    if (name.toLowerCase().includes("unpacked")) continue;
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

export function findDesktopInstaller(cwd = process.cwd()): DesktopInstallerFile | null {
  const root = repoRootFrom(cwd);
  const version = desktopVersion(root);
  const externalUrl = process.env.DESKTOP_INSTALLER_URL?.trim() || null;
  if (externalUrl) {
    return {
      version,
      fileName: process.env.DESKTOP_INSTALLER_FILENAME?.trim() || `B&D Consultores Inventario Setup ${version}.exe`,
      sizeBytes: Number(process.env.DESKTOP_INSTALLER_SIZE_BYTES || 0) || 0,
      updatedAt: new Date(),
      filePath: "",
      externalUrl,
    };
  }

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
      if (st.isFile()) {
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
