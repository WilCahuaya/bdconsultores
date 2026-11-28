import { cacheStorageFile, localMediaUrl } from "./media-cache";
import { isOnline } from "./master-cache";
import { getSupabaseClient } from "./supabase";

export async function getSignedStorageUrl(
  bucket: "fotos-activos" | "comprobantes-activos",
  path: string,
  expiresIn = 3600,
): Promise<{ url?: string; error?: string }> {
  if (path && window.electronAPI?.mediaExists && (await window.electronAPI.mediaExists(bucket, path))) {
    return { url: localMediaUrl(bucket, path) };
  }
  if (!isOnline()) {
    return { error: "Sin conexión y el archivo no está en este equipo." };
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return { error: error.message };
  void cacheStorageFile(bucket, path);
  return { url: data.signedUrl };
}
