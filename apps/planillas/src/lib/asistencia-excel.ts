import type { Range, WorkSheet } from "xlsx-js-style";
import {
  MES_ABREV,
  MES_NOMBRE,
  diasIsoDelMes,
  diaSemanaDeIso,
  etiquetaDia,
  partesMes,
  trabajadorActivoEnFecha,
  tramosDelDia,
  type TurnoAsistencia,
} from "@/lib/horario-asistencia";

export type AsistenciaExcelTrabajador = {
  relacionId?: string;
  nombre: string;
  dni: string;
  horario: string | null;
  fechaIngreso: string | null;
  fechaCese: string | null;
};

export type AsistenciaExcelEmpresa = {
  nombre: string;
  ruc: string | null;
  direccion: string | null;
};

const COLS = 11;
const BLACK = { style: "thin", color: { rgb: "000000" } };
const BORDER = { top: BLACK, bottom: BLACK, left: BLACK, right: BLACK };
const GREEN = "C6E0B4";
const GRAY_TARDE = "F0F0F0";
const FONT = { name: "Tahoma", sz: 11, color: { rgb: "000000" } };
const FONT_TAHOMA_10 = { name: "Tahoma", sz: 10, color: { rgb: "000000" } };
const FONT_TAHOMA_10_BOLD = { name: "Tahoma", sz: 10, bold: true, color: { rgb: "000000" } };
const FONT_COL_HEAD = { name: "Tahoma", sz: 8, color: { rgb: "000000" } };
const FONT_HORA_HEAD = { name: "Tahoma", sz: 7, color: { rgb: "000000" } };
const FONT_FECHA = { name: "Arial Narrow", sz: 8, color: { rgb: "FF0000" } };

/** Anchos del Excel de Herederos (A–K). */
const COL_WIDTHS = [
  { wch: 3.17 },
  { wch: 8.67 },
  { wch: 4 },
  { wch: 4 },
  { wch: 4.17 },
  { wch: 4.17 },
  { wch: 21.17 },
  { wch: 4.17 },
  { wch: 4.17 },
  { wch: 21.17 },
  { wch: 11.67 },
];

const H_TITULO = 23.25;
const H_ANIO = 15.75;
const H_MES = 15;
const H_ENCABEZADO = 15.75;
const H_TURNO = 24;
const H_TOTAL = 16.5;
const FILAS_ENCABEZADO = 4;
/** Con el encabezado de Herederos cabían 32 filas de datos (16 días) en la 1.ª hoja. */
const DATOS_CALIBRE_PAGINA1 = 32;

