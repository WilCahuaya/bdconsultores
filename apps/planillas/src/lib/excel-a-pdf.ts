import { textoCeldaExcelDDMMYYYY } from "@inventario/types";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const MAX_FILAS = 3000;
const MAX_COLUMNAS = 300;
const PALETA = [
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080",
  "9999FF", "993366", "FFFFCC", "CCFFFF", "660066", "FF8080", "0066CC", "CCCCFF",
  "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF",
  "00CCFF", "CCFFFF", "CCFFCC", "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99",
  "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696",
  "003366", "339966", "003300", "333300", "993300", "993366", "333399", "333333",
];

const PAPEL: Record<number, [number, number]> = {
  1: [612, 792],
  3: [792, 1224],
  5: [612, 1008],
  8: [841.89, 1190.55],
  9: [595.28, 841.89],
  11: [419.53, 595.28],
};

type Lado = { grosor: number; color: string } | null;
type Fuente = { tamano: number; negrita: boolean; cursiva: boolean; color: string };
type Alineacion = { horizontal: "left" | "center" | "right"; vertical: "top" | "center" | "bottom"; ajustar: boolean };
type Estilo = { fuente: Fuente; relleno: string | null; borde: { l: Lado; r: Lado; t: Lado; b: Lado }; alineacion: Alineacion };
type Merge = { r0: number; c0: number; r1: number; c1: number };
type PaginaHoja = { filas: number[]; repetir: number[] };

const FUENTE_BASE: Fuente = { tamano: 11, negrita: false, cursiva: false, color: "000000" };
const ALINEACION_BASE: Alineacion = { horizontal: "left", vertical: "center", ajustar: false };

export async function excelComoPdf(buffer: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(buffer);
  const archivos = await descomprimir(bytes);
  const estilosXml = texto(archivos.get("xl/styles.xml"));
  const libroXml = texto(archivos.get("xl/workbook.xml"));
  const rels = texto(archivos.get("xl/_rels/workbook.xml.rels"));
  if (!estilosXml || !libroXml || !rels) throw new Error("No se pudo convertir el Excel. El archivo no tiene un formato válido.");

  const estilos = leerEstilos(estilosXml);
  const hojas = hojasDelLibro(libroXml, rels);
  const titulos = titulosDeImpresion(libroXml);
  const XLSX = await cargarXlsx();
  const libro = XLSX.read(bytes, { type: "array", cellDates: true });
  const pdf = await PDFDocument.create();
  const fuentes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
    cursiva: await pdf.embedFont(StandardFonts.HelveticaOblique),
    negritaCursiva: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  let dibujo = false;

  for (let i = 0; i < hojas.length; i += 1) {
    const hoja = hojas[i];
    if (!hoja) continue;
    const xml = texto(archivos.get(hoja.ruta));
    const valores = libro.Sheets[hoja.nombre];
    if (!xml || !valores) continue;
    const armada = armarHoja(xml, valores, estilos, titulos.get(i) ?? []);
    if (!armada) continue;
    dibujarHoja(pdf, fuentes, armada);
    dibujo = true;
  }
  if (!dibujo) throw new Error("No se pudo convertir el Excel. La hoja está vacía.");
  return pdf.save();
}

type CeldaXlsx = { w?: unknown; v?: unknown; t?: unknown; z?: unknown };
type XlsxModule = {
  read: (
    data: Uint8Array,
    opts: { type: "array"; cellDates?: boolean },
  ) => { Sheets: Record<string, Record<string, CeldaXlsx>> };
};

async function cargarXlsx(): Promise<XlsxModule> {
  const mod = (await import("xlsx-js-style")) as XlsxModule & { default?: XlsxModule };
  return typeof mod.read === "function" ? mod : (mod.default as XlsxModule);
}

