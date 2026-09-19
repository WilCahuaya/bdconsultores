"use server";

import { revalidatePath } from "next/cache";
import type { EstadoDocumentoPlanilla, TipoDocumentoPlanilla } from "@inventario/types";
import { entidadAlcance, puedeEditarFichaLaboral, requirePlanillasProfile } from "@/lib/auth/access";
import { getTrabajador } from "@/lib/actions/trabajadores";
import { isUuid } from "@/lib/documento-storage";
import { parseFechaCampo } from "@/lib/planillas-labels";
import { planillasDb } from "@/lib/supabase/planillas";
import {
  ESTADO_VACACION,
  anioActualLima,
  diasCalendario,
  esPeriodoVacacion,
  type EstadoVacacion,
} from "@/lib/vacaciones";

export type VacacionRow = {
  id: string;
  relacion_id: string;
  entidad_id: string;
  periodo: number;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number;
  estado: EstadoVacacion;
  observaciones: string | null;
  documento_id: string | null;
};

const VACACION_SELECT =
  "id, relacion_id, entidad_id, periodo, fecha_inicio, fecha_fin, dias, estado, observaciones, documento_id";

function asEstado(value: string): EstadoVacacion | null {
  return ESTADO_VACACION.includes(value as EstadoVacacion) ? (value as EstadoVacacion) : null;
}

function revalidateVacaciones(relacionId: string) {
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/vacaciones");
  revalidatePath("/pendientes");
}

export async function listVacaciones(relacionId: string): Promise<VacacionRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("vacaciones")
    .select(VACACION_SELECT)
    .eq("relacion_id", relacionId)
    .order("fecha_inicio", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as VacacionRow[];
}

export async function listVacacionesEmpresa(
  entidadId: string,
  periodo = anioActualLima(),
): Promise<VacacionRow[]> {
  const profile = await requirePlanillasProfile();
  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return [];
  const db = await planillasDb();
  const { data, error } = await db
    .from("vacaciones")
    .select(VACACION_SELECT)
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .order("fecha_inicio", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VacacionRow[];
}

export async function crearDocumentoVacacion(
  relacionId: string,
): Promise<{ error?: string; documentoId?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para registrar vacaciones." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };
  const db = await planillasDb();
  const { data, error } = await db
    .from("documentos")
    .insert({
      relacion_id: relacionId,
      tipo: "VACACIONES_FIRMADO" as TipoDocumentoPlanilla,
      estado: "PENDIENTE" as EstadoDocumentoPlanilla,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "No se pudo registrar el documento de vacaciones." };
  return { documentoId: data.id };
}

async function documentoFirmadoListo(
  relacionId: string,
  documentoId: string,
): Promise<{ error?: string } | { ok: true }> {
  const db = await planillasDb();
  const { data, error } = await db
    .from("documentos")
    .select("id, tipo, storage_path, estado")
    .eq("id", documentoId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data || data.tipo !== "VACACIONES_FIRMADO" || !data.storage_path || data.estado !== "SI") {
    return { error: "Suba el documento de respaldo firmado para guardar." };
  }
  const { data: usado, error: usadoError } = await db
    .from("vacaciones")
    .select("id")
    .eq("documento_id", documentoId)
    .maybeSingle();
  if (usadoError) return { error: usadoError.message };
  if (usado) return { error: "Ese documento ya está asociado a otro goce." };
  return { ok: true };
}

export async function addVacacion(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para registrar vacaciones." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };

  const documentoId = String(formData.get("documento_id") ?? "").trim();
  if (!isUuid(documentoId)) return { error: "Suba el documento de respaldo firmado para guardar." };
  const firmado = await documentoFirmadoListo(relacionId, documentoId);
  if ("error" in firmado) return { error: firmado.error };

  const inicio = parseFechaCampo(String(formData.get("fecha_inicio") ?? ""), "Fecha de inicio");
  if (inicio.error || !inicio.value) return { error: inicio.error ?? "Indique la fecha de inicio." };
  const fin = parseFechaCampo(String(formData.get("fecha_fin") ?? ""), "Fecha de fin");
  if (fin.error || !fin.value) return { error: fin.error ?? "Indique la fecha de fin." };
  if (fin.value < inicio.value) return { error: "La fecha de fin no puede ser anterior al inicio." };

  const periodoRaw = String(formData.get("periodo") ?? "").trim();
  const periodo = esPeriodoVacacion(periodoRaw) ? Number(periodoRaw) : Number(inicio.value.slice(0, 4));
  if (!esPeriodoVacacion(periodo)) return { error: "Indique el periodo (año)." };

  const diasRaw = String(formData.get("dias") ?? "").trim();
  const dias = diasRaw ? Number(diasRaw) : diasCalendario(inicio.value, fin.value);
  if (!Number.isInteger(dias) || dias <= 0) return { error: "Los días deben ser un entero mayor a 0." };

  const estado = asEstado(String(formData.get("estado") ?? "PROGRAMADO")) ?? "PROGRAMADO";
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

  const db = await planillasDb();
  const { error } = await db.from("vacaciones").insert({
    relacion_id: relacionId,
    entidad_id: trabajador.entidad_id,
    periodo,
    fecha_inicio: inicio.value,
    fecha_fin: fin.value,
    dias,
    estado,
    observaciones,
    documento_id: documentoId,
  });
  if (error) return { error: error.message };

  await db
    .from("documentos")
    .update({ observaciones: `${inicio.value} – ${fin.value}` })
    .eq("id", documentoId)
    .eq("relacion_id", relacionId);

  revalidateVacaciones(relacionId);
  return {};
}

export async function deleteVacacion(relacionId: string, vacacionId: string): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para quitar vacaciones." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };
  const db = await planillasDb();
  const { data: actual, error: loadError } = await db
    .from("vacaciones")
    .select("id, documento_id")
    .eq("id", vacacionId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!actual) return { error: "Registro de vacaciones no encontrado." };

  const { error } = await db.from("vacaciones").delete().eq("id", vacacionId).eq("relacion_id", relacionId);
  if (error) return { error: error.message };
  if (actual.documento_id) {
    await db.from("documentos").delete().eq("id", actual.documento_id).eq("relacion_id", relacionId);
  }
  revalidateVacaciones(relacionId);
  return {};
}
