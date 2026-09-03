import { createClient } from "@/lib/supabase/client";

export async function getSignedStorageUrl(
  bucket: "fotos-activos" | "comprobantes-activos",
  path: string,
  expiresIn = 3600,
): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