async function descomprimir(data: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 65536); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("No se pudo convertir el Excel. El archivo no tiene un formato válido.");
  const cantidad = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const archivos = new Map<string, Uint8Array>();
  for (let n = 0; n < cantidad; n += 1) {
    if (cursor + 46 > data.length || view.getUint32(cursor, true) !== 0x02014b50) break;
    const metodo = view.getUint16(cursor + 10, true);
    const compSize = view.getUint32(cursor + 20, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const local = view.getUint32(cursor + 42, true);
    const nombre = new TextDecoder().decode(data.subarray(cursor + 46, cursor + 46 + nameLen));
    const localName = view.getUint16(local + 26, true);
    const localExtra = view.getUint16(local + 28, true);
    const inicio = local + 30 + localName + localExtra;
    const comprimido = data.subarray(inicio, inicio + compSize);
    const plano = metodo === 0 ? comprimido : metodo === 8 ? await inflar(comprimido) : new Uint8Array();
    if (nombre && !nombre.endsWith("/")) archivos.set(nombre.replace(/\\/g, "/"), plano);
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return archivos;
}

async function inflar(comprimido: Uint8Array): Promise<Uint8Array> {
  const copia = new Uint8Array(comprimido.byteLength);
  copia.set(comprimido);
  const stream = new Blob([copia]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function texto(bytes: Uint8Array | undefined): string {
  return bytes ? new TextDecoder().decode(bytes) : "";
}

function bloques(xml: string, etiqueta: string): string[] {
  const salida: string[] = [];
  const abre = `<${etiqueta}`;
  const cierra = `</${etiqueta}>`;
  let i = 0;
  while (i < xml.length) {
    const inicio = xml.indexOf(abre, i);
    if (inicio < 0) break;
    const siguiente = xml[inicio + abre.length];
    if (siguiente !== ">" && siguiente !== " " && siguiente !== "/") {
      i = inicio + abre.length;
      continue;
    }
    const finTag = xml.indexOf(">", inicio);
    if (finTag < 0) break;
    if (xml[finTag - 1] === "/") {
      salida.push(xml.slice(inicio, finTag + 1));
      i = finTag + 1;
      continue;
    }
    const fin = xml.indexOf(cierra, finTag);
    if (fin < 0) break;
    salida.push(xml.slice(inicio, fin + cierra.length));
    i = fin + cierra.length;
  }
  return salida;
}

function seccion(xml: string, etiqueta: string): string {
  const inicio = xml.indexOf(`<${etiqueta}`);
  if (inicio < 0) return "";
  const fin = xml.indexOf(`</${etiqueta}>`, inicio);
  return fin < 0 ? xml.slice(inicio) : xml.slice(inicio, fin + etiqueta.length + 3);
}

function atributo(tag: string, nombre: string): string | null {
  const m = new RegExp(`(?:^|\\s)${nombre}="([^"]*)"`).exec(tag);
  return m?.[1] ?? null;
}

function colorDe(fragmento: string): string {
  const color = /<(?:fgColor|bgColor|color)\b([^>]*)\/?>/.exec(fragmento);
  const attrs = color?.[1] ?? "";
  if (!attrs) return "000000";
  const rgbHex = atributo(attrs, "rgb");
  if (rgbHex) return rgbHex.slice(-6);
  const indexed = atributo(attrs, "indexed");
  if (indexed) {
    const n = Number(indexed);
    if (n === 64) return "000000";
    if (n === 65) return "FFFFFF";
    return PALETA[n] ?? "000000";
  }
  const theme = atributo(attrs, "theme");
  if (theme === "0" || theme === "2") return "FFFFFF";
  return "000000";
}

function marcado(fragmento: string, etiqueta: string): boolean {
  const m = new RegExp(`<${etiqueta}\\b([^>]*)\\/?>`).exec(fragmento);
  if (!m) return false;
  const val = atributo(m[1] ?? "", "val");
  return val == null || (val !== "0" && val !== "false");
}

function leerEstilos(xml: string): Estilo[] {
  const fuentes = bloques(seccion(xml, "fonts"), "font").map((font): Fuente => ({
    tamano: Number(atributo(/<sz\b([^>]*)\/?>/.exec(font)?.[1] ?? "", "val") ?? 11) || 11,
    negrita: marcado(font, "b"),
    cursiva: marcado(font, "i"),
    color: /<color\b/.test(font) ? colorDe(font) : "000000",
  }));
  const rellenos = bloques(seccion(xml, "fills"), "fill").map((fill) => {
    if (!/patternType="solid"/.test(fill)) return null;
    const fg = /<fgColor\b([^>]*)\/?>/.exec(fill);
    return fg ? colorDe(fg[0]) : null;
  });
  const bordes = bloques(seccion(xml, "borders"), "border").map((borde) => ({
    l: lado(borde, "left"),
    r: lado(borde, "right"),
    t: lado(borde, "top"),
    b: lado(borde, "bottom"),
  }));
  return bloques(seccion(xml, "cellXfs"), "xf").map((xf) => {
    const alineacion = /<alignment\b([^>]*)\/?>/.exec(xf)?.[1] ?? "";
    const horizontal = atributo(alineacion, "horizontal");
    const vertical = atributo(alineacion, "vertical");
    return {
      fuente: fuentes[Number(atributo(xf, "fontId") ?? 0)] ?? FUENTE_BASE,
      relleno: rellenos[Number(atributo(xf, "fillId") ?? 0)] ?? null,
      borde: bordes[Number(atributo(xf, "borderId") ?? 0)] ?? { l: null, r: null, t: null, b: null },
      alineacion: {
        horizontal: horizontal === "center" || horizontal === "centerContinuous" ? "center" : horizontal === "right" ? "right" : "left",
        vertical: vertical === "top" ? "top" : vertical === "bottom" ? "bottom" : "center",
        ajustar: atributo(alineacion, "wrapText") === "1",
      },
    };
  });
}

function lado(borde: string, nombre: string): Lado {
  const tag = new RegExp(`<${nombre}\\b([^>]*)\\/?>`).exec(borde);
  if (!tag?.[1]) return null;
  const estilo = atributo(tag[1], "style");
  if (!estilo || estilo === "none") return null;
  const grosor = estilo.includes("thick") ? 2.25 : estilo.includes("medium") ? 1.5 : 0.75;
  return { grosor, color: /<color\b/.test(tag[0]) ? colorDe(tag[0]) : "000000" };
}

function hojasDelLibro(libro: string, rels: string): { nombre: string; ruta: string }[] {
  const destinos = new Map<string, string>();
  for (const rel of bloques(rels, "Relationship")) {
    const id = atributo(rel, "Id");
    const target = atributo(rel, "Target");
    if (id && target) destinos.set(id, target.replace(/^\//, "").replace(/\\/g, "/"));
  }
  return bloques(seccion(libro, "sheets"), "sheet").map((sheet) => {
    const id = atributo(sheet, "r:id") ?? atributo(sheet, "id");
    const destino = id ? destinos.get(id) ?? "" : "";
    const ruta = destino.startsWith("xl/") ? destino : `xl/${destino.replace(/^\.\.\//, "")}`;
    return { nombre: decodificar(atributo(sheet, "name") ?? "Hoja"), ruta };
  });
}

function titulosDeImpresion(libro: string): Map<number, number[]> {
  const mapa = new Map<number, number[]>();
  for (const def of bloques(seccion(libro, "definedNames"), "definedName")) {
    if (atributo(def, "name") !== "_xlnm.Print_Titles") continue;
    const hoja = Number(atributo(def, "localSheetId") ?? 0);
    const cuerpo = def.replace(/<[^>]+>/g, "");
    const filas = /\$(\d+):\$(\d+)/.exec(cuerpo);
    if (!filas?.[1] || !filas[2]) continue;
    const desde = Number(filas[1]) - 1;
    const hasta = Number(filas[2]) - 1;
    const lista: number[] = [];
    for (let r = desde; r <= hasta && r - desde < 8; r += 1) lista.push(r);
    mapa.set(hoja, lista);
  }
  return mapa;
}

type HojaArmada = {
  ancho: number;
  alto: number;
  margen: { izq: number; der: number; sup: number; inf: number };
  escala: number;
  filas: number[];
  columnas: number[];
  textos: Map<string, string>;
  estilosCelda: Map<string, number>;
  ancla: Map<string, Merge>;
  estilos: Estilo[];
  paginas: PaginaHoja[];
  encabezado: string;
  pie: string;
  aviso: string;
};

function armarHoja(
  xml: string,
  valores: Record<string, CeldaXlsx>,
  estilos: Estilo[],
  repetirFilas: number[],
): HojaArmada | null {
  const dimension = /<dimension\b[^>]*ref="([^"]+)"/.exec(xml)?.[1] ?? "A1";
  const limite = limiteDimension(dimension);
  const formato = /<sheetFormatPr\b([^>]*)\/?>/.exec(xml)?.[1] ?? "";
  const altoBase = Number(atributo(formato, "defaultRowHeight") ?? 15) || 15;
  const anchoBase = Number(atributo(formato, "defaultColWidth") ?? atributo(formato, "baseColWidth") ?? 8.43) || 8.43;
  const filas: number[] = [];
  let maxFila = 0;
  let maxCol = 0;
  for (const fila of bloques(seccion(xml, "sheetData"), "row")) {
    const n = Number(atributo(fila, "r") ?? 0);
    if (!n || n > MAX_FILAS) continue;
    const idx = n - 1;
    maxFila = Math.max(maxFila, idx);
    filas[idx] = /hidden="1"/.test(fila) ? 0 : Number(atributo(fila, "ht") ?? altoBase) || altoBase;
  }
  const estilosCelda = new Map<string, number>();
  const celdas = xml.match(/<c r="([A-Z]+)(\d+)"([^>]*)>/g) ?? [];
  for (const celda of celdas) {
    const m = /<c r="([A-Z]+)(\d+)"([^>]*)>/.exec(celda);
    if (!m?.[1] || !m[2]) continue;
    const fila = Number(m[2]) - 1;
    const col = columnaIndice(m[1]);
    if (fila < 0 || fila >= MAX_FILAS || col >= MAX_COLUMNAS) continue;
    maxFila = Math.max(maxFila, fila);
    maxCol = Math.max(maxCol, col);
    const estilo = atributo(m[3], "s");
    if (estilo) estilosCelda.set(`${fila},${col}`, Number(estilo));
  }
  maxFila = Math.min(Math.max(maxFila, limite.fila), MAX_FILAS - 1);
  maxCol = Math.min(Math.max(maxCol, limite.col), MAX_COLUMNAS - 1);
  for (let r = 0; r <= maxFila; r += 1) if (filas[r] == null) filas[r] = altoBase;

  const columnas = new Array<number>(maxCol + 1).fill(anchoBase);
  for (const col of bloques(seccion(xml, "cols"), "col")) {
    const min = Number(atributo(col, "min") ?? 1);
    const max = Math.min(Number(atributo(col, "max") ?? min), maxCol + 1);
    const ancho = /hidden="1"/.test(col) ? 0 : Number(atributo(col, "width") ?? anchoBase) || anchoBase;
    for (let c = min - 1; c < max && c <= maxCol; c += 1) columnas[c] = ancho;
  }

  const ancla = new Map<string, Merge>();
  for (const merge of bloques(seccion(xml, "mergeCells"), "mergeCell")) {
    const ref = atributo(merge, "ref");
    const partes = ref ? rango(ref) : null;
    if (!partes) continue;
    const m = {
      r0: Math.max(0, partes.r0),
      c0: Math.max(0, partes.c0),
      r1: Math.min(maxFila, partes.r1),
      c1: Math.min(maxCol, partes.c1),
    };
    for (let r = m.r0; r <= m.r1; r += 1) {
      for (let c = m.c0; c <= m.c1; c += 1) ancla.set(`${r},${c}`, m);
    }
  }

  const textos = new Map<string, string>();
  for (const [direccion, celda] of Object.entries(valores)) {
    if (direccion.startsWith("!")) continue;
    const pos = direccionCelda(direccion);
    if (!pos || pos.r > maxFila || pos.c > maxCol) continue;
    const limpio = textoCeldaExcelDDMMYYYY(celda);
    if (limpio) textos.set(`${pos.r},${pos.c}`, limpio);
  }
  if (textos.size === 0 && estilosCelda.size === 0) return null;

  const pagina = configurarPagina(xml);
  const anchoHoja = columnas.reduce((suma, ancho) => suma + puntosColumna(ancho), 0);
  const anchoUtil = pagina.ancho - pagina.margen.izq - pagina.margen.der;
  let escala = pagina.escala;
  if (anchoHoja > 0 && anchoHoja * escala > anchoUtil) escala = anchoUtil / anchoHoja;

  const cortes = cortesDeFila(xml, maxFila);
  const paginas = paginar(filas, cortes, repetirFilas, pagina.alto - pagina.margen.sup - pagina.margen.inf, escala);
  const aviso = maxFila >= MAX_FILAS - 1 || maxCol >= MAX_COLUMNAS - 1 ? "Esta hoja continúa. El PDF muestra la primera parte." : "";
  return {
    ancho: pagina.ancho,
    alto: pagina.alto,
    margen: pagina.margen,
    escala,
    filas,
    columnas,
    textos,
    estilosCelda,
    ancla,
    estilos,
    paginas,
    encabezado: pagina.encabezado,
    pie: pagina.pie,
    aviso,
  };
}

function configurarPagina(xml: string) {
  const setup = /<pageSetup\b([^>]*)\/?>/.exec(xml)?.[1] ?? "";
  const margins = /<pageMargins\b([^>]*)\/?>/.exec(xml)?.[1] ?? "";
  const papel = Number(atributo(setup, "paperSize") ?? 9);
  const base = PAPEL[papel] ?? PAPEL[9] ?? [595.28, 841.89];
  const apaisado = atributo(setup, "orientation") === "landscape";
  const ancho = apaisado ? base[1] : base[0];
  const alto = apaisado ? base[0] : base[1];
  const pulgadas = (nombre: string, defecto: number) => Number(atributo(margins, nombre) ?? defecto) * 72;
  const encabezado = /<oddHeader>([\s\S]*?)<\/oddHeader>/.exec(xml)?.[1] ?? "";
  const pie = /<oddFooter>([\s\S]*?)<\/oddFooter>/.exec(xml)?.[1] ?? "";
  return {
    ancho,
    alto,
    escala: Math.min(4, Math.max(0.2, Number(atributo(setup, "scale") ?? 100) / 100)),
    margen: {
      izq: pulgadas("left", 0.5),
      der: pulgadas("right", 0.4),
      sup: pulgadas("top", 0.5),
      inf: pulgadas("bottom", 0.4),
    },
    encabezado: decodificar(encabezado),
    pie: decodificar(pie),
  };
}

function cortesDeFila(xml: string, maxFila: number): number[] {
  const cortes: number[] = [];
  for (const brk of bloques(seccion(xml, "rowBreaks"), "brk")) {
    const id = Number(atributo(brk, "id") ?? -1);
    if (id > 0 && id <= maxFila) cortes.push(id);
  }
  return cortes;
}

function paginar(filas: number[], cortes: number[], repetir: number[], altoUtil: number, escala: number): PaginaHoja[] {
  const limites = [0, ...cortes.filter((c) => c > 0 && c < filas.length), filas.length];
  const paginas: PaginaHoja[] = [];
  for (let i = 0; i < limites.length - 1; i += 1) {
    const desde = limites[i] ?? 0;
    const hasta = limites[i + 1] ?? filas.length;
    const titulo = repetir.filter((r) => r < desde);
    const altoTitulo = titulo.reduce((suma, r) => suma + (filas[r] ?? 0), 0) * escala;
    let lote: number[] = [];
    let usado = altoTitulo;
    for (let r = desde; r < hasta; r += 1) {
      const alto = (filas[r] ?? 0) * escala;
      if (lote.length > 0 && usado + alto > altoUtil + 0.5) {
        paginas.push({ filas: lote, repetir: titulo });
        lote = [];
        usado = altoTitulo;
      }
      lote.push(r);
      usado += alto;
    }
    if (lote.length > 0) paginas.push({ filas: lote, repetir: titulo });
  }
  return paginas;
}

function dibujarHoja(
  pdf: PDFDocument,
  fuentes: { normal: PDFFont; negrita: PDFFont; cursiva: PDFFont; negritaCursiva: PDFFont },
  hoja: HojaArmada,
) {
  const total = hoja.paginas.length + (hoja.aviso ? 1 : 0);
  hoja.paginas.forEach((pagina, indice) => {
    const page = pdf.addPage([hoja.ancho, hoja.alto]);
    dibujarContenido(page, fuentes, hoja, pagina);
    dibujarMargen(page, fuentes, hoja, indice + 1, total);
  });
  if (hoja.aviso) {
    const page = pdf.addPage([hoja.ancho, hoja.alto]);
    page.drawText(winAnsi(hoja.aviso), {
      x: hoja.margen.izq,
      y: hoja.alto / 2,
      size: 11,
      font: fuentes.normal,
    });
  }
}

function dibujarContenido(
  page: PDFPage,
  fuentes: { normal: PDFFont; negrita: PDFFont; cursiva: PDFFont; negritaCursiva: PDFFont },
  hoja: HojaArmada,
  pagina: PaginaHoja,
) {
  const filas = [...pagina.repetir, ...pagina.filas];
  const yTop = new Map<number, number>();
  let cursor = hoja.alto - hoja.margen.sup;
  for (const fila of filas) {
    const alto = (hoja.filas[fila] ?? 0) * hoja.escala;
    cursor -= alto;
    yTop.set(fila, cursor + alto);
  }
  const x = new Array<number>(hoja.columnas.length + 1);
  x[0] = hoja.margen.izq;
  for (let c = 0; c < hoja.columnas.length; c += 1) x[c + 1] = (x[c] ?? 0) + puntosColumna(hoja.columnas[c] ?? 0) * hoja.escala;

  const horizontales = new Map<string, Trazo>();
  const verticales = new Map<string, Trazo>();

  for (const fila of filas) {
    const y1 = yTop.get(fila) ?? 0;
    const y0 = y1 - (hoja.filas[fila] ?? 0) * hoja.escala;
    for (let c = 0; c < hoja.columnas.length; c += 1) {
      const clave = `${fila},${c}`;
      const estilo = hoja.estilos[hoja.estilosCelda.get(clave) ?? -1];
      const x0 = x[c] ?? 0;
      const x1 = x[c + 1] ?? x0;
      if (estilo?.relleno && estilo.relleno.toUpperCase() !== "FFFFFF") {
        const color = rgbDe(estilo.relleno);
        page.drawRectangle({ x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0), color });
      }
      if (!estilo) continue;
      const merge = hoja.ancla.get(clave);
      const interior = (r: number, col: number) =>
        !!merge && r >= merge.r0 && r <= merge.r1 && col >= merge.c0 && col <= merge.c1;
      if (!interior(fila - 1, c)) trazo(horizontales, `h:${fila}:${c}`, estilo.borde.t, { y: y1, x0, x1, x: 0, y0: 0, y1: 0 });
      if (!interior(fila + 1, c)) trazo(horizontales, `h:${fila + 1}:${c}`, estilo.borde.b, { y: y0, x0, x1, x: 0, y0: 0, y1: 0 });
      if (!interior(fila, c - 1)) trazo(verticales, `v:${c}:${fila}`, estilo.borde.l, { y: 0, x0: 0, x1: 0, x: x0, y0, y1 });
      if (!interior(fila, c + 1)) trazo(verticales, `v:${c + 1}:${fila}`, estilo.borde.r, { y: 0, x0: 0, x1: 0, x: x1, y0, y1 });
    }
  }

  for (const fila of filas) {
    for (let c = 0; c < hoja.columnas.length; c += 1) {
      const merge = hoja.ancla.get(`${fila},${c}`);
      if (merge && (merge.r0 !== fila || merge.c0 !== c)) continue;
      const texto = hoja.textos.get(`${fila},${c}`);
      if (!texto) continue;
      const c1 = merge ? merge.c1 : c;
      const r1 = merge ? merge.r1 : fila;
      if (!filas.includes(r1) || yTop.get(fila) == null) continue;
      const estilo = hoja.estilos[hoja.estilosCelda.get(`${fila},${c}`) ?? -1];
      const rect = {
        x: x[c] ?? 0,
        x1: x[c1 + 1] ?? x[c] ?? 0,
        y: (yTop.get(r1) ?? 0) - (hoja.filas[r1] ?? 0) * hoja.escala,
        y1: yTop.get(fila) ?? 0,
      };
      dibujarTexto(page, fuentes, texto, estilo, rect, hoja.escala);
    }
  }

  for (const linea of horizontales.values()) {
    page.drawLine({
      start: { x: linea.x0, y: linea.y },
      end: { x: linea.x1, y: linea.y },
      thickness: Math.max(0.4, linea.grosor * hoja.escala),
      color: rgbDe(linea.color),
    });
  }
  for (const linea of verticales.values()) {
    page.drawLine({
      start: { x: linea.x, y: linea.y0 },
      end: { x: linea.x, y: linea.y1 },
      thickness: Math.max(0.4, linea.grosor * hoja.escala),
      color: rgbDe(linea.color),
    });
  }
}

type Trazo = { y: number; x0: number; x1: number; x: number; y0: number; y1: number; grosor: number; color: string };

function trazo(mapa: Map<string, Trazo>, clave: string, lado: Lado, base: Omit<Trazo, "grosor" | "color">) {
  if (!lado) return;
  const previo = mapa.get(clave);
  if (previo && previo.grosor >= lado.grosor) return;
  mapa.set(clave, { ...base, grosor: lado.grosor, color: lado.color });
}

function dibujarTexto(
  page: PDFPage,
  fuentes: { normal: PDFFont; negrita: PDFFont; cursiva: PDFFont; negritaCursiva: PDFFont },
  texto: string,
  estilo: Estilo | undefined,
  rect: { x: number; x1: number; y: number; y1: number },
  escala: number,
) {
  const fuenteEstilo = estilo?.fuente ?? FUENTE_BASE;
  const alineacion = estilo?.alineacion ?? ALINEACION_BASE;
  const font = fuenteEstilo.negrita && fuenteEstilo.cursiva
    ? fuentes.negritaCursiva
    : fuenteEstilo.negrita
      ? fuentes.negrita
      : fuenteEstilo.cursiva
        ? fuentes.cursiva
        : fuentes.normal;
  const ancho = Math.max(0, rect.x1 - rect.x);
  const alto = Math.max(0, rect.y1 - rect.y);
  if (ancho < 3 || alto < 3) return;
  const pad = Math.min(2, ancho * 0.06);
  const usable = Math.max(1, ancho - pad * 2);
  const plano = winAnsi(texto);
  let tamano = Math.max(4, fuenteEstilo.tamano * escala);
  let lineas = partir(plano, font, tamano, usable, alineacion.ajustar);
  let altoLinea = tamano * 1.12;
  for (let intento = 0; intento < 8 && tamano > 4; intento += 1) {
    const anchoMax = lineas.reduce((max, linea) => Math.max(max, font.widthOfTextAtSize(linea, tamano)), 0);
    if (anchoMax <= usable + 0.4 && lineas.length * altoLinea <= alto - 0.5) break;
    tamano = Math.max(4, tamano * Math.min(0.92, usable / Math.max(anchoMax, 1)));
    altoLinea = tamano * 1.12;
    lineas = partir(plano, font, tamano, usable, alineacion.ajustar || anchoMax > usable);
  }
  const bloque = lineas.length * altoLinea;
  let baseline = alineacion.vertical === "top"
    ? rect.y1 - tamano - 1
    : alineacion.vertical === "bottom"
      ? rect.y + 1 + (lineas.length - 1) * altoLinea
      : rect.y + (alto - bloque) / 2 + (lineas.length - 1) * altoLinea + tamano * 0.15;
  const color = rgbDe(fuenteEstilo.color);
  for (const linea of lineas) {
    const medida = font.widthOfTextAtSize(linea, tamano);
    const x = alineacion.horizontal === "center"
      ? rect.x + (ancho - medida) / 2
      : alineacion.horizontal === "right"
        ? rect.x1 - pad - medida
        : rect.x + pad;
    if (baseline >= rect.y - 1 && baseline <= rect.y1) {
      try {
        page.drawText(linea, { x: Math.max(rect.x + 0.4, x), y: baseline, size: tamano, font, color });
      } catch {
        // Un carácter fuera de la fuente no debe impedir el resto de la ficha.
      }
    }
    baseline -= altoLinea;
  }
}

function partir(texto: string, font: PDFFont, tamano: number, maximo: number, ajustar: boolean): string[] {
  if (!ajustar) return [texto];
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    const palabras = parrafo.split(" ").filter((p) => p.length > 0);
    let actual = "";
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, tamano) <= maximo) {
        actual = prueba;
        continue;
      }
      if (actual) lineas.push(actual);
      actual = palabra;
    }
    if (actual) lineas.push(actual);
  }
  return lineas.length > 0 ? lineas : [""];
}

