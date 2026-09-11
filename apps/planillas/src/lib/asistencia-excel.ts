import type { Range, WorkSheet } from "xlsx-js-style";
import { formatoHoraContrato } from "@/lib/horario-laboral";
import {
  MES_ABREV,
  MES_NOMBRE,
  diasIsoDelMes,
  diaSemanaDeIso,
  etiquetaDia,
  formatoFechaAsistencia,
  formatoHorasTotales,
  partesMes,
  trabajadorActivoEnFecha,
  tramosDelDia,
  type TurnoAsistencia,
} from "@/lib/horario-asistencia";

export type AsistenciaExcelTrabajador = {
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

const COLS = 8;
const BLACK = { style: "thin", color: { rgb: "000000" } };
const BORDER = { top: BLACK, bottom: BLACK, left: BLACK, right: BLACK };
const GREEN = "C6E0B4";
const FONT = { name: "Calibri", sz: 10, color: { rgb: "000000" } };

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
): void {
  const cell: { v: string | number; t: "s" | "n"; s?: Record<string, unknown> } = {
    v: value,
    t: typeof value === "number" ? "n" : "s",
  };
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

function diagonalRoja(): Record<string, unknown> {
  return styleBase({
    border: {
      ...BORDER,
      diagonal: { style: "thin", color: { rgb: "FF0000" } },
      diagonalUp: true,
    },
  });
}

function sheetName(nombre: string, dni: string, usados: Set<string>): string {
  const base = slugNombre(nombre).slice(0, 28) || dni.slice(-8) || "Hoja";
  let name = base;
  let n = 2;
  while (usados.has(name.toLowerCase())) {
    name = `${base.slice(0, 24)} ${n}`;
    n += 1;
  }
  usados.add(name.toLowerCase());
  return name;
}

function buildSheet(empresa: AsistenciaExcelEmpresa, trabajador: AsistenciaExcelTrabajador, mes: string): WorkSheet {
  const partes = partesMes(mes);
  const year = partes?.year ?? 2026;
  const monthName = partes ? MES_NOMBRE[partes.month - 1] : mes;
  const ws: WorkSheet = {};
  const merges: Range[] = [];
  const rows: { hpt: number }[] = [
    { hpt: 18 },
    { hpt: 16 },
    { hpt: 16 },
    { hpt: 8 },
    { hpt: 24 },
    { hpt: 20 },
    { hpt: 20 },
    { hpt: 22 },
  ];

  setCell(ws, 0, 0, "ASOCIACION:", { font: { ...FONT, bold: true }, alignment: { vertical: "center" } });
  setCell(ws, 0, 1, empresa.nombre.toUpperCase(), {
    font: { ...FONT, bold: true, italic: true },
    alignment: { vertical: "center" },
  });
  merge(merges, 0, 1, 0, 7);
  setCell(ws, 1, 0, `RUC: ${empresa.ruc?.trim() || "—"}`, { font: FONT, alignment: { vertical: "center" } });
  merge(merges, 1, 0, 1, 7);
  setCell(ws, 2, 0, `Dirección: ${empresa.direccion?.trim() || "—"}`, { font: FONT, alignment: { vertical: "center" } });
  merge(merges, 2, 0, 2, 7);

  setCell(ws, 4, 0, "REGISTRO DE ASISTENCIA", {
    font: { ...FONT, sz: 14, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDER,
  });
  merge(merges, 4, 0, 4, 7);
  for (let c = 1; c < COLS; c += 1) setCell(ws, 4, c, "", styleBase());

  const greenHead = styleBase({
    font: { ...FONT, bold: true },
    fill: { fgColor: { rgb: GREEN }, patternType: "solid" },
  });
  setCell(ws, 5, 0, "Año", styleBase({ font: { ...FONT, bold: true } }));
  setCell(ws, 5, 1, String(year), styleBase({ font: { ...FONT, bold: true } }));
  setCell(ws, 5, 2, "Nombre del Trabajador", greenHead);
  merge(merges, 5, 2, 6, 3);
  setCell(ws, 5, 3, "", greenHead);
  setCell(ws, 6, 2, "", greenHead);
  setCell(ws, 6, 3, "", greenHead);
  setCell(ws, 5, 4, trabajador.nombre.toUpperCase(), greenHead);
  merge(merges, 5, 4, 6, 7);
  for (let c = 5; c < COLS; c += 1) setCell(ws, 5, c, "", greenHead);
  for (let c = 4; c < COLS; c += 1) setCell(ws, 6, c, "", greenHead);
  setCell(ws, 6, 0, "Mes", styleBase({ font: { ...FONT, bold: true } }));
  setCell(ws, 6, 1, monthName, styleBase({ font: { ...FONT, bold: true } }));

  const headers = ["Día", "", "Turno", "Hora de Ingreso", "Firma", "Hora de Salida", "Firma", "Horas Totales"];
  headers.forEach((label, c) => setCell(ws, 7, c, label, greenHead));
  merge(merges, 7, 0, 7, 1);

  const dias = diasIsoDelMes(mes);
  const turnos: TurnoAsistencia[] = ["Mañana", "Tarde"];
  let r = 8;
  for (const iso of dias) {
    const dia = diaSemanaDeIso(iso);
    const activo = trabajadorActivoEnFecha(iso, trabajador.fechaIngreso, trabajador.fechaCese);
    const tramos = activo ? tramosDelDia(trabajador.horario, dia) : [];
    const laborables = tramos ?? [];
    setCell(ws, r, 0, formatoFechaAsistencia(iso), styleBase({
      alignment: { horizontal: "center", vertical: "center", textRotation: 90, wrapText: true },
    }));
    merge(merges, r, 0, r + 1, 0);
    setCell(ws, r + 1, 0, "", styleBase());

    const tachaManana = tramos !== null && !laborables.some((item) => item.turno === "Mañana");
    const tachaTarde = tramos !== null && !laborables.some((item) => item.turno === "Tarde");
    if (tachaManana && tachaTarde) merge(merges, r, 3, r + 1, 7);
    for (let i = 0; i < 2; i += 1) {
      const row = r + i;
      const turno = turnos[i];
      const tramo = laborables.find((item) => item.turno === turno) ?? null;
      const tacha = turno === "Mañana" ? tachaManana : tachaTarde;
      const tachado = tacha ? diagonalRoja() : styleBase();
      setCell(ws, row, 1, etiquetaDia(dia), styleBase());
      setCell(ws, row, 2, turno, styleBase());
      setCell(ws, row, 3, tramo && !tacha ? formatoHoraContrato(tramo.ingreso) : "", tachado);
      setCell(ws, row, 4, "", tachado);
      setCell(ws, row, 5, tramo && !tacha ? formatoHoraContrato(tramo.salida) : "", tachado);
      setCell(ws, row, 6, "", tachado);
      setCell(ws, row, 7, tramo && !tacha ? formatoHorasTotales(tramo.minutos) : "", tachado);
    }
    rows[r] = { hpt: 22 };
    rows[r + 1] = { hpt: 22 };
    r += 2;
  }

  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
  ];
  ws["!rows"] = rows;
  ws["!ref"] = `A1:${encodeCell(r - 1, COLS - 1)}`;
  ws["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 1, paperSize: 9 };
  return ws;
}

export async function bufferAsistenciaExcel(
  empresa: AsistenciaExcelEmpresa,
  trabajadores: AsistenciaExcelTrabajador[],
  mes: string,
): Promise<Buffer> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  for (const trabajador of trabajadores) {
    const ws = buildSheet(empresa, trabajador, mes);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(trabajador.nombre, trabajador.dni, usados));
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
