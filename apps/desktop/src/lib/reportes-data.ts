import type { EstadoRegistro } from "@inventario/types";
import { attachCatalogoNacionalPorCodigo, resolveCuentaContableActivo } from "@inventario/types";
import { REPORTES } from "@reportes/types";
import type { ActivoReporte } from "@reportes/types";
import {
  anioEjercicioAdquisicion,
  esReporteAdquiridosEjercicio,
  rangoFechasEjercicio,
} from "@reportes/ejercicio";
import {
  aplicaFiltroAdquisicionFechaCorte,
  filtrarActivosPorFechaCorte,
  resolverFechaCorteISO,
} from "@reportes/fecha-corte";
import type { ReporteId } from "@reportes/types";
import type { ActivoConUbicacion } from "./activos";
import { isOnline } from "./master-cache";
import { listCachedActivos } from "./offline";
import { getSupabaseClient } from "./supabase";

function esReportePorAmbiente(reporteId: string): boolean {
  const def = REPORTES.find((r) => r.id === reporteId);
  return def?.scope === "ambiente";
}

function mapActivoReporteRows(data: Record<string, unknown>[] | null): ActivoReporte[] {
  return (data ?? []).map((row) => {
    const entidades = row.entidades as { nombre: string } | null;
    const sedes = row.sedes as { nombre: string } | null;
    const ambientes = row.ambientes as { nombre: string; responsable?: string | null } | null;
    const catalogo = row.catalogo_nacional as
      | { cuenta_codigo: string | null; contabilidad: string | null; grupo: string | null }
      | null
      | Array<{ cuenta_codigo: string | null; contabilidad: string | null; grupo: string | null }>;
    const cat = Array.isArray(catalogo) ? catalogo[0] : catalogo;
    const { entidades: _e, sedes: _s, ambientes: _a, catalogo_nacional: _c, ...activo } = row;
    const activoBase = activo as unknown as ActivoReporte;
    const cuenta = resolveCuentaContableActivo(activoBase, cat);
    return {
      ...activoBase,
      entidad_nombre: entidades?.nombre,
      sede_nombre: sedes?.nombre,
      ambiente_nombre: ambientes?.nombre,
      cuenta_contable: cuenta.cuenta_codigo,
      contabilidad: cuenta.contabilidad,
      grupo_contable: cat?.grupo ?? null,
    };
  });
}

function mapCachedActivoToReporte(activo: ActivoConUbicacion): ActivoReporte {
  const cat =
    activo.cuenta_codigo ||
    activo.contabilidad ||
    activo.cuenta_contable_codigo ||
    activo.catalogo_grupo
      ? {
          cuenta_codigo: activo.cuenta_codigo ?? activo.cuenta_contable_codigo ?? null,
          contabilidad: activo.contabilidad ?? activo.cuenta_contable_nombre ?? null,
          grupo: activo.catalogo_grupo ?? null,
        }
      : null;
  const cuenta = resolveCuentaContableActivo(activo, cat);
  return {
    ...activo,
    entidad_nombre: activo.entidad_nombre,
    sede_nombre: activo.sede_nombre,
    ambiente_nombre: activo.ambiente_nombre,
    cuenta_contable: cuenta.cuenta_codigo,
    contabilidad: cuenta.contabilidad,
    grupo_contable: activo.catalogo_grupo ?? cat?.grupo ?? null,
  };
}

function sortActivosReporte(a: ActivoReporte, b: ActivoReporte): number {
  const catCmp = (a.codigo_catalogo ?? "").localeCompare(b.codigo_catalogo ?? "");
  if (catCmp !== 0) return catCmp;
  return (a.correlativo ?? 0) - (b.correlativo ?? 0);
}

