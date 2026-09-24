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
import type { JornadaLaboral, TipoAdendaPlanilla } from "@inventario/types";
import { cargoCanonico, funcionesDeCargo } from "@/lib/cargos-funciones";
import { esFemeninoNombre } from "@/lib/contrato-word";
import { MES_ABREV } from "@/lib/horario-asistencia";
import { estructuraHorarioParcial, formatHorarioContrato, parseHorario } from "@/lib/horario-laboral";
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

export type AdendaWordDatos = {
  tipo: TipoAdendaPlanilla;
  jornadaContrato: JornadaLaboral;
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
  fechaContrato: string;
  fechaVigencia: string;
  fechaSuscripcion: string;
  cargoAnterior: string;
  cargoNuevo: string | null;
  remuneracionNueva: number | null;
  horarioNuevo: string | null;
  jornadaNueva: JornadaLaboral | null;
};

type Genero = {
  trato: "doña" | "don";
  identificado: "identificada" | "identificado";
  parte: "LA TRABAJADORA" | "EL TRABAJADOR";
};

function run(text: string, extra?: { bold?: boolean }): TextRun {
  return new TextRun({ text, bold: extra?.bold, size: SIZE, font: FONT });
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

function dato(value: string | null | undefined, vacio = "________________"): string {
  const t = value?.trim();
  return t || vacio;
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

function generoDe(nombres: string): Genero {
  if (esFemeninoNombre(nombres)) {
    return { trato: "doña", identificado: "identificada", parte: "LA TRABAJADORA" };
  }
  return { trato: "don", identificado: "identificado", parte: "EL TRABAJADOR" };
}

function tituloContrato(jornada: JornadaLaboral): string {
  return jornada === "TIEMPO_PARCIAL"
    ? "CONTRATO DE TRABAJO A PLAZO FIJO EN RÉGIMEN DE TIEMPO PARCIAL"
    : "CONTRATO DE TRABAJO A PLAZO FIJO POR OBRA DETERMINADA O SERVICIO ESPECIFICO";
}

function tituloContratoFrase(jornada: JornadaLaboral): string {
  return jornada === "TIEMPO_PARCIAL"
    ? "Contrato de Trabajo a Plazo Fijo en Régimen de Tiempo Parcial"
    : "Contrato de Trabajo a Plazo Fijo por Obra Determinada o Servicio Específico";
}

function clausulaModificada(d: AdendaWordDatos): string {
  if (d.tipo === "CARGO") return "Tercera";
  if (d.tipo === "HORARIO") return "Quinta";
  return d.jornadaContrato === "TIEMPO_PARCIAL" ? "Octava" : "Sexta";
}

function intro(d: AdendaWordDatos, g: Genero, nombreTrab: string): string {
  const cargoRl = dato(d.rlCargo, "representante legal");
  const titulo = tituloContratoFrase(d.jornadaContrato);
  return (
    `Conste por el presente documento la Adenda al ${titulo}, que celebran al amparo del Texto Único Ordenado del ` +
    `Decreto Legislativo N.° 728 – Ley de Productividad y Competitividad Laboral, aprobado por Decreto Supremo N.° 003-97-TR, ` +
    `de una parte: la Asociación sin fines de lucro ${dato(d.entidadNombre)}, con R.U.C. N.° ${dato(d.ruc)}, con domicilio fiscal en ` +
    `${dato(d.domicilio)}, debidamente representada por su ${cargoRl} ${dato(d.rlNombre)}, identificado con DNI N.° ${dato(d.rlDni)}, ` +
    `a quien en adelante se le denominará EL EMPLEADOR, y de la otra parte, ${g.trato} ${nombreTrab}, ${g.identificado} con DNI N.° ` +
    `${dato(d.dni)}, con domicilio en ${dato(d.direccion)}, a quien en adelante se le denominará ${g.parte}; en los términos y condiciones siguientes:`
  );
}

function antecedentes(d: AdendaWordDatos, g: Genero): string {
  const verbo = d.tipo === "CARGO" ? "venía" : "viene";
  const cargo = (cargoCanonico(d.cargoAnterior) ?? d.cargoAnterior).toUpperCase();
  return (
    `Las partes celebraron con fecha ${fechaLarga(d.fechaContrato)} un ${tituloContratoFrase(d.jornadaContrato)}, ` +
    `mediante el cual ${g.parte} ${verbo} desempeñando el cargo de ${cargo}.`
  );
}

function parrafosHorario(d: AdendaWordDatos, g: Genero): Paragraph[] {
  const jornada = d.jornadaNueva ?? d.jornadaContrato;
  const desde = `Por mutuo acuerdo, las partes convienen en modificar la Cláusula Quinta del contrato original, referida a la jornada y horario de trabajo, estableciéndose que, a partir del ${fechaLarga(d.fechaVigencia)}, `;
  if (jornada === "TIEMPO_COMPLETO") {
    return [
      parrafo(
        `${desde}${g.parte} cumplirá una jornada de trabajo ${formatHorarioContrato(d.horarioNuevo)}, conforme a las necesidades operativas del Programa y a la naturaleza del cargo.`,
      ),
    ];
  }
  const parsed = parseHorario(d.horarioNuevo);
  if (parsed?.tipo !== "PARCIAL") {
    return [parrafo(`${desde}${g.parte} prestará sus servicios bajo el régimen de tiempo parcial, ${formatHorarioContrato(d.horarioNuevo)}`)];
  }
  const data = estructuraHorarioParcial(parsed);
  const out: Paragraph[] = [
    parrafo(`${desde}${g.parte} prestará sus servicios bajo el régimen de tiempo parcial, ${data.intro}`),
  ];
  for (const bloque of data.bloques) {
    out.push(parrafo(bloque.titulo, { justify: false, after: 80, numbering: { reference: "horario", level: 0 } }));
    for (const item of bloque.items) {
      out.push(parrafo(item, { justify: false, after: 40, numbering: { reference: "horario", level: 1 } }));
    }
  }
  if (data.total) {
    out.push(parrafo(data.total, { justify: false, after: 80, numbering: { reference: "horario", level: 0 } }));
  }
  out.push(
    parrafo(
      "La distribución de la jornada podrá adecuarse por necesidades del servicio, respetando en todo momento el límite máximo de horas correspondiente al régimen de tiempo parcial y la normativa laboral vigente.",
    ),
  );
  return out;
}

function cuerpo(d: AdendaWordDatos, g: Genero): Paragraph[] {
  const clausula = clausulaModificada(d);
  if (d.tipo === "HORARIO") {
    return [
      parrafo("SEGUNDO: MODIFICACIÓN DE LA CLÁUSULA QUINTA (JORNADA Y HORARIO)", { justify: false, after: 80, bold: true }),
      ...parrafosHorario(d, g),
      parrafo("TERCERO: RATIFICACIÓN DE LAS DEMÁS CLÁUSULAS", { justify: false, after: 80, bold: true }),
      parrafo(
        "Las partes dejan expresa constancia de que la presente adenda modifica únicamente la Cláusula Quinta referida a la jornada y horario de trabajo. En consecuencia, el cargo, funciones, remuneración, plazo de duración del contrato y demás condiciones laborales pactadas en el contrato original permanecen vigentes en todos sus extremos.",
      ),
      parrafo("CUARTO: VIGENCIA", { justify: false, after: 80, bold: true }),
      parrafo(vigencia(d)),
      parrafo(
        `En señal de conformidad, las partes suscriben la presente adenda en tres ejemplares de un mismo tenor, ${fechaFirma(d.fechaSuscripcion)}.`,
        { before: 200 },
      ),
    ];
  }
  if (d.tipo === "REMUNERACION") {
    const monto = d.remuneracionNueva ?? 0;
    const remuneracion = `S/ ${formatRemuneracion(monto)} (${solesEnLetras(monto)})`;
    const pago =
      d.jornadaContrato === "TIEMPO_PARCIAL"
        ? `EL EMPLEADOR abonará a ${g.parte} la suma de ${remuneracion} como remuneración mensual, sujeta a los descuentos de ley que resulten aplicables.`
        : `EL EMPLEADOR abonará a ${g.parte} una remuneración mensual de ${remuneracion}, sujeta a los descuentos y aportes de ley.`;
    return [
      parrafo(`SEGUNDO: MODIFICACIÓN DE LA CLÁUSULA ${clausula.toUpperCase()} (REMUNERACIÓN)`, {
        justify: false,
        after: 80,
        bold: true,
      }),
      parrafo(
        `Por mutuo acuerdo, las partes convienen en modificar la Cláusula ${clausula} del contrato original, referida a la remuneración, estableciéndose que, a partir del ${fechaLarga(d.fechaVigencia)}, ${pago}`,
      ),
      parrafo("TERCERO: RATIFICACIÓN DE LAS DEMÁS CLÁUSULAS", { justify: false, after: 80, bold: true }),
      parrafo(
        `Las partes dejan expresa constancia de que la presente adenda modifica únicamente la Cláusula ${clausula} referida a la remuneración. En consecuencia, el cargo, funciones, jornada, horario, plazo de duración del contrato y demás condiciones laborales pactadas en el contrato original permanecen vigentes en todos sus extremos.`,
      ),
      parrafo("CUARTO: VIGENCIA", { justify: false, after: 80, bold: true }),
      parrafo(vigencia(d)),
      parrafo(
        `En señal de conformidad, las partes suscriben la presente adenda en tres ejemplares de un mismo tenor, ${fechaFirma(d.fechaSuscripcion)}.`,
        { before: 200 },
      ),
    ];
  }

  const cargo = (cargoCanonico(d.cargoNuevo) ?? d.cargoNuevo ?? "").toUpperCase();
  const funciones = funcionesDeCargo(d.cargoNuevo);
  const parcial = (d.jornadaNueva ?? d.jornadaContrato) === "TIEMPO_PARCIAL";
  const children: Paragraph[] = [
    parrafo("SEGUNDO: MODIFICACIÓN DE LA CLÁUSULA TERCERA (CARGO Y FUNCIONES)", { justify: false, after: 80, bold: true }),
    parrafo(
      `Por mutuo acuerdo, las partes convienen en modificar la CLÁUSULA TERCERA del contrato original, estableciéndose que, a partir del ${fechaLarga(d.fechaVigencia)}, ${g.parte} pasará a desempeñar el cargo de ${cargo} de la asociación.`,
    ),
    parrafo("TERCERO: CARGO Y FUNCIONES", { justify: false, after: 80, bold: true }),
    parrafo(
      parcial
        ? `EL EMPLEADOR contrata a ${g.parte} para desempeñar el cargo de ${cargo}, desarrollando sus funciones exclusivamente dentro de la jornada parcial pactada, teniendo a su cargo, entre otras, las siguientes funciones:`
        : `EL EMPLEADOR contrata los servicios de ${g.parte} para desempeñar el cargo de ${cargo}. En tal condición, tendrá a su cargo, entre otras, las siguientes funciones:`,
    ),
  ];
  if (funciones.length === 0) {
    children.push(parrafo("Las funciones propias del cargo asignado, según las directrices de EL EMPLEADOR."));
  } else {
    for (const fn of funciones) {
      children.push(parrafo(fn, { numbering: { reference: "funciones", level: 0 }, after: 80 }));
    }
  }
  children.push(
    parrafo("CUARTO: RATIFICACIÓN DE LAS DEMÁS CLÁUSULAS", { justify: false, after: 80, before: 160, bold: true }),
    parrafo(
      "Las partes dejan expresa constancia que la presente modificación no implica variación alguna en la remuneración, jornada de trabajo ni demás condiciones laborales, por lo que todas las demás cláusulas del contrato original se mantienen vigentes en todos sus extremos.",
    ),
    parrafo("QUINTO: VIGENCIA", { justify: false, after: 80, bold: true }),
    parrafo(vigencia(d)),
    parrafo(
      `Conforme con todas las cláusulas, firman las partes, en triplicado, ${fechaFirma(d.fechaSuscripcion)}.`,
      { before: 200 },
    ),
  );
  return children;
}

function vigencia(d: AdendaWordDatos): string {
  return (
    `La presente adenda entrará en vigencia a partir del ${fechaLarga(d.fechaVigencia)}, formando parte integrante del ` +
    `${tituloContratoFrase(d.jornadaContrato)} suscrito con fecha ${fechaLarga(d.fechaContrato)}.`
  );
}

const SIN_BORDE = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function tablaFirmas(d: AdendaWordDatos, g: Genero, nombreTrab: string): Table {
  function lineaFirma(): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: convertMillimetersToTwip(18), after: 160 },
      indent: { left: convertMillimetersToTwip(10), right: convertMillimetersToTwip(10) },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000", space: 1 } },
      children: [run(" ")],
    });
  }
  function celda(rol: string, nombre: string, dni: string): TableCell {
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: SIN_BORDE,
      children: [
        lineaFirma(),
        parrafo(rol, { center: true, justify: false, after: 80, bold: true }),
        parrafo(nombre, { center: true, justify: false, after: 80 }),
        parrafo(`DNI ${dni}`, { center: true, justify: false, after: 0 }),
      ],
    });
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          celda("EL EMPLEADOR", dato(d.rlNombre), dato(d.rlDni)),
          celda(g.parte, nombreTrab, dato(d.dni)),
        ],
      }),
    ],
  });
}

