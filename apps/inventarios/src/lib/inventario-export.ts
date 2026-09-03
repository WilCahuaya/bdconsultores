import type { Activo } from "@inventario/types";
import { exportReporte, type ActivoReporte, type ReporteId } from "@/lib/reportes";

/** @deprecated Use exportReporte from @/lib/reportes */
export const INVENTARIO_EXPORT_HEADERS = [
  "N°",
  "Cant.",
  "Und.",
  "Cat.",
  "Código",
  "Corr.",
  "Nombre del bien",
  "Descripción",
  "Fecha adq.",
  "Estado",
  "Precio adq.",
  "V. mercado",
  "% Deprec.",
  "Periodo",
  "Dep. acum.",
  "Valor neto",
  "Observación",
  "CP",
] as const;

export interface InventarioExportMeta {
  ambienteNombre: string;
  responsable?: string | null;
  responsableDni?: string | null;
  sedeNombre?: string | null;
  adminNombre?: string | null;
  adminDni?: string | null;
  entidadNombre?: string;
  usuarioNombre?: string;
  usuarioEmail?: string;
  fechaCorte?: string;
}

function isExportacionGlobal(meta: InventarioExportMeta): boolean {
  return meta.ambienteNombre === "Inventario global" || meta.entidadNombre === "Todas las entidades";
}

function toActivoReporte(activo: Activo, meta: InventarioExportMeta): ActivoReporte {
  const row = activo as ActivoReporte;
  if (isExportacionGlobal(meta)) {
    return {
      ...row,
      entidad_nombre: row.entidad_nombre,
      sede_nombre: row.sede_nombre,
      ambiente_nombre: row.ambiente_nombre,
    };
  }
  return {
    ...row,
    entidad_nombre: meta.entidadNombre ?? row.entidad_nombre,
    ambiente_nombre: meta.ambienteNombre,
    sede_nombre: meta.sedeNombre ?? row.sede_nombre,
  };
}

function pickReporteId(meta: InventarioExportMeta, valorizado: boolean): ReporteId {
  if (isExportacionGlobal(meta)) {
    return valorizado ? "inventario_entidad_valorizado" : "inventario_entidad_activos_fijos";
  }
  return valorizado ? "inventario_ambiente_valorizado" : "inventario_ambiente_sin_valores";
}

function buildContext(meta: InventarioExportMeta, reporteId: ReporteId) {
  const hoy = new Date().toISOString().slice(0, 10);
  const global = isExportacionGlobal(meta);
  return {
    reporteId,
    entidadNombre: meta.entidadNombre ?? "Entidad",
    ambienteNombre: global ? null : meta.ambienteNombre,
    sedeNombre: global ? null : meta.sedeNombre,
    responsable: meta.responsable,
    responsableDni: meta.responsableDni,
    adminNombre: meta.adminNombre,
    adminDni: meta.adminDni,
    usuarioNombre: meta.usuarioNombre ?? "Usuario",
    usuarioEmail: meta.usuarioEmail ?? "",
    fechaGeneracion: new Date(),
    fechaCorte: meta.fechaCorte ?? hoy,
  };
}

export async function exportInventarioExcel(
  activos: Activo[],
  meta: InventarioExportMeta,
  valorizado = true,
): Promise<void> {
  const reporteId = pickReporteId(meta, valorizado);
  const rows = activos.map((a) => toActivoReporte(a, meta));
  await exportReporte("excel", rows, buildContext(meta, reporteId));
}

export async function exportInventarioPdf(
  activos: Activo[],
  meta: InventarioExportMeta,
  valorizado = true,
): Promise<void> {
  const reporteId = pickReporteId(meta, valorizado);
  const rows = activos.map((a) => toActivoReporte(a, meta));
  await exportReporte("pdf", rows, buildContext(meta, reporteId));
}
