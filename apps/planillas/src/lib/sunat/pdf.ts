import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { zipSync } from "fflate";
import type { ComprobanteUbl, LineaComprobante } from "./ubl";

export interface CompraPdf {
  tipo: "01" | "02" | "03";
  serie: string;
  numero: string;
  numeroFinal: string | null;
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  fechaEmision: string | null;
  moneda: string | null;
  base?: number | null;
  igv?: number | null;
  total: number | null;
  periodo: string;
  empresa: string;
  rucEmpresa: string;
  detalle?: ComprobanteUbl | null;
  aviso?: string | null;
}

const TIPO: Record<CompraPdf["tipo"], string> = {
  "01": "FACTURA ELECTRÓNICA",
  "02": "RECIBO POR HONORARIOS",
  "03": "BOLETA DE VENTA ELECTRÓNICA",
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const ink = rgb(0.12, 0.16, 0.22);
const muted = rgb(0.38, 0.42, 0.48);
const line = rgb(0.82, 0.84, 0.87);
const band = rgb(0.12, 0.22, 0.38);
const paper = rgb(0.96, 0.97, 0.98);

export function etiquetaTipo(tipo: CompraPdf["tipo"]): string {
  return TIPO[tipo];
}

export function nombrePdf(compra: Pick<CompraPdf, "tipo" | "serie" | "numero" | "numeroFinal">): string {
  const serie = compra.serie || "SIN-SERIE";
  const numero = compra.numeroFinal ? `${compra.numero}-${compra.numeroFinal}` : compra.numero;
  return sanitizar(`${compra.tipo}-${serie}-${numero}.pdf`);
}

export async function pdfCompra(compra: CompraPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const detalle = compra.detalle;
  const moneda = (detalle?.moneda || compra.moneda || "PEN").toUpperCase();
  const serieNumero = detalle?.serieNumero || numeroVisible(compra);
  const emisor = detalle?.emisorNombre || compra.razonSocialEmisor || "-";
  const rucEmisor = detalle?.emisorRuc || compra.rucEmisor || "-";
  const cliente = detalle?.clienteNombre || compra.empresa || "-";
  const rucCliente = detalle?.clienteRuc || compra.rucEmpresa || "-";
  const fecha = fechaLegible(detalle?.fecha || compra.fechaEmision);
  const gravado = monto(detalle?.gravado, compra.base);
  const igv = monto(detalle?.igv, compra.igv);
  const total = monto(detalle?.total, compra.total);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = dibujarCabecera(page, bold, font, TIPO[compra.tipo], serieNumero);

  y = filaPartes(page, bold, font, y, {
    emisor,
    rucEmisor,
    direccionEmisor: detalle?.emisorDireccion || "",
    cliente,
    rucCliente,
    direccionCliente: detalle?.clienteDireccion || "",
  });

  y -= 8;
  page.drawText(win(`Fecha de emisión: ${fecha}`), { x: MARGIN, y, size: 9, font, color: ink });
  page.drawText(win(`Moneda: ${moneda}`), { x: 320, y, size: 9, font, color: ink });
  y -= 22;

  y = filaTabla(page, bold, y, ["Cant.", "Descripción", "P. unitario", "Importe"], true);
  const lineas = detalle?.lineas ?? [];
  if (lineas.length === 0) {
    const texto = compra.aviso || "SUNAT no entregó el detalle de lo que se compró en este comprobante.";
    y = dibujarTexto(page, font, win(texto), MARGIN + 8, y - 4, 500, 9, muted) - 8;
  } else {
    for (const linea of lineas) {
      if (y < 120) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = dibujarCabecera(page, bold, font, TIPO[compra.tipo], serieNumero);
        y = filaTabla(page, bold, y, ["Cant.", "Descripción", "P. unitario", "Importe"], true);
      }
      y = dibujarLinea(page, font, y, linea, moneda);
    }
  }

  if (y < 160) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = dibujarCabecera(page, bold, font, TIPO[compra.tipo], serieNumero);
  }
  y -= 8;
  if (gravado != null) y = totalFila(page, font, y, "Op. gravada", gravado, moneda);
  if (igv != null) y = totalFila(page, font, y, "IGV", igv, moneda);
  y -= 2;
  page.drawRectangle({ x: 330, y: y - 6, width: 229, height: 22, color: paper });
  page.drawText("Importe total", { x: 340, y, size: 11, font: bold, color: ink });
  page.drawText(win(importe(total, moneda)), { x: 470, y, size: 11, font: bold, color: ink });

  const nota = detalle?.esResumen
    ? "Este comprobante se informó en un resumen diario. SUNAT no entrega el detalle de cada ítem."
    : detalle
      ? "Representación impresa armada con el XML que SUNAT entregó al receptor."
      : compra.aviso || "Sin el XML de SUNAT este PDF solo muestra los totales del registro de compras.";
  page.drawText(win(nota), { x: MARGIN, y: 48, size: 8, font, color: muted, maxWidth: 520 });
  return doc.save();
}

