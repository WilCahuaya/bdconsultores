import fs from "fs";
import path from "path";
import { app } from "electron";

const BUCKETS = new Set(["fotos-activos", "comprobantes-activos"]);

function mediaRoot(): string {
  return path.join(app.getPath("userData"), "media");
}

/** Ruta en disco para un objeto de Storage. Null si el bucket o la ruta no son válidos. */
export function resolveMediaPath(bucket: string, storagePath: string): string | null {
  if (!BUCKETS.has(bucket)) return null;
  const normalized = storagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => part === ".." || part === "")) return null;
  const base = path.normalize(path.join(mediaRoot(), bucket));
  const full = path.normalize(path.join(base, ...normalized.split("/")));
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

export function mediaExists(bucket: string, storagePath: string): boolean {
  const full = resolveMediaPath(bucket, storagePath);
  if (!full) return false;
  return fs.existsSync(full);
}

export function writeMedia(bucket: string, storagePath: string, bytes: Uint8Array): boolean {
  const full = resolveMediaPath(bucket, storagePath);
  if (!full) return false;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, Buffer.from(bytes));
  return true;
}
