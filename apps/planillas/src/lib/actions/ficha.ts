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
import { TIPOS_DOCUMENTO_ALTA_INICIALES } from "@inventario/types";
import { puedeEditarFichaLaboral, puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { getTrabajador, listTrabajadores, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { representanteDesdeEntidad } from "@/lib/representante-contrato";
import { altasAfiliacionListas, flujoDesdeTrabajador } from "@/lib/flujo-ficha";
import {
  isUuid,
  pathPerteneceAlDocumento,
  pathPerteneceAComprobanteEmpresa,
  pathPerteneceAVidaLeyLote,
  type ArchivoVidaLeyLote,
} from "@/lib/documento-storage";
import { parseFechaCampo, parseCargoCampo, armarDireccionPersona, montoAsignacionFamiliar, vidaLeyPendienteRecepcion } from "@/lib/planillas-labels";
import { horarioEstaCompleto } from "@/lib/horario-laboral";
import { fechaFinPeriodoVidaLey } from "@/lib/vida-ley-word";
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
  documento_id: string | null;
  solicitud_registro_id: string | null;
  representante_legal_nombre: string | null;
  representante_legal_dni: string | null;
  representante_legal_cargo: string | null;
  representante_legal_guardado: boolean;
};

export type DocumentoRow = {
  id: string;
  tipo: TipoDocumentoPlanilla;
  estado: EstadoDocumentoPlanilla;
  observaciones: string | null;
  nota: string | null;
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

export type VidaLeyLoteRow = {
  id: string;
  constancia_storage_path: string | null;
  factura_storage_path: string | null;
  factura_no_enviada: boolean;
  relacionIds: string[];
};

export type EnvioVidaLeyOpcion = {
  loteId: string;
  relacionIds: string[];
  constancia: boolean;
  factura: boolean;
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
    .select("id, version, numero_contrato, cargo, horario, fecha_inicio, fecha_fin, remuneracion, asignacion_familiar, jornada, es_vigente, estado, datos_confirmados, documento_id, solicitud_registro_id, representante_legal_nombre, representante_legal_dni, representante_legal_cargo, representante_legal_guardado")
    .eq("relacion_id", relacionId)
    .neq("estado", "BAJA")
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContratoRow[];
}

function parseSnapshotContrato(formData: FormData, cargoActual: string | null) {
  const cargo = parseCargoCampo(String(formData.get("cargo") ?? ""), cargoActual);
  if (cargo.error) return { error: cargo.error };
  if (!cargo.value) return { error: "Elija el cargo del contrato." };
  const fechaInicio = parseFechaCampo(String(formData.get("fecha_inicio") ?? ""), "Fecha de inicio de contrato");
  if (fechaInicio.error) return { error: fechaInicio.error };
  if (!fechaInicio.value) return { error: "La fecha de inicio de contrato es obligatoria." };
  const fechaFin = parseFechaCampo(String(formData.get("fecha_fin") ?? ""), "Fecha de fin de contrato");
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

async function asegurarDocumentoFirmadoDeContrato(
  relacionId: string,
  contratoId: string,
  version: number,
): Promise<{ error?: string; documentoId?: string }> {
  const db = await planillasDb();
  const { data: contrato, error: loadError } = await db
    .from("contratos")
    .select("id, documento_id")
    .eq("id", contratoId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!contrato) return { error: "Contrato no encontrado." };
  if (contrato.documento_id) return { documentoId: contrato.documento_id as string };

  const { data: usados } = await db
    .from("contratos")
    .select("documento_id")
    .eq("relacion_id", relacionId)
    .not("documento_id", "is", null);
  const usadosIds = new Set((usados ?? []).map((row) => row.documento_id as string));

  const { data: existentes } = await db
    .from("documentos")
    .select("id")
    .eq("relacion_id", relacionId)
    .eq("tipo", "CONTRATO_FIRMADO")
    .order("created_at", { ascending: true });
  const libre = (existentes ?? []).find((row) => !usadosIds.has(row.id));
  let documentoId = libre?.id as string | undefined;
  if (!documentoId) {
    const { data: creado, error } = await db
      .from("documentos")
      .insert({
        relacion_id: relacionId,
        tipo: "CONTRATO_FIRMADO" as TipoDocumentoPlanilla,
        estado: "PENDIENTE" as EstadoDocumentoPlanilla,
        observaciones: `Versión ${version}`,
      })
      .select("id")
      .single();
    if (error || !creado) return { error: error?.message ?? "No se pudo registrar el documento firmado." };
    documentoId = creado.id;
  } else {
    await db
      .from("documentos")
      .update({ observaciones: `Versión ${version}` })
      .eq("id", documentoId)
      .eq("relacion_id", relacionId);
  }

  const { error: linkError } = await db
    .from("contratos")
    .update({ documento_id: documentoId })
    .eq("id", contratoId)
    .eq("relacion_id", relacionId);
  if (linkError) return { error: linkError.message };
  return { documentoId };
}

async function hayPdfFirmadoDeContrato(
  relacionId: string,
  documentoId: string | null | undefined,
): Promise<{ error?: string; ok: boolean }> {
  if (!documentoId) return { ok: false };
  const db = await planillasDb();
  const { data, error } = await db
    .from("documentos")
    .select("id, storage_path, estado")
    .eq("id", documentoId)
    .eq("relacion_id", relacionId)
    .eq("tipo", "CONTRATO_FIRMADO")
    .maybeSingle();
  if (error) return { error: error.message, ok: false };
  return { ok: Boolean(data?.storage_path && data.estado === "SI") };
}

async function hayRespaldoDeContrato(
  relacionId: string,
  documentoId: string | null | undefined,
  solicitudId: string | null | undefined,
): Promise<{ error?: string; ok: boolean }> {
  const pdf = await hayPdfFirmadoDeContrato(relacionId, documentoId);
  if (pdf.error || pdf.ok) return pdf;
  if (!solicitudId) return { ok: false };
  const db = await planillasDb();
  const { data, error } = await db
    .from("solicitudes_registro")
    .select("id, storage_path")
    .eq("id", solicitudId)
    .maybeSingle();
  if (error) return { error: error.message, ok: false };
  return { ok: Boolean(data?.storage_path) };
}

function contratoEstaCerrado(estado: EstadoContratoPlanilla): boolean {
  return estado === "RECOGIDO" || estado === "BAJA" || estado === "COMPLETO";
}

export async function generarContratoParaFirma(
  relacionId: string,
  formData: FormData,
  contratoId?: string,
): Promise<{ error?: string; contratoId?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const parsed = parseSnapshotContrato(formData, gate.trabajador.cargo);
  if (parsed.error || !parsed.value) return { error: parsed.error ?? "Datos incompletos." };
  const snapshot = parsed.value;
  const asignacionFamiliar = montoAsignacionFamiliar(gate.trabajador.recibe_asignacion_familiar);
  const entidad = await getEntidadPlanillas(gate.trabajador.entidad_id);
  const representante = representanteDesdeEntidad(entidad);

  const db = await planillasDb();
  const { data: existentes, error: listError } = await db
    .from("contratos")
    .select("id, version, estado, datos_confirmados, documento_id")
    .eq("relacion_id", relacionId)
    .order("version", { ascending: false });
  if (listError) return { error: listError.message };

  const destino = contratoId ? (existentes ?? []).find((c) => c.id === contratoId) ?? null : null;
  if (contratoId && !destino) return { error: "Contrato no encontrado." };
  if (destino && contratoEstaCerrado(destino.estado as EstadoContratoPlanilla)) {
    return { error: "Este contrato ya está cerrado." };
  }
  const campos = {
    cargo: snapshot.cargo,
    horario: snapshot.horario,
    jornada: snapshot.jornada,
    fecha_inicio: snapshot.fecha_inicio,
    fecha_fin: snapshot.fecha_fin,
    remuneracion: snapshot.remuneracion,
    asignacion_familiar: asignacionFamiliar,
    representante_legal_nombre: representante.nombre,
    representante_legal_dni: representante.dni,
    representante_legal_cargo: representante.cargo,
    representante_legal_guardado: true,
    datos_confirmados: false,
    es_vigente: false,
  };

  let idGuardado = destino?.id as string | undefined;
  const versionGuardada = destino
    ? (destino.version as number)
    : ((existentes ?? [])[0]?.version ?? 0) + 1;
  if (destino) {
    const { error } = await db.from("contratos").update(campos).eq("id", destino.id).eq("relacion_id", relacionId);
    if (error) return { error: error.message };
    if (destino.estado !== "ELABORADO") {
      const { error: estadoError } = await db
        .from("contratos")
        .update({ estado: "ELABORADO" as EstadoContratoPlanilla })
        .eq("id", destino.id)
        .eq("relacion_id", relacionId);
      if (estadoError) return { error: estadoError.message };
    }
  } else {
    const { data: creado, error } = await db
      .from("contratos")
      .insert({
        relacion_id: relacionId,
        version: versionGuardada,
        numero_contrato: null,
        estado: "PENDIENTE_DOCS" as EstadoContratoPlanilla,
        ...campos,
      })
      .select("id")
      .single();
    if (error || !creado) return { error: error?.message ?? "No se pudo generar el contrato." };
    idGuardado = creado.id;
    const { error: estadoError } = await db
      .from("contratos")
      .update({ estado: "ELABORADO" as EstadoContratoPlanilla })
      .eq("id", creado.id)
      .eq("relacion_id", relacionId);
    if (estadoError) return { error: estadoError.message };
  }

  if (!idGuardado) return { error: "No se pudo generar el contrato." };
  const doc = await asegurarDocumentoFirmadoDeContrato(relacionId, idGuardado, versionGuardada);
  if (doc.error) return { error: doc.error };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath("/tablero");
  return { contratoId: idGuardado };
}

export async function eliminarContratoGenerado(
  relacionId: string,
  contratoId: string,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };

  const db = await planillasDb();
  const { data: contrato, error: loadError } = await db
    .from("contratos")
    .select("id, estado")
    .eq("id", contratoId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!contrato) return { error: "Contrato no encontrado." };
  if (contratoEstaCerrado(contrato.estado as EstadoContratoPlanilla)) {
    return { error: "Este contrato ya está cerrado. No se puede eliminar." };
  }

  const { error } = await db
    .from("contratos")
    .update({
      estado: "BAJA" as EstadoContratoPlanilla,
      es_vigente: false,
      datos_confirmados: false,
    })
    .eq("id", contratoId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };

  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath("/");
  return {};
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
    .select("id, estado, documento_id, solicitud_registro_id")
    .eq("id", contratoId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!contrato) return { error: "Contrato no encontrado." };
  if (contrato.estado === "RECOGIDO" || contrato.estado === "BAJA" || contrato.estado === "COMPLETO") {
    return { error: "Este contrato ya está cerrado." };
  }

  const respaldo = await hayRespaldoDeContrato(
    relacionId,
    contrato.documento_id as string | null,
    contrato.solicitud_registro_id as string | null,
  );
  if (respaldo.error) return { error: respaldo.error };
  if (!respaldo.ok) {
    return { error: "Suba el contrato firmado o enlace una solicitud de registro antes de guardar los datos." };
  }

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
      asignacion_familiar: montoAsignacionFamiliar(gate.trabajador.recibe_asignacion_familiar),
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
    })
    .eq("id", relacionId);
  if (relError) return { error: relError.message };

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/tablero");
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
    .select("id, estado, datos_confirmados, documento_id, solicitud_registro_id")
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
    return { error: "Confirme los datos del respaldo antes de marcarlo Recogido." };
  }

  const respaldo = await hayRespaldoDeContrato(
    relacionId,
    contrato.documento_id as string | null,
    contrato.solicitud_registro_id as string | null,
  );
  if (respaldo.error) return { error: respaldo.error };
  if (!respaldo.ok) {
    return { error: "Suba el contrato firmado o enlace una solicitud de registro antes de marcarlo como recogido." };
  }

  const { error } = await db
    .from("contratos")
    .update({ estado: "RECOGIDO" as EstadoContratoPlanilla })
    .eq("id", contratoId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };

  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${relacionId}`);
  return {};
}

export async function asegurarFirmadoContrato(
  relacionId: string,
  contratoId: string,
): Promise<{ error?: string; documentoId?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { data: contrato, error } = await db
    .from("contratos")
    .select("id, version")
    .eq("id", contratoId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!contrato) return { error: "Contrato no encontrado." };
  const result = await asegurarDocumentoFirmadoDeContrato(relacionId, contratoId, contrato.version as number);
  if (result.error) return { error: result.error };
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath(`/trabajadores/${relacionId}`);
  return { documentoId: result.documentoId };
}

export async function listDocumentos(relacionId: string): Promise<DocumentoRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("documentos")
    .select("id, tipo, estado, observaciones, nota, storage_path, created_at")
    .eq("relacion_id", relacionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentoRow[];
}

export async function asegurarDocumentosAlta(relacionId: string): Promise<void> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return;
  const db = await planillasDb();
  const { data: existentes } = await db.from("documentos").select("tipo").eq("relacion_id", relacionId);
  const ya = new Set((existentes ?? []).map((d) => d.tipo as TipoDocumentoPlanilla));
  const faltan = TIPOS_DOCUMENTO_ALTA_INICIALES.filter((tipo) => !ya.has(tipo));
  if (faltan.length === 0) return;
  await db.from("documentos").insert(
    faltan.map((tipo) => ({
      relacion_id: relacionId,
      tipo,
      estado: "PENDIENTE",
    })),
  );
}

export async function asegurarDocumentoTramiteAfp(relacionId: string): Promise<void> {
  await asegurarDocumentoTramite(relacionId, "TRAMITE_AFP");
}

export async function asegurarDocumentoTrAlta(relacionId: string): Promise<void> {
  await asegurarDocumentoTramite(relacionId, "TR_ALTA");
}

export async function asegurarDocumentoTrBaja(relacionId: string): Promise<void> {
  await asegurarDocumentoTramite(relacionId, "TR_BAJA");
}

export async function asegurarDocumentosVidaLey(relacionId: string): Promise<void> {
  await asegurarDocumentoTramite(relacionId, "VIDA_LEY");
}

async function asegurarDocumentoTramite(
  relacionId: string,
  tipo: Extract<
    TipoDocumentoPlanilla,
    | "TRAMITE_AFP"
    | "TR_ALTA"
    | "TR_BAJA"
    | "VIDA_LEY"
  >,
): Promise<void> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return;
  const db = await planillasDb();
  const { data } = await db
    .from("documentos")
    .select("id")
    .eq("relacion_id", relacionId)
    .eq("tipo", tipo)
    .maybeSingle();
  if (data) return;
  await db.from("documentos").insert({
    relacion_id: relacionId,
    tipo,
    estado: "PENDIENTE",
  });
}

export async function guardarDatosDniEscaneo(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const nombres = String(formData.get("nombres") ?? "").trim();
  if (!nombres) return { error: "El nombre es obligatorio." };
  const nacimiento = parseFechaCampo(String(formData.get("fecha_nacimiento") ?? ""), "Fecha de nacimiento");
  if (nacimiento.error) return { error: nacimiento.error };

  const db = await planillasDb();
  const { error } = await db
    .from("personas")
    .update({
      nombres,
      apellido_paterno: String(formData.get("apellido_paterno") ?? "").trim() || null,
      apellido_materno: String(formData.get("apellido_materno") ?? "").trim() || null,
      fecha_nacimiento: nacimiento.value,
    })
    .eq("id", gate.trabajador.persona.id);
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  return {};
}

export async function guardarDatosFichaEscaneo(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const recibeRaw = String(formData.get("recibe_asignacion_familiar") ?? "").trim();
  const recibe = recibeRaw === "si" ? true : recibeRaw === "no" ? false : null;

  const tipoVia = String(formData.get("tipo_via") ?? "").trim() || null;
  const viaNombre = String(formData.get("via_nombre") ?? "").trim() || null;
  const viaNumero = String(formData.get("via_numero") ?? "").trim() || null;
  const referencia = String(formData.get("referencia") ?? "").trim() || null;
  const distrito = String(formData.get("distrito") ?? "").trim() || null;
  const provincia = String(formData.get("provincia") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  const direccion = armarDireccionPersona({
    tipo_via: tipoVia,
    via_nombre: viaNombre,
    via_numero: viaNumero,
    referencia,
    distrito,
    provincia,
    region,
    direccion: String(formData.get("direccion") ?? "").trim() || null,
  });

  const db = await planillasDb();
  const { error: pError } = await db
    .from("personas")
    .update({
      celular: String(formData.get("celular") ?? "").trim() || null,
      correo: String(formData.get("correo") ?? "").trim() || null,
      direccion,
      tipo_via: tipoVia,
      via_nombre: viaNombre,
      via_numero: viaNumero,
      referencia,
      distrito,
      provincia,
      region,
    })
    .eq("id", gate.trabajador.persona.id);
  if (pError) return { error: pError.message };

  const { error: rError } = await db
    .from("relaciones_laborales")
    .update({ recibe_asignacion_familiar: recibe })
    .eq("id", relacionId);
  if (rError) return { error: rError.message };

  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}

export async function guardarTipoPensionAlta(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const tipo = String(formData.get("tipo") ?? "").trim();
  if (tipo !== "AFP" && tipo !== "ONP") return { error: "Indique si es AFP u ONP." };

  const db = await planillasDb();
  const { data: actual } = await db
    .from("pensiones")
    .select("afp_nombre, cuspp, tramite_estado, fecha_tramite")
    .eq("relacion_id", relacionId)
    .maybeSingle();

  const { error } = await db.from("pensiones").upsert(
    {
      relacion_id: relacionId,
      tipo,
      afp_nombre: tipo === "ONP" ? null : actual?.afp_nombre ?? null,
      cuspp: actual?.cuspp ?? null,
      tramite_estado: tipo === "ONP" ? "NO_APLICA" : actual?.tramite_estado ?? "PENDIENTE",
      fecha_tramite: actual?.fecha_tramite ?? null,
    },
    { onConflict: "relacion_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/");
  revalidatePath("/contratos");
  revalidatePath("/pendientes");
  return {};
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
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath("/");
  revalidatePath("/contratos");
  revalidatePath("/pendientes");
  revalidatePath("/asistencias");
  revalidatePath("/vacaciones");
  revalidatePath("/tablero");
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
  if (tipo !== "AFP" && tipo !== "ONP") return { error: "Indique si es AFP u ONP." };
  const fechaTramite = parseFechaCampo(String(formData.get("fecha_tramite") ?? ""), "Fecha de afiliación");
  if (fechaTramite.error) return { error: fechaTramite.error };
  const afpNombre = tipo === "AFP" ? String(formData.get("afp_nombre") ?? "").trim() || null : null;
  const cuspp = String(formData.get("cuspp") ?? "").trim() || null;
  const tramiteEstado = (tipo === "ONP" ? "NO_APLICA" : String(formData.get("tramite_estado"))) as EstadoTramitePension;
  if (tipo === "AFP" && tramiteEstado === "TRAMITADO") {
    if (!afpNombre) return { error: "Indique la AFP (Habitat, Integra, Prima o Profuturo)." };
    if (!cuspp) return { error: "Indique el CUSPP." };
  }
  const payload = {
    relacion_id: relacionId,
    tipo,
    afp_nombre: afpNombre,
    cuspp,
    tramite_estado: tramiteEstado,
    fecha_tramite: fechaTramite.value,
  };
  const db = await planillasDb();
  const { error } = await db.from("pensiones").upsert(payload, { onConflict: "relacion_id" });
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/");
  revalidatePath("/contratos");
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

export async function getVidaLeyLote(relacionId: string): Promise<VidaLeyLoteRow | null> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data: actual, error } = await db
    .from("vida_ley")
    .select("lote_id")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const loteId = actual?.lote_id as string | null | undefined;
  if (!loteId) return null;

  const [loteRes, miembrosRes] = await Promise.all([
    db
      .from("vida_ley_lotes")
      .select("id, constancia_storage_path, factura_storage_path, factura_no_enviada")
      .eq("id", loteId)
      .maybeSingle(),
    db.from("vida_ley").select("relacion_id").eq("lote_id", loteId),
  ]);
  if (loteRes.error) throw new Error(loteRes.error.message);
  if (miembrosRes.error) throw new Error(miembrosRes.error.message);
  if (!loteRes.data) return null;
  return {
    id: loteRes.data.id as string,
    constancia_storage_path: (loteRes.data.constancia_storage_path as string | null) ?? null,
    factura_storage_path: (loteRes.data.factura_storage_path as string | null) ?? null,
    factura_no_enviada: Boolean(loteRes.data.factura_no_enviada),
    relacionIds: (miembrosRes.data ?? []).map((row) => row.relacion_id as string),
  };
}

export async function contextoEnviosVidaLey(entidadId: string): Promise<{
  porRelacion: { relacionId: string; loteId: string | null }[];
  envios: EnvioVidaLeyOpcion[];
}> {
  const vacio = { porRelacion: [], envios: [] };
  if (!isUuid(entidadId)) return vacio;
  await requirePlanillasProfile();
  const db = await planillasDb();
  const [vidasRes, lotesRes] = await Promise.all([
    db.from("vida_ley").select("relacion_id, lote_id").eq("entidad_id", entidadId),
    db
      .from("vida_ley_lotes")
      .select("id, constancia_storage_path, factura_storage_path, created_at")
      .eq("entidad_id", entidadId)
      .order("created_at", { ascending: true }),
  ]);
  if (vidasRes.error) throw new Error(vidasRes.error.message);
  if (lotesRes.error) throw new Error(lotesRes.error.message);
  const porRelacion = (vidasRes.data ?? []).map((row) => ({
    relacionId: row.relacion_id as string,
    loteId: (row.lote_id as string | null) ?? null,
  }));
  const idsPorLote = new Map<string, string[]>();
  for (const row of porRelacion) {
    if (!row.loteId) continue;
    const lista = idsPorLote.get(row.loteId) ?? [];
    lista.push(row.relacionId);
    idsPorLote.set(row.loteId, lista);
  }
  const envios = (lotesRes.data ?? [])
    .map((row) => ({
      loteId: row.id as string,
      relacionIds: idsPorLote.get(row.id as string) ?? [],
      constancia: Boolean(row.constancia_storage_path),
      factura: Boolean(row.factura_storage_path),
    }))
    .filter((envio) => envio.constancia || envio.factura);
  return { porRelacion, envios };
}

export async function compartirEnvioVidaLey(
  relacionId: string,
  relacionIds: string[],
): Promise<{ error?: string; loteId?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  const entidadId = gate.trabajador.entidad_id;
  const ids = [...new Set(relacionIds.filter((id) => isUuid(id) && id !== relacionId))];
  const db = await planillasDb();
  if (ids.length > 0) {
    const { data: relaciones, error: relError } = await db
      .from("relaciones_laborales")
      .select("id, entidad_id")
      .in("id", ids);
    if (relError) return { error: relError.message };
    const filas = relaciones ?? [];
    if (filas.length !== ids.length || filas.some((row) => row.entidad_id !== entidadId)) {
      return { error: "Hay un trabajador que no es de esta empresa." };
    }
  }

  const { data: actual, error: actualError } = await db
    .from("vida_ley")
    .select("lote_id, estado, numero_poliza, fecha_inicio, fecha_fin")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (actualError) return { error: actualError.message };

  let loteId = (actual?.lote_id as string | null) ?? null;
  if (!loteId) {
    const { data: lote, error: loteError } = await db
      .from("vida_ley_lotes")
      .insert({ entidad_id: entidadId })
      .select("id")
      .single();
    if (loteError || !lote) return { error: loteError?.message ?? "No se pudo crear el envío de Vida Ley." };
    loteId = lote.id as string;
  }

  const { data: miembrosActuales, error: miembrosError } = await db
    .from("vida_ley")
    .select("relacion_id")
    .eq("lote_id", loteId);
  if (miembrosError) return { error: miembrosError.message };
  const quitar = (miembrosActuales ?? [])
    .map((row) => row.relacion_id as string)
    .filter((id) => id !== relacionId && !ids.includes(id));

  const { data: existentes, error: existentesError } = await db
    .from("vida_ley")
    .select("relacion_id, estado, numero_poliza, fecha_inicio, fecha_fin")
    .in("relacion_id", [relacionId, ...ids]);
  if (existentesError) return { error: existentesError.message };
  const porId = new Map((existentes ?? []).map((row) => [row.relacion_id as string, row]));
  const payload = [relacionId, ...ids].map((id) => {
    const row = porId.get(id);
    return {
      relacion_id: id,
      entidad_id: entidadId,
      lote_id: loteId,
      estado: row?.estado ?? null,
      numero_poliza: (row?.numero_poliza as string | null) ?? null,
      fecha_inicio: (row?.fecha_inicio as string | null) ?? null,
      fecha_fin: (row?.fecha_fin as string | null) ?? null,
    };
  });
  const { error: saveError } = await db.from("vida_ley").upsert(payload, { onConflict: "relacion_id" });
  if (saveError) return { error: saveError.message };
  if (quitar.length > 0) {
    const { error: quitarError } = await db.from("vida_ley").update({ lote_id: null }).in("relacion_id", quitar);
    if (quitarError) return { error: quitarError.message };
  }
  revalidarFichasVidaLey([relacionId, ...ids, ...quitar]);
  return { loteId };
}

export async function usarEnvioVidaLey(relacionId: string, loteId: string): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  if (!isUuid(loteId)) return { error: "Envío no válido." };
  const db = await planillasDb();
  const { data: lote, error: loteError } = await db
    .from("vida_ley_lotes")
    .select("id, entidad_id, constancia_storage_path, factura_storage_path")
    .eq("id", loteId)
    .maybeSingle();
  if (loteError) return { error: loteError.message };
  if (!lote || lote.entidad_id !== gate.trabajador.entidad_id) {
    return { error: "Ese envío no es de esta empresa." };
  }
  if (!lote.constancia_storage_path && !lote.factura_storage_path) {
    return { error: "Ese grupo no tiene constancia ni factura." };
  }
  const { data: actual, error: actualError } = await db
    .from("vida_ley")
    .select("estado, numero_poliza, fecha_inicio, fecha_fin")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (actualError) return { error: actualError.message };
  const { error } = await db.from("vida_ley").upsert(
    {
      relacion_id: relacionId,
      entidad_id: gate.trabajador.entidad_id,
      lote_id: loteId,
      estado: actual?.estado ?? null,
      numero_poliza: actual?.numero_poliza ?? null,
      fecha_inicio: actual?.fecha_inicio ?? null,
      fecha_fin: actual?.fecha_fin ?? null,
    },
    { onConflict: "relacion_id" },
  );
  if (error) return { error: error.message };
  revalidarFichasVidaLey([relacionId]);
  return {};
}

export async function nuevoGrupoVidaLey(relacionId: string): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { data: lote, error: loteError } = await db
    .from("vida_ley_lotes")
    .insert({ entidad_id: gate.trabajador.entidad_id })
    .select("id")
    .single();
  if (loteError || !lote) return { error: loteError?.message ?? "No se pudo crear el grupo de Vida Ley." };
  const { data: actual, error: actualError } = await db
    .from("vida_ley")
    .select("estado, numero_poliza, fecha_inicio, fecha_fin")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (actualError) return { error: actualError.message };
  const { error } = await db.from("vida_ley").upsert(
    {
      relacion_id: relacionId,
      entidad_id: gate.trabajador.entidad_id,
      lote_id: lote.id,
      estado: actual?.estado ?? null,
      numero_poliza: actual?.numero_poliza ?? null,
      fecha_inicio: actual?.fecha_inicio ?? null,
      fecha_fin: actual?.fecha_fin ?? null,
    },
    { onConflict: "relacion_id" },
  );
  if (error) return { error: error.message };
  revalidarFichasVidaLey([relacionId]);
  return {};
}

const COLUMNA_ARCHIVO_LOTE: Record<ArchivoVidaLeyLote, "constancia_storage_path" | "factura_storage_path"> = {
  constancia: "constancia_storage_path",
  factura: "factura_storage_path",
};

export async function getComprobanteVidaLeyEmpresa(entidadId: string): Promise<string | null> {
  if (!isUuid(entidadId)) return null;
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("vida_ley_comprobante_empresa")
    .select("storage_path")
    .eq("entidad_id", entidadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.storage_path as string | null) ?? null;
}

export async function setComprobanteVidaLeyEmpresa(
  relacionId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  if (!pathPerteneceAComprobanteEmpresa(gate.trabajador.entidad_id, storagePath)) {
    return { error: "Ruta de archivo no válida." };
  }
  const db = await planillasDb();
  const entidadId = gate.trabajador.entidad_id;
  const { error } = await db.from("vida_ley_comprobante_empresa").upsert(
    { entidad_id: entidadId, storage_path: storagePath },
    { onConflict: "entidad_id" },
  );
  if (error) return { error: error.message };
  const { data: miembros, error: miembrosError } = await db
    .from("vida_ley")
    .select("relacion_id")
    .eq("entidad_id", entidadId);
  if (miembrosError) return { error: miembrosError.message };
  const ids = (miembros ?? []).map((row) => row.relacion_id as string);
  if (ids.length > 0) {
    const { error: estadoError } = await db
      .from("vida_ley")
      .update({ estado: "Registrado" })
      .eq("entidad_id", entidadId);
    if (estadoError) return { error: estadoError.message };
  }
  revalidarFichasVidaLey(ids.length > 0 ? ids : [relacionId]);
  return {};
}

function revalidarFichasVidaLey(relacionIds: string[]) {
  for (const id of relacionIds) revalidatePath(`/trabajadores/${id}`);
  revalidatePath("/pendientes");
  revalidatePath("/vida-ley");
  revalidatePath("/tablero");
}

export async function setVidaLeyLoteArchivo(
  relacionId: string,
  tipo: ArchivoVidaLeyLote,
  storagePath: string,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { data: actual, error: loadError } = await db
    .from("vida_ley")
    .select("lote_id")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  const loteId = actual?.lote_id as string | null | undefined;
  if (!loteId) return { error: "Este trabajador todavía no tiene un envío de Vida Ley." };
  if (!pathPerteneceAVidaLeyLote(gate.trabajador.entidad_id, loteId, tipo, storagePath)) {
    return { error: "Ruta de archivo no válida." };
  }

  const columna = COLUMNA_ARCHIVO_LOTE[tipo];
  const patch: {
    constancia_storage_path?: string;
    factura_storage_path?: string;
    factura_no_enviada?: boolean;
  } = { [columna]: storagePath };
  if (tipo === "factura") patch.factura_no_enviada = false;

  const { error } = await db.from("vida_ley_lotes").update(patch).eq("id", loteId);
  if (error) return { error: error.message };

  const { data: miembros, error: miembrosError } = await db
    .from("vida_ley")
    .select("relacion_id")
    .eq("lote_id", loteId);
  if (miembrosError) return { error: miembrosError.message };
  revalidarFichasVidaLey((miembros ?? []).map((row) => row.relacion_id as string));
  return {};
}

export async function saveVidaLey(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  const fechaInicio = parseFechaCampo(String(formData.get("fecha_inicio") ?? ""), "Fecha de inicio");
  if (fechaInicio.error) return { error: fechaInicio.error };
  const fechaFin = parseFechaCampo(String(formData.get("fecha_fin") ?? ""), "Fecha de fin");
  if (fechaFin.error) return { error: fechaFin.error };
  const db = await planillasDb();
  const { data: actual, error: loadError } = await db
    .from("vida_ley")
    .select("estado")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  const payload = {
    relacion_id: relacionId,
    entidad_id: gate.trabajador.entidad_id,
    estado: actual?.estado ?? null,
    numero_poliza: String(formData.get("numero_poliza") ?? "").trim() || null,
    fecha_inicio: fechaInicio.value,
    fecha_fin: fechaFin.value,
  };
  const { error } = await db.from("vida_ley").upsert(payload, { onConflict: "relacion_id" });
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  revalidatePath("/vida-ley");
  return {};
}

export async function marcarFacturaLoteNoEnviada(relacionId: string): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { data: actual, error: loadError } = await db
    .from("vida_ley")
    .select("lote_id")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  const loteId = actual?.lote_id as string | null | undefined;
  if (!loteId) return { error: "Elabore el trámite de Vida Ley antes de marcar la factura." };
  const { error } = await db.from("vida_ley_lotes").update({ factura_no_enviada: true }).eq("id", loteId);
  if (error) return { error: error.message };
  const { data: miembros, error: miembrosError } = await db
    .from("vida_ley")
    .select("relacion_id")
    .eq("lote_id", loteId);
  if (miembrosError) return { error: miembrosError.message };
  revalidarFichasVidaLey((miembros ?? []).map((row) => row.relacion_id as string));
  return {};
}

export async function setEstadoVidaLey(
  relacionId: string,
  estado: "Recepcionado" | "Registrado",
): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { data: actual, error: loadError } = await db
    .from("vida_ley")
    .select("lote_id, estado, numero_poliza, fecha_inicio, fecha_fin")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };

  const loteId = actual?.lote_id as string | null | undefined;
  if (!loteId) {
    const estadoActual = actual?.estado?.trim() ?? "";
    if (estado === "Recepcionado" && estadoActual === "Registrado") return {};
    const { error } = await db.from("vida_ley").upsert(
      {
        relacion_id: relacionId,
        entidad_id: gate.trabajador.entidad_id,
        estado,
        numero_poliza: actual?.numero_poliza ?? null,
        fecha_inicio: actual?.fecha_inicio ?? null,
        fecha_fin: actual?.fecha_fin ?? null,
      },
      { onConflict: "relacion_id" },
    );
    if (error) return { error: error.message };
    revalidarFichasVidaLey([relacionId]);
    return {};
  }

  const { data: miembros, error: miembrosError } = await db
    .from("vida_ley")
    .select("relacion_id, entidad_id, estado, numero_poliza, fecha_inicio, fecha_fin")
    .eq("lote_id", loteId);
  if (miembrosError) return { error: miembrosError.message };
  const payload = (miembros ?? [])
    .filter((row) => !(estado === "Recepcionado" && String(row.estado ?? "").trim() === "Registrado"))
    .map((row) => ({
      relacion_id: row.relacion_id as string,
      entidad_id: row.entidad_id as string,
      lote_id: loteId,
      estado,
      numero_poliza: (row.numero_poliza as string | null) ?? null,
      fecha_inicio: (row.fecha_inicio as string | null) ?? null,
      fecha_fin: (row.fecha_fin as string | null) ?? null,
    }));
  if (payload.length > 0) {
    const { error } = await db.from("vida_ley").upsert(payload, { onConflict: "relacion_id" });
    if (error) return { error: error.message };
  }
  revalidarFichasVidaLey((miembros ?? []).map((row) => row.relacion_id as string));
  return {};
}

export async function listVidaLeyEmpresa(entidadId: string): Promise<
  {
    trabajador: TrabajadorListItem;
    registro: {
      estado: string | null;
      numero_poliza: string | null;
      fecha_inicio: string | null;
      fecha_fin: string | null;
    } | null;
  }[]
> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) return [];
  const trabajadores = (await listTrabajadores(entidadId)).filter((t) => t.validacion !== "PENDIENTE");
  if (trabajadores.length === 0) return [];
  const db = await planillasDb();
  const { data, error } = await db
    .from("vida_ley")
    .select("relacion_id, estado, numero_poliza, fecha_inicio, fecha_fin")
    .in(
      "relacion_id",
      trabajadores.map((t) => t.id),
    );
  if (error) throw new Error(error.message);
  const registroPorRelacion = new Map(
    (data ?? []).map((row) => [
      row.relacion_id as string,
      {
        estado: (row.estado as string | null) ?? null,
        numero_poliza: (row.numero_poliza as string | null) ?? null,
        fecha_inicio: (row.fecha_inicio as string | null) ?? null,
        fecha_fin: (row.fecha_fin as string | null) ?? null,
      },
    ]),
  );
  return trabajadores.map((trabajador) => ({
    trabajador,
    registro: registroPorRelacion.get(trabajador.id) ?? null,
  }));
}

export async function listTrabajadoresVidaLeyPendienteRecepcion(
  entidadId: string,
): Promise<TrabajadorListItem[]> {
  const items = await listVidaLeyEmpresa(entidadId);
  return items
    .filter(
      (item) =>
        altasAfiliacionListas(flujoDesdeTrabajador(item.trabajador)) &&
        vidaLeyPendienteRecepcion(item.registro?.estado),
    )
    .map((item) => item.trabajador);
}

async function marcarVidaLeyElaborado(trabajadores: TrabajadorListItem[]): Promise<{ error?: string }> {
  if (trabajadores.length === 0) return { error: "No hay trabajadores para el trámite Vida Ley." };
  const db = await planillasDb();
  const ids = trabajadores.map((t) => t.id);
  const entidades = new Set(trabajadores.map((t) => t.entidad_id));
  if (entidades.size !== 1) return { error: "El envío de Vida Ley debe ser de una sola empresa." };
  const { data: existentes, error: loadError } = await db
    .from("vida_ley")
    .select("relacion_id, estado, numero_poliza, fecha_inicio, fecha_fin, lote_id")
    .in("relacion_id", ids);
  if (loadError) return { error: loadError.message };
  const actualPorId = new Map((existentes ?? []).map((row) => [row.relacion_id as string, row]));
  const hoy = new Date().toISOString().slice(0, 10);
  const payload = trabajadores.map((t) => {
    const actual = actualPorId.get(t.id);
    const inicio = actual?.fecha_inicio ?? t.fecha_ingreso ?? hoy;
    const estadoActual = String(actual?.estado ?? "").trim();
    return {
      relacion_id: t.id,
      entidad_id: t.entidad_id,
      lote_id: (actual?.lote_id as string | null) ?? null,
      estado: vidaLeyPendienteRecepcion(estadoActual) ? "Elaborado" : estadoActual,
      numero_poliza: actual?.numero_poliza ?? null,
      fecha_inicio: inicio,
      fecha_fin: actual?.fecha_fin ?? fechaFinPeriodoVidaLey(t.fecha_ingreso ?? inicio),
    };
  });
  const { error } = await db.from("vida_ley").upsert(payload, { onConflict: "relacion_id" });
  if (error) return { error: error.message };
  revalidarFichasVidaLey(ids);
  return {};
}

export async function generarVidaLey(relacionId: string): Promise<{ error?: string }> {
  const gate = await assertEscrituraTramite(relacionId);
  if ("error" in gate) return { error: gate.error };
  return marcarVidaLeyElaborado([gate.trabajador]);
}

export async function generarVidaLeyGrupo(
  entidadId: string,
): Promise<{ error?: string; ids?: string[]; count?: number }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) return { error: "No tiene permiso para editar." };
  const pendientes = await listTrabajadoresVidaLeyPendienteRecepcion(entidadId);
  if (pendientes.length === 0) {
    return { error: "No hay trabajadores pendientes de recepción de Vida Ley." };
  }
  const marked = await marcarVidaLeyElaborado(pendientes);
  if (marked.error) return { error: marked.error };
  return { ids: pendientes.map((t) => t.id), count: pendientes.length };
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
  revalidatePath("/");
  revalidatePath("/contratos");
  revalidatePath("/pendientes");
  return {};
}
