import { createClient } from "@/lib/supabase/client";
import {
  DOCUMENTOS_PLANILLAS_BUCKET,
  errorArchivoDocumento,
  extensionDocumento,
  pathDocumento,
} from "@/lib/documento-storage";

export async function uploadDocumentoFile(
  entidadId: string,
  relacionId: string,
  documentoId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  const invalid = errorArchivoDocumento(file);
  if (invalid) return { error: invalid };

  const ext = extensionDocumento(file.name);
  if (!ext) return { error: "Solo se admiten PDF, JPG, PNG o WEBP." };

  const path = pathDocumento(entidadId, relacionId, documentoId, ext);
  const supabase = createClient();
  const { error } = await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });

  if (error) return { error: error.message };

  if (previousPath && previousPath !== path) {
    await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).remove([previousPath]);
  }

  return { path };
}
