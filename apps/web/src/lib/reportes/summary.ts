import {
  agruparClasificacionResumenPorTipo,
  buildClasificacionResumen as buildClasificacionResumenCore,
  buildValorizacionTotales as buildValorizacionTotalesCore,
  resolveCuentaContableActivo,
  type ActivoValorizacionFuente,
} from "@inventario/types";
import type { ActivoReporte, ClasificacionResumen, ValorizacionTotales } from "./types";

function activoReporteAValorizacion(activo: ActivoReporte): ActivoValorizacionFuente {
  const resolved = resolveCuentaContableActivo(activo, {
    cuenta_codigo: activo.cuenta_contable ?? null,
    contabilidad: activo.contabilidad ?? null,
  });
  return {
    ...activo,
    cuenta_codigo: resolved.cuenta_codigo,
    contabilidad: resolved.contabilidad,
  };
}

/** @deprecated Usar ClasificacionResumen de @inventario/types (campo `categoria`). */
export type ClasificacionResumenReporte = ClasificacionResumen & {
  cuenta: string;
  grupo: string;
};

export function buildValorizacionTotales(
  activos: ActivoReporte[],
  fechaCorte: Date,
): ValorizacionTotales {
  return buildValorizacionTotalesCore(
    activos.map(activoReporteAValorizacion),
    fechaCorte,
  );
}

export function buildClasificacionResumen(
  activos: ActivoReporte[],
  fechaCorte: Date,
): ClasificacionResumen[] {
  return buildClasificacionResumenCore(
    activos.map(activoReporteAValorizacion),
    fechaCorte,
  );
}

export function clasificacionToRows(resumen: ClasificacionResumen[]): string[][] {
  const secciones = agruparClasificacionResumenPorTipo(resumen);
  const rows: string[][] = [];

  for (const seccion of secciones) {
    rows.push([seccion.label, "", "", "", ""]);
    for (const r of seccion.filas) {
      rows.push([
        r.categoria || r.cuenta,
        String(r.cantidad),
        r.valorAdquisicion.toFixed(2),
        r.depreciacionAcumulada.toFixed(2),
        r.valorNeto.toFixed(2),
      ]);
    }
    rows.push([
      `Total ${seccion.label}`,
      String(seccion.subtotal.cantidad),
      seccion.subtotal.valorAdquisicion.toFixed(2),
      seccion.subtotal.depreciacionAcumulada.toFixed(2),
      seccion.subtotal.valorNeto.toFixed(2),
    ]);
  }

  return rows;
}

export function clasificacionTotalRow(totales: ValorizacionTotales): string[] {
  return [
    "TOTAL",
    String(totales.cantidad),
    totales.valorAdquisicion.toFixed(2),
    totales.depreciacionAcumulada.toFixed(2),
    totales.valorNeto.toFixed(2),
  ];
}

export const CLASIFICACION_HEADERS = [
  "Cuenta contable",
  "Cantidad",
  "Valor adquisición",
  "Dep. acumulada",
  "Valor neto",
] as const;

/** Fila de título de sección (Activo / Cuenta de orden) o subtotal de sección. */
export function isClasificacionSectionOrSubtotalRow(row: string[]): boolean {
  const label = row[0]?.trim() ?? "";
  if (!label) return false;
  if (label === "Activo" || label === "Cuenta de orden") return true;
  return label.startsWith("Total Activo") || label.startsWith("Total Cuenta de orden");
}

export function isClasificacionSectionTitleRow(row: string[]): boolean {
  const label = row[0]?.trim() ?? "";
  return label === "Activo" || label === "Cuenta de orden";
}