export async function zipPdfs(archivos: Array<{ nombre: string; bytes: Uint8Array }>): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  for (const archivo of archivos) entries[archivo.nombre] = archivo.bytes;
  return zipSync(entries, { level: 6 });
}

function dibujarCabecera(page: PDFPage, bold: PDFFont, font: PDFFont, titulo: string, serieNumero: string): number {
  page.drawRectangle({ x: 0, y: PAGE_H - 78, width: PAGE_W, height: 78, color: band });
  page.drawText(win(titulo), { x: MARGIN, y: PAGE_H - 36, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText(win(serieNumero), { x: MARGIN, y: PAGE_H - 56, size: 12, font, color: rgb(0.85, 0.9, 0.95) });
  return PAGE_H - 104;
}

function filaPartes(
  page: PDFPage,
  bold: PDFFont,
  font: PDFFont,
  y: number,
  partes: {
    emisor: string;
    rucEmisor: string;
    direccionEmisor: string;
    cliente: string;
    rucCliente: string;
    direccionCliente: string;
  },
): number {
  const nombreAlto = Math.max(
    contarLineas(win(partes.emisor), bold, 10, 230),
    contarLineas(win(partes.cliente), bold, 10, 230),
  );
  const alto = 36 + nombreAlto * 13 + (partes.direccionEmisor || partes.direccionCliente ? 14 : 0);
  page.drawRectangle({ x: MARGIN, y: y - alto, width: 250, height: alto, color: paper });
  page.drawRectangle({ x: 308, y: y - alto, width: 251, height: alto, color: paper });
  page.drawText("EMISOR", { x: MARGIN + 10, y: y - 16, size: 8, font: bold, color: muted });
  page.drawText("ADQUIRENTE", { x: 318, y: y - 16, size: 8, font: bold, color: muted });
  dibujarTexto(page, bold, win(partes.emisor), MARGIN + 10, y - 32, 230, 10, ink);
  dibujarTexto(page, bold, win(partes.cliente), 318, y - 32, 230, 10, ink);
  const rucY = y - 36 - nombreAlto * 13;
  page.drawText(win(`RUC ${partes.rucEmisor}`), { x: MARGIN + 10, y: rucY, size: 8, font, color: muted });
  page.drawText(win(`RUC ${partes.rucCliente}`), { x: 318, y: rucY, size: 8, font, color: muted });
  if (partes.direccionEmisor) {
    page.drawText(win(recortar(partes.direccionEmisor, 42)), { x: MARGIN + 10, y: rucY - 12, size: 7, font, color: muted });
  }
  if (partes.direccionCliente) {
    page.drawText(win(recortar(partes.direccionCliente, 42)), { x: 318, y: rucY - 12, size: 7, font, color: muted });
  }
  return y - alto - 16;
}

function filaTabla(page: PDFPage, font: PDFFont, y: number, celdas: string[], encabezado: boolean): number {
  if (encabezado) {
    page.drawRectangle({ x: MARGIN, y: y - 6, width: PAGE_W - MARGIN * 2, height: 18, color: paper });
  }
  const xs = [MARGIN + 8, MARGIN + 52, 400, 490];
  celdas.forEach((celda, index) => {
    page.drawText(win(celda), { x: xs[index] ?? MARGIN, y, size: 8, font, color: encabezado ? muted : ink });
  });
  page.drawLine({
    start: { x: MARGIN, y: y - 6 },
    end: { x: PAGE_W - MARGIN, y: y - 6 },
    thickness: 0.4,
    color: line,
  });
  return y - 20;
}

function dibujarLinea(page: PDFPage, font: PDFFont, y: number, linea: LineaComprobante, moneda: string): number {
  const desc = win(linea.descripcion || "-");
  const alto = Math.max(16, contarLineas(desc, font, 9, 250) * 12);
  page.drawText(win(cantidad(linea)), { x: MARGIN + 8, y, size: 9, font, color: ink });
  const siguiente = dibujarTexto(page, font, desc, MARGIN + 52, y, 250, 9, ink);
  page.drawText(win(importe(numeroDe(linea.valorUnitario), moneda)), { x: 390, y, size: 9, font, color: ink });
  page.drawText(win(importe(numeroDe(linea.importe), moneda)), { x: 480, y, size: 9, font, color: ink });
  return Math.min(siguiente, y - alto);
}

function totalFila(page: PDFPage, font: PDFFont, y: number, etiqueta: string, valor: number | null, moneda: string): number {
  page.drawText(etiqueta, { x: 340, y, size: 9, font, color: muted });
  page.drawText(win(importe(valor, moneda)), { x: 470, y, size: 9, font, color: ink });
  return y - 16;
}

function dibujarTexto(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: ReturnType<typeof rgb>,
): number {
  const palabras = text.split(/\s+/).filter(Boolean);
  let linea = "";
  let cursor = y;
  const bajar = () => {
    page.drawText(linea, { x, y: cursor, size, font, color });
    cursor -= size + 3;
    linea = "";
  };
  for (const palabra of palabras) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(candidata, size) > maxWidth && linea) {
      bajar();
      linea = palabra;
    } else {
      linea = candidata;
    }
  }
  if (linea) bajar();
  return cursor;
}

