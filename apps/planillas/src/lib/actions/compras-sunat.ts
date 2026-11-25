"use server";

import { revalidatePath } from "next/cache";
import { esPersonalEstudio } from "@inventario/types";
import { requirePlanillasProfile } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { decryptString, encryptString } from "@/lib/sunat/crypto";
import { SunatError, SunatTicketPendienteError } from "@/lib/sunat/errors";
import { parseRce, type CompraRce } from "@/lib/sunat/parse-rce";
import { descargarPropuestaRce, textoDeArchivo } from "@/lib/sunat/sire";
import type { SunatCredencialSecreto } from "@/lib/sunat/auth";
import { descargarXmlRecibido } from "@/lib/sunat/cpe";
import { parseUbl, type ComprobanteUbl } from "@/lib/sunat/ubl";

export interface CredencialSunatVista {
  configurada: boolean;
  usuarioSol: string;
  clientId: string;
  ruc: string;
}

export interface CompraSunatFila {
  id: string;
  tipo: "01" | "02" | "03";
  serie: string;
  numero: string;
  numero_final: string | null;
  ruc_emisor: string | null;
  razon_social_emisor: string | null;
  fecha_emision: string | null;
  moneda: string | null;
  total: number | null;
}

export interface DescargaSunatVista {
  estado: string;
  mensaje: string | null;
  numTicket: string | null;
}

const SELECT_COMPRA =
  "id, tipo, serie, numero, numero_final, ruc_emisor, razon_social_emisor, fecha_emision, moneda, total";

function normalizarCompra(row: CompraSunatFila): CompraSunatFila {
  const total = row.total == null ? null : Number(row.total);
  return { ...row, total: total != null && Number.isFinite(total) ? total : null };
}

async function exigirEstudio() {
  const profile = await requirePlanillasProfile();
  if (!esPersonalEstudio(profile.rol)) {
    return { profile: null, error: "Solo el personal del estudio puede usar las compras de SUNAT." };
  }
  return { profile, error: null };
}

export async function credencialSunat(entidadId: string): Promise<CredencialSunatVista> {
  const vacia = { configurada: false, usuarioSol: "", clientId: "", ruc: "" };
  const acceso = await exigirEstudio();
  if (!acceso.profile) return vacia;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sunat_credenciales")
    .select("usuario_sol, client_id, ruc")
    .eq("entidad_id", entidadId)
    .maybeSingle();
  if (!data) return vacia;
  return {
    configurada: true,
    usuarioSol: data.usuario_sol as string,
    clientId: data.client_id as string,
    ruc: data.ruc as string,
  };
}

