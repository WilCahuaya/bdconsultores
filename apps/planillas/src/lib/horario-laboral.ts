export const DIAS_SEMANA = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const DIA_LABEL: Record<DiaSemana, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

export const DIA_LABEL_LOWER: Record<DiaSemana, string> = {
  LUNES: "lunes",
  MARTES: "martes",
  MIERCOLES: "miércoles",
  JUEVES: "jueves",
  VIERNES: "viernes",
  SABADO: "sábado",
  DOMINGO: "domingo",
};

export type HorarioTramo = { desde: string; hasta: string };

export type HorarioBloque = {
  dias: DiaSemana[];
  tramos: HorarioTramo[];
};

export type HorarioCompleto = {
  tipo: "COMPLETO";
  diaInicio: DiaSemana;
  diaFin: DiaSemana;
  desde: string;
  hasta: string;
  refrigerioDesde: string;
  refrigerioHasta: string;
};

export type HorarioParcial = {
  tipo: "PARCIAL";
  bloques: HorarioBloque[];
};

export type HorarioTexto = { tipo: "TEXTO"; texto: string };

export type HorarioLaboral = HorarioCompleto | HorarioParcial;

export type HorarioGuardado = HorarioLaboral | HorarioTexto;

export function horarioCompletoPorDefecto(): HorarioCompleto {
  return {
    tipo: "COMPLETO",
    diaInicio: "LUNES",
    diaFin: "SABADO",
    desde: "08:00",
    hasta: "17:00",
    refrigerioDesde: "13:00",
    refrigerioHasta: "14:00",
  };
}

export function horarioParcialPorDefecto(): HorarioParcial {
  return {
    tipo: "PARCIAL",
    bloques: [
      {
        dias: ["JUEVES", "VIERNES", "SABADO"],
        tramos: [
          { desde: "09:00", hasta: "12:50" },
          { desde: "14:00", hasta: "17:50" },
        ],
      },
    ],
  };
}

function esDia(value: unknown): value is DiaSemana {
  return typeof value === "string" && (DIAS_SEMANA as readonly string[]).includes(value);
}

