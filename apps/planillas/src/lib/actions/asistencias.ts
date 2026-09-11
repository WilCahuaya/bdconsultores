"use server";

import { revalidatePath } from "next/cache";
import type { EstadoDocumentoPlanilla, TipoDocumentoPlanilla } from "@inventario/types";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { getTrabajador, listTrabajadores, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { puedeEditarFichaLaboral, requirePlanillasProfile } from "@/lib/auth/access";
import { nombreCompleto } from "@/lib/planillas-labels";
import { esMesAsistencia, trabajadorActivoEnMes } from "@/lib/horario-asistencia";
import type { AsistenciaExcelEmpresa, AsistenciaExcelTrabajador } from "@/lib/asistencia-excel";
import { planillasDb } from "@/lib/supabase/planillas";

type ContratoHorario = {
  horario: string | null;
  jornada: string | null;
  es_vigente: boolean;
  version: number;
};

function horarioDeContratos(contratos: ContratoHorario[], fallback: string | null): string | null {
  const vigente = contratos.find((c) => c.es_vigente);
  const elegido = vigente ?? [...contratos].sort((a, b) => b.version - a.version)[0];
  return elegido?.horario ?? fallback;
}

function aFilaExcel(t: TrabajadorListItem, horario: string | null): AsistenciaExcelTrabajador {
  return {
    nombre: nombreCompleto(t.persona),
    dni: t.persona.dni,
    horario,
    fechaIngreso: t.fecha_ingreso,
    fechaCese: t.fecha_cese,
  };
}

export async function datosAsistenciaEmpresa(
  entidadId: string,
  mes: string,
): Promise<{ error?: string; empresa?: AsistenciaExcelEmpresa; trabajadores?: AsistenciaExcelTrabajador[] }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para generar asistencia." };
  if (!esMesAsistencia(mes)) return { error: "Indique el mes (AAAA-MM)." };
  const empresa = await getEntidadPlanillas(entidadId);
  if (!empresa) return { error: "Empresa no encontrada." };
  const trabajadores = await listTrabajadores(entidadId);
  const db = await planillasDb();
  const ids = trabajadores.map((t) => t.id);
  const { data: contratos, error } = ids.length
    ? await db
        .from("contratos")
        .select("relacion_id, horario, jornada, es_vigente, version")
        .in("relacion_id", ids)
    : { data: [], error: null };
  if (error) return { error: error.message };
  const porRelacion = new Map<string, ContratoHorario[]>();
  for (const row of contratos ?? []) {
    const lista = porRelacion.get(row.relacion_id) ?? [];
    lista.push({
      horario: row.horario,
      jornada: row.jornada,
      es_vigente: row.es_vigente,
      version: row.version,
    });
    porRelacion.set(row.relacion_id, lista);
  }
  const filas = trabajadores
    .filter((t) => trabajadorActivoEnMes(mes, t.fecha_ingreso, t.fecha_cese))
    .map((t) => aFilaExcel(t, horarioDeContratos(porRelacion.get(t.id) ?? [], t.horario)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  if (filas.length === 0) return { error: "No hay trabajadores activos en ese mes." };
  return {
    empresa: { nombre: empresa.nombre, ruc: empresa.ruc, direccion: empresa.direccion ?? null },
    trabajadores: filas,
  };
}

export async function datosAsistenciaTrabajador(
  relacionId: string,
  mes: string,
): Promise<{ error?: string; empresa?: AsistenciaExcelEmpresa; trabajador?: AsistenciaExcelTrabajador }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para generar asistencia." };
  if (!esMesAsistencia(mes)) return { error: "Indique el mes (AAAA-MM)." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };
  if (!trabajadorActivoEnMes(mes, trabajador.fecha_ingreso, trabajador.fecha_cese)) {
    return { error: "Este trabajador no estuvo activo en ese mes." };
  }
  const empresa = await getEntidadPlanillas(trabajador.entidad_id);
  if (!empresa) return { error: "Empresa no encontrada." };
  const db = await planillasDb();
  const { data: contratos, error } = await db
    .from("contratos")
    .select("horario, jornada, es_vigente, version")
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };
  return {
    empresa: { nombre: empresa.nombre, ruc: empresa.ruc, direccion: empresa.direccion ?? null },
    trabajador: aFilaExcel(
      trabajador,
      horarioDeContratos((contratos ?? []) as ContratoHorario[], trabajador.horario),
    ),
  };
}

export async function listDocumentosAsistenciaMes(
  entidadId: string,
  mes: string,
): Promise<{ relacion_id: string; id: string; storage_path: string | null; estado: string }[]> {
  await requirePlanillasProfile();
  const trabajadores = await listTrabajadores(entidadId);
  const ids = trabajadores.map((t) => t.id);
  if (ids.length === 0) return [];
  const db = await planillasDb();
  const { data, error } = await db
    .from("documentos")
    .select("id, storage_path, estado, relacion_id")
    .eq("tipo", "ASISTENCIA")
    .eq("observaciones", mes)
    .in("relacion_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as { relacion_id: string; id: string; storage_path: string | null; estado: string }[];
}

export async function asegurarDocumentoAsistenciaMes(
  relacionId: string,
  mes: string,
): Promise<{ error?: string; documentoId?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para guardar asistencia." };
  if (!esMesAsistencia(mes)) return { error: "Indique el mes (AAAA-MM)." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };
  const db = await planillasDb();
  const { data: existente, error: loadError } = await db
    .from("documentos")
    .select("id")
    .eq("relacion_id", relacionId)
    .eq("tipo", "ASISTENCIA")
    .eq("observaciones", mes)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (existente) return { documentoId: existente.id };
  const { data: creado, error } = await db
    .from("documentos")
    .insert({
      relacion_id: relacionId,
      tipo: "ASISTENCIA" as TipoDocumentoPlanilla,
      estado: "PENDIENTE" as EstadoDocumentoPlanilla,
      observaciones: mes,
    })
    .select("id")
    .single();
  if (error || !creado) return { error: error?.message ?? "No se pudo registrar la asistencia." };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/asistencias");
  return { documentoId: creado.id };
}
