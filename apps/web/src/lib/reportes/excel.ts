import { formatMonedaPE, labelFechaEmision } from "@inventario/types";
import type { Range, WorkSheet } from "xlsx-js-style";
import {
  ambienteDisenoExportFilename,
  buildFichaActualizacionLabel,
  esReporteAmbienteDiseno,
  reporteAmbienteIncluyeFirmas,
  tituloReporteAmbienteDiseno,
} from "./ficha-asignacion";
import {
  entidadDisenoExportFilename,
  esReporteEntidadDiseno,
  reporteEntidadIncluyeFirmas,
  writeEntidadDisenoHeader,
  writeEntidadInventarioFirmas,
} from "./inventario-entidad-diseno";
import { buildInstitutionalHeader, fechaCorteCalculo } from "./header-meta";
import {
  STYLE_BODY,
  STYLE_HEADER_BOLD,
  STYLE_HEADER_MUTED,
  STYLE_HEADER_NORMAL,
  STYLE_HEADER_TITLE,
  STYLE_RESUMEN_HEAD,
  STYLE_SECTION_TITLE,
  STYLE_TABLE_FOOT,
  STYLE_TABLE_HEAD,
  addMerge,
  setCell,
} from "./excel-styles";
import {
  buildReporteRows,
  buildValorizacionTotalesFila,
  esReporteDisenoExtendido,
  esReporteInventarioValorizado,
  headerDefLabel,
  reporteDisenoExcelColWidths,
  reporteIncluyeResumenClasificacion,
  reporteTableHeaderDefs,
  type ReporteTableHeaderDef,
  type ValorizacionTotalesFila,
} from "./rows";
import {
  CLASIFICACION_HEADERS,
  buildClasificacionResumen,
  buildValorizacionTotales,
  clasificacionToRows,
  clasificacionTotalRow,
} from "./summary";
import type { ActivoReporte, ReporteContexto, ReporteId } from "./types";
import { REPORTES } from "./types";