function dibujarMargen(
  page: PDFPage,
  fuentes: { normal: PDFFont; negrita: PDFFont; cursiva: PDFFont; negritaCursiva: PDFFont },
  hoja: HojaArmada,
  numero: number,
  total: number,
) {
  const encabezado = interpretarMargen(hoja.encabezado, numero, total);
  const pie = interpretarMargen(hoja.pie, numero, total);
  pintarSeccion(page, fuentes, encabezado, hoja, hoja.alto - 16);
  pintarSeccion(page, fuentes, pie, hoja, 16);
}

function interpretarMargen(raw: string, pagina: number, total: number) {
  const sec = {
    L: { t: "", sz: 8, bold: false },
    C: { t: "", sz: 8, bold: false },
    R: { t: "", sz: 8, bold: false },
  };
  let actual: keyof typeof sec = "L";
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== "&") {
      sec[actual].t += raw[i];
      continue;
    }
    const marca = raw[i + 1] ?? "";
    if (marca === "&") {
      sec[actual].t += "&";
      i += 1;
      continue;
    }
    if (marca === "L" || marca === "C" || marca === "R") {
      actual = marca;
      i += 1;
      continue;
    }
    if (marca === "P") {
      sec[actual].t += String(pagina);
      i += 1;
      continue;
    }
    if (marca === "N") {
      sec[actual].t += String(total);
      i += 1;
      continue;
    }
    if (marca === "B") {
      sec[actual].bold = true;
      i += 1;
      continue;
    }
    if (marca === '"') {
      const fin = raw.indexOf('"', i + 2);
      const nombre = raw.slice(i + 2, fin < 0 ? raw.length : fin);
      sec[actual].bold = /negrita|bold/i.test(nombre);
      i = fin < 0 ? raw.length : fin;
      continue;
    }
    if (/\d/.test(marca)) {
      let j = i + 1;
      while (j < raw.length && /\d/.test(raw[j] ?? "")) j += 1;
      sec[actual].sz = Number(raw.slice(i + 1, j));
      i = j - 1;
      continue;
    }
    i += 1;
  }
  return sec;
}

