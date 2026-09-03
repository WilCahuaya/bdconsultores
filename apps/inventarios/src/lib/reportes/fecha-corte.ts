import { parseFechaDDMMYYYY } from "@inventario/types";
import { esReporteAdquiridosEjercicio } from "./ejercicio";
import type { ReporteId } from "./types";

/** Normaliza fecha de corte a AAAA-MM-DD (ISO). */
export function resolverFechaCorteISO(fechaCorte?: string): string | null {
  if (!fechaCorte?.trim()) return null;
  const trimmed = fechaCorte.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return parseFechaDDMMYYYY(trimmed);
}

/** Reportes de inventario que excluyen bienes adquiridos después de la fecha de corte. */
export function aplicaFiltroAdquisicionFechaCorte(
  reporteId: ReporteId,
  fechaCorte?: string,
): boolean {
  return Boolean(resolverFechaCorteISO(fechaCorte)) && !esReporteAdquiridosEjercicio(reporteId);
}

export function activoIncluidoEnFechaCorte(
  activo: { fecha_adquisicion: string | null },
  fechaCorteISO: string,
): boolean {
  if (!activo.fecha_adquisicion) return true;
  return activo.fecha_adquisicion.slice(0, 10) <= fechaCorteISO;
}

export function filtrarActivosPorFechaCorte<T extends { fecha_adquisicion: string | null }>(
  activos: T[],
  reporteId: ReporteId,
  fechaCorte?: string,
): T[] {
  const corteISO = resolverFechaCorteISO(fechaCorte);
  if (!corteISO || !aplicaFiltroAdquisicionFechaCorte(reporteId, fechaCorte)) {
    return activos;
  }
  return activos.filter((a) => activoIncluidoEnFechaCorte(a, corteISO));
}
