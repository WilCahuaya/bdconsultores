"use server";

import { revalidatePath } from "next/cache";
import type {
  EstadoContratoPlanilla,
  EstadoDocumentoPlanilla,
  EstadoTramitePension,
  JornadaLaboral,
  TipoDocumentoPlanilla,
  TipoPension,
  TipoTRegistro,
} from "@inventario/types";
import { puedeEditarFichaLaboral, puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { getTrabajador, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { pathPerteneceAlDocumento } from "@/lib/documento-storage";
import { parseFechaCampo, parseCargoCampo } from "@/lib/planillas-labels";
import { horarioEstaCompleto } from "@/lib/horario-laboral";
import { planillasDb } from "@/lib/supabase/planillas";

async function assertEscrituraFicha(
  relacionId: string,
): Promise<{ error: string } | { trabajador: TrabajadorListItem }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para editar." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };
  return { trabajador };
}

async function assertEscrituraTramite(
  relacionId: string,
): Promise<{ error: string } | { trabajador: TrabajadorListItem }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) return { error: "No tiene permiso para editar." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };
  return { trabajador };
}

export type ContratoRow = {
  id: string;
  version: number;
  numero_contrato: string | null;
  cargo: string | null;
  horario: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  remuneracion: number | null;
  asignacion_familiar: number | null;
  jornada: JornadaLaboral | null;
  es_vigente: boolean;
  estado: EstadoContratoPlanilla;
  datos_confirmados: boolean;
};

export type DocumentoRow = {
  id: string;
  tipo: TipoDocumentoPlanilla;
  estado: EstadoDocumentoPlanilla;
  observaciones: string | null;
  storage_path: string | null;
  created_at: string;
};

export type PensionRow = {
  id: string;
  tipo: TipoPension;
  afp_nombre: string | null;
  cuspp: string | null;
  tramite_estado: EstadoTramitePension;
  fecha_tramite: string | null;
};

export type VidaLeyRow = {
  id: string;
  estado: string | null;
  numero_poliza: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

export type TRegistroRow = {
  id: string;
  tipo: TipoTRegistro;
  realizado: boolean;
  fecha: string | null;
  observaciones: string | null;
};

export async function listContratos(relacionId: string): Promise<ContratoRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("contratos")
    .select("id, version, numero_contrato, cargo, horario, fecha_inicio, fecha_fin, remuneracion, asignacion_familiar, jornada, es_vigente, estado, datos_confirmados")
    .eq("relacion_id", relacionId)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContratoRow[];
}

function parseSnapshotContrato(formData: FormData, cargoActual: string | null) {
  const cargo = parseCargoCampo(String(formData.get("cargo") ?? ""), cargoActual);
  if (cargo.error) return { error: cargo.error };
  if (!cargo.value) return { error: "Elija el cargo del contrato." };
  const fechaInicio = parseFechaCampo(String(formData.get("fecha_inicio") ?? ""), "Fecha de inicio");
  if (fechaInicio.error) return { error: fechaInicio.error };
  if (!fechaInicio.value) return { error: "La fecha de inicio es obligatoria." };
  const fechaFin = parseFechaCampo(String(formData.get("fecha_fin") ?? ""), "Fecha de fin");
  if (fechaFin.error) return { error: fechaFin.error };
  const jornada = String(formData.get("jornada") ?? "").trim();
  if (jornada !== "TIEMPO_COMPLETO" && jornada !== "TIEMPO_PARCIAL") {
    return { error: "Elija tiempo completo o parcial." };
  }
  const horario = String(formData.get("horario") ?? "").trim();
  if (!horarioEstaCompleto(horario)) return { error: "Complete el horario del contrato." };
  const remuneracion = Number(formData.get("remuneracion") || 0);
  if (!Number.isFinite(remuneracion) || remuneracion <= 0) return { error: "Indique la remuneración." };
  return {
    value: {
      cargo: cargo.value,
      fecha_inicio: fechaInicio.value,
      fecha_fin: fechaFin.value,
      jornada: jornada as JornadaLaboral,
      horario,
      remuneracion,
    },
  };
}

async function asegurarDocumentoFirmado(relacionId: string) {
  const db = await planillasDb();
  const { data: contratoDoc } = await db
    .from("documentos")
    .select("id")
    .eq("relacion_id", relacionId)
    .eq("tipo", "CONTRATO_FIRMADO")
    .maybeSingle();
  if (!contratoDoc) {
    await db.from("documentos").insert({
      relacion_id: relacionId,
      tipo: "CONTRATO_FIRMADO",
      estado: "PENDIENTE",
    });
  }
}

async function hayPdfFirmado(relacionId: string): Promise<{ error?: string; ok: boolean }> {
  const db = await planillasDb();
  const { data: firmados, error } = await db
    .from("documentos")
    .select("id, storage_path, estado")
    .eq("relacion_id", relacionId)
    .eq("tipo", "CONTRATO_FIRMADO");
  if (error) return { error: error.message, ok: false };
  return { ok: Boolean((firmados ?? []).find((d) => d.storage_path && d.estado === "SI")) };
}

