import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { JornadaLaboral } from "@inventario/types";
import { cargoCanonico, funcionesDeCargo } from "@/lib/cargos-funciones";
import { formatHorarioContrato } from "@/lib/horario-laboral";
import { formatRemuneracion, nombreCompleto } from "@/lib/planillas-labels";
import { solesEnLetras } from "@/lib/soles-letras";

const FONT = "Times New Roman";
const SIZE = 24;
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const FEMENINOS = new Set([
  "ana",
  "beatriz",
  "carmen",
  "claudia",
  "daniela",
  "daniella",
  "debbie",
  "deybbie",
  "edith",
  "elizabeth",
  "gabriela",
  "inés",
  "ines",
  "isabel",
  "janet",
  "jessica",
  "karina",
  "laura",
  "liz",
  "lucía",
  "lucia",
  "luz",
  "maría",
  "maria",
  "marleni",
  "melissa",
  "milagros",
  "mónica",
  "monica",
  "natalia",
  "paola",
  "patricia",
  "rosa",
  "ruth",
  "sandra",
  "silvia",
  "soledad",
  "sonia",
  "teresa",
  "vanessa",
  "verónica",
  "veronica",
  "yesenia",
]);

const MASCULINOS_EN_A = new Set([
  "elías",
  "elias",
  "isaías",
  "isaias",
  "josué",
  "josue",
  "joshua",
  "luca",
  "lucas",
  "matías",
  "matias",
  "nicolás",
  "nicolas",
  "tomás",
  "tomas",
]);

export type ContratoWordDatos = {
  jornada: JornadaLaboral;
  entidadNombre: string;
  ruc: string | null;
  domicilio: string | null;
  rlNombre: string | null;
  rlDni: string | null;
  rlCargo: string | null;
  personaNombres: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  dni: string;
  direccion: string | null;
  cargo: string;
  fechaInicio: string;
  fechaFin: string | null;
  remuneracion: number;
  horario: string | null;
};

type Genero = {
  trato: "doña" | "don";
  identificado: "identificada" | "identificado";
  parte: "LA TRABAJADORA" | "EL TRABAJADOR";
  deParte: "LA TRABAJADORA" | "EL TRABAJADOR";
};

function run(text: string, extra?: { bold?: boolean; size?: number; break?: number }): TextRun {
  return new TextRun({
    text,
    bold: extra?.bold,
    size: extra?.size ?? SIZE,
    font: FONT,
    break: extra?.break,
  });
}

function parrafo(
  children: TextRun[] | string,
  opts?: {
    justify?: boolean;
    center?: boolean;
    before?: number;
    after?: number;
    bold?: boolean;
    numbering?: { reference: string; level: number };
  },
): Paragraph {
  return new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : opts?.justify === false ? AlignmentType.LEFT : AlignmentType.BOTH,
    spacing: { before: opts?.before ?? 0, after: opts?.after ?? 200, line: 276 },
    numbering: opts?.numbering,
    children: typeof children === "string" ? [run(children, { bold: opts?.bold })] : children,
  });
}

function partesFecha(iso: string): { dia: string; mes: string; anio: string } {
  const [year, month, day] = iso.slice(0, 10).split("-");
  const mes = MESES[Number(month) - 1] ?? month;
  return { dia: day ?? "", mes, anio: year ?? "" };
}

function fechaLarga(iso: string): string {
  const { dia, mes, anio } = partesFecha(iso);
  return `${dia} de ${mes} de ${anio}`;
}

function fechaFirma(iso: string): string {
  const { dia, mes, anio } = partesFecha(iso);
  return `a los ${dia} días del mes de ${mes} del año ${anio}`;
}

export function esFemeninoNombre(nombres: string): boolean {
  const primero = nombres.trim().split(/\s+/)[0]?.toLowerCase().normalize("NFC") ?? "";
  if (!primero) return false;
  if (FEMENINOS.has(primero)) return true;
  if (MASCULINOS_EN_A.has(primero)) return false;
  return /a$/.test(primero);
}

