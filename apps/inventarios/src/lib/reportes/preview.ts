import { estadoBienLabel, formatMonedaPE } from "@inventario/types";
import type { ActivoReporte, ReporteId } from "./types";
import { buildValorizacionTotales } from "./summary";
import { esReporteInventarioValorizado } from "./rows";

export const REPORTE_PREVIEW_MAX_ROWS = 50;

export interface ReporteResumenGrupo {
  label: string;
  count: number;
}

export interface ReporteResumenPreview {
  total: number;
  porEstado: ReporteResumenGrupo[];
  porUbicacion: ReporteResumenGrupo[];
  valorizacion?: {
    valorAdquisicion: string;
    depreciacionAcumulada: string;
    valorNeto: string;
  };
}

function gruposDesdeMap(map: Map<string, number>, limit?: number): ReporteResumenGrupo[] {
  const items = [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return limit != null ? items.slice(0, limit) : items;
}

export function buildReporteResumenPreview(
  activos: ActivoReporte[],
  reporteId: ReporteId,
  fechaCorte?: string,
): ReporteResumenPreview {
  const porEstado = new Map<string, number>();
  const porUbicacion = new Map<string, number>();

  for (const activo of activos) {
    const estado = estadoBienLabel(activo.estado_bien);
    porEstado.set(estado, (porEstado.get(estado) ?? 0) + 1);

    const ubicacion =
      [activo.entidad_nombre, activo.sede_nombre, activo.ambiente_nombre]
        .filter(Boolean)
        .join(" · ") || "Sin ubicación";
    porUbicacion.set(ubicacion, (porUbicacion.get(ubicacion) ?? 0) + 1);
  }

  const resumen: ReporteResumenPreview = {
    total: activos.length,
    porEstado: gruposDesdeMap(porEstado),
    porUbicacion: gruposDesdeMap(porUbicacion, 8),
  };

  if (esReporteInventarioValorizado(reporteId) && fechaCorte) {
    const totales = buildValorizacionTotales(activos, new Date(`${fechaCorte}T12:00:00`));
    resumen.valorizacion = {
      valorAdquisicion: formatMonedaPE(totales.valorAdquisicion),
      depreciacionAcumulada: formatMonedaPE(totales.depreciacionAcumulada),
      valorNeto: formatMonedaPE(totales.valorNeto),
    };
  }

  return resumen;
}