export async function generarContratoParaFirma(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string; contratoId?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const parsed = parseSnapshotContrato(formData, gate.trabajador.cargo);
  if (parsed.error || !parsed.value) return { error: parsed.error ?? "Datos incompletos." };
  const snapshot = parsed.value;

  const db = await planillasDb();
  const { data: existentes, error: listError } = await db
    .from("contratos")
    .select("id, version, estado, datos_confirmados")
    .eq("relacion_id", relacionId)
    .order("version", { ascending: false });
  if (listError) return { error: listError.message };

  const abierto = (existentes ?? []).find(
    (c) => c.estado !== "RECOGIDO" && c.estado !== "BAJA" && c.estado !== "COMPLETO",
  );
  const campos = {
    cargo: snapshot.cargo,
    horario: snapshot.horario,
    jornada: snapshot.jornada,
    fecha_inicio: snapshot.fecha_inicio,
    fecha_fin: snapshot.fecha_fin,
    remuneracion: snapshot.remuneracion,
    datos_confirmados: false,
    es_vigente: false,
  };

  let contratoId = abierto?.id as string | undefined;
  if (abierto) {
    const { error } = await db.from("contratos").update(campos).eq("id", abierto.id).eq("relacion_id", relacionId);
    if (error) return { error: error.message };
    if (abierto.estado !== "ELABORADO") {
      const { error: estadoError } = await db
        .from("contratos")
        .update({ estado: "ELABORADO" as EstadoContratoPlanilla })
        .eq("id", abierto.id)
        .eq("relacion_id", relacionId);
      if (estadoError) return { error: estadoError.message };
    }
  } else {
    const version = ((existentes ?? [])[0]?.version ?? 0) + 1;
    const { data: creado, error } = await db
      .from("contratos")
      .insert({
        relacion_id: relacionId,
        version,
        numero_contrato: null,
        asignacion_familiar: null,
        estado: "PENDIENTE_DOCS" as EstadoContratoPlanilla,
        ...campos,
      })
      .select("id")
      .single();
    if (error || !creado) return { error: error?.message ?? "No se pudo generar el contrato." };
    contratoId = creado.id;
    const { error: estadoError } = await db
      .from("contratos")
      .update({ estado: "ELABORADO" as EstadoContratoPlanilla })
      .eq("id", creado.id)
      .eq("relacion_id", relacionId);
    if (estadoError) return { error: estadoError.message };
  }

  await asegurarDocumentoFirmado(relacionId);
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return { contratoId };
}

export async function confirmarContratoFirmado(
  relacionId: string,
  contratoId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const parsed = parseSnapshotContrato(formData, gate.trabajador.cargo);
  if (parsed.error || !parsed.value) return { error: parsed.error ?? "Datos incompletos." };
  const snapshot = parsed.value;

  const db = await planillasDb();
  const { data: contrato, error: loadError } = await db
    .from("contratos")
    .select("id, estado")
    .eq("id", contratoId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!contrato) return { error: "Contrato no encontrado." };
  if (contrato.estado === "RECOGIDO" || contrato.estado === "BAJA" || contrato.estado === "COMPLETO") {
    return { error: "Este contrato ya está cerrado." };
  }

  const pdf = await hayPdfFirmado(relacionId);
  if (pdf.error) return { error: pdf.error };
  if (!pdf.ok) return { error: "Suba el PDF firmado antes de guardar los datos del contrato." };

  await db.from("contratos").update({ es_vigente: false }).eq("relacion_id", relacionId);

  const { error } = await db
    .from("contratos")
    .update({
      cargo: snapshot.cargo,
      horario: snapshot.horario,
      jornada: snapshot.jornada,
      fecha_inicio: snapshot.fecha_inicio,
      fecha_fin: snapshot.fecha_fin,
      remuneracion: snapshot.remuneracion,
      datos_confirmados: true,
      es_vigente: true,
    })
    .eq("id", contratoId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };

  const { error: relError } = await db
    .from("relaciones_laborales")
    .update({
      cargo: snapshot.cargo,
      horario: snapshot.horario,
      jornada: snapshot.jornada,
      fecha_ingreso: snapshot.fecha_inicio,
      fecha_cese: snapshot.fecha_fin,
    })
    .eq("id", relacionId);
  if (relError) return { error: relError.message };

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath(`/trabajadores/${relacionId}`);
  return {};
}

