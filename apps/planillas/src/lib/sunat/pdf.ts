import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { zipSync } from "fflate";
import type { ComprobanteUbl, TotalesComprobante } from "./ubl";

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
const MARGIN = 22;
const ink = rgb(0, 0, 0);
const hair = rgb(0, 0, 0);
const header = rgb(0.93, 0.93, 0.93);
const COLON = 128;
const ALTO_TOTAL = 12.4;

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
  const totales = totalesVisibles(compra);
  const columnas = columnasTabla();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = dibujarCabecera(page, bold, font, compra);
  let tope = y;
  y = encabezadoTabla(page, bold, y, columnas);

  const lineas = detalle?.lineas ?? [];
  if (lineas.length === 0) {
    const texto = compra.aviso || "SUNAT no entregó el detalle de lo que se compró en este comprobante.";
    y = filaTabla(page, font, y, columnas, ["", "", "", texto, "", ""], false);
  } else {
    for (const linea of lineas) {
      const celdas = [
        decimalVisible(linea.cantidad, 6),
        unidadLegible(linea.unidad),
        linea.codigo || "",
        linea.descripcion || "",
        decimalVisible(linea.valorUnitario, 8),
        dineroPlano(numeroDe(linea.icbper) ?? 0),
      ];
      const alto = altoFila(font, celdas, columnas);
      if (y - alto < MARGIN + 28) {
        cerrarTabla(page, tope, y, columnas);
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - 28;
        tope = y;
        y = encabezadoTabla(page, bold, y, columnas);
      }
      y = filaTabla(page, font, y, columnas, celdas, false);
    }
  }
  cerrarTabla(page, tope, y, columnas);

  if (y - ALTO_TOTAL * FILAS_TOTAL.length < MARGIN + 8) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 28;
  }
  dibujarTotales(page, bold, font, y, totales, moneda);
  return doc.save();
}

export async function zipPdfs(archivos: Array<{ nombre: string; bytes: Uint8Array }>): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  for (const archivo of archivos) entries[archivo.nombre] = archivo.bytes;
  return zipSync(entries, { level: 6 });
}

const FILAS_TOTAL: Array<[string, keyof TotalesComprobante]> = [
  ["Descuento Global *", "descuentoAfecta"],
  ["Total valor venta gravado", "gravado"],
  ["Total valor venta inafecto", "inafecto"],
  ["Total valor venta exonerado", "exonerado"],
  ["Total valor venta gratuito", "gratuito"],
  ["Total valor venta exportación", "exportacion"],
  ["Descuento Global **", "descuentoNoAfecta"],
  ["Total descuentos", "descuentos"],
  ["Sumatoria otros tributos", "otrosTributos"],
  ["Sumatoria otros cargos", "otrosCargos"],
  ["Sumatoria ISC", "isc"],
  ["Sumatoria IGV", "igv"],
  ["Sumatoria ICBPER", "icbper"],
  ["Importe total", "total"],
];

interface Columna {
  titulo: string;
  ancho: number;
  alinear: "left" | "right" | "center";
}

function columnasTabla(): Columna[] {
  const fijos = 50 + 70 + 54 + 78 + 50;
  const descripcion = PAGE_W - MARGIN * 2 - fijos;
  return [
    { titulo: "Cantidad", ancho: 50, alinear: "right" },
    { titulo: "Unidad Medida", ancho: 70, alinear: "center" },
    { titulo: "Código", ancho: 54, alinear: "center" },
    { titulo: "Descripción", ancho: descripcion, alinear: "left" },
    { titulo: "Valor Unitario", ancho: 78, alinear: "right" },
    { titulo: "ICBPER", ancho: 50, alinear: "right" },
  ];
}

