import {
  persistirComprobantesMenaje,
  type MenajeComprobante,
} from "@inventario/types";
import type { MenajeComprobanteCambio, MenajeComprobanteNuevo } from "@inventario/ui";
import { getSupabaseClient } from "./supabase";

async function uploadMenajeComprobantePdf(
  entidadId: string,
  activoId: string,
  comprobanteId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ path?: string; error?: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const path = `${entidadId}/${activoId}/comprobantes/${comprobanteId}.${ext}`;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from("comprobantes-activos").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) return { error: error.message };
  if (previousPath && previousPath !== path) {
    await supabase.storage.from("comprobantes-activos").remove([previousPath]);
  }
  return { path };
}

export async function aplicarComprobantesMenaje(args: {
  entidadId: string;
  activoId: string;
  nuevo: MenajeComprobanteNuevo | null;
  cambios: MenajeComprobanteCambio[];
}): Promise<{ error?: string; comprobantes?: MenajeComprobante[] }> {
  if (!args.nuevo && args.cambios.length === 0) return {};
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return persistirComprobantesMenaje(supabase, {
    activoId: args.activoId,
    usuarioId: data.user?.id ?? null,
    nuevo: args.nuevo,
    cambios: args.cambios.map((cambio) => ({
      id: cambio.id,
      cantidad: cambio.cantidad,
      precio: cambio.precio,
      serie: cambio.serie,
      fecha: cambio.fecha,
      archivo: cambio.archivo,
      pdfAnterior: cambio.pdf_path,
    })),
    subirPdf: (comprobanteId, archivo, pdfAnterior) =>
      uploadMenajeComprobantePdf(
        args.entidadId,
        args.activoId,
        comprobanteId,
        archivo as File,
        pdfAnterior,
      ),
  });
}
