import { formatMonedaPE } from "@inventario/types";
import { buildInstitutionalHeader, fechaCorteCalculo } from "./header-meta";
import {
  addAmbienteDisenoHeaderPdf,
  addFichaAsignacionFirmasPdf,
  ambienteDisenoExportFilename,
  esReporteAmbienteDiseno,
  FICHA_TABLE_ALT_ROW_RGB,
  FICHA_TABLE_HEAD_RGB,
  measureAmbienteDisenoHeaderEndY,
  reporteAmbienteIncluyeFirmas,
} from "./ficha-asignacion";
import {
  addEntidadDisenoHeaderPdf,
  addEntidadInventarioFirmasPdf,
  entidadDisenoExportFilename,
  esReporteEntidadDiseno,
  measureEntidadDisenoHeaderEndY,
  reporteEntidadIncluyeFirmas,
} from "./inventario-entidad-diseno";
import { addPdfLogoWatermark, getBrandLogoPngDataUrl } from "./logo-watermark";
import {
  buildPdfTableHead,
  buildReporteRows,
  buildValorizacionTotalesFila,
  buildValorizacionTotalesFilaPdf,
  esReporteValorizadoTablaAmbiente,
  esReporteDisenoExtendido,
  esReporteInventarioValorizado,
  reporteDisenoPdfColumnStyles,
  reporteHeaderMultilinea,
  reporteIncluyeResumenClasificacion,
  reporteTableHeaderDefs,
  reporteTitulo,
} from "./rows";
import {
  CLASIFICACION_HEADERS,
  buildClasificacionResumen,
  buildValorizacionTotales,
  clasificacionToRows,
  clasificacionTotalRow,
  isClasificacionSectionTitleRow,
  isClasificacionSectionOrSubtotalRow,
} from "./summary";
import type { ActivoReporte, ReporteContexto } from "./types";
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

type JsPDFDoc = import("jspdf").jsPDF;

/** Totales: tono claro distinto al encabezado, texto oscuro para buena legibilidad. */
const TOTAL_ROW_STYLES = {
  fillColor: [186, 230, 253] as [number, number, number],
  textColor: [15, 52, 96] as [number, number, number],
  fontStyle: "bold" as const,
  fontSize: 7,
};

