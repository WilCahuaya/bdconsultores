import {
  buildDescripcionBien,
  calcPeriodoMesesHasta,
  calcValorizacionActivo,
  categoriaBienCorto,
  estadoBienLabel,
  formatActivoCodigoDisplay,
  formatCorrelativoDisplay,
  formatCuentaContableDisplay,
  formatFechaISOToDDMMYYYY,
  formatMonedaPE,
  resolveFechaInicioDepreciacion,
  valorActivoEfectivo,
} from "@inventario/types";
import { esReporteAmbienteDiseno } from "./ficha-asignacion";
import { esReporteEntidadDiseno } from "./inventario-entidad-diseno";
import { tituloReporteAdquiridosEjercicio, esReporteAdquiridosEjercicio } from "./ejercicio";
import {
  definicionReporte,
  plantillaReporte,
  type ActivoReporte,
  type ReporteId,
  type ReportePlantilla,
  type ValorizacionTotales,
} from "./types";

function esPlantilla(reporteId: ReporteId, ...plantillas: ReportePlantilla[]): boolean {
  return plantillas.includes(plantillaReporte(reporteId));
}

export function esReporteDisenoExtendido(reporteId: ReporteId): boolean {
  return esReporteAmbienteDiseno(reporteId) || esReporteEntidadDiseno(reporteId);
}

export interface ReporteTableHeaderDef {
  key: string;
  line1: string;
  line2?: string;
}

const KEY_NUM = "num";
const KEY_CANT = "cant";
const KEY_PRECIO = "precio_adq";
const KEY_DEP = "dep_acum";
const KEY_NETO = "valor_neto";

export function reporteIncluyeResumenClasificacion(reporteId: ReporteId): boolean {
  return (
    esReporteInventarioValorizado(reporteId) && !esReporteValorizadoTablaAmbiente(reporteId)
  );
}

export function esReporteAmbienteValorizadoDiseno(reporteId: ReporteId): boolean {
  return esPlantilla(reporteId, "valorizado_ambiente");
}

/** Tabla valorizada con columnas del inventario por ambiente (CP después de estado, sin periodo/obs.). */
export function esReporteValorizadoTablaAmbiente(reporteId: ReporteId): boolean {
  return esPlantilla(reporteId, "valorizado_ambiente", "valorizado_entidad");
}

export function esReporteInventarioValorizado(reporteId: ReporteId): boolean {
  return esReporteValorizadoTablaAmbiente(reporteId);
}

export interface ValorizacionTotalesFila {
  cells: string[];
  /** Combina las primeras columnas del pie con la etiqueta TOTAL. */
  totalLabelSpan?: number;
}

export function buildValorizacionTotalesFila(
  headerDefs: readonly ReporteTableHeaderDef[],
  totales: ValorizacionTotales,
  reporteId: ReporteId,
): ValorizacionTotalesFila {
  const row = headerDefs.map(() => "");
  const numIdx = headerDefs.findIndex((h) => h.key === KEY_NUM);
  const cantIdx = headerDefs.findIndex((h) => h.key === KEY_CANT);
  const precioIdx = headerDefs.findIndex((h) => h.key === KEY_PRECIO);
  const depIdx = headerDefs.findIndex((h) => h.key === KEY_DEP);
  const netoIdx = headerDefs.findIndex((h) => h.key === KEY_NETO);
  const esTablaValorizadoAmbiente = esReporteValorizadoTablaAmbiente(reporteId);

  if (esTablaValorizadoAmbiente) {
    if (numIdx >= 0) row[numIdx] = "TOTAL";
  } else {
    if (numIdx >= 0) row[numIdx] = "TOTAL";
    if (cantIdx >= 0) row[cantIdx] = String(totales.cantidad);
  }

  if (precioIdx >= 0 && !esTablaValorizadoAmbiente) {
    row[precioIdx] = `S/ ${formatMonedaPE(totales.valorAdquisicion)}`;
  }
  if (depIdx >= 0) {
    row[depIdx] = `S/ ${formatMonedaPE(totales.depreciacionAcumulada)}`;
  }
  if (netoIdx >= 0) {
    row[netoIdx] = `S/ ${formatMonedaPE(totales.valorNeto)}`;
  }

  return {
    cells: row,
    totalLabelSpan: esTablaValorizadoAmbiente ? 2 : undefined,
  };
}

