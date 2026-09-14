export const DIAS_VACACIONES_ANUALES = 30;

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

export function saldoVacaciones(diasTomados: number): number {
  return DIAS_VACACIONES_ANUALES - diasTomados;
}

export function resumenPeriodoVacacion<T extends { periodo: number; dias: number }>(
  registros: T[],
  fechaIngreso: string | null | undefined,
  periodo: number,
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
  return {
    periodo,
    derecho,
    diasCorrespondientes: derecho ? DIAS_VACACIONES_ANUALES : 0,
    diasTomados,
    saldo: derecho ? saldoVacaciones(diasTomados) : 0,
    registros: delPeriodo,
  };
}
