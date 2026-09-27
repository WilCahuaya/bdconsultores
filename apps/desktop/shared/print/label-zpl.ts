/** Honeywell PC42t — 203 dpi. Cinta 110 mm, etiqueta 50×25 mm, 2 columnas, 3 huecos iguales. */
import {
  formatCodigoBarrasSimbolo,
  normalizeCodigoBarrasDisplay,
  fitLabelLine,
  resolveNombreEtiqueta,
} from "@inventario/types";

export const LABEL_DPI = 203;
export const LABEL_WIDTH_MM = 50;
export const LABEL_HEIGHT_MM = 25;
export const TAPE_WIDTH_MM = 110;
export const LABELS_PER_ROW = 2;

/** Hueco lateral y central: (110 − 2×50) / 3 ≈ 3,33 mm */
export const TAPE_GAP_MM = (TAPE_WIDTH_MM - LABEL_WIDTH_MM * LABELS_PER_ROW) / (LABELS_PER_ROW + 1);

/** Ancho máximo del símbolo Code 128 en la etiqueta (mm). */
export const BARCODE_MAX_WIDTH_MM = 30;

export const HONEYWELL_BARCODE_MODULES = [1, 1.5, 2, 2.5, 3] as const;
export type HoneywellBarcodeModule = (typeof HONEYWELL_BARCODE_MODULES)[number];

export interface LabelZplInput {
  entidadNombre: string;
  codigoBarras: string;
  nombreBien: string;
  /** ISO (YYYY-MM-DD) o DD/MM/YYYY; en etiqueta solo el año. */
  fechaAdquisicion?: string | null;
}

/** Fuente de texto con override opcional para etiqueta. */
export interface LabelNombreSource {
  nombre: string;
  nombre_etiqueta?: string | null;
}

export interface LabelActivoPrintSource extends LabelNombreSource {
  codigo_barras: string;
  fecha_adquisicion?: string | null;
}

/** Resuelve nombre_etiqueta y arma LabelZplInput listo para buildLabelZpl. */
export function labelZplInputFromActivo(
  activo: LabelActivoPrintSource,
  entidad: LabelNombreSource,
): LabelZplInput {
  return {
    entidadNombre: resolveNombreEtiqueta(entidad.nombre, entidad.nombre_etiqueta),
    codigoBarras: activo.codigo_barras,
    nombreBien: resolveNombreEtiqueta(activo.nombre, activo.nombre_etiqueta),
    fechaAdquisicion: activo.fecha_adquisicion,
  };
}

export function labelZplInputsFromActivos(
  activos: LabelActivoPrintSource[],
  entidad: LabelNombreSource,
): LabelZplInput[] {
  return activos.map((activo) => labelZplInputFromActivo(activo, entidad));
}

function mmToDots(mm: number): number {
  return Math.round((mm * LABEL_DPI) / 25.4);
}

export function dotsToMm(dots: number): number {
  return (dots * 25.4) / LABEL_DPI;
}

export const LABEL_WIDTH_DOTS = mmToDots(LABEL_WIDTH_MM);
export const LABEL_HEIGHT_DOTS = mmToDots(LABEL_HEIGHT_MM);
export const TAPE_WIDTH_DOTS = mmToDots(TAPE_WIDTH_MM);
export const TAPE_GAP_DOTS = mmToDots(TAPE_GAP_MM);

/**
 * Posiciones ^FO relativas al borde izquierdo de cada etiqueta 50 mm (0…400 dots).
 * Ajustado desde plantilla cinta (B&D ^FO5 → x=0); todo cabe en 50 mm.
 */