function generoDe(nombres: string): Genero {
  if (esFemeninoNombre(nombres)) {
    return {
      trato: "doña",
      identificado: "identificada",
      parte: "LA TRABAJADORA",
      deParte: "LA TRABAJADORA",
    };
  }
  return {
    trato: "don",
    identificado: "identificado",
    parte: "EL TRABAJADOR",
    deParte: "EL TRABAJADOR",
  };
}

function dato(value: string | null | undefined, vacio = "________________"): string {
  const t = value?.trim();
  return t || vacio;
}

function cargoEnMayusculas(cargo: string): string {
  return (cargoCanonico(cargo) ?? cargo).toUpperCase();
}

function articuloCargo(cargo: string): string {
  const c = cargoCanonico(cargo) ?? cargo;
  if (/^responsable/i.test(c)) return `un ${c}`;
  if (/^[aeiouáéíóú]/i.test(c)) return `un ${c}`;
  return `un ${c}`;
}

function anioInicio(iso: string): string {
  return partesFecha(iso).anio;
}

function celdaFirma(lineas: string[]): TableCell {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    children: lineas.map((linea, i) =>
      parrafo(linea, { center: true, justify: false, after: i === lineas.length - 1 ? 0 : 80 }),
    ),
  });
}

function introCompleto(d: ContratoWordDatos, g: Genero, nombreTrab: string): string {
  const cargoRl = dato(d.rlCargo, "representante legal");
  return (
    `Conste por el presente documento el Contrato de Trabajo a Plazo Fijo, bajo la modalidad de obra determinada o servicio específico, ` +
    `que celebran al amparo del Texto Único Ordenado del Decreto Legislativo N.° 728 – Ley de Productividad y Competitividad Laboral, ` +
    `aprobado por Decreto Supremo N.° 003-97-TR, de una parte: ${dato(d.entidadNombre)}, Asociación sin fines de lucro, ` +
    `con R.U.C. N.° ${dato(d.ruc)}, con domicilio fiscal en ${dato(d.domicilio)}, debidamente representada por su ${cargoRl} ` +
    `${dato(d.rlNombre)}, identificado con DNI N.° ${dato(d.rlDni)}, a quien en adelante se le denominará EL EMPLEADOR; ` +
    `y de la otra parte, ${g.trato} ${nombreTrab}, ${g.identificado} con DNI N.° ${dato(d.dni)} con domicilio en ${dato(d.direccion)}, ` +
    `a quien en adelante se le denominará ${g.parte}; en los términos y condiciones siguientes:`
  );
}

function introParcial(d: ContratoWordDatos, g: Genero, nombreTrab: string): string {
  const cargoRl = dato(d.rlCargo, "representante legal");
  return (
    `Conste por el presente documento el Contrato de Trabajo a Plazo Fijo en Régimen de Tiempo Parcial, que celebran al amparo ` +
    `del Texto Único Ordenado del Decreto Legislativo N° 728 – Ley de Productividad y Competitividad Laboral, aprobado por ` +
    `Decreto Supremo N° 003-97-TR, de una parte: la Asociación sin fines de lucro ${dato(d.entidadNombre)}, ` +
    `con R.U.C. N° ${dato(d.ruc)}, con domicilio fiscal en ${dato(d.domicilio)}, debidamente representada por su ${cargoRl} ` +
    `${dato(d.rlNombre)}, identificado con DNI N° ${dato(d.rlDni)}, a quien en adelante se le denominará EL EMPLEADOR, ` +
    `y de la otra parte, ${g.trato} ${nombreTrab}, ${g.identificado} con DNI N° ${dato(d.dni)}, con domicilio en ${dato(d.direccion)}, ` +
    `a quien en adelante se le denominará ${g.parte}; en los términos y condiciones siguientes:`
  );
}

