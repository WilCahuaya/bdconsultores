import { plantillaReporte, type ReporteId } from "./types";

export function esReporteAdquiridosEjercicio(reporteId: ReporteId): boolean {
  const plantilla = plantillaReporte(reporteId);
  return plantilla === "ejercicio_actual" || plantilla === "ejercicio_anterior";
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
  const plantilla = plantillaReporte(reporteId);
  if (plantilla === "ejercicio_actual") return ref;
  if (plantilla === "ejercicio_anterior") return ref - 1;
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
  if (anio == null) return "BIENES ADQUIRIDOS";
  return `BIENES ADQUIRIDOS EN EL EJERCICIO ${anio}`;
}