export const LABEL_LAYOUT = {
  nombre: { xDots: 0, yDots: 25, font: 22, fullWidth: true },
  brand: { xDots: 0, yDots: 53, font: 23 },
  controlVertical: { xDots: 5, yDots: 99, font: 18 },
  patrimonialVertical: { xDots: 25, yDots: 85, font: 18 },
  barcode: { xDots: 45, yDots: 53, module: 1.5, ratio: 2, heightDots: 65 },
  codigoText: { xDots: 0, yDots: 123, font: 23, fullWidth: true },
  adquisicion: { xDots: 0, yDots: 150, font: 18, fullWidth: true },
  entidad: { xDots: 0, yDots: 175, font: 22, fullWidth: true },
} as const;

/** Code 128 subset C en ZPL (^FD>:datos): solo dígitos, longitud par, ≥ 4. */
export function usesCode128SubsetC(symbol: string): boolean {
  return /^\d+$/.test(symbol) && symbol.length >= 4 && symbol.length % 2 === 0;
}

/**
 * Payload ^FD para ^BCN: fuerza subset C en códigos numéricos pares (más estrecho y legible).
 * Catálogo propio BD… ya viene como 24… vía formatCodigoBarrasSimbolo.
 */
export function code128ZplPayload(symbol: string): string {
  return usesCode128SubsetC(symbol) ? `>:${symbol}` : symbol;
}

function code128SubsetBModules(charCount: number): number {
  return 35 + 11 * charCount;
}

/** Code 128 subset C: start(11) + pares×11 + check(11) + stop(13). */
function code128SubsetCModules(charCount: number): number {
  return 35 + 11 * Math.ceil(charCount / 2);
}

/** Módulos Code 128 aprox. (12 dígitos numéricos; ^BCN elige subset en impresora). */
export function estimateCode128Modules(charCount: number, code?: string): number {
  if (code && /^\d{12}$/.test(code)) {
    return 95;
  }
  if (code && /^\d+$/.test(code) && charCount >= 2) {
    return code128SubsetCModules(charCount);
  }
  return code128SubsetBModules(charCount);
}

/**
 * Estimación para impresión: con >: (subset C) en códigos de 12 dígitos;
 * sin él, subset B (más ancho).
 */
export function estimateCode128ModulesForPrint(charCount: number, code?: string): number {
  const symbol = code?.trim() ?? "";
  if (symbol && usesCode128SubsetC(symbol)) {
    return code128SubsetCModules(charCount);
  }
  if (symbol && /^\d+$/.test(symbol)) {
    return code128SubsetBModules(charCount);
  }
  return estimateCode128Modules(charCount, code);
}

export function estimateCode128WidthDots(charCount: number, module: number, code?: string): number {
  return Math.ceil(estimateCode128ModulesForPrint(charCount, code) * module);
}

export function barcodeMaxWidthDots(): number {
  return Math.min(
    mmToDots(BARCODE_MAX_WIDTH_MM),
    LABEL_WIDTH_DOTS - LABEL_LAYOUT.barcode.xDots,
  );
}

/**
 * Módulo ^BY Honeywell: el mayor valor ≤ preferido que quepa en BARCODE_MAX_WIDTH_MM (mín. 1).
 * Con subset C (12 dígitos + >:) cabe módulo 1.5 (~19 mm).
 */
export function resolveBarcodeModule(code?: string): HoneywellBarcodeModule {
  const symbol = code?.trim() ?? "";
  const charCount = symbol.length || 12;
  const modulesCount = estimateCode128ModulesForPrint(charCount, symbol || undefined);
  const maxWidthDots = barcodeMaxWidthDots();
  const preferred = LABEL_LAYOUT.barcode.module;

  let chosen: HoneywellBarcodeModule = HONEYWELL_BARCODE_MODULES[0];
  for (const mod of HONEYWELL_BARCODE_MODULES) {
    if (mod > preferred) continue;
    if (modulesCount * mod <= maxWidthDots) {
      chosen = mod;
    }
  }
  return chosen;
}

/**
 * Calibración columna derecha (2-up). Negativo mueve el contenido a la izquierda.
 * Ajustado frente a rollo físico Honeywell 110 mm (hueco central real < teórico).
 */