function slugFilename(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

function formatClasificacionCells(row: string[]): string[] {
  return row.map((cell, i) => (i >= 2 ? `S/ ${formatMonedaPE(Number(cell))}` : cell));
}

function textoFicha(value: string | null | undefined): string {
  const t = value?.trim();
  return t || "—";
}

function writeAmbienteDisenoHeader(
  ws: WorkSheet,
  merges: Range[],
  colCount: number,
  ctx: ReporteContexto,
  totalRegistros: number,
): number {
  const lastCol = Math.max(colCount - 1, 0);
  const split = Math.max(Math.floor(colCount / 2) - 1, 0);
  let r = 0;

  setCell(ws, r, 0, tituloReporteAmbienteDiseno(ctx.reporteId), {
    ...STYLE_HEADER_TITLE,
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  });
  addMerge(merges, r, 0, lastCol);
  r++;

  setCell(ws, r, 0, labelFechaEmision(ctx.fechaGeneracion), {
    ...STYLE_HEADER_NORMAL,
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  });
  addMerge(merges, r, 0, lastCol);
  r++;

  setCell(ws, r, 0, buildFichaActualizacionLabel(ctx.fechaCorte!), {
    ...STYLE_HEADER_NORMAL,
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  });
  addMerge(merges, r, 0, split);
  setCell(ws, r, split + 1, `Registros: ${totalRegistros}`, {
    ...STYLE_HEADER_NORMAL,
    alignment: { horizontal: "right", vertical: "center", wrapText: true },
  });
  if (split + 1 < lastCol) addMerge(merges, r, split + 1, lastCol);
  r += 2;

  setCell(ws, r, 0, "USUARIO RESPONSABLE:", STYLE_HEADER_BOLD);
  setCell(ws, r, split + 1, "LOCALIZACIÓN DEL BIEN:", STYLE_HEADER_BOLD);
  addMerge(merges, r, 0, split);
  if (split + 1 < lastCol) addMerge(merges, r, split + 1, lastCol);
  r++;

  setCell(ws, r, 0, `APELLIDOS Y NOMBRES: ${textoFicha(ctx.responsable)}`, STYLE_HEADER_NORMAL);
  setCell(ws, r, split + 1, `ENTIDAD: ${ctx.entidadNombre.toUpperCase()}`, STYLE_HEADER_NORMAL);
  addMerge(merges, r, 0, split);
  if (split + 1 < lastCol) addMerge(merges, r, split + 1, lastCol);
  r++;

  setCell(ws, r, 0, `DNI: ${textoFicha(ctx.responsableDni)}`, STYLE_HEADER_NORMAL);
  if (ctx.sedeNombre?.trim()) {
    setCell(ws, r, split + 1, `SEDE: ${ctx.sedeNombre.trim().toUpperCase()}`, STYLE_HEADER_NORMAL);
  } else if (ctx.ambienteNombre?.trim()) {
    setCell(ws, r, split + 1, `AMBIENTE: ${ctx.ambienteNombre.trim().toUpperCase()}`, STYLE_HEADER_NORMAL);
  }
  addMerge(merges, r, 0, split);
  if (split + 1 < lastCol) addMerge(merges, r, split + 1, lastCol);
  r++;

  if (ctx.sedeNombre?.trim() && ctx.ambienteNombre?.trim()) {
    setCell(ws, r, split + 1, `AMBIENTE: ${ctx.ambienteNombre.trim().toUpperCase()}`, STYLE_HEADER_NORMAL);
    addMerge(merges, r, split + 1, lastCol);
    r++;
  }

  return r + 1;
}

function writeFichaAsignacionFirmas(
  ws: WorkSheet,
  merges: Range[],
  startRow: number,
  colCount: number,
  ctx: ReporteContexto,
): number {
  const lastCol = Math.max(colCount - 1, 0);
  const split = Math.max(Math.floor(colCount / 2) - 1, 0);
  let r = startRow + 1;

  setCell(ws, r, 0, "______________________________________", {
    ...STYLE_HEADER_NORMAL,
    alignment: { horizontal: "center", vertical: "center" },
  });
  addMerge(merges, r, 0, split);
  if (split + 1 < lastCol) {
    setCell(ws, r, split + 1, "______________________________________", {
      ...STYLE_HEADER_NORMAL,
      alignment: { horizontal: "center", vertical: "center" },
    });
    addMerge(merges, r, split + 1, lastCol);
  }
  r++;

  setCell(ws, r, 0, "ADMINISTRADOR", {
    ...STYLE_HEADER_BOLD,
    alignment: { horizontal: "center", vertical: "center" },
  });
  addMerge(merges, r, 0, split);
  if (split + 1 < lastCol) {
    setCell(ws, r, split + 1, "RESPONSABLE", {
      ...STYLE_HEADER_BOLD,
      alignment: { horizontal: "center", vertical: "center" },
    });
    addMerge(merges, r, split + 1, lastCol);
  }
  r++;

  setCell(ws, r, 0, textoFicha(ctx.adminNombre), {
    ...STYLE_HEADER_NORMAL,
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  });
  addMerge(merges, r, 0, split);
  if (split + 1 < lastCol) {
    setCell(ws, r, split + 1, textoFicha(ctx.responsable), {
      ...STYLE_HEADER_NORMAL,
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    });
    addMerge(merges, r, split + 1, lastCol);
  }
  r++;

  setCell(ws, r, 0, `DNI: ${textoFicha(ctx.adminDni)}`, {
    ...STYLE_HEADER_NORMAL,
    alignment: { horizontal: "center", vertical: "center" },
  });
  addMerge(merges, r, 0, split);
  if (split + 1 < lastCol) {
    setCell(ws, r, split + 1, `DNI: ${textoFicha(ctx.responsableDni)}`, {
      ...STYLE_HEADER_NORMAL,
      alignment: { horizontal: "center", vertical: "center" },
    });
    addMerge(merges, r, split + 1, lastCol);
  }
  r++;

  return r;
}

function writeInstitutionalHeader(
  ws: WorkSheet,
  merges: Range[],
  colCount: number,
  header: ReturnType<typeof buildInstitutionalHeader>,
): number {
  const lastCol = Math.max(colCount - 1, 0);
  const split = Math.max(Math.floor(colCount / 2) - 1, 0);

  let r = 0;

  setCell(ws, r, 0, header.razonSocial, STYLE_HEADER_BOLD);
  setCell(ws, r, split + 1, header.fechaEmision, {
    ...STYLE_HEADER_NORMAL,
    alignment: { horizontal: "right", vertical: "center", wrapText: true },
  });
  addMerge(merges, r, 0, split);
  if (split + 1 < lastCol) addMerge(merges, r, split + 1, lastCol);
  r++;

  setCell(ws, r, 0, header.productoRuc, STYLE_HEADER_NORMAL);
  if (header.fechaCorte) {
    setCell(ws, r, split + 1, header.fechaCorte, {
      ...STYLE_HEADER_NORMAL,
      alignment: { horizontal: "right", vertical: "center", wrapText: true },
    });
    if (split + 1 < lastCol) addMerge(merges, r, split + 1, lastCol);
  } else {
    addMerge(merges, r, 0, lastCol);
  }
  addMerge(merges, r, 0, split);
  r++;

  setCell(ws, r, 0, header.titulo, STYLE_HEADER_TITLE);
  addMerge(merges, r, 0, lastCol);
  r++;

  setCell(ws, r, 0, header.metaLine, STYLE_HEADER_NORMAL);
  addMerge(merges, r, 0, lastCol);
  r++;

  setCell(ws, r, 0, header.usuarioLine, STYLE_HEADER_MUTED);
  addMerge(merges, r, 0, lastCol);
  r++;

  return r;
}

function setReportColumnWidths(
  ws: WorkSheet,
  reporteId: ReporteId,
): void {
  const disenoWidths = reporteDisenoExcelColWidths(reporteId);
  if (disenoWidths) {
    ws["!cols"] = disenoWidths.map((wch) => ({ wch }));
  }
}

function mergeHorizontal(merges: Range[], r: number, c0: number, c1: number): void {
  if (c1 <= c0) return;
  merges.push({ s: { r, c: c0 }, e: { r, c: c1 } });
}

function writeTableSection(
  ws: WorkSheet,
  merges: Range[],
  startRow: number,
  headerDefs: readonly ReporteTableHeaderDef[],
  rows: string[][],
  footRow?: ValorizacionTotalesFila,
  fichaTable = false,
): number {
  let r = startRow;

  const headStyle = fichaTable
    ? {
        ...STYLE_TABLE_HEAD,
        fill: { fgColor: { rgb: "1D4E89" }, patternType: "solid" as const },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
      }
    : {
        ...STYLE_TABLE_HEAD,
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
      };

  headerDefs.forEach((h, c) => setCell(ws, r, c, headerDefLabel(h), headStyle));
  r++;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const bodyStyle = fichaTable && i % 2 === 1
      ? {
          ...STYLE_BODY,
          fill: { fgColor: { rgb: "F8F8F8" }, patternType: "solid" as const },
        }
      : STYLE_BODY;
    row.forEach((value, c) => setCell(ws, r, c, value, bodyStyle));
    r++;
  }

  if (footRow) {
    const span = footRow.totalLabelSpan ?? 0;
    if (span >= 2) {
      setCell(ws, r, 0, footRow.cells[0] || "TOTAL", {
        ...STYLE_TABLE_FOOT,
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
      });
      mergeHorizontal(merges, r, 0, span - 1);
      for (let c = span; c < footRow.cells.length; c++) {
        setCell(ws, r, c, footRow.cells[c]!, STYLE_TABLE_FOOT);
      }
    } else {
      footRow.cells.forEach((value, c) => setCell(ws, r, c, value, STYLE_TABLE_FOOT));
    }
    r++;
  }

  return r;
}