function contarLineas(text: string, font: PDFFont, size: number, maxWidth: number): number {
  const palabras = text.split(/\s+/).filter(Boolean);
  let linea = "";
  let count = 1;
  for (const palabra of palabras) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(candidata, size) > maxWidth && linea) {
      count += 1;
      linea = palabra;
    } else {
      linea = candidata;
    }
  }
  return count;
}

function numeroVisible(compra: CompraPdf): string {
  const serie = compra.serie || "";
  const numero = compra.numeroFinal ? `${compra.numero}-${compra.numeroFinal}` : compra.numero;
  return `${serie}-${numero}`.replace(/^-/, "");
}

function cantidad(linea: LineaComprobante): string {
  const n = numeroDe(linea.cantidad);
  if (n == null) return "-";
  const texto = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return linea.unidad ? `${texto}` : texto;
}

function monto(texto: string | null | undefined, respaldo: number | null | undefined): number | null {
  const desdeXml = numeroDe(texto);
  if (desdeXml != null) return desdeXml;
  return respaldo ?? null;
}

function numeroDe(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function importe(total: number | null, moneda: string): string {
  if (total == null) return "-";
  const texto = total.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${moneda} ${texto}`;
}

function fechaLegible(iso: string | null): string {
  if (!iso) return "-";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

function recortar(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function sanitizar(nombre: string): string {
  return nombre.replace(/[^\w.\-]+/g, "_");
}

function win(value: string): string {
  return value.normalize("NFC").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}
