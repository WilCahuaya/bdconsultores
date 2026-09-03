import type { Range, WorkSheet } from "xlsx-js-style";
import { labelFechaCorte, labelFechaEmision } from "@inventario/types";
import {
  STYLE_HEADER_BOLD,
  STYLE_HEADER_NORMAL,
  STYLE_HEADER_TITLE,
  addMerge,
  setCell,
} from "./excel-styles";
import type { ReporteContexto, ReporteId } from "./types";
import { esReporteAdquiridosEjercicio, tituloReporteAdquiridosEjercicio } from "./ejercicio";

export const ACTA_DE_INVENTARIO_ACTIVOS_FIJOS_GENERAL_TITULO =
  "ACTA DE INVENTARIO DE ACTIVOS FIJOS GENERAL";

export const INVENTARIO_ACTIVOS_FIJOS_GENERAL_TITULO =
  "INVENTARIO DE ACTIVOS FIJOS GENERAL";

export const INVENTARIO_ACTIVOS_VALORIZADOS_GENERAL_TITULO =
  "INVENTARIO DE ACTIVOS VALORIZADOS GENERAL";

export const REPORTE_BAJAS_TITULO = "REPORTE DE BAJAS DE ACTIVOS FIJOS";

export const REPORTE_ACTIVOS_ESTADO_MALO_TITULO = "REPORTE DE ACTIVOS EN ESTADO MALO";

const REPORTES_ENTIDAD_DISENO: ReporteId[] = [
  "inventario_entidad_sin_valores",
  "inventario_entidad_activos_fijos",
  "inventario_entidad_valorizado",
  "reporte_bajas",
  "reporte_activos_estado_malo",
  "reporte_adquiridos_ejercicio_actual",
  "reporte_adquiridos_ejercicio_anterior",
];

export function esReporteEntidadDiseno(reporteId: ReporteId): boolean {
  return REPORTES_ENTIDAD_DISENO.includes(reporteId);
}

export function reporteEntidadIncluyeFirmas(reporteId: ReporteId): boolean {
  return reporteId === "inventario_entidad_sin_valores";
}

export function tituloReporteEntidadDiseno(reporteId: ReporteId, fechaCorte?: string): string {
  if (reporteId === "reporte_bajas") return REPORTE_BAJAS_TITULO;
  if (reporteId === "reporte_activos_estado_malo") return REPORTE_ACTIVOS_ESTADO_MALO_TITULO;
  if (esReporteAdquiridosEjercicio(reporteId)) {
    return tituloReporteAdquiridosEjercicio(reporteId, fechaCorte);
  }
  if (reporteId === "inventario_entidad_sin_valores") {
    return ACTA_DE_INVENTARIO_ACTIVOS_FIJOS_GENERAL_TITULO;
  }
  if (reporteId === "inventario_entidad_valorizado") {
    return INVENTARIO_ACTIVOS_VALORIZADOS_GENERAL_TITULO;
  }
  return INVENTARIO_ACTIVOS_FIJOS_GENERAL_TITULO;
}

export function buildEntidadActualizacionLabel(fechaCorte: string): string {
  return labelFechaCorte(fechaCorte);
}

export function measureEntidadDisenoHeaderEndY(startY = 10): number {
  return startY + 5 + 5 + 4 + 4 + 3;
}

export function entidadDisenoExportFilename(ctx: ReporteContexto): string {
  const slug = ctx.entidadNombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
  const fecha = ctx.fechaGeneracion.toISOString().slice(0, 10);
  const prefijos: Record<string, string> = {
    inventario_entidad_sin_valores: "acta-inventario-activos-fijos-general",
    inventario_entidad_activos_fijos: "inventario-activos-fijos-general",
    inventario_entidad_valorizado: "inventario-activos-valorizados-general",
    reporte_bajas: "reporte-bajas",
    reporte_activos_estado_malo: "reporte-activos-estado-malo",
    reporte_adquiridos_ejercicio_actual: "adquiridos-ejercicio-actual",
    reporte_adquiridos_ejercicio_anterior: "adquiridos-ejercicio-anterior",
  };
  const prefijo = prefijos[ctx.reporteId] ?? "inventario-entidad";
  return `${prefijo}-${slug}-${fecha}`;
}