function esHora(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

export function minutosDeHora(value: string): number | null {
  if (!esHora(value)) return null;
  const [h, m] = value.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function duracionMinutos(desde: string, hasta: string): number | null {
  const a = minutosDeHora(desde);
  const b = minutosDeHora(hasta);
  if (a == null || b == null || b <= a) return null;
  return b - a;
}

export function parseHorario(raw: string | null | undefined): HorarioGuardado | null {
  const text = raw?.trim() ?? "";
  if (!text) return null;
  if (!text.startsWith("{")) return { tipo: "TEXTO", texto: text };
  try {
    const data = JSON.parse(text) as Partial<HorarioLaboral>;
    if (data.tipo === "COMPLETO" && esDia(data.diaInicio) && esDia(data.diaFin)) {
      return {
        tipo: "COMPLETO",
        diaInicio: data.diaInicio,
        diaFin: data.diaFin,
        desde: typeof data.desde === "string" ? data.desde : "",
        hasta: typeof data.hasta === "string" ? data.hasta : "",
        refrigerioDesde: typeof data.refrigerioDesde === "string" ? data.refrigerioDesde : "",
        refrigerioHasta: typeof data.refrigerioHasta === "string" ? data.refrigerioHasta : "",
      };
    }
    if (data.tipo === "PARCIAL" && Array.isArray(data.bloques)) {
      return {
        tipo: "PARCIAL",
        bloques: data.bloques.map((bloque) => ({
          dias: Array.isArray(bloque?.dias) ? bloque.dias.filter(esDia) : [],
          tramos: Array.isArray(bloque?.tramos)
            ? bloque.tramos.map((tramo) => ({
                desde: typeof tramo?.desde === "string" ? tramo.desde : "",
                hasta: typeof tramo?.hasta === "string" ? tramo.hasta : "",
              }))
            : [{ desde: "", hasta: "" }],
        })),
      };
    }
  } catch {
    return { tipo: "TEXTO", texto: text };
  }
  return { tipo: "TEXTO", texto: text };
}

function diasEnRango(inicio: DiaSemana, fin: DiaSemana): DiaSemana[] {
  const a = DIAS_SEMANA.indexOf(inicio);
  const b = DIAS_SEMANA.indexOf(fin);
  if (a < 0 || b < 0 || b < a) return [];
  return DIAS_SEMANA.slice(a, b + 1);
}

function formatoDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const partes: string[] = [];
  if (horas === 1) partes.push("1 hora");
  else if (horas > 1) partes.push(`${horas} horas`);
  if (resto === 1) partes.push("1 minuto");
  else if (resto > 1) partes.push(`${resto} minutos`);
  return partes.join(" y ") || "0 minutos";
}

const HORAS_EN_LETRAS: Record<number, string> = {
  1: "una",
  2: "dos",
  3: "tres",
  4: "cuatro",
  5: "cinco",
  6: "seis",
  7: "siete",
  8: "ocho",
  9: "nueve",
  10: "diez",
  11: "once",
  12: "doce",
  13: "trece",
  14: "catorce",
  15: "quince",
  16: "dieciséis",
  17: "diecisiete",
  18: "dieciocho",
  19: "diecinueve",
  20: "veinte",
  21: "veintiuna",
  22: "veintidós",
  23: "veintitrés",
  24: "veinticuatro",
  25: "veinticinco",
  26: "veintiséis",
  27: "veintisiete",
  28: "veintiocho",
  29: "veintinueve",
  30: "treinta",
  36: "treinta y seis",
  40: "cuarenta",
  48: "cuarenta y ocho",
};

function horasSemanalesEnLetras(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const letras = HORAS_EN_LETRAS[horas] ?? String(horas);
  const unidad = horas === 1 ? "hora" : "horas";
  let texto = `${letras} (${horas}) ${unidad}`;
  if (resto > 0) texto += ` y ${formatoDuracion(resto)}`;
  return texto;
}

export function formatListaDias(dias: DiaSemana[]): string {
  const labels = dias.map((dia, index) => (index === 0 ? DIA_LABEL[dia] : DIA_LABEL_LOWER[dia]));
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

function lineasTramosYRefrigerio(tramos: HorarioTramo[]): string[] {
  const lineas: string[] = [];
  tramos.forEach((tramo, index) => {
    lineas.push(`Horario: de ${formatoHoraContrato(tramo.desde)} a ${formatoHoraContrato(tramo.hasta)}`);
    const siguiente = tramos[index + 1];
    if (siguiente && duracionMinutos(tramo.hasta, siguiente.desde)) {
      lineas.push(
        `Horario de refrigerio: de ${formatoHoraContrato(tramo.hasta)} a ${formatoHoraContrato(siguiente.desde)}`,
      );
    }
  });
  return lineas;
}

export function formatoHoraContrato(value: string): string {
  const minutos = minutosDeHora(value);
  if (minutos == null) return value;
  const h24 = Math.floor(minutos / 60);
  const m = minutos % 60;
  const sufijo = h24 >= 12 ? "p.m." : "a.m.";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

export function horasEfectivasCompleto(horario: HorarioCompleto): { dia: number; semana: number } | null {
  const jornada = duracionMinutos(horario.desde, horario.hasta);
  if (jornada == null) return null;
  const refrigerio =
    horario.refrigerioDesde && horario.refrigerioHasta
      ? duracionMinutos(horario.refrigerioDesde, horario.refrigerioHasta)
      : 0;
  if (refrigerio == null) return null;
  const dia = jornada - refrigerio;
  if (dia <= 0) return null;
  const dias = diasEnRango(horario.diaInicio, horario.diaFin);
  if (dias.length === 0) return null;
  return { dia, semana: dia * dias.length };
}

export function horasEfectivasBloque(bloque: HorarioBloque): number | null {
  if (bloque.dias.length === 0) return null;
  let total = 0;
  for (const tramo of bloque.tramos) {
    const mins = duracionMinutos(tramo.desde, tramo.hasta);
    if (mins == null) return null;
    total += mins;
  }
  return total > 0 ? total : null;
}

export function horasEfectivasSemanaParcial(horario: HorarioParcial): number | null {
  let total = 0;
  const vistos = new Set<DiaSemana>();
  for (const bloque of horario.bloques) {
    const porDia = horasEfectivasBloque(bloque);
    if (porDia == null || bloque.dias.length === 0) return null;
    for (const dia of bloque.dias) {
      if (vistos.has(dia)) return null;
      vistos.add(dia);
      total += porDia;
    }
  }
  return vistos.size > 0 ? total : null;
}

export function horarioEstructuraValida(horario: HorarioLaboral): boolean {
  if (horario.tipo === "COMPLETO") return horasEfectivasCompleto(horario) != null;
  return horasEfectivasSemanaParcial(horario) != null;
}

export function horarioEstaCompleto(raw: string | null | undefined): boolean {
  const parsed = parseHorario(raw);
  if (!parsed) return false;
  if (parsed.tipo === "TEXTO") return parsed.texto.trim().length > 0;
  return horarioEstructuraValida(parsed);
}

export function formatHorarioContrato(raw: string | null | undefined): string {
  const parsed = parseHorario(raw);
  if (!parsed) return "—";
  if (parsed.tipo === "TEXTO") return parsed.texto;
  if (parsed.tipo === "COMPLETO") return formatClausulaCompleto(parsed);
  return formatClausulaParcial(parsed);
}

export function formatClausulaCompleto(horario: HorarioCompleto): string {
  const rangoDias =
    horario.diaInicio === horario.diaFin
      ? DIA_LABEL_LOWER[horario.diaInicio]
      : `${DIA_LABEL_LOWER[horario.diaInicio]} a ${DIA_LABEL_LOWER[horario.diaFin]}`;
  let texto = `de ${rangoDias}, de ${formatoHoraContrato(horario.desde)} a ${formatoHoraContrato(horario.hasta)}`;
  const refrigerio = duracionMinutos(horario.refrigerioDesde, horario.refrigerioHasta);
  if (refrigerio) {
    const duracion =
      refrigerio === 60 ? "una hora de refrigerio" : `${formatoDuracion(refrigerio)} de refrigerio`;
    texto += `, con ${duracion} de ${formatoHoraContrato(horario.refrigerioDesde)} a ${formatoHoraContrato(horario.refrigerioHasta)}`;
  }
  return texto;
}

export function formatClausulaParcial(horario: HorarioParcial): string {
  const semana = horasEfectivasSemanaParcial(horario);
  const partes: string[] = [];
  if (semana != null) {
    partes.push(
      `con una jornada que no excederá de ${horasSemanalesEnLetras(semana)} semanales, distribuidas de la siguiente manera:`,
    );
  }
  for (const bloque of horario.bloques) {
    const porDia = horasEfectivasBloque(bloque);
    if (!bloque.dias.length || porDia == null) continue;
    partes.push("");
    partes.push(formatListaDias(bloque.dias));
    partes.push(...lineasTramosYRefrigerio(bloque.tramos));
    partes.push(`Horas efectivas de trabajo por día: ${formatoDuracion(porDia)}`);
  }
  if (semana != null) {
    partes.push(`Total de horas efectivas de trabajo por semana: ${formatoDuracion(semana)}`);
  }
  return partes.join("\n").trim();
}

export function serializeHorario(horario: HorarioLaboral): string {
  return JSON.stringify(horario);
}

export function horarioInicialParaJornada(
  jornada: string | null | undefined,
  raw: string | null | undefined,
): HorarioLaboral | HorarioTexto | null {
  const parsed = parseHorario(raw);
  if (jornada === "TIEMPO_COMPLETO") {
    if (parsed?.tipo === "COMPLETO") return parsed;
    return horarioCompletoPorDefecto();
  }
  if (jornada === "TIEMPO_PARCIAL") {
    if (parsed?.tipo === "PARCIAL") return parsed;
    return horarioParcialPorDefecto();
  }
  return parsed;
}