function dibujarCabecera(page: PDFPage, bold: PDFFont, font: PDFFont, compra: CompraPdf): number {
  const detalle = compra.detalle;
  const y0 = PAGE_H - 32;
  const cajaX = 338;
  const cajaW = PAGE_W - MARGIN - cajaX;
  const cajaH = 62;
  page.drawRectangle({
    x: cajaX,
    y: y0 - cajaH + 12,
    width: cajaW,
    height: cajaH,
    borderColor: hair,
    borderWidth: 1.4,
  });
  const titulo = TIPO[compra.tipo];
  const tamTitulo = font.widthOfTextAtSize(win(titulo), 9) > cajaW - 12 ? 7.5 : 9;
  centrar(page, bold, titulo, cajaX, y0 - 6, cajaW, tamTitulo);
  centrar(page, bold, `RUC: ${detalle?.emisorRuc || compra.rucEmisor || "-"}`, cajaX, y0 - 22, cajaW, 9);
  centrar(page, bold, serieVisible(detalle?.serieNumero || "", compra), cajaX, y0 - 40, cajaW, 11);

  const comercial = (detalle?.nombreComercial || "").trim();
  const legal = (detalle?.emisorNombre || compra.razonSocialEmisor || "").trim();
  const nombres = [comercial, legal && legal.toUpperCase() !== comercial.toUpperCase() ? legal : ""].filter(Boolean);
  const anchoNombre = cajaX - MARGIN - 12;
  let y = y0;
  for (const [index, nombre] of nombres.entries()) {
    y = dibujarTexto(page, index === 0 ? bold : font, win(nombre), MARGIN, y, anchoNombre, 8, ink);
  }
  if (detalle?.emisorDireccion) y = dibujarTexto(page, font, win(detalle.emisorDireccion), MARGIN, y, anchoNombre, 8, ink);
  if (detalle?.emisorLugar) y = dibujarTexto(page, font, win(detalle.emisorLugar), MARGIN, y, anchoNombre, 8, ink);

  y = Math.min(y - 8, y0 - cajaH - 4);
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_W - MARGIN, y: y + 6 }, thickness: 0.6, color: hair });
  const moneda = (detalle?.moneda || compra.moneda || "PEN").toUpperCase();
  const fechaY = y - 4;
  dato(page, font, fechaY, "Fecha de Emisión", fechaLegible(detalle?.fecha || compra.fechaEmision), 150);
  page.drawText(win("Forma de pago"), { x: 360, y: fechaY, size: 8, font, color: ink });
  page.drawText(":", { x: 432, y: fechaY, size: 8, font, color: ink });
  page.drawText(win(detalle?.formaPago || "Contado"), { x: 442, y: fechaY, size: 8, font, color: ink });
  y = fechaY - 12;
  y = dato(page, font, y, "Señor(es)", detalle?.clienteNombre || compra.empresa || "-", 420);
  y = dato(page, font, y, "RUC", detalle?.clienteRuc || compra.rucEmpresa || "-", 200);
  y = dato(page, font, y, "Dirección del Cliente", detalle?.clienteDireccion || "-", 420);
  y = dato(page, font, y, "Tipo de Moneda", nombreMoneda(moneda), 160);
  y = dato(page, font, y, "Observación", observacionVisible(detalle?.observacion || ""), 420);
  return y - 4;
}

function dato(page: PDFPage, font: PDFFont, y: number, etiqueta: string, valor: string, ancho: number): number {
  page.drawText(win(etiqueta), { x: MARGIN, y, size: 8, font, color: ink });
  page.drawText(":", { x: COLON, y, size: 8, font, color: ink });
  return dibujarTexto(page, font, win(valor || "-"), COLON + 12, y, ancho, 8, ink);
}

function centrar(page: PDFPage, font: PDFFont, texto: string, x: number, y: number, ancho: number, size: number) {
  const safe = win(texto);
  const dx = Math.max(0, (ancho - font.widthOfTextAtSize(safe, size)) / 2);
  page.drawText(safe, { x: x + dx, y, size, font, color: ink });
}

function encabezadoTabla(page: PDFPage, font: PDFFont, y: number, columnas: Columna[]): number {
  return filaTabla(page, font, y, columnas, columnas.map((columna) => columna.titulo), true);
}

function filaTabla(page: PDFPage, font: PDFFont, y: number, columnas: Columna[], valores: string[], encabezado: boolean): number {
  const size = encabezado ? 7 : 7;
  const altoTexto = valores.reduce((max, valor, index) => {
    const columna = columnas[index];
    if (!columna) return max;
    return Math.max(max, contarLineas(win(valor), font, size, columna.ancho - 6));
  }, 1);
  const alto = Math.max(encabezado ? 14 : 11, altoTexto * (size + 2) + 3);
  let x = MARGIN;
  if (encabezado) {
    page.drawRectangle({ x: MARGIN, y: y - alto + 9, width: PAGE_W - MARGIN * 2, height: alto, color: header });
  }
  valores.forEach((valor, index) => {
    const columna = columnas[index];
    if (!columna) return;
    const lineas = partir(win(valor), font, size, columna.ancho - 6);
    let cursor = y;
    for (const linea of lineas) {
      const ancho = font.widthOfTextAtSize(linea, size);
      const dx = columna.alinear === "right" ? columna.ancho - 4 - ancho : columna.alinear === "center" ? (columna.ancho - ancho) / 2 : 3;
      page.drawText(linea, { x: x + dx, y: cursor, size, font, color: ink });
      cursor -= size + 2;
    }
    x += columna.ancho;
  });
  page.drawLine({
    start: { x: MARGIN, y: y - alto + 9 },
    end: { x: PAGE_W - MARGIN, y: y - alto + 9 },
    thickness: 0.4,
    color: hair,
  });
  return y - alto;
}

function cerrarTabla(page: PDFPage, arriba: number, abajo: number, columnas: Columna[]) {
  const top = arriba + 9;
  const bottom = abajo + 9;
  if (top - bottom < 4) return;
  page.drawRectangle({
    x: MARGIN,
    y: bottom,
    width: PAGE_W - MARGIN * 2,
    height: top - bottom,
    borderColor: hair,
    borderWidth: 0.6,
  });
  let x = MARGIN;
  for (const columna of columnas.slice(0, -1)) {
    x += columna.ancho;
    page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.3, color: hair });
  }
}

