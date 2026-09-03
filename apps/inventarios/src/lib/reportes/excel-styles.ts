import type { Range, WorkSheet } from "xlsx-js-style";

/** Encabezado de tabla principal — igual que PDF (#1E4078). */
export const STYLE_TABLE_HEAD = {
  font: { name: "Calibri", sz: 9, bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "1E4078" }, patternType: "solid" },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: borderThin(),
} as const;

/** Fila de totales — igual que PDF. */
export const STYLE_TABLE_FOOT = {
  font: { name: "Calibri", sz: 9, bold: true, color: { rgb: "0F3460" } },
  fill: { fgColor: { rgb: "BAE6FD" }, patternType: "solid" },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: borderThin(),
} as const;

/** Encabezado resumen clasificación — PDF #475569. */
export const STYLE_RESUMEN_HEAD = {
  font: { name: "Calibri", sz: 9, bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "475569" }, patternType: "solid" },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: borderThin(),
} as const;

export const STYLE_BODY = {
  font: { name: "Calibri", sz: 9 },
  alignment: { vertical: "center", wrapText: true },
  border: borderThin(),
} as const;

export const STYLE_HEADER_TITLE = {
  font: { name: "Calibri", sz: 12, bold: true },
  alignment: { vertical: "center", wrapText: true },
} as const;

export const STYLE_HEADER_BOLD = {
  font: { name: "Calibri", sz: 10, bold: true },
  alignment: { vertical: "center", wrapText: true },
} as const;

export const STYLE_HEADER_NORMAL = {
  font: { name: "Calibri", sz: 9 },
  alignment: { vertical: "center", wrapText: true },
} as const;

export const STYLE_HEADER_MUTED = {
  font: { name: "Calibri", sz: 8, color: { rgb: "5A5A5A" } },
  alignment: { vertical: "center", wrapText: true },
} as const;

export const STYLE_SECTION_TITLE = {
  font: { name: "Calibri", sz: 11, bold: true },
  alignment: { vertical: "center" },
} as const;

function borderThin() {
  const side = { style: "thin", color: { rgb: "CBD5E1" } };
  return { top: side, bottom: side, left: side, right: side };
}

export function setCell(
  ws: WorkSheet,
  r: number,
  c: number,
  value: string | number,
  style?: Record<string, unknown>,
): void {
  const addr = XLSX_ENCODE_CELL(r, c);
  const cell: { v: string | number; t: "s" | "n"; s?: Record<string, unknown> } = {
    v: value,
    t: typeof value === "number" ? "n" : "s",
  };
  if (style) cell.s = style;
  ws[addr] = cell;
}

function XLSX_ENCODE_CELL(r: number, c: number): string {
  let col = "";
  let n = c;
  do {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${col}${r + 1}`;
}

export function styleRow(
  ws: WorkSheet,
  r: number,
  colCount: number,
  style: Record<string, unknown>,
): void {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX_ENCODE_CELL(r, c);
    if (ws[addr]) {
      (ws[addr] as { s?: Record<string, unknown> }).s = style;
    } else {
      setCell(ws, r, c, "", style);
    }
  }
}

export function addMerge(merges: Range[], r: number, c0: number, c1: number): void {
  if (c1 <= c0) return;
  merges.push({ s: { r, c: c0 }, e: { r, c: c1 } });
}

export function setColumnWidths(ws: WorkSheet, headers: readonly string[]): void {
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(28, Math.max(8, h.length + 3)),
  }));
}
