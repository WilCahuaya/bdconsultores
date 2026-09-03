import type { ReporteId } from "./types";

export function esReporteAdquiridosEjercicio(reporteId: ReporteId): boolean {
  return (
    reporteId === "reporte_adquiridos_ejercicio_actual" ||
    reporteId === "reporte_adquiridos_ejercicio_anterior"
  );
}

/** Año de referencia a partir de fecha de corte ISO (AAAA-MM-DD) o DD/MM/AAAA. */
export function anioReferenciaDesdeFechaCorte(fechaCorte?: string): number {
  if (fechaCorte) {
    const iso = fechaCorte.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return Number(iso[1]);
    const dmy = fechaCorte.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmy) return Number(dmy[3]);
  }
  return new Date().getFullYear();
}

export function anioEjercicioAdquisicion(
  reporteId: ReporteId,
  fechaCorte?: string,
): number | null {
  const ref = anioReferenciaDesdeFechaCorte(fechaCorte);
  if (reporteId === "reporte_adquiridos_ejercicio_actual") return ref;
  if (reporteId === "reporte_adquiridos_ejercicio_anterior") return ref - 1;
  return null;
}

export function rangoFechasEjercicio(anio: number): { desde: string; hasta: string } {
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
}

export function tituloReporteAdquiridosEjercicio(
  reporteId: ReporteId,
  fechaCorte?: string,
): string {
  const anio = anioEjercicioAdquisicion(reporteId, fechaCorte);
  if (anio == null) return "REPORTE DE ACTIVOS ADQUIRIDOS";
  return `REPORTE DE ACTIVOS ADQUIRIDOS EN EL EJERCICIO ${anio}`;
}