export const LABEL_COLUMN1_X_OFFSET_DOTS = -7;

/** Solo columna izquierda: desplaza B&D, vertical y barcode (no los campos ^FB centrados). */
export const LABEL_COLUMN0_X_OFFSET_DOTS = 2;

export function labelColumnSideShift(column: number): number {
  return column === 0 ? LABEL_COLUMN0_X_OFFSET_DOTS : 0;
}

/** Origen X en cinta de cada columna (mm desde borde izquierdo del rollo). */
export function tapeColumnOriginMm(column: number): number {
  return TAPE_GAP_MM + column * (LABEL_WIDTH_MM + TAPE_GAP_MM);
}

export function tapeColumnOriginDots(column: number): number {
  if (column === 0) {
    return mmToDots(tapeColumnOriginMm(0));
  }
  const col0 = tapeColumnOriginDots(0);
  const col1 = col0 + LABEL_WIDTH_DOTS + TAPE_GAP_DOTS + LABEL_COLUMN1_X_OFFSET_DOTS;
  return column === 1 ? col1 : mmToDots(tapeColumnOriginMm(column));
}

export function formatAnioAdquisicion(fecha: string | null | undefined): string {
  if (!fecha?.trim()) return "";
  const t = fecha.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 4);
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return slash[3];
  const year = t.match(/(\d{4})/);
  return year?.[1] ?? "";
}

/**
 * Línea de años en la etiqueta.
 * Con fecha: a la derecha de Control Patrimonial.
 * Sin fecha: «inventario {año de impresión}», centrado en los 50 mm.
 */
export function formatLineaInventarioEtiqueta(
  fechaAdquisicion: string | null | undefined,
  anioImpresion = new Date().getFullYear(),
): { text: string; centered: boolean } {
  const anio = formatAnioAdquisicion(fechaAdquisicion);
  if (anio) {
    return {
      text: `Adquisición ${anio} - inventario ${anioImpresion}`,
      centered: false,
    };
  }
  return { text: `inventario ${anioImpresion}`, centered: true };
}

function sanitizeZplField(value: string): string {
  return value.replace(/[\^~\\]/g, " ").replace(/\s+/g, " ").trim();
}

function centeredField(
  tapeX: number,
  tapeY: number,
  font: number,
  text: string,
  lines = 1,
): string {
  return fieldBlock(tapeX, tapeY, LABEL_WIDTH_DOTS, font, text, "C", lines);
}

function fieldBlock(
  tapeX: number,
  tapeY: number,
  widthDots: number,
  font: number,
  text: string,
  align: "C" | "L" | "R",
  lines = 1,
): string {
  return `^FO${tapeX},${tapeY}^A0N,${font},${font}^FB${widthDots},${lines},0,${align},0^FD${text}^FS`;
}

