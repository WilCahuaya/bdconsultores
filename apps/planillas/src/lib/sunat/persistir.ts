import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRce } from "./parse-rce";
import { rutaCdr, rutaXml, type RutaCompra } from "./rutas";

const BUCKET = "sunat-compras";

export async function guardarPropuesta(
  supabase: SupabaseClient,
  entidadId: string,
  periodo: string,
  propuesta: { numTicket: string; contenido: Uint8Array; texto: string },
): Promise<{ total: number }> {
  const compras = parseRce(propuesta.texto);
  const path = `${entidadId}/${periodo}/propuesta.zip`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, propuesta.contenido, {
    contentType: "application/octet-stream",
    upsert: true,
  });

  const { error: borrarError } = await supabase.from("sunat_compras").delete().eq("entidad_id", entidadId).eq("periodo", periodo);
  if (borrarError) throw new Error(borrarError.message);

  if (compras.length > 0) {
    const { error: insertError } = await supabase.from("sunat_compras").insert(
      compras.map((compra) => ({
        entidad_id: entidadId,
        periodo,
        tipo: compra.tipo,
        serie: compra.serie,
        numero: compra.numero,
        numero_final: compra.numeroFinal,
        ruc_emisor: compra.rucEmisor,
        razon_social_emisor: compra.razonSocialEmisor,
        fecha_emision: compra.fechaEmision,
        moneda: compra.moneda,
        total: compra.total,
        car: compra.car,
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  const conXml = compras.filter((compra) => compra.tipo === "01" || compra.tipo === "02" || compra.tipo === "03");
  if (conXml.length > 0) {
    const { error: estadoError } = await supabase.from("sunat_compra_archivos").upsert(
      conXml.map((compra) => ({
        entidad_id: entidadId,
        periodo,
        tipo: compra.tipo,
        serie: compra.serie,
        numero: compra.numero,
        xml_estado: "PENDIENTE",
        cdr_estado: "PENDIENTE",
      })),
      { onConflict: "entidad_id,periodo,tipo,serie,numero", ignoreDuplicates: true },
    );
    if (estadoError) throw new Error(estadoError.message);
  }

  await registrarDescarga(supabase, entidadId, periodo, {
    numTicket: propuesta.numTicket,
    estado: "LISTO",
    mensaje: uploadError
      ? `${compras.length} comprobantes guardados. No se archivó el ZIP de SUNAT: ${uploadError.message}`
      : `${compras.length} comprobantes de factura, boleta electrónica y recibo por honorarios.`,
    archivoPath: uploadError ? null : path,
  });
  return { total: compras.length };
}

export async function registrarDescarga(
  supabase: SupabaseClient,
  entidadId: string,
  periodo: string,
  descarga: { numTicket?: string | null; estado: string; mensaje: string | null; archivoPath?: string | null },
): Promise<void> {
  const fila: Record<string, unknown> = {
    entidad_id: entidadId,
    periodo,
    estado: descarga.estado,
    mensaje: descarga.mensaje,
    updated_at: new Date().toISOString(),
  };
  if (descarga.numTicket !== undefined) fila.num_ticket = descarga.numTicket;
  if (descarga.archivoPath !== undefined) fila.archivo_path = descarga.archivoPath;
  const { error } = await supabase.from("sunat_descargas").upsert(fila, { onConflict: "entidad_id,periodo" });
  if (error) throw new Error(error.message);
}

export async function marcarArchivo(
  supabase: SupabaseClient,
  compra: RutaCompra,
  patch: { xmlEstado?: string; cdrEstado?: string; mensaje?: string | null },
): Promise<void> {
  const clave = {
    entidad_id: compra.entidadId,
    periodo: compra.periodo,
    tipo: compra.tipo,
    serie: compra.serie,
    numero: compra.numero,
  };
  const { data } = await supabase
    .from("sunat_compra_archivos")
    .select("xml_estado, cdr_estado")
    .match(clave)
    .maybeSingle();
  const { error } = await supabase.from("sunat_compra_archivos").upsert(
    {
      ...clave,
      xml_estado: patch.xmlEstado ?? (data?.xml_estado as string | undefined) ?? "PENDIENTE",
      cdr_estado: patch.cdrEstado ?? (data?.cdr_estado as string | undefined) ?? "PENDIENTE",
      mensaje: patch.mensaje ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entidad_id,periodo,tipo,serie,numero" },
  );
  if (error) throw new Error(error.message);
}

export async function subirXml(supabase: SupabaseClient, compra: RutaCompra, xml: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(rutaXml(compra), Buffer.from(xml), {
    contentType: "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

export async function subirCdr(supabase: SupabaseClient, compra: RutaCompra, bytes: Uint8Array): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(rutaCdr(compra), bytes, {
    contentType: "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}
