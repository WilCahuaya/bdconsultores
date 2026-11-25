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
const MARGIN = 28;
const ink = rgb(0.1, 0.12, 0.16);
const muted = rgb(0.28, 0.34, 0.38);
const line = rgb(0.75, 0.78, 0.8);
const header = rgb(0.9, 0.93, 0.94);
const box = rgb(0.07, 0.45, 0.48);

const COL = {
  cant: 32,
  um: 72,
  desc: 118,
  unit: 392,
  dto: 462,
  venta: 524,
};

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
  const simbolo = simboloDe(moneda);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 36;
  y = dibujarFicha(page, bold, font, y, {
    titulo: TIPO[compra.tipo],
    serieNumero,
    rucEmisor,
    emisor,
    direccion: detalle?.emisorDireccion || "",
    rucCliente,
    cliente,
    observacion: detalle?.observacion || "-",
    fecha,
    moneda,
    simbolo,
  });

  y -= 8;
  y = encabezadoTabla(page, bold, y);
  const lineas = detalle?.lineas ?? [];
  if (lineas.length === 0) {
    const texto = compra.aviso || "SUNAT no entregó el detalle de lo que se compró en este comprobante.";
    y = dibujarTexto(page, font, win(texto), COL.desc, y, 250, 8, muted) - 6;
  } else {
    for (const linea of lineas) {
      const alto = Math.max(14, contarLineas(win(linea.descripcion || "-"), font, 8, 250) * 11);
      if (y - alto < 90) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - 36;
        y = encabezadoTabla(page, bold, y);
      }
      y = dibujarLinea(page, font, y, linea);
    }
  }

  if (y < 120) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 36;
  }
  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y: y + 8 },
    end: { x: PAGE_W - MARGIN, y: y + 8 },
    thickness: 0.6,
    color: line,
  });
  const letras = total == null ? "" : montoEnLetras(total, moneda);
  dibujarTexto(page, bold, win(letras), MARGIN, y, 320, 8, ink);
  y = totalFila(page, font, y, "SUB TOTAL", gravado);
  y = totalFila(page, bold, y, "IGV", igv);
  y = totalFila(page, bold, y, "IMP. TOTAL", total);

  if (!detalle?.lineas.length && compra.aviso) {
    page.drawText(win("Los totales salen del registro de compras."), {
      x: MARGIN,
      y: 36,
      size: 7,
      font,
      color: muted,
    });
  }
  return doc.save();
}

export async function zipPdfs(archivos: Array<{ nombre: string; bytes: Uint8Array }>): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  for (const archivo of archivos) entries[archivo.nombre] = archivo.bytes;
  return zipSync(entries, { level: 6 });
}

function dibujarFicha(
  page: PDFPage,
  bold: PDFFont,
  font: PDFFont,
  y: number,
  datos: {
    titulo: string;
    serieNumero: string;
    rucEmisor: string;
    emisor: string;
    direccion: string;
    rucCliente: string;
    cliente: string;
    observacion: string;
    fecha: string;
    moneda: string;
    simbolo: string;
  },
): number {
  const cajaX = 360;
  const cajaW = PAGE_W - MARGIN - cajaX;
  page.drawRectangle({ x: cajaX, y: y - 62, width: cajaW, height: 70, borderColor: box, borderWidth: 1.2 });
  page.drawText(win(datos.titulo), { x: cajaX + 8, y: y - 4, size: 8, font: bold, color: box });
  page.drawText(win(`RUC: ${datos.rucEmisor}`), { x: cajaX + 8, y: y - 20, size: 8, font, color: ink });
  page.drawText(win(datos.serieNumero), { x: cajaX + 8, y: y - 40, size: 12, font: bold, color: ink });

  page.drawText("DATOS DEL PROVEEDOR", { x: MARGIN, y, size: 8, font: bold, color: box });
  let cursor = y - 14;
  cursor = campo(page, bold, font, cursor, "RUC", datos.rucEmisor, 320);
  cursor = campo(page, bold, font, cursor, "RAZÓN SOCIAL", datos.emisor, 320);
  cursor = campo(page, bold, font, cursor, "DIRECCIÓN", datos.direccion || "-", 320);

  const clienteY = Math.min(cursor - 10, y - 78);
  page.drawText("DATOS DEL CLIENTE", { x: MARGIN, y: clienteY, size: 8, font: bold, color: box });
  page.drawText(win(`FECHA:  ${datos.fecha}`), { x: cajaX, y: clienteY, size: 8, font, color: ink });
  page.drawText(win(`MONEDA:  ${datos.moneda}`), { x: cajaX, y: clienteY - 14, size: 8, font, color: ink });
  page.drawText(win(`SÍMBOLO:  ${datos.simbolo}`), { x: cajaX, y: clienteY - 28, size: 8, font, color: ink });
  cursor = clienteY - 14;
  cursor = campo(page, bold, font, cursor, "RUC", datos.rucCliente, 320);
  cursor = campo(page, bold, font, cursor, "RAZÓN SOCIAL", datos.cliente, 320);
  cursor = campo(page, bold, font, cursor, "OBSERVACIÓN", datos.observacion, 320);
  return cursor - 8;
}

