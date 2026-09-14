"use server";

import { revalidatePath } from "next/cache";
import { entidadAlcance, puedeEditarFichaLaboral, requirePlanillasProfile } from "@/lib/auth/access";
import { getTrabajador } from "@/lib/actions/trabajadores";
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
};

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
    .select("id, relacion_id, entidad_id, periodo, fecha_inicio, fecha_fin, dias, estado, observaciones")
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
    .select("id, relacion_id, entidad_id, periodo, fecha_inicio, fecha_fin, dias, estado, observaciones")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .order("fecha_inicio", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VacacionRow[];
}

export async function addVacacion(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para registrar vacaciones." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };

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
  });
  if (error) return { error: error.message };
  revalidateVacaciones(relacionId);
  return {};
}

export async function deleteVacacion(relacionId: string, vacacionId: string): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para quitar vacaciones." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };
  const db = await planillasDb();
  const { error } = await db.from("vacaciones").delete().eq("id", vacacionId).eq("relacion_id", relacionId);
  if (error) return { error: error.message };
  revalidateVacaciones(relacionId);
  return {};
}