function dibujarTotales(
  page: PDFPage,
  bold: PDFFont,
  font: PDFFont,
  y: number,
  totales: import("./ubl").TotalesComprobante,
  moneda: string,
) {
  const alto = ALTO_TOTAL * FILAS_TOTAL.length;
  const xCorte = PAGE_W - MARGIN - 232;
  const top = y + 9;
  const bottom = top - alto;
  page.drawRectangle({ x: MARGIN, y: bottom, width: PAGE_W - MARGIN * 2, height: alto, borderColor: hair, borderWidth: 0.7 });
  page.drawLine({ start: { x: xCorte, y: top }, end: { x: xCorte, y: bottom }, thickness: 0.5, color: hair });
  const xMonto = xCorte + 158;
  page.drawLine({ start: { x: xMonto, y: top }, end: { x: xMonto, y: bottom }, thickness: 0.5, color: hair });

  FILAS_TOTAL.forEach(([etiqueta, clave], index) => {
    const filaY = top - ALTO_TOTAL * (index + 1);
    if (index < FILAS_TOTAL.length - 1) {
      page.drawLine({ start: { x: xCorte, y: filaY }, end: { x: PAGE_W - MARGIN, y: filaY }, thickness: 0.3, color: hair });
    }
    const textoY = filaY + 3;
    const fuente = clave === "total" ? bold : font;
    const label = win(etiqueta);
    const ancho = fuente.widthOfTextAtSize(label, 7);
    page.drawText(label, { x: xMonto - 8 - ancho, y: textoY, size: 7, font: fuente, color: ink });
    page.drawText(":", { x: xMonto - 6, y: textoY, size: 7, font: fuente, color: ink });
    const monto = dinero(totales[clave], moneda);
    const anchoMonto = fuente.widthOfTextAtSize(monto, 7);
    page.drawText(monto, { x: PAGE_W - MARGIN - 4 - anchoMonto, y: textoY, size: 7, font: fuente, color: ink });
  });

  const son = `SON: ${montoEnLetras(totales.total, moneda)}`;
  const sonY = bottom + 58;
  dibujarTexto(page, bold, win(son), MARGIN + 6, sonY, xCorte - MARGIN - 14, 7.5, ink);
  page.drawText(win("* Descuento Global que Afecta la Base Imponible"), { x: MARGIN + 6, y: bottom + 28, size: 6.5, font, color: ink });
  page.drawText(win("** Descuento Global que no Afecta la Base Imponible"), { x: MARGIN + 6, y: bottom + 16, size: 6.5, font, color: ink });
}

function totalesVisibles(compra: CompraPdf): TotalesComprobante {
  const totales = compra.detalle?.totales;
  if (totales && (totales.total || totales.gravado || totales.igv || totales.inafecto || totales.exonerado)) return totales;
  return {
    descuentoAfecta: 0,
    descuentoNoAfecta: 0,
    gravado: compra.base ?? 0,
    inafecto: 0,
    exonerado: 0,
    gratuito: 0,
    exportacion: 0,
    descuentos: 0,
    otrosTributos: 0,
    otrosCargos: 0,
    isc: 0,
    igv: compra.igv ?? 0,
    icbper: 0,
    total: compra.total ?? numeroDe(compra.detalle?.total) ?? 0,
  };
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

function serieVisible(id: string, compra: CompraPdf): string {
  const raw = (id || numeroVisible(compra)).trim();
  const match = raw.match(/^(.*?)[- ](\d+)$/);
  if (!match) return raw;
  return `${match[1]}-${String(Number(match[2]))}`;
}

function observacionVisible(nota: string): string {
  const limpia = nota.replace(/\s+/g, " ").trim();
  if (!limpia || /see-?sfs|facturador sunat|elaborado por sistema de emi/i.test(limpia)) return "-";
  return limpia;
}

function nombreMoneda(moneda: string): string {
  if (moneda === "USD") return "DOLAR";
  if (moneda === "EUR") return "EURO";
  return "SOL";
}

function partir(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const palabras = text.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [""];
  const lineas: string[] = [];
  let linea = "";
  for (const palabra of palabras) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(candidata, size) > maxWidth && linea) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = candidata;
    }
  }
  if (linea) lineas.push(linea);
  return lineas;
}

function altoFila(font: PDFFont, valores: string[], columnas: Columna[]): number {
  const lineas = valores.reduce((max, valor, index) => {
    const columna = columnas[index];
    return columna ? Math.max(max, contarLineas(win(valor), font, 7, columna.ancho - 6)) : max;
  }, 1);
  return Math.max(11, lineas * 9 + 3);
}

function decimalVisible(valor: string, max: number): string {
  const n = numeroDe(valor);
  if (n == null) return "";
  return n.toFixed(max).replace(/\.?0+$/, "");
}

function dineroPlano(valor: number): string {
  return valor.toFixed(2);
}

function dinero(valor: number, moneda: string): string {
  const simbolo = moneda === "USD" ? "US$" : moneda === "EUR" ? "EUR" : "S/";
  return `${simbolo} ${valor.toFixed(2)}`;
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

function numeroDe(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
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
