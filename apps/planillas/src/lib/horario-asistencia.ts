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