function causaObjetivaCompleto(d: ContratoWordDatos): string {
  const year = anioInicio(d.fechaInicio);
  const cargo = cargoCanonico(d.cargo) ?? d.cargo;
  return (
    `La presente contratación se sustenta en la necesidad objetiva, temporal y específica de contar con ${articuloCargo(cargo)}, ` +
    `para realizar las labores temporales y a plazo fijo de servicio específico, consistente en la ejecución, seguimiento y ` +
    `supervisión del Plan Operativo Anual (POA) correspondiente al ejercicio ${year}, elaborado y aprobado por la Asociación, ` +
    `así como funciones del cargo y actividades propias de ${cargo.toLowerCase()}. ` +
    `Dicha contratación se encuentra directamente vinculada a la vigencia del POA ${year}, a los convenios y compromisos ` +
    `asumidos con terceros, así como al financiamiento asignado exclusivamente para dicho período, no constituyendo una ` +
    `necesidad permanente de la Asociación. En consecuencia, el servicio a prestarse tiene carácter temporal, específico y ` +
    `determinado, por lo que se justifica la contratación a plazo fijo bajo la modalidad de obra determinada o servicio específico, ` +
    `conforme a lo dispuesto en el artículo 63 del TUO del Decreto Legislativo N.° 728.`
  );
}

function causaObjetivaParcial(d: ContratoWordDatos): string {
  const cargo = cargoCanonico(d.cargo) ?? d.cargo;
  return (
    `La presente contratación a plazo fijo bajo el régimen de tiempo parcial responde a la necesidad institucional y temporal ` +
    `de contar con personal responsable de las funciones de ${cargo} de la Asociación, conforme a la planificación operativa ` +
    `y presupuestal del Programa, no requiriéndose una prestación continua ni a tiempo completo, lo que justifica la modalidad ` +
    `contractual adoptada.`
  );
}

function plazoCompleto(d: ContratoWordDatos): string {
  if (d.fechaFin) {
    return (
      `El presente contrato tiene una duración determinada, que rige desde el ${fechaLarga(d.fechaInicio)} hasta el ${fechaLarga(d.fechaFin)}, ` +
      `fecha en la cual quedará extinguido de pleno derecho, sin necesidad de comunicación adicional, salvo renovación expresa por acuerdo de partes.`
    );
  }
  return (
    `El presente contrato tiene una duración determinada, que rige desde el ${fechaLarga(d.fechaInicio)}, ` +
    `vinculado a la vigencia del Plan Operativo Anual ${anioInicio(d.fechaInicio)}.`
  );
}

function plazoParcial(d: ContratoWordDatos): string {
  if (d.fechaFin) {
    return (
      `El contrato tendrá una duración determinada desde el ${fechaLarga(d.fechaInicio)} hasta el ${fechaLarga(d.fechaFin)}, ` +
      `extinguiéndose automáticamente al vencimiento del plazo, sin necesidad de comunicación adicional.`
    );
  }
  return `El contrato tendrá una duración determinada desde el ${fechaLarga(d.fechaInicio)}.`;
}

function parrafosHorario(d: ContratoWordDatos, g: Genero): Paragraph[] {
  const horario = formatHorarioContrato(d.horario);
  if (d.jornada === "TIEMPO_COMPLETO") {
    return [
      parrafo(
        `${g.parte} cumplirá una jornada de trabajo ${horario}, conforme a las necesidades operativas del Programa y a la naturaleza del cargo.`,
      ),
    ];
  }
  const lineas = horario.split("\n").map((l) => l.trim()).filter(Boolean);
  const [primera, ...resto] = lineas;
  const out: Paragraph[] = [
    parrafo(`${g.parte} prestará sus servicios bajo el régimen de tiempo parcial, ${primera ?? horario}`),
  ];
  for (const linea of resto) {
    out.push(parrafo(`• ${linea}`, { justify: false, after: 80 }));
  }
  return out;
}

function tablaFirmas(d: ContratoWordDatos, g: Genero, nombreTrab: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          celdaFirma(["EL EMPLEADOR", dato(d.rlNombre), `DNI ${dato(d.rlDni)}`]),
          celdaFirma([g.parte, nombreTrab, `DNI ${dato(d.dni)}`]),
        ],
      }),
    ],
  });
}

