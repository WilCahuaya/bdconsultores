import { isOnline } from "./master-cache";
import { getSupabaseClient } from "./supabase";

export type MediaBucket = "fotos-activos" | "comprobantes-activos";

export function localMediaUrl(bucket: MediaBucket, storagePath: string): string {
  const encoded = storagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `media://${bucket}/${encoded}`;
}

export async function cacheStorageFile(
  bucket: MediaBucket,
  storagePath: string | null | undefined,
  bytes?: Uint8Array,
): Promise<void> {
  const path = storagePath?.trim();
  if (!path || !window.electronAPI?.mediaPut || !window.electronAPI.mediaExists) return;
  if (bytes) {
    await window.electronAPI.mediaPut(bucket, path, bytes);
    return;
  }
  if (await window.electronAPI.mediaExists(bucket, path)) return;
  if (!isOnline()) return;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return;
  await window.electronAPI.mediaPut(bucket, path, new Uint8Array(await data.arrayBuffer()));
}

type ArchivoActivo = {
  foto_path?: string | null;
  comprobante_path?: string | null;
  comprobantes?: Array<{ pdf_path?: string | null }> | null;
};

/** Baja fotos y PDF que todavía no están en este equipo. */
export async function cacheArchivosDeActivos(activos: ArchivoActivo[]): Promise<void> {
  const jobs: Array<{ bucket: MediaBucket; path: string }> = [];
  const seen = new Set<string>();
  for (const activo of activos) {
    if (activo.foto_path) jobs.push({ bucket: "fotos-activos", path: activo.foto_path });
    if (activo.comprobante_path) {
      jobs.push({ bucket: "comprobantes-activos", path: activo.comprobante_path });
    }
    for (const comprobante of activo.comprobantes ?? []) {
      if (comprobante.pdf_path) {
        jobs.push({ bucket: "comprobantes-activos", path: comprobante.pdf_path });
      }
    }
  }
  const pending = jobs.filter((job) => {
    const key = `${job.bucket}:${job.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const workers = Array.from({ length: 3 }, async () => {
    while (pending.length > 0) {
      const job = pending.shift();
      if (!job) return;
      try {
        await cacheStorageFile(job.bucket, job.path);
      } catch {
        /* un archivo que falle no detiene el resto */
      }
    }
  });
  await Promise.all(workers);
}