type JsPDFDoc = import("jspdf").jsPDF;

export function addEntidadDisenoHeaderPdf(
  doc: JsPDFDoc,
  ctx: ReporteContexto,
  totalRegistros: number,
  startY = 10,
): number {
  const margin = 10;
  const pageW = doc.internal.pageSize.getWidth();
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(tituloReporteEntidadDiseno(ctx.reporteId, ctx.fechaCorte ?? undefined), margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Registros: ${totalRegistros}`, pageW - margin, y, { align: "right" });
  y += 5;

  doc.setFontSize(9);
  doc.text(labelFechaEmision(ctx.fechaGeneracion), margin, y);
  y += 4;
  if (ctx.fechaCorte && !esReporteAdquiridosEjercicio(ctx.reporteId)) {
    doc.text(labelFechaCorte(ctx.fechaCorte), margin, y);
    y += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(ctx.entidadNombre.toUpperCase(), margin, y);

  return y + 4;
}

const FIRMA_LINEA = "______________________________";

export function addEntidadInventarioFirmasPdf(doc: JsPDFDoc, y: number, ctx: ReporteContexto): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const gap = 8;
  const colWidth = (pageW - margin * 2 - gap * 2) / 3;
  const firmaEspacioMm = 18;
  let startY = y + 12;

  if (startY > pageH - 70) {
    doc.addPage();
    startY = 28;
  }

  const titulos = ["CONTADOR", "ADMINISTRADOR", "REPRESENTANTE LEGAL"];
  const adminNombre = ctx.adminNombre?.trim() ?? "";
  const adminDni = ctx.adminDni?.trim() ?? "";
  const nombres = ["", adminNombre, ""];
  const dnis = ["", adminDni, ""];

  const colX = (index: number) => margin + index * (colWidth + gap);

  // Espacio en blanco arriba de la línea para firmar
  startY += firmaEspacioMm;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  titulos.forEach((_, index) => {
    doc.text(FIRMA_LINEA, colX(index), startY, { align: "left" });
  });
  startY += 6;

  const lineWidth = doc.getTextWidth(FIRMA_LINEA);
  doc.setFont("helvetica", "bold");
  titulos.forEach((titulo, index) => {
    doc.text(titulo, colX(index) + lineWidth / 2, startY, {
      align: "center",
      maxWidth: lineWidth,
    });
  });
  startY += 6;

  doc.setFont("helvetica", "normal");
  titulos.forEach((_, index) => {
    const x = colX(index);
    const nombre = nombres[index]?.trim() ?? "";
    const dni = dnis[index]?.trim() ?? "";
    doc.text("NOMBRE:", x, startY, { maxWidth: colWidth });
    if (nombre) doc.text(nombre, x + 18, startY, { maxWidth: colWidth - 18 });
    doc.text("DNI:", x, startY + 5, { maxWidth: colWidth });
    if (dni) doc.text(dni, x + 10, startY + 5, { maxWidth: colWidth - 10 });
  });
}

export function writeEntidadDisenoHeader(
  ws: WorkSheet,
  merges: Range[],
  colCount: number,
  ctx: ReporteContexto,
  totalRegistros: number,
): number {
  const lastCol = Math.max(colCount - 1, 0);
  const split = Math.max(Math.floor(colCount / 2) - 1, 0);
  let r = 0;

  setCell(ws, r, 0, tituloReporteEntidadDiseno(ctx.reporteId, ctx.fechaCorte ?? undefined), STYLE_HEADER_TITLE);
  setCell(ws, r, split + 1, `Registros: ${totalRegistros}`, {
    ...STYLE_HEADER_NORMAL,
    alignment: { horizontal: "right", vertical: "center", wrapText: true },
  });
  addMerge(merges, r, 0, split);
  if (split + 1 < lastCol) addMerge(merges, r, split + 1, lastCol);
  r++;

  setCell(ws, r, 0, labelFechaEmision(ctx.fechaGeneracion), STYLE_HEADER_NORMAL);
  addMerge(merges, r, 0, lastCol);
  r++;

  if (ctx.fechaCorte && !esReporteAdquiridosEjercicio(ctx.reporteId)) {
    setCell(ws, r, 0, labelFechaCorte(ctx.fechaCorte), STYLE_HEADER_NORMAL);
    addMerge(merges, r, 0, lastCol);
    r++;
  }

  setCell(ws, r, 0, ctx.entidadNombre.toUpperCase(), STYLE_HEADER_BOLD);
  addMerge(merges, r, 0, lastCol);
  r++;

  return r + 1;
}

function setRowHeight(ws: WorkSheet, row: number, hpt: number) {
  if (!ws["!rows"]) ws["!rows"] = [];
  ws["!rows"][row] = { hpt };
}

function firmaLineaEndCol(start: number, end: number): number {
  const blockCols = end - start + 1;
  const lineCols = Math.min(Math.max(Math.ceil(FIRMA_LINEA.length / 4), 4), blockCols);
  return start + lineCols - 1;
}

export function writeEntidadInventarioFirmas(
  ws: WorkSheet,
  merges: Range[],
  startRow: number,
  colCount: number,
  ctx: ReporteContexto,
): number {
  const lastCol = Math.max(colCount - 1, 0);
  const blockSize = Math.max(Math.ceil((lastCol + 1) / 3), 1);
  const blocks = [
    { start: 0, end: Math.min(blockSize - 1, lastCol) },
    {
      start: Math.min(blockSize, lastCol),
      end: Math.min(blockSize * 2 - 1, lastCol),
    },
    {
      start: Math.min(blockSize * 2, lastCol),
      end: lastCol,
    },
  ];
  let r = startRow + 2;

  const titulos = ["CONTADOR", "ADMINISTRADOR", "REPRESENTANTE LEGAL"];
  const adminNombre = ctx.adminNombre?.trim() ?? "";
  const adminDni = ctx.adminDni?.trim() ?? "";
  const nombres = ["", adminNombre, ""];
  const dnis = ["", adminDni, ""];

  setRowHeight(ws, r, 48);
  titulos.forEach((_, index) => {
    const { start, end } = blocks[index]!;
    setCell(ws, r, start, "", STYLE_HEADER_NORMAL);
    if (end > start) addMerge(merges, r, start, end);
  });
  r++;

  titulos.forEach((_, index) => {
    const { start, end } = blocks[index]!;
    const lineEnd = firmaLineaEndCol(start, end);
    setCell(ws, r, start, FIRMA_LINEA, {
      ...STYLE_HEADER_NORMAL,
      alignment: { horizontal: "left", vertical: "bottom" },
    });
    if (lineEnd > start) addMerge(merges, r, start, lineEnd);
  });
  r += 2;

  titulos.forEach((titulo, index) => {
    const { start, end } = blocks[index]!;
    const lineEnd = firmaLineaEndCol(start, end);
    setCell(ws, r, start, titulo, {
      ...STYLE_HEADER_BOLD,
      alignment: { horizontal: "center", vertical: "top", wrapText: true },
    });
    if (lineEnd > start) addMerge(merges, r, start, lineEnd);
  });
  r += 2;

  titulos.forEach((_, index) => {
    const { start, end } = blocks[index]!;
    const nombre = nombres[index]?.trim() ?? "";
    setCell(ws, r, start, nombre ? `NOMBRE: ${nombre}` : "NOMBRE:", {
      ...STYLE_HEADER_NORMAL,
      alignment: { horizontal: "left", vertical: "center" },
    });
    if (end > start) addMerge(merges, r, start, end);
  });
  r++;

  titulos.forEach((_, index) => {
    const { start, end } = blocks[index]!;
    const dni = dnis[index]?.trim() ?? "";
    setCell(ws, r, start, dni ? `DNI: ${dni}` : "DNI:", {
      ...STYLE_HEADER_NORMAL,
      alignment: { horizontal: "left", vertical: "center" },
    });
    if (end > start) addMerge(merges, r, start, end);
  });
  r++;

  return r;
}
