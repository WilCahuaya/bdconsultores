import { createClient } from "@/lib/supabase/client";
import {
  DOCUMENTOS_PLANILLAS_BUCKET,
  errorArchivoDocumento,
  extensionDocumento,
  pathDocumento,
  pathSolicitudRegistro,
  pathVidaLeyLote,
  type ArchivoVidaLeyLote,
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

export async function uploadVidaLeyLoteFile(
  entidadId: string,
  loteId: string,
  tipo: ArchivoVidaLeyLote,
  file: File,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  const invalid = errorArchivoDocumento(file);
  if (invalid) return { error: invalid };

  const ext = extensionDocumento(file.name);
  if (!ext) return { error: "Solo se admiten PDF, JPG, PNG o WEBP." };

  const path = pathVidaLeyLote(entidadId, loteId, tipo, ext);
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

export async function uploadSolicitudFile(
  entidadId: string,
  solicitudId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  const invalid = errorArchivoDocumento(file);
  if (invalid) return { error: invalid };

  const ext = extensionDocumento(file.name);
  if (!ext) return { error: "Solo se admiten PDF, JPG, PNG o WEBP." };

  const path = pathSolicitudRegistro(entidadId, solicitudId, ext);
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

export async function quitarArchivoSolicitud(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).remove([path]);
}
