import {
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
  return resumen.map((r) => [
    r.categoria || r.cuenta,
    String(r.cantidad),
    r.valorAdquisicion.toFixed(2),
    r.depreciacionAcumulada.toFixed(2),
    r.valorNeto.toFixed(2),
  ]);
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
