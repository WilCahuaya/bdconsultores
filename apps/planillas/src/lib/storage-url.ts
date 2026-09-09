import { createClient } from "@/lib/supabase/client";
import { DOCUMENTOS_PLANILLAS_BUCKET } from "@/lib/documento-storage";

export async function getSignedDocumentoUrl(
  path: string,
  options?: { expiresIn?: number; download?: boolean | string },
): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).createSignedUrl(
    path,
    options?.expiresIn ?? 3600,
    options?.download === undefined ? undefined : { download: options.download },
  );

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
