import { labelFechaCorte, labelFechaEmision } from "@inventario/types";
import { definicionReporte, plantillaReporte, type ReporteContexto, type ReporteId } from "./types";

export const FICHA_TABLE_HEAD_RGB: [number, number, number] = [29, 78, 137];
export const FICHA_TABLE_ALT_ROW_RGB: [number, number, number] = [248, 248, 248];

/** Informes por ambiente con diseño extendido (no membrete institucional). */
export function esReporteAmbienteDiseno(reporteId: ReporteId): boolean {
  return definicionReporte(reporteId).scope === "ambiente";
}

/** @deprecated Use esReporteAmbienteDiseno */
export function esReporteAmbienteFicha(reporteId: ReporteId): boolean {
  return esReporteAmbienteDiseno(reporteId);
}

export function tituloReporteAmbienteDiseno(reporteId: ReporteId): string {
  return definicionReporte(reporteId).titulo;
}

export function reporteAmbienteIncluyeFirmas(reporteId: ReporteId): boolean {
  return plantillaReporte(reporteId) === "ficha_ambiente";
}

export function buildFichaActualizacionLabel(fechaCorte: string): string {
  return labelFechaCorte(fechaCorte);
}

export function ambienteDisenoExportFilename(ctx: ReporteContexto): string {
  const slug = (ctx.ambienteNombre ?? ctx.entidadNombre)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
  const fecha = ctx.fechaGeneracion.toISOString().slice(0, 10);
  const prefix = definicionReporte(ctx.reporteId).archivo;
  return `${prefix}-${slug}-${fecha}`;
}

/** @deprecated Use ambienteDisenoExportFilename */
export function fichaExportFilename(ctx: ReporteContexto): string {
  return ambienteDisenoExportFilename(ctx);
}

type JsPDFDoc = import("jspdf").jsPDF;

function textoFicha(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/** Altura Y donde debe comenzar la tabla (sin dibujar el membrete). */
export function measureAmbienteDisenoHeaderEndY(ctx: ReporteContexto, startY = 10): number {
  let y = startY;
  y += 6;
  y += 4;
  y += 4;
  y += 4;
  y += 4;
  y += 4;
  if (ctx.sedeNombre?.trim()) {
    y += 4;
    if (ctx.ambienteNombre?.trim()) y += 4;
  } else if (ctx.ambienteNombre?.trim()) {
    y += 4;
  }
  return y + 3;
}

export function addAmbienteDisenoHeaderPdf(
  doc: JsPDFDoc,
  ctx: ReporteContexto,
  totalRegistros: number,
  startY = 10,
): number {
  const margin = 10;
  const pageW = doc.internal.pageSize.getWidth();
  const mid = pageW / 2 + 2;
  let y = startY;
  const titulo = tituloReporteAmbienteDiseno(ctx.reporteId);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(titulo, pageW / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  doc.text(labelFechaEmision(ctx.fechaGeneracion), pageW / 2, y, { align: "center" });
  y += 4;
  doc.text(buildFichaActualizacionLabel(ctx.fechaCorte!), pageW / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Registros: ${totalRegistros}`, pageW - margin, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("USUARIO RESPONSABLE:", margin, y);
  doc.text("LOCALIZACIÓN DEL BIEN:", mid, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.text(`APELLIDOS Y NOMBRES: ${textoFicha(ctx.responsable)}`, margin, y);
  doc.text(`ENTIDAD: ${ctx.entidadNombre.toUpperCase()}`, mid, y);
  y += 4;

  doc.text(`DNI: ${textoFicha(ctx.responsableDni)}`, margin, y);
  if (ctx.sedeNombre?.trim()) {
    doc.text(`SEDE: ${ctx.sedeNombre.trim().toUpperCase()}`, mid, y);
    y += 4;
    if (ctx.ambienteNombre?.trim()) {
      doc.text(`AMBIENTE: ${ctx.ambienteNombre.trim().toUpperCase()}`, mid, y);
      y += 4;
    }
  } else if (ctx.ambienteNombre?.trim()) {
    doc.text(`AMBIENTE: ${ctx.ambienteNombre.trim().toUpperCase()}`, mid, y);
    y += 4;
  }

  return y + 3;
}

export function addFichaAsignacionFirmasPdf(
  doc: JsPDFDoc,
  y: number,
  ctx: ReporteContexto,
): void {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const gap = 10;
  const colWidth = (pageW - margin * 2 - gap) / 2;
  let startY = y + 10;

  if (startY > pageH - 48) {
    doc.addPage();
    startY = 28;
  }

  const colCenter = [
    margin + colWidth / 2,
    margin + colWidth + gap + colWidth / 2,
  ];
  const adminNombre = textoFicha(ctx.adminNombre);
  const adminDni = textoFicha(ctx.adminDni);
  const respNombre = textoFicha(ctx.responsable);
  const respDni = textoFicha(ctx.responsableDni);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  colCenter.forEach((x) => {
    doc.text("______________________________________", x, startY, { align: "center" });
  });
  startY += 5;

  doc.setFont("helvetica", "bold");
  doc.text("ADMINISTRADOR", colCenter[0]!, startY, { align: "center" });
  doc.text("RESPONSABLE", colCenter[1]!, startY, { align: "center" });
  startY += 5;

  doc.setFont("helvetica", "normal");
  doc.text(adminNombre, colCenter[0]!, startY, { align: "center", maxWidth: colWidth });
  doc.text(respNombre, colCenter[1]!, startY, { align: "center", maxWidth: colWidth });
  startY += 4;
  doc.text(`DNI: ${adminDni}`, colCenter[0]!, startY, { align: "center" });
  doc.text(`DNI: ${respDni}`, colCenter[1]!, startY, { align: "center" });
}

/** @deprecated Use addAmbienteDisenoHeaderPdf */
export function addFichaAsignacionHeaderPdf(
  doc: JsPDFDoc,
  ctx: ReporteContexto,
  totalRegistros: number,
  startY = 10,
): number {
  return addAmbienteDisenoHeaderPdf(doc, ctx, totalRegistros, startY);
}