function writeClasificacionSection(
  ws: WorkSheet,
  merges: Range[],
  startRow: number,
  colCount: number,
  resumenRows: string[][],
  totalRow: string[],
): number {
  const lastCol = Math.max(colCount - 1, 0);
  let r = startRow + 1;

  setCell(ws, r, 0, "Resumen por clasificación contable", STYLE_SECTION_TITLE);
  addMerge(merges, r, 0, lastCol);
  r += 2;

  CLASIFICACION_HEADERS.forEach((h, c) => setCell(ws, r, c, h, STYLE_RESUMEN_HEAD));
  r++;

  for (const row of resumenRows) {
    formatClasificacionCells(row).forEach((value, c) => setCell(ws, r, c, value, STYLE_BODY));
    r++;
  }

  formatClasificacionCells(totalRow).forEach((value, c) => setCell(ws, r, c, value, STYLE_TABLE_FOOT));
  r++;

  return r;
}

export async function exportReporteExcel(
  activos: ActivoReporte[],
  ctx: ReporteContexto,
): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const def = REPORTES.find((r) => r.id === ctx.reporteId)!;
  const fechaCorte = fechaCorteCalculo(ctx);
  const useAmbienteDiseno = esReporteAmbienteDiseno(ctx.reporteId);
  const useEntidadDiseno = esReporteEntidadDiseno(ctx.reporteId);
  const useDisenoExtendido = esReporteDisenoExtendido(ctx.reporteId);
  const institutional = buildInstitutionalHeader(ctx, activos.length);
  const headerDefs = reporteTableHeaderDefs(ctx.reporteId, def.valorizado);
  const rows = buildReporteRows(activos, ctx.reporteId, def.valorizado, fechaCorte);
  const colCount = headerDefs.length;

  const inventarioValorizado = esReporteInventarioValorizado(ctx.reporteId);
  const totales =
    inventarioValorizado && activos.length > 0
      ? buildValorizacionTotales(activos, fechaCorte)
      : null;

  const ws: WorkSheet = {};
  const merges: Range[] = [];

  let nextRow = useAmbienteDiseno
    ? writeAmbienteDisenoHeader(ws, merges, colCount, ctx, activos.length)
    : useEntidadDiseno
      ? writeEntidadDisenoHeader(ws, merges, colCount, ctx, activos.length)
      : writeInstitutionalHeader(ws, merges, colCount, institutional);
  const tableStartRow = nextRow;
  nextRow = writeTableSection(
    ws,
    merges,
    nextRow,
    headerDefs,
    rows,
    totales
      ? buildValorizacionTotalesFila(headerDefs, totales, ctx.reporteId)
      : undefined,
    useDisenoExtendido,
  );

  if (reporteIncluyeResumenClasificacion(ctx.reporteId) && activos.length > 0) {
    const resumen = buildClasificacionResumen(activos, fechaCorte);
    const totalesResumen = totales ?? buildValorizacionTotales(activos, fechaCorte);
    nextRow = writeClasificacionSection(
      ws,
      merges,
      nextRow,
      colCount,
      clasificacionToRows(resumen),
      clasificacionTotalRow(totalesResumen),
    );
  }

  if (useAmbienteDiseno && reporteAmbienteIncluyeFirmas(ctx.reporteId)) {
    nextRow = writeFichaAsignacionFirmas(ws, merges, nextRow, colCount, ctx);
  } else if (reporteEntidadIncluyeFirmas(ctx.reporteId)) {
    nextRow = writeEntidadInventarioFirmas(ws, merges, nextRow, colCount, ctx);
  }

  ws["!merges"] = merges;
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: nextRow, c: colCount - 1 } });
  setReportColumnWidths(ws, ctx.reporteId);
  ws["!views"] = [{ state: "frozen", ySplit: tableStartRow + 1, activeCell: "A1" }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, useDisenoExtendido ? "Informe" : "Reporte");

  const baseName = useAmbienteDiseno
    ? ambienteDisenoExportFilename(ctx)
    : useEntidadDiseno
      ? entidadDisenoExportFilename(ctx)
      : `reporte-${ctx.reporteId}-${slugFilename(ctx.ambienteNombre ?? ctx.entidadNombre)}-${ctx.fechaGeneracion.toISOString().slice(0, 10)}`;
  XLSX.writeFile(wb, `${baseName}.xlsx`);
}