function slugNombre(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function nombreArchivoAsistenciaEmpresa(mes: string, entidadNombre: string): string {
  const partes = partesMes(mes);
  const mm = partes ? String(partes.month).padStart(2, "0") : mes;
  const abrev = partes ? MES_ABREV[partes.month - 1].toUpperCase() : "MES";
  const entidad = slugNombre(entidadNombre).toUpperCase() || "EMPRESA";
  return `${mm} ${abrev} - ASISTENCIA - ${entidad}.xlsx`;
}

export function nombreArchivoAsistenciaTrabajador(nombre: string): string {
  const persona = slugNombre(nombre).toUpperCase() || "TRABAJADOR";
  return `HORARIO - ${persona}.xlsx`;
}

function encodeCell(r: number, c: number): string {
  let col = "";
  let n = c;
  do {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${col}${r + 1}`;
}

function setCell(
  ws: WorkSheet,
  r: number,
  c: number,
  value: string | number,
  style?: Record<string, unknown>,
  extras?: { z?: string; t?: "s" | "n" },
): void {
  const t = extras?.t ?? (typeof value === "number" ? "n" : "s");
  const cell: { v: string | number; t: "s" | "n"; z?: string; s?: Record<string, unknown> } = {
    v: value,
    t,
  };
  if (extras?.z) cell.z = extras.z;
  if (style) cell.s = style;
  ws[encodeCell(r, c)] = cell;
}

function merge(merges: Range[], r1: number, c1: number, r2: number, c2: number): void {
  merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}

function styleBase(extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    font: FONT,
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    border: BORDER,
    ...extra,
  };
}

function diagonalRoja(extra?: Record<string, unknown>): Record<string, unknown> {
  return styleBase({
    border: {
      ...BORDER,
      diagonal: { style: "thin", color: { rgb: "FF0000" } },
      diagonalDown: true,
    },
    ...extra,
  });
}

function excelSerial(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000);
}

function sheetName(nombre: string, dni: string, index: number, usados: Set<string>): string {
  const primero = slugNombre(nombre).split(" ")[0] || dni.slice(-8) || "Hoja";
  const base = `${String(index + 1).padStart(2, "0")} ${primero}`.slice(0, 31);
  let name = base;
  let n = 2;
  while (usados.has(name.toLowerCase())) {
    name = `${base.slice(0, 27)} ${n}`;
    n += 1;
  }
  usados.add(name.toLowerCase());
  return name;
}

function paint(ws: WorkSheet, r: number, c1: number, c2: number, style: Record<string, unknown>): void {
  for (let c = c1; c <= c2; c += 1) setCell(ws, r, c, "", style);
}

function buildSheet(empresa: AsistenciaExcelEmpresa, trabajador: AsistenciaExcelTrabajador, mes: string): WorkSheet {
  const partes = partesMes(mes);
  const year = partes?.year ?? 2026;
  const monthName = partes ? MES_NOMBRE[partes.month - 1] : mes;
  const ws: WorkSheet = {};
  const merges: Range[] = [];
  const rows: { hpt: number }[] = [];
  const greenFill = { fgColor: { rgb: GREEN }, patternType: "solid" };
  const greenLabel = styleBase({
    font: FONT_TAHOMA_10,
    fill: greenFill,
  });
  const greenName = styleBase({
    font: FONT_TAHOMA_10_BOLD,
    fill: greenFill,
  });
  const greenColHead = styleBase({
    font: FONT_COL_HEAD,
    fill: greenFill,
  });
  const greenHoraHead = styleBase({
    font: FONT_HORA_HEAD,
    fill: greenFill,
  });
  const mesAnioValor = styleBase({
    font: FONT_TAHOMA_10_BOLD,
    alignment: { horizontal: "center", vertical: "center", wrapText: true, shrinkToFit: true },
  });

  setCell(ws, 0, 0, "REGISTRO DE ASISTENCIA", {
    font: { name: "Calibri", sz: 16, bold: true, color: { rgb: "000000" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDER,
  });
  merge(merges, 0, 0, 0, COLS - 1);
  paint(ws, 0, 1, COLS - 1, styleBase({ font: { name: "Calibri", sz: 16, bold: true } }));
  rows[0] = { hpt: H_TITULO };

  setCell(ws, 1, 0, "Año", greenLabel);
  merge(merges, 1, 0, 1, 1);
  setCell(ws, 1, 1, "", greenLabel);
  setCell(ws, 1, 2, year, mesAnioValor);
  merge(merges, 1, 2, 1, 3);
  setCell(ws, 1, 3, "", mesAnioValor);
  setCell(ws, 1, 4, "Nombre del Trabajador", greenName);
  merge(merges, 1, 4, 2, 6);
  paint(ws, 1, 5, 6, greenName);
  paint(ws, 2, 4, 6, greenName);
  setCell(ws, 1, 7, trabajador.nombre.toUpperCase(), greenName);
  merge(merges, 1, 7, 2, 10);
  paint(ws, 1, 8, 10, greenName);
  paint(ws, 2, 7, 10, greenName);
  rows[1] = { hpt: H_ANIO };

  setCell(ws, 2, 0, "Mes", greenLabel);
  merge(merges, 2, 0, 2, 1);
  setCell(ws, 2, 1, "", greenLabel);
  setCell(ws, 2, 2, monthName, mesAnioValor);
  merge(merges, 2, 2, 2, 3);
  setCell(ws, 2, 3, "", mesAnioValor);
  rows[2] = { hpt: H_MES };

  const headers: Array<{ c1: number; c2: number; label: string; style: Record<string, unknown> }> = [
    { c1: 0, c2: 1, label: "Día", style: greenColHead },
    { c1: 2, c2: 3, label: "Turno", style: greenColHead },
    { c1: 4, c2: 5, label: "Hora de Ingreso", style: greenHoraHead },
    { c1: 6, c2: 6, label: "Firma", style: greenColHead },
    { c1: 7, c2: 8, label: "Hora de Salida", style: greenHoraHead },
    { c1: 9, c2: 9, label: "Firma", style: greenColHead },
    { c1: 10, c2: 10, label: "Horas Totales", style: greenColHead },
  ];
  headers.forEach(({ c1, c2, label, style }) => {
    setCell(ws, 3, c1, label, style);
    if (c2 > c1) {
      merge(merges, 3, c1, 3, c2);
      paint(ws, 3, c1 + 1, c2, style);
    }
  });
  rows[3] = { hpt: H_ENCABEZADO };

  const dias = diasIsoDelMes(mes);
  const turnos: TurnoAsistencia[] = ["Mañana", "Tarde"];
  let r = 4;
  for (const iso of dias) {
    const dia = diaSemanaDeIso(iso);
    const activo = trabajadorActivoEnFecha(iso, trabajador.fechaIngreso, trabajador.fechaCese);
    const tramos = activo ? tramosDelDia(trabajador.horario, dia) : [];
    const laborables = tramos ?? [];
    const fechaStyle = styleBase({
      font: FONT_FECHA,
      alignment: { horizontal: "center", vertical: "center", textRotation: 90, wrapText: true },
    });
    setCell(ws, r, 0, excelSerial(iso), fechaStyle, { t: "n", z: "dd/mmm/yyyy" });
    merge(merges, r, 0, r + 1, 0);
    setCell(ws, r + 1, 0, "", fechaStyle);

    const tachaManana = tramos !== null && !laborables.some((item) => item.turno === "Mañana");
    const tachaTarde = tramos !== null && !laborables.some((item) => item.turno === "Tarde");
    const tachaDia = tachaManana && tachaTarde;
    if (tachaDia) merge(merges, r, 4, r + 1, 10);

    for (let i = 0; i < 2; i += 1) {
      const row = r + i;
      const turno = turnos[i];
      const tacha = turno === "Mañana" ? tachaManana : tachaTarde;
      const fill =
        turno === "Tarde" ? { fgColor: { rgb: GRAY_TARDE }, patternType: "solid" } : undefined;
      const base = styleBase(fill ? { fill } : undefined);
      const tachado = tacha ? diagonalRoja(fill ? { fill } : undefined) : base;
      setCell(ws, row, 1, etiquetaDia(dia), base);
      setCell(ws, row, 2, turno, base);
      merge(merges, row, 2, row, 3);
      setCell(ws, row, 3, "", base);

      if (tachaDia) {
        setCell(ws, row, 4, "", tachado);
        paint(ws, row, 5, 10, tachado);
      } else {
        setCell(ws, row, 4, "", tachado);
        merge(merges, row, 4, row, 5);
        setCell(ws, row, 5, "", tachado);
        setCell(ws, row, 6, "", tachado);
        setCell(ws, row, 7, "", tachado);
        merge(merges, row, 7, row, 8);
        setCell(ws, row, 8, "", tachado);
        setCell(ws, row, 9, "", tachado);
        setCell(ws, row, 10, "", tachado);
      }
      rows[row] = { hpt: H_TURNO };
    }
    r += 2;
  }

  const totalStyle = styleBase({
    font: { ...FONT, sz: 10, bold: true },
    fill: { fgColor: { rgb: GRAY_TARDE }, patternType: "solid" },
  });
  setCell(ws, r, 9, "Total", totalStyle);
  setCell(ws, r, 10, "", totalStyle);
  rows[r] = { hpt: H_TOTAL };
  r += 3;
  const firmaPie = {
    font: { name: "Tahoma", sz: 8, color: { rgb: "000000" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: { top: { style: "thin", color: { rgb: "000000" } } },
  };
  setCell(ws, r, 6, "Firma del Administrador", firmaPie);
  setCell(ws, r, 9, "Firma del Rep. Legal", firmaPie);
  rows[r] = { hpt: 15.75 };

  ws["!merges"] = merges;
  ws["!cols"] = COL_WIDTHS;
  ws["!rows"] = rows;
  ws["!ref"] = `A1:${encodeCell(r, COLS - 1)}`;
  ws["!margins"] = {
    left: 0.71,
    right: 0.51,
    top: 0.94,
    bottom: 0.75,
    header: 0.31,
    footer: 0.31,
  };
  return ws;
}

function xmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bloqueEncabezado(empresa: AsistenciaExcelEmpresa): string {
  const nombre = xmlAttr(empresa.nombre.toUpperCase());
  const ruc = xmlAttr(empresa.ruc?.trim() || "-");
  const direccion = xmlAttr(empresa.direccion?.trim() || "-");
  return (
    `&amp;L&amp;"Tahoma,Negrita"&amp;12ASOCIACION:&amp;"-,Normal"&amp;11 &amp;"-,Negrita Cursiva" ${nombre}&amp;"-,Normal"` +
    `\nRUC: ${ruc}` +
    `\nDirección: ${direccion}`
  );
}

function conVistaPagina(xml: string): string {
  if (/<sheetView\b[^>]*\bview=/.test(xml)) return xml;
  return xml.replace(/<sheetView\b/, `<sheetView view="pageLayout" zoomScalePageLayoutView="100"`);
}

function filasParesQueCaben(puntos: number): number {
  const n = Math.floor(puntos / H_TURNO);
  return Math.max(2, n - (n % 2));
}

/** Saltos después de un día completo. Las filas 1–4 se repiten en cada hoja, como en Herederos. */
function idsSaltoTrasDiaCompleto(cantidadDias: number): number[] {
  const headerPt = H_TITULO + H_ANIO + H_MES + H_ENCABEZADO;
  const ptPagina = headerPt + DATOS_CALIBRE_PAGINA1 * H_TURNO;
  const pageData = filasParesQueCaben(ptPagina - headerPt);
  const totalData = cantidadDias * 2;
  const ids: number[] = [];
  let usados = 0;
  while (usados + pageData < totalData) {
    usados += pageData;
    ids.push(FILAS_ENCABEZADO + usados);
  }
  return ids;
}

function xmlSaltosPagina(ids: number[]): string {
  if (ids.length === 0) return "";
  const brks = ids.map((id) => `<brk id="${id}" max="16383" man="1"/>`).join("");
  return `<rowBreaks count="${ids.length}" manualBreakCount="${ids.length}">${brks}</rowBreaks>`;
}

function insertarTitulosImpresion(workbookXml: string): string {
  const sheets = [...workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
  if (sheets.length === 0) return workbookXml;
  const names = sheets
    .map((name, i) => {
      const quoted = `'${name.replace(/'/g, "''")}'`;
      return `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${quoted}!$1:$4</definedName>`;
    })
    .join("");
  const block = `<definedNames>${names}</definedNames>`;
  if (/<definedNames[\s\S]*?<\/definedNames>/.test(workbookXml)) {
    return workbookXml.replace(/<definedNames[\s\S]*?<\/definedNames>/, block);
  }
  if (/<\/sheets>/.test(workbookXml)) {
    return workbookXml.replace("</sheets>", `</sheets>${block}`);
  }
  return workbookXml.replace("</workbook>", `${block}</workbook>`);
}

