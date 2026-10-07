import { errorArchivoDocumento, extensionDocumento, DOCUMENTO_MAX_BYTES } from "@/lib/documento-storage";
import { excelComoPdf } from "@/lib/excel-a-pdf";

const A4_ANCHO = 595.28;
const A4_ALTO = 841.89;
const MARGEN = 40;
const TAMANO = 11;
const INTERLINEADO = 15;
const MAX_LADO = 3500;
const MAX_FILAS_EXCEL = 3000;

const IMAGENES = new Set(["jpg", "png", "webp", "gif", "bmp", "tif", "tiff", "avif", "heic", "heif"]);

export async function archivoParaGuardar(file: File): Promise<{ file?: File; error?: string }> {
  const invalid = errorArchivoDocumento(file);
  if (invalid) return { error: invalid };
  try {
    const pdf = await convertirAPdf(file);
    if (pdf.size > DOCUMENTO_MAX_BYTES) return { error: "El PDF resultante supera 10 MB." };
    return { file: pdf };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("No se pudo")) return { error: message };
    return { error: "No se pudo convertir el archivo a PDF." };
  }
}

async function convertirAPdf(file: File): Promise<File> {
  const ext = extensionDocumento(file.name);
  if (ext === "pdf" || file.type === "application/pdf") {
    if (file.type === "application/pdf" && file.name.toLowerCase().endsWith(".pdf")) return file;
    return new File([file], nombrePdf(file.name), { type: "application/pdf" });
  }
  if (ext === "doc") throw new Error("No se pudo convertir el Word antiguo. Guárdelo como .docx.");
  const bytes =
    ext && (IMAGENES.has(ext) || file.type.startsWith("image/"))
      ? await imagenArchivoAPdf(file)
      : ext === "docx"
        ? await docxAPdf(await file.arrayBuffer())
        : ext === "xlsx"
          ? await excelComoPdf(await file.arrayBuffer())
          : ext === "xls"
            ? await excelAPdf(await file.arrayBuffer())
          : null;
  if (!bytes) throw new Error("No se pudo convertir el archivo a PDF.");
  return archivoPdf(bytes, nombrePdf(file.name));
}

function nombrePdf(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return `${base || "documento"}.pdf`;
}

function copiaBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  return copia;
}

function archivoPdf(bytes: Uint8Array, nombre: string): File {
  return new File([copiaBytes(bytes)], nombre, { type: "application/pdf" });
}

async function imagenArchivoAPdf(file: File): Promise<Uint8Array> {
  const dibujo = await archivoAJpeg(file);
  const pdf = await import("pdf-lib").then((mod) => mod.PDFDocument.create());
  const image = await pdf.embedJpg(dibujo.jpeg);
  const apaisado = dibujo.ancho > dibujo.alto;
  const ancho = apaisado ? A4_ALTO : A4_ANCHO;
  const alto = apaisado ? A4_ANCHO : A4_ALTO;
  const maxAncho = ancho - MARGEN * 2;
  const maxAlto = alto - MARGEN * 2;
  const escala = Math.min(maxAncho / image.width, maxAlto / image.height);
  const w = image.width * escala;
  const h = image.height * escala;
  const page = pdf.addPage([ancho, alto]);
  page.drawImage(image, { x: (ancho - w) / 2, y: (alto - h) / 2, width: w, height: h });
  return pdf.save();
}

async function archivoAJpeg(file: File): Promise<{ jpeg: Uint8Array; ancho: number; alto: number }> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("No se pudo leer la imagen.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("No se pudo leer la imagen. Use JPG, PNG o WEBP.");
  }
  try {
    return bitmapAJpeg(bitmap);
  } finally {
    bitmap.close();
  }
}

function bitmapAJpeg(bitmap: ImageBitmap): Promise<{ jpeg: Uint8Array; ancho: number; alto: number }> {
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.max(1, Math.round(bitmap.width * escala));
  const alto = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("No se pudo leer la imagen."));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("No se pudo leer la imagen."));
          return;
        }
        resolve({ jpeg: new Uint8Array(await blob.arrayBuffer()), ancho, alto });
      },
      "image/jpeg",
      0.9,
    );
  });
}

async function docxAPdf(buffer: ArrayBuffer): Promise<Uint8Array> {
  const mammoth = await import("mammoth");
  const convertido = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const bloques = htmlABloques(convertido.value);
  if (bloques.length === 0) throw new Error("No se pudo convertir el Word. El archivo no tiene contenido.");
  return bloquesAPdf(bloques);
}

async function excelAPdf(buffer: ArrayBuffer): Promise<Uint8Array> {
  const { valorExcelATextoDDMMYYYY } = await import("@inventario/types");
  const XLSX = await import("xlsx-js-style");
  const libro = XLSX.read(buffer, { type: "array", cellDates: true });
  const bloques: Bloque[] = [];
  let filas = 0;
  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
      header: 1,
      raw: false,
      dateNF: "dd/mm/yyyy",
      defval: "",
    });
    const utiles = rows.filter((row) => row.some((celda) => valorExcelATextoDDMMYYYY(celda)));
    if (utiles.length === 0) continue;
    bloques.push({ tipo: "titulo", texto: nombre });
    for (const row of utiles) {
      if (filas >= MAX_FILAS_EXCEL) {
        bloques.push({ tipo: "texto", texto: "Hay más filas en el Excel. Este PDF muestra las primeras 3000." });
        return bloquesAPdf(bloques);
      }
      filas += 1;
      bloques.push({
        tipo: "texto",
        texto: row.map((celda) => valorExcelATextoDDMMYYYY(celda)).filter(Boolean).join("  ·  "),
      });
    }
  }
  if (bloques.length === 0) throw new Error("No se pudo convertir el Excel. La hoja está vacía.");
  return bloquesAPdf(bloques);
}