export async function guardarCredencialSunat(
  entidadId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const acceso = await exigirEstudio();
  if (!acceso.profile) return { error: acceso.error ?? "Sin permiso." };

  const usuarioSol = String(formData.get("usuarioSol") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const claveSol = String(formData.get("claveSol") ?? "");
  const clientSecret = String(formData.get("clientSecret") ?? "");

  if (usuarioSol.length < 4 || usuarioSol.length > 20) {
    return { error: "El usuario SOL debe tener entre 4 y 20 caracteres." };
  }
  if (clientId.length < 8 || clientId.length > 80) {
    return { error: "El client id no tiene el largo que entrega SUNAT." };
  }

  const supabase = await createClient();
  const { data: entidad, error: entidadError } = await supabase
    .from("entidades")
    .select("id, ruc, usa_planillas")
    .eq("id", entidadId)
    .maybeSingle();
  if (entidadError) return { error: entidadError.message };
  const ruc = String(entidad?.ruc ?? "").trim();
  if (!entidad || entidad.usa_planillas !== true || !/^[0-9]{11}$/.test(ruc)) {
    return { error: "La empresa necesita un RUC de 11 dígitos antes de guardar la credencial." };
  }

  const { data: previa } = await supabase
    .from("sunat_credenciales")
    .select("clave_sol_cifrada, client_secret_cifrado")
    .eq("entidad_id", entidadId)
    .maybeSingle();

  if (!previa && (!claveSol.trim() || !clientSecret.trim())) {
    return { error: "La primera vez hay que ingresar la clave SOL y el client secret." };
  }

  let claveCifrada = (previa?.clave_sol_cifrada as string | undefined) ?? "";
  let secretCifrado = (previa?.client_secret_cifrado as string | undefined) ?? "";
  try {
    if (claveSol.trim()) claveCifrada = encryptString(claveSol, entidadId);
    if (clientSecret.trim()) secretCifrado = encryptString(clientSecret, entidadId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo cifrar la credencial." };
  }

  const { error } = await supabase.from("sunat_credenciales").upsert(
    {
      entidad_id: entidadId,
      ruc,
      usuario_sol: usuarioSol,
      client_id: clientId,
      clave_sol_cifrada: claveCifrada,
      client_secret_cifrado: secretCifrado,
      updated_at: new Date().toISOString(),
      updated_by: acceso.profile.id,
    },
    { onConflict: "entidad_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/compras");
  return {};
}

export async function listarComprasSunat(entidadId: string, periodo: string): Promise<CompraSunatFila[]> {
  const acceso = await exigirEstudio();
  if (!acceso.profile || !/^[0-9]{6}$/.test(periodo)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sunat_compras")
    .select(SELECT_COMPRA)
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .order("fecha_emision", { ascending: true })
    .order("serie", { ascending: true })
    .order("numero", { ascending: true });
  if (error) throw new Error(error.message);
  const filas = (data ?? []).map(normalizarCompra);
  try {
    return await corregirEmisores(supabase, entidadId, periodo, filas);
  } catch {
    return filas;
  }
}

export async function estadoDescargaSunat(entidadId: string, periodo: string): Promise<DescargaSunatVista | null> {
  const acceso = await exigirEstudio();
  if (!acceso.profile || !/^[0-9]{6}$/.test(periodo)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sunat_descargas")
    .select("estado, mensaje, num_ticket")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .maybeSingle();
  if (!data) return null;
  return {
    estado: data.estado as string,
    mensaje: (data.mensaje as string | null) ?? null,
    numTicket: (data.num_ticket as string | null) ?? null,
  };
}

export async function descargarComprasSunat(
  entidadId: string,
  periodo: string,
): Promise<{ error?: string; total?: number; pendiente?: boolean }> {
  const acceso = await exigirEstudio();
  if (!acceso.profile) return { error: acceso.error ?? "Sin permiso." };
  if (!/^[0-9]{6}$/.test(periodo)) return { error: "Elija un mes válido." };

  const supabase = await createClient();
  const { data: credencial, error: credencialError } = await supabase
    .from("sunat_credenciales")
    .select("entidad_id, ruc, usuario_sol, client_id, clave_sol_cifrada, client_secret_cifrado")
    .eq("entidad_id", entidadId)
    .maybeSingle();
  if (credencialError) return { error: credencialError.message };
  if (!credencial) return { error: "Guarde primero la credencial SOL de esta empresa." };

  const { data: previa } = await supabase
    .from("sunat_descargas")
    .select("num_ticket, estado")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .maybeSingle();
  const ticketPrevio =
    previa?.estado === "EN_PROCESO" && previa.num_ticket ? (previa.num_ticket as string) : undefined;

  const secreto: SunatCredencialSecreto = {
    entidadId,
    ruc: credencial.ruc as string,
    usuarioSol: credencial.usuario_sol as string,
    clientId: credencial.client_id as string,
    claveSolCifrada: credencial.clave_sol_cifrada as string,
    clientSecretCifrado: credencial.client_secret_cifrado as string,
  };

  try {
    decryptString(secreto.claveSolCifrada, entidadId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo leer la credencial." };
  }

  try {
    const propuesta = await descargarPropuestaRce(secreto, periodo, { numTicket: ticketPrevio });
    const compras = parseRce(propuesta.texto);
    const path = `${entidadId}/${periodo}/propuesta.zip`;
    const { error: uploadError } = await supabase.storage.from("sunat-compras").upload(path, propuesta.contenido, {
      contentType: "application/octet-stream",
      upsert: true,
    });

    const { error: borrarError } = await supabase
      .from("sunat_compras")
      .delete()
      .eq("entidad_id", entidadId)
      .eq("periodo", periodo);
    if (borrarError) return { error: borrarError.message };

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
      if (insertError) return { error: insertError.message };
    }

    await supabase.from("sunat_descargas").upsert(
      {
        entidad_id: entidadId,
        periodo,
        num_ticket: propuesta.numTicket,
        estado: "LISTO",
        mensaje: uploadError
          ? `${compras.length} comprobantes guardados. No se archivó el ZIP de SUNAT: ${uploadError.message}`
          : `${compras.length} comprobantes de factura, boleta electrónica y recibo por honorarios.`,
        archivo_path: uploadError ? null : path,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entidad_id,periodo" },
    );
    revalidatePath("/compras");
    return { total: compras.length };
  } catch (error) {
    if (error instanceof SunatTicketPendienteError) {
      await supabase.from("sunat_descargas").upsert(
        {
          entidad_id: entidadId,
          periodo,
          num_ticket: error.numTicket,
          estado: "EN_PROCESO",
          mensaje: error.message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entidad_id,periodo" },
      );
      revalidatePath("/compras");
      return { error: error.message, pendiente: true };
    }
    const message = error instanceof SunatError ? error.message : "No se pudo descargar el mes desde SUNAT.";
    await supabase.from("sunat_descargas").upsert(
      {
        entidad_id: entidadId,
        periodo,
        estado: "ERROR",
        mensaje: message,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entidad_id,periodo" },
    );
    return { error: message };
  }
}

export async function prepararPdfCompra(id: string): Promise<{
  error?: string;
  compra?: CompraSunatFila & { periodo: string; empresa: string; rucEmpresa: string };
  base?: number | null;
  igv?: number | null;
  detalle?: ComprobanteUbl | null;
  aviso?: string | null;
}> {
  const datos = await compraSunatParaPdf(id);
  if (datos.error || !datos.compra) return { error: datos.error ?? "No se encontró el comprobante." };
  const compra = datos.compra;
  const supabase = await createClient();
  const registro = await lineaDeRegistro(supabase, compra.entidadId, compra.periodo, compra);
  if (registro && (registro.rucEmisor !== compra.ruc_emisor || registro.razonSocialEmisor !== compra.razon_social_emisor)) {
    compra.ruc_emisor = registro.rucEmisor;
    compra.razon_social_emisor = registro.razonSocialEmisor;
    await supabase
      .from("sunat_compras")
      .update({ ruc_emisor: registro.rucEmisor, razon_social_emisor: registro.razonSocialEmisor })
      .eq("id", compra.id);
  }

  const guardado = await xmlGuardado(supabase, compra);
  let xml = guardado;
  let aviso: string | null = null;
  if (!xml && compra.ruc_emisor) {
    const cred = await credencialSecreta(supabase, compra.entidadId);
    if (cred) {
      const bajado = await descargarXmlRecibido(cred, {
        rucEmisor: compra.ruc_emisor,
        tipo: compra.tipo,
        serie: compra.serie,
        numero: compra.numero,
      }).catch(() => ({ xml: null, aviso: "SUNAT no respondió al pedir el XML." }));
      xml = bajado.xml;
      aviso = bajado.aviso;
      if (xml) await guardarXml(supabase, compra, xml);
    } else {
      aviso = "Falta la credencial SOL para pedir el detalle a SUNAT.";
    }
  }

  const detalle = xml ? parseUbl(xml) : null;
  if (detalle?.esResumen) {
    aviso = "Este comprobante se informó en un resumen diario y SUNAT no entrega el detalle de cada ítem.";
  }
  return {
    compra,
    base: registro?.base ?? null,
    igv: registro?.igv ?? null,
    detalle: detalle && (detalle.lineas.length > 0 || detalle.emisorNombre) ? detalle : null,
    aviso,
  };
}

export async function compraSunatParaPdf(id: string): Promise<{
  error?: string;
  compra?: CompraSunatFila & { periodo: string; empresa: string; rucEmpresa: string; entidadId: string };
}> {
  const acceso = await exigirEstudio();
  if (!acceso.profile) return { error: acceso.error ?? "Sin permiso." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sunat_compras")
    .select(`${SELECT_COMPRA}, periodo, entidad_id`)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { error: "No se encontró el comprobante." };
  const { data: entidad } = await supabase
    .from("entidades")
    .select("nombre, ruc")
    .eq("id", data.entidad_id as string)
    .maybeSingle();
  return {
    compra: {
      ...normalizarCompra(data as CompraSunatFila),
      periodo: data.periodo as string,
      empresa: (entidad?.nombre as string) ?? "",
      rucEmpresa: (entidad?.ruc as string) ?? "",
      entidadId: data.entidad_id as string,
    },
  };
}

async function corregirEmisores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entidadId: string,
  periodo: string,
  filas: CompraSunatFila[],
): Promise<CompraSunatFila[]> {
  const { data: entidad } = await supabase.from("entidades").select("ruc").eq("id", entidadId).maybeSingle();
  const ruc = String(entidad?.ruc ?? "");
  if (!ruc || !filas.some((fila) => fila.ruc_emisor === ruc)) return filas;
  const lineas = await leerPropuesta(supabase, entidadId, periodo);
  if (!lineas) return filas;
  const porClave = new Map(lineas.map((linea) => [claveCompra(linea.tipo, linea.serie, linea.numero), linea]));
  await Promise.all(
    filas.map(async (fila) => {
      const fresco = porClave.get(claveCompra(fila.tipo, fila.serie, fila.numero));
      if (!fresco || (fresco.rucEmisor === fila.ruc_emisor && fresco.razonSocialEmisor === fila.razon_social_emisor)) return;
      fila.ruc_emisor = fresco.rucEmisor;
      fila.razon_social_emisor = fresco.razonSocialEmisor;
      await supabase
        .from("sunat_compras")
        .update({ ruc_emisor: fresco.rucEmisor, razon_social_emisor: fresco.razonSocialEmisor })
        .eq("id", fila.id);
    }),
  );
  return filas;
}

async function lineaDeRegistro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entidadId: string,
  periodo: string,
  compra: Pick<CompraSunatFila, "tipo" | "serie" | "numero">,
): Promise<CompraRce | null> {
  const lineas = await leerPropuesta(supabase, entidadId, periodo);
  if (!lineas) return null;
  return lineas.find((linea) => claveCompra(linea.tipo, linea.serie, linea.numero) === claveCompra(compra.tipo, compra.serie, compra.numero)) ?? null;
}

async function leerPropuesta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entidadId: string,
  periodo: string,
): Promise<CompraRce[] | null> {
  const { data: descarga } = await supabase
    .from("sunat_descargas")
    .select("archivo_path")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .maybeSingle();
  const path = (descarga?.archivo_path as string | null) ?? null;
  if (!path) return null;
  const { data, error } = await supabase.storage.from("sunat-compras").download(path);
  if (error || !data) return null;
  return parseRce(textoDeArchivo(Buffer.from(await data.arrayBuffer())));
}

function claveCompra(tipo: string, serie: string, numero: string): string {
  return `${tipo}|${serie}|${numero}`;
}

function rutaXml(compra: { entidadId: string; periodo: string; tipo: string; serie: string; numero: string }): string {
  const serie = compra.serie.replace(/[^\w.-]+/g, "_") || "SIN-SERIE";
  const numero = compra.numero.replace(/[^\w.-]+/g, "_");
  return `${compra.entidadId}/${compra.periodo}/xml/${compra.tipo}-${serie}-${numero}.xml`;
}

async function xmlGuardado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  compra: { entidadId: string; periodo: string; tipo: string; serie: string; numero: string },
): Promise<string | null> {
  const { data, error } = await supabase.storage.from("sunat-compras").download(rutaXml(compra));
  if (error || !data) return null;
  const texto = Buffer.from(await data.arrayBuffer()).toString("utf8");
  return texto.includes("<") ? texto : null;
}

async function guardarXml(
  supabase: Awaited<ReturnType<typeof createClient>>,
  compra: { entidadId: string; periodo: string; tipo: string; serie: string; numero: string },
  xml: string,
): Promise<void> {
  await supabase.storage.from("sunat-compras").upload(rutaXml(compra), Buffer.from(xml), {
    contentType: "application/octet-stream",
    upsert: true,
  });
}

async function credencialSecreta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entidadId: string,
): Promise<SunatCredencialSecreto | null> {
  const { data } = await supabase
    .from("sunat_credenciales")
    .select("ruc, usuario_sol, client_id, clave_sol_cifrada, client_secret_cifrado")
    .eq("entidad_id", entidadId)
    .maybeSingle();
  if (!data) return null;
  return {
    entidadId,
    ruc: data.ruc as string,
    usuarioSol: data.usuario_sol as string,
    clientId: data.client_id as string,
    claveSolCifrada: data.clave_sol_cifrada as string,
    clientSecretCifrado: data.client_secret_cifrado as string,
  };
}

export async function comprasSunatParaZip(
  entidadId: string,
  periodo: string,
): Promise<{ error?: string; empresa?: string; rucEmpresa?: string; compras?: CompraSunatFila[] }> {
  const acceso = await exigirEstudio();
  if (!acceso.profile) return { error: acceso.error ?? "Sin permiso." };
  const supabase = await createClient();
  const { data: entidad } = await supabase
    .from("entidades")
    .select("nombre, ruc")
    .eq("id", entidadId)
    .maybeSingle();
  const compras = await listarComprasSunat(entidadId, periodo);
  if (compras.length === 0) return { error: "Este mes no tiene comprobantes descargados." };
  return {
    empresa: (entidad?.nombre as string) ?? "",
    rucEmpresa: (entidad?.ruc as string) ?? "",
    compras,
  };
}