function insertarImpresion(xml: string, empresa: AsistenciaExcelEmpresa, saltos: number[]): string {
  const printOptions = `<printOptions horizontalCentered="1"/>`;
  const pageSetup = `<pageSetup paperSize="9" scale="85" orientation="portrait"/>`;
  const headerFooter =
    `<headerFooter><oddHeader xml:space="preserve">${bloqueEncabezado(empresa)}</oddHeader>` +
    `<oddFooter>&amp;C&amp;P</oddFooter></headerFooter>`;
  const rowBreaks = xmlSaltosPagina(saltos);
  let next = conVistaPagina(xml)
    .replace(/<printOptions\b[^>]*\/>/g, "")
    .replace(/<printOptions\b[\s\S]*?<\/printOptions>/g, "")
    .replace(/<pageSetup\b[^>]*\/>/g, "")
    .replace(/<pageSetup\b[\s\S]*?<\/pageSetup>/g, "")
    .replace(/<headerFooter\b[\s\S]*?<\/headerFooter>/g, "")
    .replace(/<rowBreaks\b[\s\S]*?<\/rowBreaks>/g, "");
  const cola = `${pageSetup}${headerFooter}${rowBreaks}`;
  if (/<pageMargins\b/.test(next)) {
    next = next.replace(/<pageMargins\b/, `${printOptions}<pageMargins`);
    if (/<pageMargins\b[^>]*\/>/.test(next)) {
      return next.replace(/<pageMargins\b[^>]*\/>/, (tag) => `${tag}${cola}`);
    }
    return next.replace("</pageMargins>", `</pageMargins>${cola}`);
  }
  const bloque = `${printOptions}${cola}`;
  if (next.includes("<ignoredErrors")) {
    return next.replace("<ignoredErrors", `${bloque}<ignoredErrors`);
  }
  return next.replace("</worksheet>", `${bloque}</worksheet>`);
}

async function aplicarImpresionHerederos(
  buffer: Buffer,
  empresa: AsistenciaExcelEmpresa,
  mes: string,
): Promise<Buffer> {
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import("fflate");
  const unzipped = unzipSync(new Uint8Array(buffer));
  const saltos = idsSaltoTrasDiaCompleto(diasIsoDelMes(mes).length);
  for (const name of Object.keys(unzipped)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      unzipped[name] = strToU8(insertarImpresion(strFromU8(unzipped[name]), empresa, saltos));
    }
    if (name === "xl/workbook.xml") {
      unzipped[name] = strToU8(insertarTitulosImpresion(strFromU8(unzipped[name])));
    }
  }
  return Buffer.from(zipSync(unzipped, { level: 6 }));
}

export async function bufferAsistenciaExcel(
  empresa: AsistenciaExcelEmpresa,
  trabajadores: AsistenciaExcelTrabajador[],
  mes: string,
): Promise<Buffer> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  trabajadores.forEach((trabajador, index) => {
    const ws = buildSheet(empresa, trabajador, mes);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(trabajador.nombre, trabajador.dni, index, usados));
  });
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return aplicarImpresionHerederos(buffer, empresa, mes);
}