type Bloque = { tipo: "titulo" | "texto" | "imagen"; texto?: string; bytes?: Uint8Array; mime?: string };

function htmlABloques(html: string): Bloque[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const bloques: Bloque[] = [];
  const visitar = (nodo: Node) => {
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;
    const el = nodo as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "img") {
      const datos = dataUrlBytes(el.getAttribute("src") ?? "");
      if (datos) bloques.push({ tipo: "imagen", bytes: datos.bytes, mime: datos.mime });
      return;
    }
    if (tag === "table") {
      for (const fila of el.querySelectorAll("tr")) {
        const texto = [...fila.querySelectorAll("th,td")]
          .map((celda) => (celda.textContent ?? "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join("  ·  ");
        if (texto) bloques.push({ tipo: "texto", texto });
      }
      return;
    }
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const texto = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (texto) bloques.push({ tipo: "titulo", texto });
      return;
    }
    if (tag === "p" || tag === "li") {
      const prefijo = tag === "li" ? "- " : "";
      let texto = "";
      const soltarTexto = () => {
        const limpio = texto.replace(/\s+/g, " ").trim();
        texto = "";
        if (limpio) bloques.push({ tipo: "texto", texto: `${prefijo}${limpio}` });
      };
      for (const hijo of el.childNodes) {
        if (hijo.nodeType === Node.ELEMENT_NODE && (hijo as HTMLElement).tagName.toLowerCase() === "img") {
          soltarTexto();
          const datos = dataUrlBytes((hijo as HTMLElement).getAttribute("src") ?? "");
          if (datos) bloques.push({ tipo: "imagen", bytes: datos.bytes, mime: datos.mime });
          continue;
        }
        texto += hijo.textContent ?? "";
      }
      soltarTexto();
      return;
    }
    for (const hijo of el.childNodes) visitar(hijo);
  };
  for (const hijo of doc.body.childNodes) visitar(hijo);
  return bloques;
}

function dataUrlBytes(src: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(src);
  if (!match?.[1] || !match[2]) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { mime: match[1], bytes };
}

async function bloquesAPdf(bloques: Bloque[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([A4_ANCHO, A4_ALTO]);
  let y = A4_ALTO - MARGEN;
  const anchoTexto = A4_ANCHO - MARGEN * 2;

  const nuevaPagina = () => {
    page = pdf.addPage([A4_ANCHO, A4_ALTO]);
    y = A4_ALTO - MARGEN;
  };
  const asegurar = (alto: number) => {
    if (y - alto < MARGEN) nuevaPagina();
  };
  const escribir = (texto: string, fuente: typeof normal, tamano: number) => {
    const lineas = partirLineas(winAnsi(texto), (linea) => fuente.widthOfTextAtSize(linea, tamano), anchoTexto);
    for (const linea of lineas) {
      asegurar(INTERLINEADO);
      page.drawText(linea, { x: MARGEN, y: y - tamano, size: tamano, font: fuente });
      y -= INTERLINEADO;
    }
    y -= 4;
  };

  for (const bloque of bloques) {
    if (bloque.tipo === "imagen" && bloque.bytes && bloque.mime) {
      const jpeg = await bytesImagenAJpeg(bloque.bytes, bloque.mime);
      if (!jpeg) continue;
      const image = await pdf.embedJpg(jpeg.bytes);
      const maxAlto = A4_ALTO - MARGEN * 2;
      const escala = Math.min(anchoTexto / image.width, maxAlto / image.height);
      const w = image.width * escala;
      const h = image.height * escala;
      asegurar(h + 8);
      page.drawImage(image, { x: MARGEN, y: y - h, width: w, height: h });
      y -= h + 8;
      continue;
    }
    if (!bloque.texto) continue;
    escribir(bloque.texto, bloque.tipo === "titulo" ? negrita : normal, bloque.tipo === "titulo" ? 13 : TAMANO);
  }
  return pdf.save();
}

async function bytesImagenAJpeg(bytes: Uint8Array, mime: string): Promise<{ bytes: Uint8Array } | null> {
  if (mime === "image/jpeg" || mime === "image/jpg") return { bytes };
  try {
    const blob = new Blob([copiaBytes(bytes)], { type: mime });
    const bitmap = await createImageBitmap(blob);
    try {
      const jpeg = await bitmapAJpeg(bitmap);
      return { bytes: jpeg.jpeg };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

function winAnsi(texto: string): string {
  return texto
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\u0000-\u00ff]/g, "?");
}

function partirLineas(texto: string, anchoDe: (linea: string) => number, maximo: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (anchoDe(prueba) <= maximo) {
      actual = prueba;
      continue;
    }
    if (actual) lineas.push(actual);
    actual = anchoDe(palabra) <= maximo ? palabra : partirPalabra(palabra, anchoDe, maximo).join("\n");
    if (actual.includes("\n")) {
      const trozos = actual.split("\n");
      lineas.push(...trozos.slice(0, -1));
      actual = trozos[trozos.length - 1] ?? "";
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function partirPalabra(palabra: string, anchoDe: (linea: string) => number, maximo: number): string[] {
  const trozos: string[] = [];
  let actual = "";
  for (const char of palabra) {
    const prueba = actual + char;
    if (anchoDe(prueba) <= maximo) {
      actual = prueba;
      continue;
    }
    if (actual) trozos.push(actual);
    actual = char;
  }
  if (actual) trozos.push(actual);
  return trozos.length > 0 ? trozos : [palabra];
}
