"use server";

import { revalidatePath } from "next/cache";
import { esPersonalEstudio } from "@inventario/types";
import { requirePlanillasProfile } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import type { SunatCredencialSecreto } from "@/lib/sunat/auth";
import { decryptString, encryptString } from "@/lib/sunat/crypto";
import { SunatError, SunatTicketPendienteError } from "@/lib/sunat/errors";
import { parseRce, type CompraRce } from "@/lib/sunat/parse-rce";
import { guardarPropuesta, registrarDescarga } from "@/lib/sunat/persistir";
import { rutaCdr, rutaXml } from "@/lib/sunat/rutas";
import { descargarPropuestaRce, textoDeArchivo } from "@/lib/sunat/sire";
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
  tipo_cambio: number | null;
  base: number | null;
  igv: number | null;
  total: number | null;
  estado: string;
  xml_estado: string | null;
}

export interface DescargaSunatVista {
  estado: string;
  mensaje: string | null;
  numTicket: string | null;
}

export interface PedidoXmlVista {
  estado: string;
  mensaje: string | null;
}

const SELECT_COMPRA =
  "id, tipo, serie, numero, numero_final, ruc_emisor, razon_social_emisor, fecha_emision, moneda, total";

function normalizarCompra(row: CompraSunatFila): CompraSunatFila {
  return {
    ...row,
    total: monto(row.total),
    base: monto(row.base),
    igv: monto(row.igv),
    tipo_cambio: monto(row.tipo_cambio),
    estado: row.estado || "ACEPTADO",
    xml_estado: row.xml_estado ?? null,
  };
}