function addInstitutionalHeader(
  doc: JsPDFDoc,
  ctx: ReporteContexto,
  titulo: string,
  totalRegistros: number,
  startY = 10,
): number {
  const header = buildInstitutionalHeader(ctx, totalRegistros);
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(header.razonSocial, margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(header.fechaEmision, pageW - margin, y, { align: "right" });
  y += 4;

  doc.text(header.productoRuc, margin, y);
  if (header.fechaCorte) {
    doc.text(header.fechaCorte, pageW - margin, y, { align: "right" });
  }
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(titulo, margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(header.metaLine, margin, y, { maxWidth: pageW - margin * 2 });
  y += 4;

  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(header.usuarioLine, margin, y);
  doc.setTextColor(0, 0, 0);

  return y + 3;
}

function addPageNumbers(doc: JsPDFDoc) {
  const total = doc.getNumberOfPages();

  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.text(`Página ${i} de ${total}`, pageW - 10, pageH - 8, { align: "right" });
  }
}

export async function exportReportePdf(
  activos: ActivoReporte[],
  ctx: ReporteContexto,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const def = REPORTES.find((r) => r.id === ctx.reporteId)!;
  const fechaCorte = fechaCorteCalculo(ctx);
  const useAmbienteDiseno = esReporteAmbienteDiseno(ctx.reporteId);
  const useEntidadDiseno = esReporteEntidadDiseno(ctx.reporteId);
  const useDisenoExtendido = esReporteDisenoExtendido(ctx.reporteId);
  const titulo = reporteTitulo(ctx.reporteId, def.valorizado, ctx.fechaCorte ?? undefined);
  const headerDefs = reporteTableHeaderDefs(ctx.reporteId, def.valorizado);
  const pdfHead = buildPdfTableHead(headerDefs);
  const multilineHead = reporteHeaderMultilinea(headerDefs);
  const rows = buildReporteRows(activos, ctx.reporteId, def.valorizado, fechaCorte);
  const tableFontSize = useDisenoExtendido ? (def.valorizado ? 6 : 7) : 6;
  const tableCellPadding = useDisenoExtendido ? (def.valorizado ? 1 : 1.5) : 1;
  const ambienteValorizado = esReporteValorizadoTablaAmbiente(ctx.reporteId);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  let logoPng: string | null = null;
  try {
    logoPng = await getBrandLogoPngDataUrl();
  } catch {
    /* sin marca de agua si falla la rasterización del SVG */
  }

  const startY = useAmbienteDiseno
    ? measureAmbienteDisenoHeaderEndY(ctx)
    : useEntidadDiseno
      ? measureEntidadDisenoHeaderEndY()
      : addInstitutionalHeader(doc, ctx, titulo, activos.length);
  const inventarioValorizado = esReporteInventarioValorizado(ctx.reporteId);
  const totales =
    inventarioValorizado && activos.length > 0
      ? buildValorizacionTotales(activos, fechaCorte)
      : null;

  const totalesFila =
    totales != null
      ? buildValorizacionTotalesFila(headerDefs, totales, ctx.reporteId)
      : null;

  const tableMargin = { left: 10, right: 10, top: 10, bottom: 14 };
  const pageW = doc.internal.pageSize.getWidth();
  const tableWidth = pageW - tableMargin.left - tableMargin.right;

  autoTable(doc, {
    head: pdfHead,
    body: rows,
    foot: totalesFila ? [buildValorizacionTotalesFilaPdf(totalesFila)] : undefined,
    showFoot: totales ? "lastPage" : undefined,
    showHead: "everyPage",
    startY,
    tableWidth: useDisenoExtendido ? tableWidth : undefined,
    columnStyles: useDisenoExtendido
      ? reporteDisenoPdfColumnStyles(tableWidth, ctx.reporteId)
      : undefined,
    didParseCell: (data) => {
      if (data.section === "head" && useDisenoExtendido) {
        data.cell.styles.fillColor = FICHA_TABLE_HEAD_RGB;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
      }
    },
    styles: {
      fontSize: tableFontSize,
      cellPadding: tableCellPadding,
      lineColor: [210, 210, 210],
      lineWidth: useDisenoExtendido ? { top: 0.1, bottom: 0.1, left: 0, right: 0 } : 0.1,
    },
    headStyles: {
      fillColor: useDisenoExtendido ? FICHA_TABLE_HEAD_RGB : [30, 64, 120],
      fontSize: ambienteValorizado ? 5.5 : tableFontSize,
      textColor: [255, 255, 255],
      halign: "center",
      valign: "middle",
      minCellHeight: useDisenoExtendido ? (multilineHead ? 11 : 8) : undefined,
      cellPadding: ambienteValorizado ? { top: 1.5, bottom: 1.5, left: 0.8, right: 0.8 } : tableCellPadding,
      lineWidth: useDisenoExtendido ? { top: 0, bottom: 0.1, left: 0, right: 0 } : 0.1,
    },
    alternateRowStyles: useDisenoExtendido ? { fillColor: FICHA_TABLE_ALT_ROW_RGB } : undefined,
    footStyles: {
      ...TOTAL_ROW_STYLES,
      halign: ambienteValorizado ? "center" : "left",
    },
    margin: tableMargin,
  });

  if (useAmbienteDiseno) {
    doc.setPage(1);
    addAmbienteDisenoHeaderPdf(doc, ctx, activos.length);
  } else if (useEntidadDiseno) {
    doc.setPage(1);
    addEntidadDisenoHeaderPdf(doc, ctx, activos.length);
  }

  const finalY = (doc as JsPDFDoc & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY;

  if (reporteIncluyeResumenClasificacion(ctx.reporteId) && activos.length > 0) {
    const resumen = buildClasificacionResumen(activos, fechaCorte);
    const totalesResumen = totales ?? buildValorizacionTotales(activos, fechaCorte);
    const resumenY = (finalY ?? startY) + 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen por clasificación contable", 10, resumenY);
    autoTable(doc, {
      head: [[...CLASIFICACION_HEADERS]],
      body: clasificacionToRows(resumen).map((row) => {
        if (isClasificacionSectionTitleRow(row)) {
          return [
            {
              content: row[0] ?? "",
              colSpan: 5,
              styles: {
                fontStyle: "bold",
                fillColor: [226, 232, 240],
                textColor: [15, 23, 42],
              },
            },
          ];
        }
        const cells = row.map((cell, i) =>
          i >= 2 && cell.trim() ? `S/ ${formatMonedaPE(Number(cell))}` : cell,
        );
        if (isClasificacionSectionOrSubtotalRow(row)) {
          return cells.map((cell) => ({
            content: cell,
            styles: { fontStyle: "bold", fillColor: [241, 245, 249] },
          }));
        }
        return cells;
      }),
      foot: [
        clasificacionTotalRow(totalesResumen).map((cell, i) =>
          i >= 2 ? `S/ ${formatMonedaPE(Number(cell))}` : cell,
        ),
      ],
      showFoot: "lastPage",
      startY: resumenY + 4,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [71, 85, 105] },
      footStyles: TOTAL_ROW_STYLES,
      margin: { left: 10, right: 10, bottom: 14 },
    });
  }

  if (useAmbienteDiseno && reporteAmbienteIncluyeFirmas(ctx.reporteId)) {
    const firmasY =
      (doc as JsPDFDoc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      startY;
    addFichaAsignacionFirmasPdf(doc, firmasY, ctx);
  } else if (reporteEntidadIncluyeFirmas(ctx.reporteId)) {
    const firmasY =
      (doc as JsPDFDoc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      startY;
    addEntidadInventarioFirmasPdf(doc, firmasY, ctx);
  }

  if (logoPng) {
    addPdfLogoWatermark(doc, logoPng);
  }
  if (!useDisenoExtendido) {
    addPageNumbers(doc);
  }

  const baseName = useAmbienteDiseno
    ? ambienteDisenoExportFilename(ctx)
    : useEntidadDiseno
      ? entidadDisenoExportFilename(ctx)
      : `reporte-${ctx.reporteId}-${slugFilename(ctx.ambienteNombre ?? ctx.entidadNombre)}-${ctx.fechaGeneracion.toISOString().slice(0, 10)}`;
  doc.save(`${baseName}.pdf`);
}
