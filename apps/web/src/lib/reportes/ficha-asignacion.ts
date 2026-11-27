import { formatFechaISOToDDMMYYYY, labelFechaCorte, labelFechaEmision } from "@inventario/types";
import type { ReporteContexto, ReporteId } from "./types";

export const FICHA_ASIGNACION_TITULO =
  "FICHA DE LEVANTAMIENTO DE INFORMACIÓN DE BIENES PATRIMONIALES";
export const INVENTARIO_ACTIVOS_FIJOS_AMBIENTE_TITULO =
  "INVENTARIO DE ACTIVOS FIJOS POR AMBIENTE";
export const INVENTARIO_ACTIVOS_VALORIZADOS_AMBIENTE_TITULO =
  "INVENTARIO DE ACTIVOS VALORIZADOS POR AMBIENTE";

export const FICHA_TABLE_HEAD_RGB: [number, number, number] = [29, 78, 137];
export const FICHA_TABLE_ALT_ROW_RGB: [number, number, number] = [248, 248, 248];

/** Informes por ambiente con diseño extendido (no membrete institucional). */
export function esReporteAmbienteDiseno(reporteId: ReporteId): boolean {
  return (
    reporteId === "inventario_ambiente_sin_valores" ||
    reporteId === "inventario_ambiente_activos_fijos" ||
    reporteId === "inventario_ambiente_valorizado"
  );
}

/** @deprecated Use esReporteAmbienteDiseno */
export function esReporteAmbienteFicha(reporteId: ReporteId): boolean {
  return esReporteAmbienteDiseno(reporteId);
}

export function tituloReporteAmbienteDiseno(reporteId: ReporteId): string {
  if (reporteId === "inventario_ambiente_activos_fijos") {
    return INVENTARIO_ACTIVOS_FIJOS_AMBIENTE_TITULO;
  }
  if (reporteId === "inventario_ambiente_valorizado") {
    return INVENTARIO_ACTIVOS_VALORIZADOS_AMBIENTE_TITULO;
  }
  return FICHA_ASIGNACION_TITULO;
}

export function esFichaLevantamiento(reporteId: ReporteId): boolean {
  return reporteId === "inventario_ambiente_sin_valores";
}

/** La ficha de levantamiento no lleva bloque de firmas. */
export function reporteAmbienteIncluyeFirmas(_reporteId: ReporteId): boolean {
  return false;
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
  const prefix =
    ctx.reporteId === "inventario_ambiente_activos_fijos"
      ? "inventario-activos-fijos"
      : ctx.reporteId === "inventario_ambiente_valorizado"
        ? "inventario-activos-valorizados"
        : "inventario-patrimonial";
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

function textoMayus(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t.toUpperCase() : "";
}

export function subtituloInventarioPatrimonial(ctx: ReporteContexto): string {
  const iso = ctx.fechaCorte?.trim() || ctx.fechaGeneracion.toISOString().slice(0, 10);
  const year = iso.slice(0, 4);
  const anio = /^\d{4}$/.test(year) ? year : String(ctx.fechaGeneracion.getFullYear());
  return `INVENTARIO PATRIMONIAL – ${anio}`;
}

export function fechaFichaLevantamiento(ctx: ReporteContexto): string {
  const iso = ctx.fechaGeneracion.toISOString().slice(0, 10);
  return `FECHA: ${formatFechaISOToDDMMYYYY(iso)}`;
}

/** Altura Y donde debe comenzar la tabla (sin dibujar el membrete). */
export function measureAmbienteDisenoHeaderEndY(ctx: ReporteContexto, startY = 10): number {
  if (esFichaLevantamiento(ctx.reporteId)) {
    return startY + 5 + 5 + 6 + 4 + 4 + 4 + 5;
  }
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

export function addFichaLevantamientoHeaderPdf(
  doc: JsPDFDoc,
  ctx: ReporteContexto,
  startY = 10,
): number {
  const margin = 10;
  const pageW = doc.internal.pageSize.getWidth();
  const right = pageW - margin;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(textoMayus(ctx.entidadNombre) || "—", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(fechaFichaLevantamiento(ctx), right, y, { align: "right" });
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(tituloReporteAmbienteDiseno(ctx.reporteId), pageW / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(12);
  doc.text(subtituloInventarioPatrimonial(ctx), pageW / 2, y, { align: "center" });
  y += 6;

  const gap = 8;
  const blockW = (pageW - margin * 2 - gap) / 2;
  const rightX = margin + blockW + gap;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(margin, y - 3.5, blockW, 14);
  doc.rect(rightX, y - 3.5, blockW, 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("LOCALIZACIÓN DEL BIEN:", margin + 2, y);
  doc.text("USUARIO RESPONSABLE:", rightX + 2, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.text(`SEDE: ${textoMayus(ctx.sedeNombre)}`, margin + 2, y);
  doc.text(`APELLIDOS Y NOMBRES: ${textoMayus(ctx.responsable)}`, rightX + 2, y, {
    maxWidth: blockW - 4,
  });
  y += 4;

  doc.text(`AMBIENTE: ${textoMayus(ctx.ambienteNombre)}`, margin + 2, y);
  doc.text(`DNI: ${textoFicha(ctx.responsableDni)}`, rightX + 2, y);
  y += 4;

  return y + 5;
}

export function addAmbienteDisenoHeaderPdf(
  doc: JsPDFDoc,
  ctx: ReporteContexto,
  totalRegistros: number,
  startY = 10,
): number {
  if (esFichaLevantamiento(ctx.reporteId)) {
    return addFichaLevantamientoHeaderPdf(doc, ctx, startY);
  }
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
