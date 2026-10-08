import { createClient } from "@/lib/supabase/client";
import { archivoParaGuardar, girarPaginasPdf } from "@/lib/convertir-a-pdf";
import {
  DOCUMENTOS_PLANILLAS_BUCKET,
  pathDocumento,
  pathSolicitudRegistro,
  pathVidaLeyComprobanteEmpresa,
  pathVidaLeyLote,
  type ArchivoVidaLeyLote,
} from "@/lib/documento-storage";

async function subirPdf(
  file: File,
  path: string,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  const preparado = await archivoParaGuardar(file);
  if (preparado.error || !preparado.file) return { error: preparado.error ?? "No se pudo convertir el archivo a PDF." };
  const supabase = createClient();
  const { error } = await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).upload(path, preparado.file, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) return { error: error.message };
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).remove([previousPath]);
  }
  return { path };
}

export async function girarPdfGuardado(path: string, grados: 90 | -90): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).download(path);
  if (error || !data) return { error: error?.message ?? "No se pudo abrir el PDF." };
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await girarPaginasPdf(await data.arrayBuffer(), grados);
  } catch {
    return { error: "No se pudo girar el PDF." };
  }
  const archivo = new Blob([bytes], { type: "application/pdf" });
  const { error: uploadError } = await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).upload(path, archivo, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (uploadError) return { error: uploadError.message };
  return {};
}

export async function uploadDocumentoFile(
  entidadId: string,
  relacionId: string,
  documentoId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  return subirPdf(file, pathDocumento(entidadId, relacionId, documentoId, "pdf"), previousPath);
}

export async function uploadVidaLeyLoteFile(
  entidadId: string,
  loteId: string,
  tipo: ArchivoVidaLeyLote,
  file: File,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  return subirPdf(file, pathVidaLeyLote(entidadId, loteId, tipo, "pdf"), previousPath);
}

export async function uploadVidaLeyComprobanteEmpresa(
  entidadId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  return subirPdf(file, pathVidaLeyComprobanteEmpresa(entidadId, "pdf"), previousPath);
}

export async function uploadSolicitudFile(
  entidadId: string,
  solicitudId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  return subirPdf(file, pathSolicitudRegistro(entidadId, solicitudId, "pdf"), previousPath);
}

export async function quitarArchivoSolicitud(path: string): Promise<void> {
  await quitarArchivoStorage(path);
}

export async function quitarArchivoStorage(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).remove([path]);
}
