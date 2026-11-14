/** Tiempo completo (plazo fijo): 30 días. Tiempo parcial: 7 días. */
export const DIAS_VACACIONES_TIEMPO_COMPLETO = 30;
export const DIAS_VACACIONES_TIEMPO_PARCIAL = 7;
export const DIAS_VACACIONES_ANUALES = DIAS_VACACIONES_TIEMPO_COMPLETO;

export function diasVacacionesPorJornada(jornada: string | null | undefined): number {
  return jornada === "TIEMPO_PARCIAL" ? DIAS_VACACIONES_TIEMPO_PARCIAL : DIAS_VACACIONES_TIEMPO_COMPLETO;
}

export const ESTADO_VACACION = ["PROGRAMADO", "GOZADO"] as const;
export type EstadoVacacion = (typeof ESTADO_VACACION)[number];

export const ESTADO_VACACION_LABEL: Record<EstadoVacacion, string> = {
  PROGRAMADO: "Programado",
  GOZADO: "Gozado",
};

export function anioActualLima(): number {
  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
  }).format(new Date());
  return Number(year);
}

export function esPeriodoVacacion(value: string | number | undefined): value is number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
}

export function todayIsoLima(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function diasCalendario(inicio: string, fin: string): number {
  const a = Date.parse(`${inicio}T12:00:00.000Z`);
  const b = Date.parse(`${fin}T12:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

/** Derecho a 30 días luego de un año de servicio. */
export function tieneDerechoVacaciones(fechaIngreso: string | null | undefined, hoyIso = todayIsoLima()): boolean {
  if (!fechaIngreso) return false;
  const ingreso = Date.parse(`${fechaIngreso.slice(0, 10)}T12:00:00.000Z`);
  const hoy = Date.parse(`${hoyIso}T12:00:00.000Z`);
  if (Number.isNaN(ingreso) || Number.isNaN(hoy)) return false;
  const aniversario = new Date(ingreso);
  aniversario.setUTCFullYear(aniversario.getUTCFullYear() + 1);
  return hoy >= aniversario.getTime();
}

export function saldoVacaciones(diasTomados: number, diasCorrespondientes = DIAS_VACACIONES_ANUALES): number {
  return diasCorrespondientes - diasTomados;
}

/** Cómo se pinta la columna Tomados: sin días, goce en curso o periodo cubierto. */
export type SituacionTomaVacaciones = "ninguno" | "proceso" | "tomado";

export function situacionTomaVacaciones(
  registros: { dias: number; estado: string }[],
  diasCorrespondientes: number,
): SituacionTomaVacaciones {
  const diasTomados = registros.reduce((sum, row) => sum + row.dias, 0);
  if (diasTomados <= 0) return "ninguno";
  const gozados = registros.reduce((sum, row) => (row.estado === "GOZADO" ? sum + row.dias : sum), 0);
  const hayProgramado = registros.some((row) => row.estado === "PROGRAMADO");
  if (!hayProgramado && gozados >= diasCorrespondientes) return "tomado";
  return "proceso";
}

export function resumenPeriodoVacacion<T extends { periodo: number; dias: number }>(
  registros: T[],
  fechaIngreso: string | null | undefined,
  periodo: number,
  jornada?: string | null,
): {
  periodo: number;
  derecho: boolean;
  diasCorrespondientes: number;
  diasTomados: number;
  saldo: number;
  registros: T[];
} {
  const delPeriodo = registros.filter((r) => r.periodo === periodo);
  const diasTomados = delPeriodo.reduce((sum, r) => sum + r.dias, 0);
  const derecho = tieneDerechoVacaciones(fechaIngreso);
  const diasCorrespondientes = diasVacacionesPorJornada(jornada);
  return {
    periodo,
    derecho,
    diasCorrespondientes,
    diasTomados,
    saldo: derecho ? saldoVacaciones(diasTomados, diasCorrespondientes) : 0,
    registros: delPeriodo,
  };
}