function tokenNombreArchivo(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function nombreArchivoAdenda(d: AdendaWordDatos): string {
  const tipo = d.tipo === "REMUNERACION" ? "SUELDO" : d.tipo;
  const persona = tokenNombreArchivo(
    [d.personaNombres.trim().split(/\s+/)[0] ?? "", d.apellidoPaterno ?? ""].filter(Boolean).join(" "),
  ).slice(0, 50);
  const [year, month, day] = d.fechaVigencia.slice(0, 10).split("-");
  const abrev = MES_ABREV[Number(month) - 1] ?? month ?? "";
  const fecha = `${day ?? ""} ${abrev.toUpperCase()} ${year ?? ""}`.replace(/\s+/g, " ").trim();
  return `ADENDA ${tipo} - ${persona} - ${fecha}.docx`;
}

export function construirDocumentoAdenda(d: AdendaWordDatos): Document {
  const g = generoDe(d.personaNombres);
  const nombreTrab = nombreCompleto({
    nombres: d.personaNombres,
    apellido_paterno: d.apellidoPaterno,
    apellido_materno: d.apellidoMaterno,
  }).toUpperCase();
  const children: Paragraph[] = [
    parrafo(`ADENDA AL ${tituloContrato(d.jornadaContrato)}`, { center: true, after: 300, bold: true }),
    parrafo(intro(d, g, nombreTrab)),
    parrafo("PRIMERO: ANTECEDENTES", { justify: false, after: 80, bold: true }),
    parrafo(antecedentes(d, g)),
    ...cuerpo(d, g),
  ];
  return new Document({
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
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
                paragraph: { indent: { left: convertMillimetersToTwip(12), hanging: convertMillimetersToTwip(7) } },
              },
            },
          ],
        },
        {
          reference: "horario",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: convertMillimetersToTwip(12), hanging: convertMillimetersToTwip(7) } },
              },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "◦",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: convertMillimetersToTwip(22), hanging: convertMillimetersToTwip(7) } },
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
        children: [...children, new Paragraph({ spacing: { before: 200 }, children: [] }), tablaFirmas(d, g, nombreTrab)],
      },
    ],
  });
}

export async function bufferAdendaWord(d: AdendaWordDatos): Promise<Buffer> {
  return Packer.toBuffer(construirDocumentoAdenda(d));
}