function monto(valor: number | null | undefined): number | null {
  if (valor == null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
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
  const filas = (data ?? []).map((row) =>
    normalizarCompra({
      ...(row as CompraSunatFila),
      base: null,
      igv: null,
      tipo_cambio: null,
      estado: "ACEPTADO",
      xml_estado: null,
    }),
  );
  try {
    const completas = await completarFilas(supabase, entidadId, periodo, filas);
    return await adjuntarXml(supabase, entidadId, periodo, completas);
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

export async function estadoPedidoXml(entidadId: string, periodo: string): Promise<PedidoXmlVista | null> {
  const acceso = await exigirEstudio();
  if (!acceso.profile || !/^[0-9]{6}$/.test(periodo)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sunat_pedidos")
    .select("estado, mensaje")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .maybeSingle();
  if (!data) return null;
  return { estado: data.estado as string, mensaje: (data.mensaje as string | null) ?? null };
}

export async function pedirXmlCompras(entidadId: string, periodo: string): Promise<{ error?: string }> {
  const acceso = await exigirEstudio();
  if (!acceso.profile) return { error: acceso.error ?? "Sin permiso." };
  if (!/^[0-9]{6}$/.test(periodo)) return { error: "Elija un mes válido." };
  const supabase = await createClient();
  const { data: credencial } = await supabase.from("sunat_credenciales").select("entidad_id").eq("entidad_id", entidadId).maybeSingle();
  if (!credencial) return { error: "Guarde primero la credencial SOL de esta empresa." };
  const { data: actual } = await supabase
    .from("sunat_pedidos")
    .select("estado")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .maybeSingle();
  if (actual?.estado === "EN_PROCESO") return { error: "La PC del estudio ya está bajando este mes." };
  const { error } = await supabase.from("sunat_pedidos").upsert(
    {
      entidad_id: entidadId,
      periodo,
      estado: "PEDIDO",
      mensaje: "Pedido recibido. La PC del estudio lo baja si está encendida y con el programa abierto.",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entidad_id,periodo" },
  );
  if (error) return { error: error.message };
  revalidatePath("/compras");
  return {};
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
    const { total } = await guardarPropuesta(supabase, entidadId, periodo, propuesta);
    revalidatePath("/compras");
    return { total };
  } catch (error) {
    if (error instanceof SunatTicketPendienteError) {
      await registrarDescarga(supabase, entidadId, periodo, {
        numTicket: error.numTicket,
        estado: "EN_PROCESO",
        mensaje: error.message,
      });
      revalidatePath("/compras");
      return { error: error.message, pendiente: true };
    }
    const message = error instanceof SunatError ? error.message : "No se pudo descargar el mes desde SUNAT.";
    await registrarDescarga(supabase, entidadId, periodo, { estado: "ERROR", mensaje: message });
    return { error: message };
  }
}

export async function prepararPdfCompra(id: string): Promise<{
  error?: string;
  compra?: CompraSunatFila & { periodo: string; empresa: string; rucEmpresa: string; entidadId: string };
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

  const xml = await xmlGuardado(supabase, compra);
  let aviso = xml
    ? null
    : "El detalle de este comprobante todavía no está en el almacén. Pide el XML desde Planillas.";

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
  const { periodo, entidad_id: entidadId, ...fila } = data;
  const { data: entidad } = await supabase
    .from("entidades")
    .select("nombre, ruc")
    .eq("id", entidadId as string)
    .maybeSingle();
  return {
    compra: {
      ...normalizarCompra({
        ...(fila as CompraSunatFila),
        base: null,
        igv: null,
        tipo_cambio: null,
        estado: "ACEPTADO",
      }),
      periodo: periodo as string,
      empresa: (entidad?.nombre as string) ?? "",
      rucEmpresa: (entidad?.ruc as string) ?? "",
      entidadId: entidadId as string,
    },
  };
}

async function completarFilas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entidadId: string,
  periodo: string,
  filas: CompraSunatFila[],
): Promise<CompraSunatFila[]> {
  const lineas = await leerPropuesta(supabase, entidadId, periodo);
  if (!lineas) return filas;
  const porClave = new Map(lineas.map((linea) => [claveCompra(linea.tipo, linea.serie, linea.numero), linea]));
  await Promise.all(
    filas.map(async (fila) => {
      const fresco = porClave.get(claveCompra(fila.tipo, fila.serie, fila.numero));
      if (!fresco) return;
      fila.base = fresco.base;
      fila.igv = fresco.igv;
      fila.tipo_cambio = fresco.tipoCambio ?? (fila.moneda === "PEN" ? 1 : null);
      if (fresco.rucEmisor === fila.ruc_emisor && fresco.razonSocialEmisor === fila.razon_social_emisor) return;
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

async function adjuntarXml(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entidadId: string,
  periodo: string,
  filas: CompraSunatFila[],
): Promise<CompraSunatFila[]> {
  const { data, error } = await supabase
    .from("sunat_compra_archivos")
    .select("tipo, serie, numero, xml_estado")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo);
  if (error || !data) return filas;
  const porClave = new Map(data.map((fila) => [claveCompra(fila.tipo as string, fila.serie as string, fila.numero as string), fila.xml_estado as string]));
  for (const fila of filas) fila.xml_estado = porClave.get(claveCompra(fila.tipo, fila.serie, fila.numero)) ?? null;
  return filas;
}

function claveCompra(tipo: string, serie: string, numero: string): string {
  return `${tipo}|${serie}|${numero}`;
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

const FALTA_ARCHIVO = "Ese archivo todavía no está en el almacén. En la PC del estudio se baja con pnpm sunat:bajar.";

export async function archivoCompraSunat(
  id: string,
  clase: "xml" | "cdr",
): Promise<{ error?: string; filename?: string; contentType?: string; bytes?: Uint8Array }> {
  const datos = await compraSunatParaPdf(id);
  if (datos.error || !datos.compra) return { error: datos.error ?? "No se encontró el comprobante." };
  const compra = datos.compra;
  const supabase = await createClient();
  const base = `${compra.tipo}-${compra.serie || "SIN-SERIE"}-${compra.numero}`.replace(/[^\w.-]+/g, "_");

  if (clase === "xml") {
    const xml = await xmlGuardado(supabase, compra);
    if (!xml) return { error: FALTA_ARCHIVO };
    return { filename: `${base}.xml`, contentType: "application/xml", bytes: Buffer.from(xml) };
  }

  const guardado = await supabase.storage.from("sunat-compras").download(rutaCdr(compra));
  if (!guardado.data) return { error: FALTA_ARCHIVO };
  return archivoCdr(base, new Uint8Array(await guardado.data.arrayBuffer()));
}

function archivoCdr(base: string, bytes: Uint8Array): { filename: string; contentType: string; bytes: Uint8Array } {
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  return {
    filename: `${base}.cdr.${zip ? "zip" : "xml"}`,
    contentType: zip ? "application/zip" : "application/xml",
    bytes,
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
