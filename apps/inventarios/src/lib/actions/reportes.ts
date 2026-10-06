"use server";

import type { EstadoRegistro } from "@inventario/types";
import { attachCatalogoNacionalPorCodigo, resolveCuentaContableActivo } from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { getProfile, requireProfile } from "@/lib/auth/profile";
import type { ActivoReporte, ReporteId } from "@/lib/reportes/types";
import { REPORTES, reportePermitidoParaRol } from "@/lib/reportes/types";
import { listProcedenciaFaltante } from "@/lib/actions/visitas-campo";
import {
  anioEjercicioAdquisicion,
  esReporteAdquiridosEjercicio,
  rangoFechasEjercicio,
} from "@/lib/reportes/ejercicio";
import {
  aplicaFiltroAdquisicionFechaCorte,
  filtrarActivosPorFechaCorte,
  resolverFechaCorteISO,
} from "@/lib/reportes/fecha-corte";

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

export interface CargarActivosReporteInput {
  reporteId: string;
  entidadId: string;
  ambienteId?: string;
  sedeId?: string;
  /** AAAA-MM-DD o DD/MM/AAAA; usada en reportes por ejercicio de adquisición. */
  fechaCorte?: string;
}

export async function cargarActivosReporte(
  input: CargarActivosReporteInput,
): Promise<{ data?: ActivoReporte[]; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };

  if (!input.entidadId) return { error: "Seleccione una entidad." };

  if (profile.rol === "ADMIN_ENTIDAD" && profile.entidad_id !== input.entidadId) {
    return { error: "No autorizado para esta entidad." };
  }

  if (!reportePermitidoParaRol(input.reporteId as ReporteId, profile.rol)) {
    return { error: "Este reporte no está disponible para su rol." };
  }

  const supabase = await createClient();
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
  } else if (input.reporteId === "reporte_faltantes") {
    const { data: ambienteFaltante } = await supabase
      .from("ambientes")
      .select("id, sedes!inner(entidad_id)")
      .eq("es_faltante", true)
      .eq("activo", true)
      .eq("sedes.entidad_id", input.entidadId)
      .maybeSingle();
    if (!ambienteFaltante?.id) return { data: [] };
    query = query
      .eq("ambiente_id", ambienteFaltante.id)
      .eq("estado_registro", "REGISTRADO" as EstadoRegistro);
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
  if (error) return { error: error.message };

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
  if (input.reporteId === "reporte_faltantes" && activos.length > 0) {
    const procedencia = await listProcedenciaFaltante(activos.map((activo) => activo.id));
    activos = activos.map((activo) => ({
      ...activo,
      procedencia: procedencia[activo.id] ?? null,
    }));
  }

  return { data: activos };
}

export async function getEntidadesParaReportes() {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (profile.rol === "ADMIN_ENTIDAD") {
    const { data } = await supabase
      .from("entidades")
      .select("*")
      .eq("id", profile.entidad_id!)
      .eq("activo", true)
      .eq("usa_inventarios", true)
      .maybeSingle();
    return data ? [data] : [];
  }

  if (profile.rol !== "CONTADOR") {
    throw new Error("FORBIDDEN");
  }

  const { data, error } = await supabase
    .from("entidades")
    .select("*")
    .eq("activo", true)
    .eq("usa_inventarios", true)
    .order("nombre");

  if (error) throw new Error(error.message);
  return data ?? [];
}