export type PdfFootCell = string | { content: string; colSpan?: number };

export function buildValorizacionTotalesFilaPdf(
  fila: ValorizacionTotalesFila,
): PdfFootCell[] {
  const span = fila.totalLabelSpan ?? 0;
  if (span < 2) return fila.cells;

  const out: PdfFootCell[] = [{ content: fila.cells[0] || "TOTAL", colSpan: span }];
  for (let i = span; i < fila.cells.length; i++) {
    out.push(fila.cells[i]!);
  }
  return out;
}

const HEADERS_SIN_VALORES_BASE = [
  "N°",
  "Cant.",
  "Und.",
  "Cat.",
  "Código",
  "Corr.",
  "Nombre del bien",
  "Descripción",
] as const;

const HEADERS_SIN_VALORES_COLA = ["Fecha adq.", "Estado", "Observación"] as const;

const HEADERS_VALORIZADOS_BASE = [
  "N°",
  "Cant.",
  "Und.",
  "Cat.",
  "Código",
  "Corr.",
  "Nombre del bien",
  "Descripción",
] as const;

const HEADERS_VALORIZADOS_COLA = [
  "Fecha adq.",
  "Cuenta contable",
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

const HEADERS_AMBIENTE_VALORIZADO: ReporteTableHeaderDef[] = [
  { key: KEY_NUM, line1: "N°" },
  { key: KEY_CANT, line1: "Cant." },
  { key: "und", line1: "Und." },
  { key: "cat", line1: "Cat." },
  { key: "codigo", line1: "Código" },
  { key: "nombre", line1: "Nombre del", line2: "bien" },
  { key: "descripcion", line1: "Descripción" },
  { key: "fecha_adq", line1: "Fecha", line2: "adq." },
  { key: "cuenta_contable", line1: "Cuenta", line2: "contable" },
  { key: "estado", line1: "Estado" },
  { key: "cp", line1: "Comprobante", line2: "de adquisición" },
  { key: KEY_PRECIO, line1: "Precio de", line2: "adquisición" },
  { key: "valor_mercado", line1: "Valor de", line2: "mercado" },
  { key: "pct_deprec", line1: "% de", line2: "depreciación" },
  { key: KEY_DEP, line1: "Depreciación", line2: "acumulada" },
  { key: KEY_NETO, line1: "Valor", line2: "neto" },
];

const HEADERS_ENTIDAD_VALORIZADO: ReporteTableHeaderDef[] = [
  ...HEADERS_AMBIENTE_VALORIZADO,
  { key: "ubicacion", line1: "Sede · Ambiente" },
];

const COLUMNA_UBICACION = "Entidad · Sede · Ambiente" as const;
const COLUMNA_SEDE_AMBIENTE = "Sede · Ambiente" as const;

function esReporteScopeEntidad(reporteId: ReporteId): boolean {
  return definicionReporte(reporteId).scope === "entidad";
}

function columnaUbicacionLabel(reporteId: ReporteId): string {
  return esReporteScopeEntidad(reporteId) ? COLUMNA_SEDE_AMBIENTE : COLUMNA_UBICACION;
}

export function ordenarActivosParaReporte(
  activos: ActivoReporte[],
  reporteId: ReporteId,
): ActivoReporte[] {
  if (!esReporteScopeEntidad(reporteId)) return activos;

  return [...activos].sort((a, b) => {
    const sede = (a.sede_nombre ?? "").localeCompare(b.sede_nombre ?? "", "es", {
      sensitivity: "base",
    });
    if (sede !== 0) return sede;

    const ambiente = (a.ambiente_nombre ?? "").localeCompare(b.ambiente_nombre ?? "", "es", {
      sensitivity: "base",
    });
    if (ambiente !== 0) return ambiente;

    const codigo = (a.codigo_catalogo ?? "").localeCompare(b.codigo_catalogo ?? "", "es", {
      sensitivity: "base",
    });
    if (codigo !== 0) return codigo;

    return (a.correlativo ?? 0) - (b.correlativo ?? 0);
  });
}

/** Reportes por ambiente: la ubicación ya figura en el membrete. */
export function omitUbicacionEnTabla(reporteId: ReporteId): boolean {
  return definicionReporte(reporteId).scope === "ambiente";
}

const HEADERS_BAJAS = [
  "N°",
  "Código",
  "Corr.",
  "Nombre del bien",
  "Motivo de baja",
  "Fecha de baja",
] as const;

const HEADERS_FALTANTES = [
  "N°",
  "Código",
  "Corr.",
  "Nombre del bien",
  "Estado",
  "Viene de",
] as const;

function comprobanteExport(activo: ActivoReporte): string {
  const serie = activo.comprobante_serie?.trim();
  if (!serie && !activo.comprobante_path) return "SIN CP";
  return serie ?? "PDF adjunto";
}

function ubicacionCompletaLabel(activo: ActivoReporte): string {
  return [activo.entidad_nombre, activo.sede_nombre, activo.ambiente_nombre]
    .filter(Boolean)
    .join(" · ") || "—";
}

function ubicacionReporteLabel(activo: ActivoReporte, reporteId: ReporteId): string {
  if (esReporteScopeEntidad(reporteId)) {
    return [activo.sede_nombre, activo.ambiente_nombre].filter(Boolean).join(" · ") || "—";
  }
  return ubicacionCompletaLabel(activo);
}

function valoresMonetariosFila(activo: ActivoReporte, fechaCorte: Date): string[] {
  const valorEfectivo = valorActivoEfectivo(activo.valor_adquisicion, activo.valor_incremento);
  const precioAdq = !activo.valor_es_mercado ? valorEfectivo : null;
  const valorMercado = activo.valor_es_mercado ? valorEfectivo : null;
  const periodo = calcPeriodoMesesHasta(
    resolveFechaInicioDepreciacion(activo.fecha_inicio_depreciacion, activo.fecha_adquisicion),
    fechaCorte,
  );
  const { depreciacionAcumulada: depAcum, valorNeto } = calcValorizacionActivo({
    valor: valorEfectivo,
    vidaUtilMeses: activo.vida_util_meses,
    periodoMeses: periodo,
    categoria: activo.categoria,
    estadoRegistro: activo.estado_registro,
    estadoBien: activo.estado_bien,
  });

  return [
    precioAdq != null ? `S/ ${formatMonedaPE(precioAdq)}` : "—",
    valorMercado != null ? `S/ ${formatMonedaPE(valorMercado)}` : "—",
    activo.depreciacion?.trim() || "—",
    periodo > 0 ? periodo.toFixed(2).replace(".", ",") : "—",
    depAcum != null ? `S/ ${formatMonedaPE(depAcum)}` : "—",
    valorNeto != null ? `S/ ${formatMonedaPE(valorNeto)}` : "—",
  ];
}

function cuentaContableExport(activo: ActivoReporte): string {
  return formatCuentaContableDisplay(activo.cuenta_contable, activo.contabilidad);
}

interface FilaComunOpciones {
  codigoCompleto?: boolean;
  incluirCorr?: boolean;
}

function filaComunActivo(
  activo: ActivoReporte,
  index: number,
  opciones: FilaComunOpciones = {},
): string[] {
  const { codigoCompleto = false, incluirCorr = true } = opciones;
  const base = [
    String(index + 1),
    "1",
    "Und.",
    categoriaBienCorto(activo.categoria),
  ];
  if (codigoCompleto) {
    base.push(formatActivoCodigoDisplay(activo));
  } else {
    base.push(activo.codigo_catalogo);
    if (incluirCorr) {
      base.push(formatCorrelativoDisplay(activo.correlativo));
    }
  }
  base.push(activo.nombre);
  return base;
}

function valoresAmbienteValorizadoFila(activo: ActivoReporte, fechaCorte: Date): string[] {
  const [precio, mercado, pctDeprec, , depAcum, valorNeto] = valoresMonetariosFila(
    activo,
    fechaCorte,
  );
  return [comprobanteExport(activo), precio, mercado, pctDeprec, depAcum, valorNeto];
}

function headerDefFromStrings(
  headers: readonly string[],
  keys?: readonly string[],
): ReporteTableHeaderDef[] {
  return headers.map((line1, index) => ({
    key: keys?.[index] ?? `col_${index}`,
    line1,
  }));
}

const KEYS_VALORIZADOS_ENTIDAD = [
  KEY_NUM,
  KEY_CANT,
  "und",
  "cat",
  "codigo",
  "corr",
  "nombre",
  "descripcion",
  "fecha_adq",
  "cuenta_contable",
  "estado",
  KEY_PRECIO,
  "valor_mercado",
  "pct_deprec",
  "periodo",
  KEY_DEP,
  KEY_NETO,
  "observacion",
  "cp",
] as const;

export function reporteTableHeaderDefs(
  reporteId: ReporteId,
  valorizado: boolean,
): readonly ReporteTableHeaderDef[] {
  if (esPlantilla(reporteId, "bajas")) {
    return headerDefFromStrings([...HEADERS_BAJAS, columnaUbicacionLabel(reporteId)]);
  }
  if (esPlantilla(reporteId, "faltantes")) {
    return headerDefFromStrings([...HEADERS_FALTANTES]);
  }
  if (esPlantilla(reporteId, "valorizado_ambiente")) return HEADERS_AMBIENTE_VALORIZADO;
  if (esPlantilla(reporteId, "valorizado_entidad")) return HEADERS_ENTIDAD_VALORIZADO;

  const sinUbicacion = omitUbicacionEnTabla(reporteId);
  if (valorizado) {
    const headers = sinUbicacion
      ? [...HEADERS_VALORIZADOS_BASE, ...HEADERS_VALORIZADOS_COLA]
      : [...HEADERS_VALORIZADOS_BASE, ...HEADERS_VALORIZADOS_COLA, columnaUbicacionLabel(reporteId)];
    const keys = sinUbicacion
      ? KEYS_VALORIZADOS_ENTIDAD
      : [...KEYS_VALORIZADOS_ENTIDAD, "ubicacion"];
    return headerDefFromStrings(headers, keys);
  }
  const headers = sinUbicacion
    ? [...HEADERS_SIN_VALORES_BASE, ...HEADERS_SIN_VALORES_COLA]
    : [...HEADERS_SIN_VALORES_BASE, ...HEADERS_SIN_VALORES_COLA, columnaUbicacionLabel(reporteId)];
  return headerDefFromStrings(headers);
}

export function reporteHeaders(reporteId: ReporteId, valorizado: boolean): readonly string[] {
  return reporteTableHeaderDefs(reporteId, valorizado).map((h) =>
    h.line2 ? `${h.line1} ${h.line2}` : h.line1,
  );
}

export function headerDefLabel(h: ReporteTableHeaderDef): string {
  return h.line2 ? `${h.line1}\n${h.line2}` : h.line1;
}

export function reporteHeaderMultilinea(headerDefs: readonly ReporteTableHeaderDef[]): boolean {
  return headerDefs.some((h) => h.line2);
}

type PdfHeadCell = string | { content: string; rowSpan?: number; colSpan?: number };

/** Una sola fila de cabecera; los títulos largos usan salto de línea dentro de la celda. */
export function buildPdfTableHead(
  headerDefs: readonly ReporteTableHeaderDef[],
): PdfHeadCell[][] {
  return [headerDefs.map((h) => headerDefLabel(h))];
}

/** Pesos relativos por columna (inventario valorizado por ambiente). */
const AMBIENTE_VALORIZADO_COL_WEIGHTS = [
  4, 4, 4, 5, 10, 14, 18, 7, 10, 6, 10, 9, 9, 9, 9, 9,
] as const;

/** Pesos relativos (ficha de asignación y activos fijos por ambiente). */
const AMBIENTE_SIN_VALOR_COL_WEIGHTS = [
  4, 4, 4, 5, 8, 6, 16, 22, 8, 7, 12,
] as const;

function pdfColumnStylesFromWeights(
  tableWidthMm: number,
  weights: readonly number[],
  leftAlignIndices: readonly number[] = [6, 7],
): Record<number, { cellWidth: number; halign?: "left" | "center" | "right" }> {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const leftAlign = new Set(leftAlignIndices);
  const styles: Record<number, { cellWidth: number; halign?: "left" | "center" | "right" }> = {};

  weights.forEach((weight, index) => {
    styles[index] = {
      cellWidth: (tableWidthMm * weight) / totalWeight,
      halign: leftAlign.has(index) ? "left" : "center",
    };
  });

  return styles;
}

/** Pesos relativos (reporte de bajas por entidad). */
const BAJAS_COL_WEIGHTS = [5, 10, 8, 22, 18, 10, 17] as const;

/** Pesos relativos (reporte del ambiente Faltantes). */
const FALTANTES_COL_WEIGHTS = [5, 14, 8, 28, 12, 28] as const;

/** Pesos relativos (inventario general por entidad sin valores). */
const ENTIDAD_SIN_VALOR_COL_WEIGHTS = [
  4, 4, 4, 5, 8, 6, 13, 17, 7, 6, 9, 12,
] as const;

/** Pesos relativos (inventario valorizado general por entidad: tabla ambiente + ubicación). */
const ENTIDAD_VALORIZADO_COL_WEIGHTS = [...AMBIENTE_VALORIZADO_COL_WEIGHTS, 9] as const;

/** Anchos de columna escalados al ancho útil de la tabla (informes con diseño extendido, PDF apaisado). */
export function reporteDisenoPdfColumnStyles(
  tableWidthMm: number,
  reporteId: ReporteId,
): Record<number, { cellWidth: number; halign?: "left" | "center" | "right" }> | undefined {
  const pesos = pesosColumnasDiseno(reporteId);
  if (!pesos) return undefined;
  return pdfColumnStylesFromWeights(tableWidthMm, pesos.weights, pesos.leftAlign);
}

/** @deprecated Use reporteDisenoPdfColumnStyles */
export function ambienteDisenoPdfColumnStyles(
  tableWidthMm: number,
  reporteId: ReporteId,
): Record<number, { cellWidth: number; halign?: "left" | "center" | "right" }> | undefined {
  return reporteDisenoPdfColumnStyles(tableWidthMm, reporteId);
}

/** Anchos de columna en caracteres (Excel) para informes con diseño extendido. */
function pesosColumnasDiseno(reporteId: ReporteId): {
  weights: readonly number[];
  leftAlign: readonly number[];
} | null {
  const plantilla = plantillaReporte(reporteId);
  switch (plantilla) {
    case "valorizado_ambiente":
      return { weights: AMBIENTE_VALORIZADO_COL_WEIGHTS, leftAlign: [5, 6] };
    case "ficha_ambiente":
    case "inventario_ambiente":
      return { weights: AMBIENTE_SIN_VALOR_COL_WEIGHTS, leftAlign: [6, 7, 10] };
    case "acta_entidad":
    case "inventario_entidad":
    case "estado_malo":
    case "ejercicio_actual":
    case "ejercicio_anterior":
      return { weights: ENTIDAD_SIN_VALOR_COL_WEIGHTS, leftAlign: [6, 7, 10, 11] };
    case "valorizado_entidad":
      return { weights: ENTIDAD_VALORIZADO_COL_WEIGHTS, leftAlign: [5, 6, 16] };
    case "bajas":
      return { weights: BAJAS_COL_WEIGHTS, leftAlign: [3] };
    case "faltantes":
      return { weights: FALTANTES_COL_WEIGHTS, leftAlign: [3, 5] };
    default:
      return null;
  }
}

export function reporteDisenoExcelColWidths(reporteId: ReporteId): number[] | undefined {
  const weights = pesosColumnasDiseno(reporteId)?.weights ?? null;
  if (!weights) return undefined;

  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((weight) => Math.max(4, Math.round((weight / total) * 120)));
}

/** @deprecated Use reporteDisenoExcelColWidths */
export function ambienteDisenoExcelColWidths(reporteId: ReporteId): number[] | undefined {
  return reporteDisenoExcelColWidths(reporteId);
}

/** @deprecated Use ambienteDisenoPdfColumnStyles */
export function ambienteValorizadoPdfColumnStyles(
  tableWidthMm: number,
): Record<number, { cellWidth: number; halign?: "left" | "center" | "right" }> {
  return ambienteDisenoPdfColumnStyles(tableWidthMm, "inventario_ambiente_valorizado")!;
}

export function buildReporteRows(
  activos: ActivoReporte[],
  reporteId: ReporteId,
  valorizado: boolean,
  fechaCorte: Date,
): string[][] {
  const ordenados = ordenarActivosParaReporte(activos, reporteId);

  if (esPlantilla(reporteId, "bajas")) {
    return ordenados.map((activo, index) => [
      String(index + 1),
      activo.codigo_barras ?? activo.codigo_catalogo,
      formatCorrelativoDisplay(activo.correlativo),
      activo.nombre,
      activo.motivo_baja?.trim() || "—",
      formatFechaISOToDDMMYYYY(activo.updated_at.slice(0, 10)) || "—",
      ubicacionReporteLabel(activo, reporteId),
    ]);
  }

  if (esPlantilla(reporteId, "faltantes")) {
    const porOrigen = [...ordenados].sort((a, b) => {
      const origen = (a.procedencia ?? "").localeCompare(b.procedencia ?? "", "es");
      if (origen !== 0) return origen;
      return a.nombre.localeCompare(b.nombre, "es");
    });
    return porOrigen.map((activo, index) => [
      String(index + 1),
      activo.codigo_barras ?? activo.codigo_catalogo,
      formatCorrelativoDisplay(activo.correlativo),
      activo.nombre,
      estadoBienLabel(activo.estado_bien),
      activo.procedencia?.trim() || "—",
    ]);
  }

  return ordenados.map((activo, index) => {
    const descripcion = buildDescripcionBien(
      activo.marca,
      activo.modelo,
      activo.serie,
      activo.color,
      activo.medidas,
    );

    const sinUbicacion = omitUbicacionEnTabla(reporteId);
    const tablaValorizadoAmbiente = valorizado && esReporteValorizadoTablaAmbiente(reporteId);
    const comun = [
      ...filaComunActivo(activo, index, {
        codigoCompleto: tablaValorizadoAmbiente,
        incluirCorr: !tablaValorizadoAmbiente,
      }),
      descripcion || "—",
    ];
    const colaComunValorizado = [
      formatFechaISOToDDMMYYYY(activo.fecha_adquisicion) || "—",
      cuentaContableExport(activo),
      estadoBienLabel(activo.estado_bien),
    ];
    const colaComun = [
      formatFechaISOToDDMMYYYY(activo.fecha_adquisicion) || "—",
      estadoBienLabel(activo.estado_bien),
    ];

    if (valorizado) {
      if (tablaValorizadoAmbiente) {
        const fila = [
          ...comun,
          ...colaComunValorizado,
          ...valoresAmbienteValorizadoFila(activo, fechaCorte),
        ];
        if (esPlantilla(reporteId, "valorizado_entidad")) {
          fila.push(ubicacionReporteLabel(activo, reporteId));
        }
        return fila;
      }
      const fila = [
        ...comun,
        ...colaComunValorizado,
        ...valoresMonetariosFila(activo, fechaCorte),
        activo.observacion?.trim() || "—",
        comprobanteExport(activo),
      ];
      if (!sinUbicacion) fila.push(ubicacionReporteLabel(activo, reporteId));
      return fila;
    }

    const fila = [...comun, ...colaComun, activo.observacion?.trim() || "—"];
    if (!sinUbicacion) fila.push(ubicacionReporteLabel(activo, reporteId));
    return fila;
  });
}

export function reporteTitulo(
  reporteId: ReporteId,
  valorizado: boolean,
  fechaCorte?: string,
): string {
  void valorizado;
  if (esReporteAdquiridosEjercicio(reporteId)) {
    return tituloReporteAdquiridosEjercicio(reporteId, fechaCorte);
  }
  return definicionReporte(reporteId).titulo;
}