function filtrarActivosReporteCache(
  activos: ActivoReporte[],
  input: CargarActivosReporteInput,
): ActivoReporte[] {
  let filtered = activos;

  if (esReportePorAmbiente(input.reporteId)) {
    if (input.sedeId) {
      filtered = filtered.filter((a) => a.sede_id === input.sedeId);
    }
    if (input.ambienteId) {
      filtered = filtered.filter((a) => a.ambiente_id === input.ambienteId);
    }
  }

  if (input.reporteId === "reporte_bajas") {
    filtered = filtered.filter((a) => a.estado_registro === ("DADO_DE_BAJA" as EstadoRegistro));
  } else if (input.reporteId === "reporte_activos_estado_malo") {
    filtered = filtered.filter(
      (a) => a.estado_registro === ("REGISTRADO" as EstadoRegistro) && a.estado_bien === "MALO",
    );
  } else if (esReporteAdquiridosEjercicio(input.reporteId as ReporteId)) {
    const anio = anioEjercicioAdquisicion(input.reporteId as ReporteId, input.fechaCorte);
    if (anio == null) return [];
    const { desde, hasta } = rangoFechasEjercicio(anio);
    filtered = filtered.filter(
      (a) =>
        a.estado_registro === ("REGISTRADO" as EstadoRegistro) &&
        a.fecha_adquisicion != null &&
        a.fecha_adquisicion >= desde &&
        a.fecha_adquisicion <= hasta,
    );
  } else {
    filtered = filtered.filter((a) => a.estado_registro === ("REGISTRADO" as EstadoRegistro));
  }

  const corteISO = resolverFechaCorteISO(input.fechaCorte);
  if (
    corteISO &&
    aplicaFiltroAdquisicionFechaCorte(input.reporteId as ReporteId, input.fechaCorte)
  ) {
    filtered = filtered.filter(
      (a) => !a.fecha_adquisicion || a.fecha_adquisicion.slice(0, 10) <= corteISO,
    );
  }

  filtered = filtrarActivosPorFechaCorte(filtered, input.reporteId as ReporteId, input.fechaCorte);
  return [...filtered].sort(sortActivosReporte);
}

async function cargarActivosReporteFromCache(
  input: CargarActivosReporteInput,
): Promise<ActivoReporte[]> {
  const cached = await listCachedActivos(input.entidadId);
  const activos = cached.map(mapCachedActivoToReporte);
  return filtrarActivosReporteCache(activos, input);
}

export interface CargarActivosReporteInput {
  reporteId: string;
  entidadId: string;
  ambienteId?: string;
  sedeId?: string;
  fechaCorte?: string;
}

export async function cargarActivosReporte(
  input: CargarActivosReporteInput,
): Promise<{ data?: ActivoReporte[]; error?: string }> {
  if (!input.entidadId) return { error: "Seleccione una entidad." };

  if (!isOnline()) {
    return { data: await cargarActivosReporteFromCache(input) };
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from("activos")
    .select(
      "*, entidades(nombre), sedes:sede_id(nombre), ambientes:ambiente_id(nombre, responsable)",
    )
    .eq("entidad_id", input.entidadId)
    .order("codigo_catalogo")
    .order("correlativo", { ascending: true });

  if (esReportePorAmbiente(input.reporteId)) {
    if (input.sedeId) query = query.eq("sede_id", input.sedeId);
    if (input.ambienteId) query = query.eq("ambiente_id", input.ambienteId);
  }

  if (input.reporteId === "reporte_bajas") {
    query = query.eq("estado_registro", "DADO_DE_BAJA" as EstadoRegistro);
  } else if (input.reporteId === "reporte_activos_estado_malo") {
    query = query
      .eq("estado_registro", "REGISTRADO" as EstadoRegistro)
      .eq("estado_bien", "MALO");
  } else if (esReporteAdquiridosEjercicio(input.reporteId as ReporteId)) {
    const anio = anioEjercicioAdquisicion(
      input.reporteId as ReporteId,
      input.fechaCorte,
    );
    if (anio == null) {
      return { error: "Reporte de ejercicio no válido." };
    }
    const { desde, hasta } = rangoFechasEjercicio(anio);
    query = query
      .eq("estado_registro", "REGISTRADO" as EstadoRegistro)
      .not("fecha_adquisicion", "is", null)
      .gte("fecha_adquisicion", desde)
      .lte("fecha_adquisicion", hasta);
  } else {
    query = query.eq("estado_registro", "REGISTRADO" as EstadoRegistro);
  }

  const corteISO = resolverFechaCorteISO(input.fechaCorte);
  if (corteISO && aplicaFiltroAdquisicionFechaCorte(input.reporteId as ReporteId, input.fechaCorte)) {
    query = query.or(`fecha_adquisicion.is.null,fecha_adquisicion.lte.${corteISO}`);
  }

  const { data, error } = await query;
  if (error) {
    const cached = await cargarActivosReporteFromCache(input);
    if (cached.length > 0) return { data: cached };
    return { error: error.message };
  }

  const conCatalogo = await attachCatalogoNacionalPorCodigo(
    supabase,
    data as Record<string, unknown>[],
  );
  let activos = mapActivoReporteRows(conCatalogo);
  activos = filtrarActivosPorFechaCorte(
    activos,
    input.reporteId as ReporteId,
    input.fechaCorte,
  );

  return { data: activos };
}

export type { ActivoReporte, ReporteFormato, ReporteId } from "@reportes/types";
export {
  REPORTES,
  REPORTE_PREVIEW_MAX_ROWS,
  buildReporteResumenPreview,
  buildReporteRows,
  esReporteAdquiridosEjercicio,
  exportReporte,
  reporteHeaders,
  reportesDisponiblesParaRol,
  reportesAmbienteParaRol,
} from "@reportes";
