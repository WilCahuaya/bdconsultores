import {
  DIAS_SEMANA,
  DIA_LABEL,
  duracionMinutos,
  parseHorario,
  type DiaSemana,
  type HorarioTramo,
} from "@/lib/horario-laboral";

export const MES_ABREV = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"] as const;
export const MES_NOMBRE = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export type TurnoAsistencia = "Mañana" | "Tarde";

export type TramoAsistencia = {
  turno: TurnoAsistencia;
  ingreso: string;
  salida: string;
  minutos: number;
};

const DIA_DESDE_JS: DiaSemana[] = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

export function esMesAsistencia(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function mesActualLima(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function hoyIsoLima(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function diaDelMesLima(iso = hoyIsoLima()): number {
  return Number(iso.slice(8, 10));
}

export function ultimoDiaDelMes(mes: string): number {
  const dias = diasIsoDelMes(mes);
  return dias.length;
}

/** 28–30 (o últimos 3 días en febrero). */
export function diaInicioVentanaMesSiguiente(ultimoDia: number): number {
  return Math.min(28, Math.max(1, ultimoDia - 2));
}

export function timestampEnMesLima(value: string | null | undefined, mes: string): boolean {
  if (!value) return false;
  const lima = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
  return lima.slice(0, 7) === mes;
}

export function fechaEnMes(isoDate: string | null | undefined, mes: string): boolean {
  return Boolean(isoDate && isoDate.slice(0, 7) === mes);
}

export function partesMes(mes: string): { year: number; month: number } | null {
  if (!esMesAsistencia(mes)) return null;
  const [year, month] = mes.split("-").map(Number);
  return { year, month };
}

export function etiquetaMesAsistencia(mes: string): string {
  const partes = partesMes(mes);
  if (!partes) return mes;
  return `${MES_NOMBRE[partes.month - 1]} ${partes.year}`;
}

/** Fechas ISO del mes, sin repetir ni días de otro mes. */
export function feriadosValidosDelMes(mes: string, fechas: readonly string[]): string[] {
  const validos = new Set(diasIsoDelMes(mes));
  const out = new Set<string>();
  for (const raw of fechas) {
    const iso = String(raw).slice(0, 10);
    if (validos.has(iso)) out.add(iso);
  }
  return [...out].sort();
}

export function diasIsoDelMes(mes: string): string[] {
  const partes = partesMes(mes);
  if (!partes) return [];
  const last = new Date(Date.UTC(partes.year, partes.month, 0)).getUTCDate();
  const out: string[] = [];
  for (let day = 1; day <= last; day += 1) {
    out.push(`${partes.year}-${String(partes.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

export function diaSemanaDeIso(iso: string): DiaSemana {
  const [year, month, day] = iso.split("-").map(Number);
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return DIA_DESDE_JS[js] ?? "LUNES";
}

export function formatoFechaAsistencia(iso: string): string {
  const [year, month, day] = iso.split("-");
  const abrev = MES_ABREV[Number(month) - 1] ?? month;
  return `${day}/${abrev}/${year}`;
}

export function formatoHorasTotales(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${String(horas).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

/** Horas enteras. 30 minutos o más suben a la hora siguiente. */
export function formatoHorasRedondeadas(minutos: number): string {
  return String(Math.round(minutos / 60));
}

function turnoDeTramo(tramo: HorarioTramo, index: number, total: number): TurnoAsistencia {
  if (total === 1) {
    const hora = Number(tramo.desde.slice(0, 2));
    return Number.isFinite(hora) && hora >= 13 ? "Tarde" : "Mañana";
  }
  return index === 0 ? "Mañana" : "Tarde";
}

function tramoValido(tramo: HorarioTramo): TramoAsistencia | null {
  const minutos = duracionMinutos(tramo.desde, tramo.hasta);
  if (minutos == null) return null;
  return {
    turno: "Mañana",
    ingreso: tramo.desde,
    salida: tramo.hasta,
    minutos,
  };
}

export function tramosDelDia(horarioRaw: string | null | undefined, dia: DiaSemana): TramoAsistencia[] | null {
  const parsed = parseHorario(horarioRaw);
  if (!parsed || parsed.tipo === "TEXTO") return null;
  if (parsed.tipo === "COMPLETO") {
    const a = DIAS_SEMANA.indexOf(parsed.diaInicio);
    const b = DIAS_SEMANA.indexOf(parsed.diaFin);
    const i = DIAS_SEMANA.indexOf(dia);
    if (a < 0 || b < 0 || i < a || i > b) return [];
    const manana = tramoValido({
      desde: parsed.desde,
      hasta: parsed.refrigerioDesde || parsed.hasta,
    });
    if (!parsed.refrigerioDesde || !parsed.refrigerioHasta) {
      return manana ? [{ ...manana, turno: "Mañana" }] : [];
    }
    const tarde = tramoValido({ desde: parsed.refrigerioHasta, hasta: parsed.hasta });
    const out: TramoAsistencia[] = [];
    if (manana) out.push({ ...manana, turno: "Mañana" });
    if (tarde) out.push({ ...tarde, turno: "Tarde" });
    return out;
  }
  for (const bloque of parsed.bloques) {
    if (!bloque.dias.includes(dia)) continue;
    const out: TramoAsistencia[] = [];
    bloque.tramos.forEach((tramo, index) => {
      const valido = tramoValido(tramo);
      if (!valido) return;
      out.push({ ...valido, turno: turnoDeTramo(tramo, index, bloque.tramos.length) });
    });
    return out;
  }
  return [];
}

export function etiquetaDia(dia: DiaSemana): string {
  return DIA_LABEL[dia];
}

/** Letra de la grilla semanal: L M M J V S D. Martes y miércoles comparten M. */
export const DIA_LETRA: Record<DiaSemana, string> = {
  LUNES: "L",
  MARTES: "M",
  MIERCOLES: "M",
  JUEVES: "J",
  VIERNES: "V",
  SABADO: "S",
  DOMINGO: "D",
};

export type MinutosSemana = Record<DiaSemana, number | null>;

export type SemanaHoras =
  | { estado: "vacio" }
  | { estado: "texto" }
  | { estado: "dias"; minutos: MinutosSemana };

/** Horas efectivas de cada día de la semana. null en un día = no trabaja. */
export function semanaHorasDeHorario(horarioRaw: string | null | undefined): SemanaHoras {
  if (!horarioRaw?.trim()) return { estado: "vacio" };
  const minutos = {} as MinutosSemana;
  for (const dia of DIAS_SEMANA) {
    const tramos = tramosDelDia(horarioRaw, dia);
    if (tramos === null) return { estado: "texto" };
    const total = tramos.reduce((suma, tramo) => suma + tramo.minutos, 0);
    minutos[dia] = total > 0 ? total : null;
  }
  return { estado: "dias", minutos };
}

/** 7 h 40 min → "7.67". */
export function formatoHorasDia(minutos: number): string {
  return (minutos / 60).toFixed(2);
}

export function firmaSemanaHoras(horarioRaw: string | null | undefined): string {
  const semana = semanaHorasDeHorario(horarioRaw);
  if (semana.estado !== "dias") return semana.estado;
  return DIAS_SEMANA.map((dia) => (semana.minutos[dia] == null ? "x" : String(semana.minutos[dia]))).join("|");
}

export type RangoFecha = { inicio: string; fin: string };

/** Días del mes que caen dentro de algún rango de vacaciones. */
export function diasVacacionesEnMes(mes: string, rangos: readonly RangoFecha[]): string[] {
  const out: string[] = [];
  for (const iso of diasIsoDelMes(mes)) {
    const enVacaciones = rangos.some((rango) => {
      const inicio = rango.inicio.slice(0, 10);
      const fin = rango.fin.slice(0, 10);
      return iso >= inicio && iso <= fin;
    });
    if (enVacaciones) out.push(iso);
  }
  return out;
}

/**
 * Horas del mes seleccionado. No suma feriados ni vacaciones.
 * null si el trabajador no estuvo activo o el horario está en texto libre.
 */
export function minutosTrabajadosDelMes(input: {
  mes: string;
  horarioFicha: string | null | undefined;
  fechaIngreso?: string | null;
  fechaCese?: string | null;
  feriados: readonly string[];
  vacaciones: readonly RangoFecha[];
  contratos: readonly ContratoHorarioMes[];
}): number | null {
  if (!trabajadorActivoEnMes(input.mes, input.fechaIngreso, input.fechaCese)) return null;
  const feriados = new Set(input.feriados.map((dia) => dia.slice(0, 10)));
  const vacaciones = new Set(diasVacacionesEnMes(input.mes, input.vacaciones));
  for (const iso of diasIsoDelMes(input.mes)) {
    if (!trabajadorActivoEnFecha(iso, input.fechaIngreso, input.fechaCese)) continue;
    if (feriados.has(iso) || vacaciones.has(iso)) continue;
    const horario = horarioContratoEnFecha(iso, input.contratos) ?? input.horarioFicha;
    if (!horario?.trim()) continue;
    if (tramosDelDia(horario, diaSemanaDeIso(iso)) === null) return null;
  }
  return minutosHorarioMes({
    mes: input.mes,
    horario: input.horarioFicha,
    fechaIngreso: input.fechaIngreso,
    fechaCese: input.fechaCese,
    feriados: input.feriados,
    vacaciones: input.vacaciones,
    horarioEnFecha: (iso) => horarioContratoEnFecha(iso, input.contratos) ?? input.horarioFicha,
  });
}

/** Horas del horario del mes. Feriados y vacaciones no suman. */
export function minutosHorarioMes(input: {
  mes: string;
  horario: string | null | undefined;
  fechaIngreso?: string | null;
  fechaCese?: string | null;
  feriados: readonly string[];
  vacaciones: readonly RangoFecha[];
  horarioEnFecha?: (iso: string) => string | null | undefined;
}): number {
  const feriados = new Set(input.feriados.map((dia) => dia.slice(0, 10)));
  const vacaciones = new Set(diasVacacionesEnMes(input.mes, input.vacaciones));
  let minutos = 0;
  for (const iso of diasIsoDelMes(input.mes)) {
    if (!trabajadorActivoEnFecha(iso, input.fechaIngreso, input.fechaCese)) continue;
    if (feriados.has(iso) || vacaciones.has(iso)) continue;
    const horario = input.horarioEnFecha ? input.horarioEnFecha(iso) : input.horario;
    const tramos = tramosDelDia(horario, diaSemanaDeIso(iso));
    if (!tramos) continue;
    for (const tramo of tramos) minutos += tramo.minutos;
  }
  return minutos;
}

export type ContratoHorarioMes = {
  horario: string | null;
  inicio: string | null;
  fin: string | null;
  version: number;
  confirmado: boolean;
};

function contratoCubreFecha(contrato: ContratoHorarioMes, iso: string): boolean {
  if (!contrato.confirmado || !contrato.horario?.trim() || !contrato.inicio) return false;
  const inicio = contrato.inicio.slice(0, 10);
  const fin = contrato.fin?.slice(0, 10);
  return iso >= inicio && (!fin || iso <= fin);
}

/** Contrato confirmado vigente ese día. Si hay varios, el de inicio más reciente. */
export function horarioContratoEnFecha(iso: string, contratos: readonly ContratoHorarioMes[]): string | null {
  const candidatos = contratos.filter((contrato) => contratoCubreFecha(contrato, iso));
  candidatos.sort(
    (a, b) => (b.inicio ?? "").localeCompare(a.inicio ?? "") || b.version - a.version,
  );
  return candidatos[0]?.horario?.trim() || null;
}

/** Contratos confirmados que cubren al menos un día del mes, del más antiguo al más nuevo. */
export function contratosHorarioDelMes(mes: string, contratos: readonly ContratoHorarioMes[]): ContratoHorarioMes[] {
  const dias = diasIsoDelMes(mes);
  const vistos = new Set<number>();
  const out: ContratoHorarioMes[] = [];
  for (const iso of dias) {
    const horario = horarioContratoEnFecha(iso, contratos);
    const contrato = contratos
      .filter((item) => contratoCubreFecha(item, iso) && item.horario?.trim() === horario)
      .sort((a, b) => (b.inicio ?? "").localeCompare(a.inicio ?? "") || b.version - a.version)[0];
    if (!contrato || vistos.has(contrato.version)) continue;
    vistos.add(contrato.version);
    out.push(contrato);
  }
  return out;
}

export function trabajadorActivoEnFecha(
  iso: string,
  fechaIngreso: string | null | undefined,
  fechaCese: string | null | undefined,
): boolean {
  const ingreso = fechaIngreso?.slice(0, 10);
  const cese = fechaCese?.slice(0, 10);
  if (ingreso && iso < ingreso) return false;
  if (cese && iso > cese) return false;
  return true;
}

export function trabajadorActivoEnMes(
  mes: string,
  fechaIngreso: string | null | undefined,
  fechaCese: string | null | undefined,
): boolean {
  const dias = diasIsoDelMes(mes);
  if (dias.length === 0) return false;
  const first = dias[0];
  const last = dias[dias.length - 1];
  const ingreso = fechaIngreso?.slice(0, 10);
  const cese = fechaCese?.slice(0, 10);
  if (ingreso && ingreso > last) return false;
  if (cese && cese < first) return false;
  return true;
}

/** Meses AAAA-MM del año en los que el trabajador estuvo en planilla. */
export function mesesLaboradosEnAnio(
  anio: number,
  fechaIngreso: string | null | undefined,
  fechaCese: string | null | undefined,
): string[] {
  if (!Number.isInteger(anio) || anio < 1900 || anio > 9999) return [];
  const out: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const mes = `${anio}-${String(month).padStart(2, "0")}`;
    if (trabajadorActivoEnMes(mes, fechaIngreso, fechaCese)) out.push(mes);
  }
  return out;
}