/** Una etiqueta anclada a la cinta en tapeOriginDots. */
function buildLabelSlotZpl(tapeOriginDots: number, input: LabelZplInput, column: number): string {
  const ox = tapeOriginDots;
  const sideX = labelColumnSideShift(column);
  const L = LABEL_LAYOUT;

  const nombreRaw = sanitizeZplField(input.nombreBien.toUpperCase());
  const codigoLegible = sanitizeZplField(normalizeCodigoBarrasDisplay(input.codigoBarras));
  const codigoSimbolo = sanitizeZplField(formatCodigoBarrasSimbolo(input.codigoBarras));
  const entidadRaw = sanitizeZplField(input.entidadNombre.toUpperCase());
  const lineaAnios = formatLineaInventarioEtiqueta(input.fechaAdquisicion);

  const nombreFit = fitLabelLine(nombreRaw, {
    maxWidthDots: LABEL_WIDTH_DOTS,
    preferredFont: L.nombre.font,
  });
  const entidadFit = fitLabelLine(entidadRaw, {
    maxWidthDots: LABEL_WIDTH_DOTS,
    preferredFont: L.entidad.font,
  });
  const { heightDots, ratio, xDots, yDots } = L.barcode;
  const barcodeModule = resolveBarcodeModule(codigoSimbolo);
  const barcodePayload = code128ZplPayload(codigoSimbolo);

  const fields = [
    centeredField(ox + L.nombre.xDots, L.nombre.yDots, nombreFit.font, nombreFit.text),
    `^FO${ox + L.brand.xDots + sideX},${L.brand.yDots}^A0N,${L.brand.font},${L.brand.font}^FDB&D^FS`,
    `^FO${ox + L.controlVertical.xDots + sideX},${L.controlVertical.yDots}^FWB^A0B,${L.controlVertical.font},${L.controlVertical.font}^FDControl^FS^FWN`,
    `^FO${ox + L.patrimonialVertical.xDots + sideX},${L.patrimonialVertical.yDots}^FWB^A0B,${L.patrimonialVertical.font},${L.patrimonialVertical.font}^FDPatrimonial^FS^FWN`,
    `^FO${ox + xDots + sideX},${yDots}^BY${barcodeModule},${ratio},${heightDots}^BCN,${heightDots},N,N,N^FD${barcodePayload}^FS`,
    centeredField(ox + L.codigoText.xDots, L.codigoText.yDots, L.codigoText.font, codigoLegible),
  ];

  if (lineaAnios.centered) {
    fields.push(
      centeredField(
        ox + L.adquisicion.xDots,
        L.adquisicion.yDots,
        L.adquisicion.font,
        lineaAnios.text,
      ),
    );
  } else {
    const leftStripDots = L.barcode.xDots + sideX;
    fields.push(
      fieldBlock(
        ox + leftStripDots,
        L.adquisicion.yDots,
        LABEL_WIDTH_DOTS - leftStripDots,
        L.adquisicion.font,
        lineaAnios.text,
        "C",
      ),
    );
  }

  fields.push(
    centeredField(ox + L.entidad.xDots, L.entidad.yDots, entidadFit.font, entidadFit.text),
  );

  return fields.join("\n");
}

/** Fila del rollo: hasta 2 etiquetas (columnas izquierda y derecha). */
export function buildLabelRowZpl(left: LabelZplInput, right?: LabelZplInput | null): string {
  const slots = [buildLabelSlotZpl(tapeColumnOriginDots(0), left, 0)];
  if (right) {
    slots.push(buildLabelSlotZpl(tapeColumnOriginDots(1), right, 1));
  }

  return `^XA
^CI28
^PW${TAPE_WIDTH_DOTS}
^LL${LABEL_HEIGHT_DOTS}
^LH0,0
^LS0
^MNM
${slots.join("\n")}
^PQ1
^XZ`;
}

export function buildLabelZpl(input: LabelZplInput): string {
  return buildLabelRowZpl(input);
}

/** ZPL de una etiqueta 50×25 para vista previa (Labelary); origen ox=0, ^PW400. */
export function buildLabelPreviewZpl(input: LabelZplInput): string {
  return `^XA
^CI28
^PW${LABEL_WIDTH_DOTS}
^LL${LABEL_HEIGHT_DOTS}
^LH0,0
^LS0
^MNM
${buildLabelSlotZpl(0, input, 0)}
^PQ1
^XZ`;
}

export function buildBatchLabelZpl(entidadNombre: string, items: LabelZplInput[]): string {
  if (items.length === 0) return "";

  const normalized = items.map((item) => ({
    entidadNombre: item.entidadNombre || entidadNombre,
    codigoBarras: item.codigoBarras,
    nombreBien: item.nombreBien,
    fechaAdquisicion: item.fechaAdquisicion,
  }));

  const rows: string[] = [];
  for (let i = 0; i < normalized.length; i += LABELS_PER_ROW) {
    rows.push(buildLabelRowZpl(normalized[i], normalized[i + 1] ?? null));
  }

  return rows.join("\n");
}