function campo(
  page: PDFPage,
  bold: PDFFont,
  font: PDFFont,
  y: number,
  etiqueta: string,
  valor: string,
  ancho: number,
): number {
  const label = `${etiqueta}:`;
  page.drawText(win(label), { x: MARGIN, y, size: 8, font: bold, color: ink });
  const x = MARGIN + font.widthOfTextAtSize(label, 8) + 4;
  return dibujarTexto(page, font, win(valor), x, y, ancho - (x - MARGIN), 8, ink);
}

function encabezadoTabla(page: PDFPage, font: PDFFont, y: number): number {
  page.drawRectangle({ x: MARGIN, y: y - 6, width: PAGE_W - MARGIN * 2, height: 16, color: header });
  const celdas: Array<[string, number]> = [
    ["CANTIDAD", COL.cant],
    ["U.M.", COL.um],
    ["DESCRIPCIÓN", COL.desc],
    ["VALOR UNIT.", COL.unit],
    ["DESCUENTO", COL.dto],
    ["VALOR VENTA", COL.venta],
  ];
  for (const [texto, x] of celdas) {
    page.drawText(texto, { x, y, size: 7, font, color: ink });
  }
  return y - 18;
}

function dibujarLinea(page: PDFPage, font: PDFFont, y: number, linea: LineaComprobante): number {
  const desc = win(linea.descripcion || "-");
  page.drawText(cantidadTexto(linea.cantidad), { x: COL.cant, y, size: 8, font, color: ink });
  page.drawText(win(unidadLegible(linea.unidad)), { x: COL.um, y, size: 7, font, color: ink });
  const siguiente = dibujarTexto(page, font, desc, COL.desc, y, 250, 8, ink);
  alinear(page, font, numero(numeroDe(linea.valorUnitario)), COL.unit, 64, y);
  alinear(page, font, numero(numeroDe(linea.descuento) ?? 0), COL.dto, 56, y);
  alinear(page, font, numero(numeroDe(linea.importe)), COL.venta, 48, y);
  return Math.min(siguiente, y - 12) - 2;
}

function totalFila(page: PDFPage, font: PDFFont, y: number, etiqueta: string, valor: number | null): number {
  page.drawText(etiqueta, { x: 400, y, size: 8, font, color: ink });
  alinear(page, font, numero(valor), 500, 68, y);
  return y - 14;
}

function alinear(page: PDFPage, font: PDFFont, texto: string, x: number, ancho: number, y: number) {
  const safe = win(texto);
  const dx = Math.max(0, ancho - font.widthOfTextAtSize(safe, 8));
  page.drawText(safe, { x: x + dx, y, size: 8, font, color: ink });
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
  if (palabras.length === 0) return y - (size + 3);
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
  const numero = (compra.numeroFinal ? `${compra.numero}-${compra.numeroFinal}` : compra.numero).replace(/^0+(?=\d)/, "");
  return `${serie}-${numero}`.replace(/^-/, "");
}

function cantidadTexto(valor: string): string {
  const n = numeroDe(valor);
  if (n == null) return "-";
  return n.toFixed(2);
}

function unidadLegible(codigo: string): string {
  const mapa: Record<string, string> = {
    NIU: "UNIDAD",
    ZZ: "UNIDAD",
    UNI: "UNIDAD",
    C62: "UNIDAD",
    KGM: "KG",
    GRM: "G",
    LTR: "LITRO",
    MTR: "METRO",
    BX: "CAJA",
    SET: "JUEGO",
  };
  const clave = codigo.trim().toUpperCase();
  return mapa[clave] || clave || "-";
}

function simboloDe(moneda: string): string {
  if (moneda === "USD") return "US$";
  if (moneda === "EUR") return "EUR";
  return "S/";
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

function numero(total: number | null): string {
  if (total == null) return "-";
  const [entero, decimal] = total.toFixed(2).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${conMiles}.${decimal}`;
}

function fechaLegible(iso: string | null): string {
  if (!iso) return "-";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

function montoEnLetras(total: number, moneda: string): string {
  const absoluto = Math.abs(total);
  const entero = Math.floor(absoluto + 1e-6);
  const centavos = Math.round((absoluto - entero) * 100);
  const nombre = moneda === "USD" ? "DOLARES AMERICANOS" : "SOLES";
  return `${enteroEnLetras(entero)} Y ${String(centavos).padStart(2, "0")}/100 ${nombre}`;
}

function enteroEnLetras(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) {
    partes.push(millones === 1 ? "UN MILLON" : `${grupo(millones).replace(/\bUNO\b/g, "UN")} MILLONES`);
  }
  if (miles) partes.push(miles === 1 ? "MIL" : `${grupo(miles).replace(/\bUNO\b/g, "UN")} MIL`);
  if (resto) partes.push(grupo(resto));
  return partes.join(" ").replace(/\bUNO\b/g, "UN");
}

function grupo(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
  const especiales = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const decenas = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const unidades = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  const partes: string[] = [];
  if (c) partes.push(centenas[c] ?? "");
  if (resto >= 10 && resto <= 19) partes.push(especiales[resto - 10] ?? "");
  else if (resto >= 21 && resto <= 29) partes.push(u === 0 ? "VEINTE" : `VEINTI${unidades[u] ?? ""}`);
  else if (d) partes.push(u ? `${decenas[d]} Y ${unidades[u]}` : decenas[d] ?? "");
  else if (u) partes.push(unidades[u] ?? "");
  return partes.filter(Boolean).join(" ");
}

function sanitizar(nombre: string): string {
  return nombre.replace(/[^\w.\-]+/g, "_");
}

function win(value: string): string {
  return value.normalize("NFC").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}