export async function marcarContratoRecogido(
  relacionId: string,
  contratoId: string,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };

  const db = await planillasDb();
  const { data: contrato, error: loadError } = await db
    .from("contratos")
    .select("id, estado, datos_confirmados")
    .eq("id", contratoId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!contrato) return { error: "Contrato no encontrado." };
  if (contrato.estado === "RECOGIDO") return {};
  if (contrato.estado !== "ELABORADO") {
    return { error: "Primero hay que generar el documento (estado Elaborado)." };
  }
  if (!contrato.datos_confirmados) {
    return { error: "Confirme los datos del PDF firmado antes de marcarlo Recogido." };
  }

  const pdf = await hayPdfFirmado(relacionId);
  if (pdf.error) return { error: pdf.error };
  if (!pdf.ok) {
    return { error: "Suba el PDF del contrato firmado antes de marcarlo como recogido." };
  }

  const { error } = await db
    .from("contratos")
    .update({ estado: "RECOGIDO" as EstadoContratoPlanilla })
    .eq("id", contratoId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };

  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}

export async function listDocumentos(relacionId: string): Promise<DocumentoRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("documentos")
    .select("id, tipo, estado, observaciones, storage_path, created_at")
    .eq("relacion_id", relacionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentoRow[];
}

export async function addDocumento(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string; documentoId?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { data, error } = await db
    .from("documentos")
    .insert({
      relacion_id: relacionId,
      tipo: String(formData.get("tipo")) as TipoDocumentoPlanilla,
      estado: String(formData.get("estado")) as EstadoDocumentoPlanilla,
      observaciones: String(formData.get("observaciones") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return { documentoId: data.id };
}

export async function setDocumentoArchivo(
  relacionId: string,
  documentoId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };

  if (!pathPerteneceAlDocumento(gate.trabajador.entidad_id, relacionId, documentoId, storagePath)) {
    return { error: "Ruta de archivo no válida." };
  }

  const db = await planillasDb();
  const { data: actual, error: loadError } = await db
    .from("documentos")
    .select("id")
    .eq("id", documentoId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!actual) return { error: "Documento no encontrado." };

  const { error } = await db
    .from("documentos")
    .update({ storage_path: storagePath, estado: "SI" })
    .eq("id", documentoId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}

export async function getPension(relacionId: string): Promise<PensionRow | null> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("pensiones")
    .select("id, tipo, afp_nombre, cuspp, tramite_estado, fecha_tramite")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as PensionRow | null;
}

export async function savePension(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  const tipo = String(formData.get("tipo")) as TipoPension;
  const fechaTramite = parseFechaCampo(String(formData.get("fecha_tramite") ?? ""), "Fecha de trámite");
  if (fechaTramite.error) return { error: fechaTramite.error };
  const payload = {
    relacion_id: relacionId,
    tipo,
    afp_nombre: tipo === "AFP" ? String(formData.get("afp_nombre") ?? "").trim() || null : null,
    cuspp: String(formData.get("cuspp") ?? "").trim() || null,
    tramite_estado: (tipo === "ONP" ? "NO_APLICA" : String(formData.get("tramite_estado"))) as EstadoTramitePension,
    fecha_tramite: fechaTramite.value,
  };
  const db = await planillasDb();
  const { error } = await db.from("pensiones").upsert(payload, { onConflict: "relacion_id" });
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}

export async function getVidaLey(relacionId: string): Promise<VidaLeyRow | null> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("vida_ley")
    .select("id, estado, numero_poliza, fecha_inicio, fecha_fin")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as VidaLeyRow | null;
}

export async function saveVidaLey(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  const fechaInicio = parseFechaCampo(String(formData.get("fecha_inicio") ?? ""), "Fecha de inicio");
  if (fechaInicio.error) return { error: fechaInicio.error };
  const fechaFin = parseFechaCampo(String(formData.get("fecha_fin") ?? ""), "Fecha de fin");
  if (fechaFin.error) return { error: fechaFin.error };
  const payload = {
    relacion_id: relacionId,
    estado: String(formData.get("estado") ?? "").trim() || null,
    numero_poliza: String(formData.get("numero_poliza") ?? "").trim() || null,
    fecha_inicio: fechaInicio.value,
    fecha_fin: fechaFin.value,
  };
  const db = await planillasDb();
  const { error } = await db.from("vida_ley").upsert(payload, { onConflict: "relacion_id" });
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}

export async function listTRegistro(relacionId: string): Promise<TRegistroRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("t_registro")
    .select("id, tipo, realizado, fecha, observaciones")
    .eq("relacion_id", relacionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TRegistroRow[];
}

export async function addTRegistro(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  const fecha = parseFechaCampo(String(formData.get("fecha") ?? ""), "Fecha");
  if (fecha.error) return { error: fecha.error };
  const db = await planillasDb();
  const { error } = await db.from("t_registro").insert({
    relacion_id: relacionId,
    tipo: String(formData.get("tipo")) as TipoTRegistro,
    realizado: formData.get("realizado") === "on",
    fecha: fecha.value,
    observaciones: String(formData.get("observaciones") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}