export function nombreArchivoContrato(d: ContratoWordDatos): string {
  const jornada = d.jornada === "TIEMPO_PARCIAL" ? "TP" : "TC";
  const cargo = (cargoCanonico(d.cargo) ?? d.cargo).replace(/[\\/:*?"<>|]/g, " ").slice(0, 60).trim();
  const persona = nombreCompleto({
    nombres: d.personaNombres,
    apellido_paterno: d.apellidoPaterno,
    apellido_materno: d.apellidoMaterno,
  })
    .replace(/[\\/:*?"<>|]/g, " ")
    .slice(0, 50)
    .trim();
  return `Contrato ${jornada} - ${cargo} - ${persona}.docx`;
}

export function construirDocumentoContrato(d: ContratoWordDatos): Document {
  const g = generoDe(d.personaNombres);
  const nombreTrab = nombreCompleto({
    nombres: d.personaNombres,
    apellido_paterno: d.apellidoPaterno,
    apellido_materno: d.apellidoMaterno,
  }).toUpperCase();
  const cargo = cargoCanonico(d.cargo) ?? d.cargo;
  const funciones = funcionesDeCargo(cargo);
  const remuneracion = `S/ ${formatRemuneracion(d.remuneracion)} (${solesEnLetras(d.remuneracion)})`;
  const titulo =
    d.jornada === "TIEMPO_PARCIAL"
      ? "CONTRATO DE TRABAJO A PLAZO FIJO EN RÉGIMEN DE TIEMPO PARCIAL"
      : "CONTRATO DE TRABAJO A PLAZO FIJO POR OBRA DETERMINADA O SERVICIO ESPECIFICO";

  const children: Paragraph[] = [
    parrafo(titulo, { center: true, after: 300, bold: true }),
    parrafo(d.jornada === "TIEMPO_PARCIAL" ? introParcial(d, g, nombreTrab) : introCompleto(d, g, nombreTrab)),
    parrafo("PRIMERO: OBJETO SOCIAL DEL EMPLEADOR", { justify: false, after: 80, bold: true }),
    parrafo(
      "EL EMPLEADOR es una Asociación sin fines de lucro cuyo objeto es la asistencia social y el desarrollo integral de niños, adolescentes, jóvenes y personas en situación de vulnerabilidad, mediante la ejecución de programas y actividades de carácter social, educativo y comunitario.",
    ),
    parrafo(
      d.jornada === "TIEMPO_PARCIAL"
        ? "SEGUNDO: CAUSA OBJETIVA DE LA CONTRATACIÓN A TIEMPO PARCIAL"
        : "SEGUNDO: CAUSA OBJETIVA DE LA CONTRATACIÓN A PLAZO FIJO",
      { justify: false, after: 80, bold: true },
    ),
    parrafo(d.jornada === "TIEMPO_PARCIAL" ? causaObjetivaParcial(d) : causaObjetivaCompleto(d)),
    parrafo("TERCERO: CARGO Y FUNCIONES", { justify: false, after: 80, bold: true }),
    parrafo(
      d.jornada === "TIEMPO_PARCIAL"
        ? `EL EMPLEADOR contrata a ${g.deParte} para desempeñar el cargo de ${cargoEnMayusculas(cargo)}, desarrollando sus funciones exclusivamente dentro de la jornada parcial pactada, teniendo a su cargo, entre otras, las siguientes funciones:`
        : `EL EMPLEADOR contrata los servicios de ${g.deParte} para desempeñar el cargo de ${cargoEnMayusculas(cargo)}. En tal condición, tendrá a su cargo, entre otras, las siguientes funciones:`,
    ),
  ];

  if (funciones.length === 0) {
    children.push(parrafo("Las funciones propias del cargo asignado, según las directrices de EL EMPLEADOR."));
  } else {
    for (const fn of funciones) {
      children.push(
        parrafo(fn, {
          numbering: { reference: "funciones", level: 0 },
          after: 80,
        }),
      );
    }
  }

  children.push(
    parrafo(d.jornada === "TIEMPO_PARCIAL" ? "CUARTO: PLAZO" : "CUARTO: PLAZO DE DURACIÓN", { justify: false, after: 80, before: 160, bold: true }),
    parrafo(d.jornada === "TIEMPO_PARCIAL" ? plazoParcial(d) : plazoCompleto(d)),
    parrafo(
      d.jornada === "TIEMPO_PARCIAL" ? "QUINTO: JORNADA Y HORARIO DE TRABAJO (TIEMPO PARCIAL)" : "QUINTO: JORNADA Y HORARIO DE TRABAJO",
      { justify: false, after: 80, bold: true },
    ),
    ...parrafosHorario(d, g),
  );

  if (d.jornada === "TIEMPO_PARCIAL") {
    children.push(
      parrafo("SEXTO: BENEFICIOS LABORALES", { justify: false, after: 80, bold: true }),
      parrafo(
        `Por tratarse de un contrato a tiempo parcial, ${g.parte} tendrá derecho a remuneración pactada, gratificaciones legales y asignación familiar, de corresponder. No le corresponde el pago de Compensación por Tiempo de Servicios (CTS), ni indemnización por despido arbitrario, conforme a la normatividad vigente.`,
      ),
      parrafo("SEPTIMO: OBLIGACIONES LABORALES", { justify: false, after: 80, bold: true }),
      parrafo(
        `${g.parte} se obliga a cumplir con las normas internas, el Reglamento Interno de Trabajo, las políticas institucionales y las disposiciones impartidas por EL EMPLEADOR en ejercicio de su facultad de dirección.`,
      ),
      parrafo("OCTAVO: REMUNERACIÓN", { justify: false, after: 80, bold: true }),
      parrafo(
        `EL EMPLEADOR abonará a ${g.parte} la suma de ${remuneracion} como remuneración mensual, sujeta a los descuentos de ley que resulten aplicables.`,
      ),
      parrafo("NOVENO: EXTINCIÓN", { justify: false, after: 80, bold: true }),
      parrafo(
        "Queda entendido que EL EMPLEADOR no está obligado a dar aviso alguno adicional referente al término del presente contrato, operando su extinción en la fecha de su vencimiento conforme la cláusula cuarta.",
      ),
      parrafo(
        `Conforme con todas las cláusulas, firman las partes, en triplicado, ${fechaFirma(d.fechaInicio)}.`,
        { before: 200 },
      ),
    );
  } else {
    children.push(
      parrafo("SEXTO: REMUNERACIÓN", { justify: false, after: 80, bold: true }),
      parrafo(
        `EL EMPLEADOR abonará a ${g.parte} una remuneración mensual de ${remuneracion}, sujeta a los descuentos y aportes de ley.`,
      ),
      parrafo("SEPTIMO: DEBERES Y CONFIDENCIALIDAD", { justify: false, after: 80, bold: true }),
      parrafo(
        `${g.parte} se obliga a guardar estricta reserva sobre toda información confidencial o estratégica a la que tenga acceso; cumplir las normas internas, políticas institucionales y directivas del Consejo Directivo; y actuar con ética, transparencia y diligencia en el manejo de recursos.`,
      ),
      parrafo("OCTAVO: RÉGIMEN DISCIPLINARIO", { justify: false, after: 80, bold: true }),
      parrafo(
        `${g.parte} se encuentra sujeto al Reglamento Interno de Trabajo, de ser el caso, y a las disposiciones del TUO del Decreto Legislativo N.° 728 y normas complementarias.`,
      ),
      parrafo("NOVENO: LEGISLACIÓN APLICABLE", { justify: false, after: 80, bold: true }),
      parrafo(
        "En todo lo no previsto en el presente contrato, serán de aplicación las disposiciones del TUO del Decreto Legislativo N.° 728 – Ley de Productividad y Competitividad Laboral, y demás normas laborales vigentes.",
      ),
      parrafo(
        `Como muestra de conformidad con todas las cláusulas del presente contrato firman las partes, por triplicado ${fechaFirma(d.fechaInicio)}.`,
        { before: 200 },
      ),
    );
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "funciones",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertMillimetersToTwip(12), hanging: convertMillimetersToTwip(7) },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(25),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(25),
            },
          },
        },
        children: [...children, new Paragraph({ spacing: { before: 400 }, children: [] }), tablaFirmas(d, g, nombreTrab)],
      },
    ],
  });
}

export async function bufferContratoWord(d: ContratoWordDatos): Promise<Buffer> {
  return Packer.toBuffer(construirDocumentoContrato(d));
}