function pintarSeccion(
  page: PDFPage,
  fuentes: { normal: PDFFont; negrita: PDFFont },
  sec: { L: { t: string; sz: number; bold: boolean }; C: { t: string; sz: number; bold: boolean }; R: { t: string; sz: number; bold: boolean } },
  hoja: HojaArmada,
  y: number,
) {
  const pintar = (texto: string, sz: number, bold: boolean, alineacion: "left" | "center" | "right") => {
    const limpio = winAnsi(texto.trim());
    if (!limpio) return;
    const font = bold ? fuentes.negrita : fuentes.normal;
    const size = Math.max(6, sz * hoja.escala);
    const ancho = font.widthOfTextAtSize(limpio, size);
    const x = alineacion === "center"
      ? (hoja.ancho - ancho) / 2
      : alineacion === "right"
        ? hoja.ancho - hoja.margen.der - ancho
        : hoja.margen.izq;
    page.drawText(limpio, { x, y, size, font, color: rgb(0, 0, 0) });
  };
  pintar(sec.L.t, sec.L.sz, sec.L.bold, "left");
  pintar(sec.C.t, sec.C.sz, sec.C.bold, "center");
  pintar(sec.R.t, sec.R.sz, sec.R.bold, "right");
}

function puntosColumna(ancho: number): number {
  const mdw = 7;
  const px = Math.floor((ancho + Math.round(128 / mdw) / 256) * mdw);
  return (px * 72) / 96;
}

function rgbDe(hex: string) {
  const n = Number.parseInt(hex.slice(-6), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function limiteDimension(ref: string): { fila: number; col: number } {
  const partes = rango(ref);
  return partes ? { fila: partes.r1, col: partes.c1 } : { fila: 0, col: 0 };
}

function rango(ref: string): { r0: number; c0: number; r1: number; c1: number } | null {
  const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(ref);
  if (!m?.[1] || !m[2]) return null;
  const c0 = columnaIndice(m[1]);
  const r0 = Number(m[2]) - 1;
  const c1 = m[3] ? columnaIndice(m[3]) : c0;
  const r1 = m[4] ? Number(m[4]) - 1 : r0;
  return { r0, c0, r1, c1 };
}

function columnaIndice(letras: string): number {
  let n = 0;
  for (const char of letras) n = n * 26 + (char.charCodeAt(0) - 64);
  return n - 1;
}

function direccionCelda(direccion: string): { r: number; c: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(direccion);
  if (!m?.[1] || !m[2]) return null;
  return { c: columnaIndice(m[1]), r: Number(m[2]) - 1 };
}

function decodificar(valor: string): string {
  return valor
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
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
