import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import { cargoCanonico } from "@/lib/cargos-funciones";
import { nombreCompleto } from "@/lib/planillas-labels";

const FONT = "Times New Roman";
const SIZE = 22;
const SIZE_TABLA = 16;
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

const ACTIVIDAD_ECONOMICA = "9499 - ACTIVIDADES DE OTRAS ASOCIACIONES N.C.P.";
const OBJETO_ASOCIACION =
  "Asociación sin fines de lucro que brinda asistencia social a niños, adolescentes y jóvenes";

const BORDE = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

export type VidaLeyTrabajadorWord = {
  nombres: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  dni: string;
  fechaIngreso: string | null;
  remuneracion: number | null;
  cargo: string | null;
  fechaNacimiento: string | null;
};

export type VidaLeyWordDatos = {
  entidadNombre: string;
  ruc: string | null;
  direccion: string | null;
  trabajadores: VidaLeyTrabajadorWord[];
};

function run(text: string, extra?: { bold?: boolean; size?: number }): TextRun {
  return new TextRun({
    text,
    bold: extra?.bold,
    size: extra?.size ?? SIZE,
    font: FONT,
  });
}

function parrafo(
  children: TextRun[] | string,
  opts?: { center?: boolean; after?: number; before?: number; bold?: boolean; size?: number },
): Paragraph {
  return new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: opts?.before ?? 0, after: opts?.after ?? 120 },
    children: typeof children === "string" ? [run(children, { bold: opts?.bold, size: opts?.size })] : children,
  });
}

export function fechaVidaLeyDoc(value: string | null | undefined): string {
  if (!value) return "";
  const iso = value.slice(0, 10);
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function periodoVidaLey(fechaIngreso: string | null | undefined): string {
  const iso = fechaIngreso?.slice(0, 10);
  const [year, month] = iso ? iso.split("-") : new Date().toISOString().slice(0, 10).split("-");
  const mesIdx = Number(month) - 1;
  const mes = (MESES[mesIdx] ?? "").toUpperCase();
  const anio = year ?? "";
  if (!mes || !anio) return "";
  if (mesIdx >= 11) return `DICIEMBRE ${anio}`;
  return `${mes} – DICIEMBRE ${anio}`;
}

export function fechaFinPeriodoVidaLey(fechaIngreso: string | null | undefined): string {
  const iso = fechaIngreso?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const year = iso.slice(0, 4);
  return `${year}-12-31`;
}

function remuneracionDoc(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return `S/. ${value.toFixed(2)}`;
}

function cargoDoc(cargo: string | null | undefined): string {
  const raw = cargo?.trim();
  if (!raw) return "";
  return (cargoCanonico(raw) ?? raw).toUpperCase();
}

function nombreDoc(t: VidaLeyTrabajadorWord): string {
  return nombreCompleto({
    nombres: t.nombres,
    apellido_paterno: t.apellidoPaterno,
    apellido_materno: t.apellidoMaterno,
  }).toUpperCase();
}

function celda(
  text: string,
  opts?: { bold?: boolean; header?: boolean; width: number; center?: boolean },
): TableCell {
  return new TableCell({
    width: { size: opts?.width ?? 10, type: WidthType.PERCENTAGE },
    borders: BORDES,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts?.header ? { type: ShadingType.CLEAR, fill: "D9D9D9" } : undefined,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 0, before: 0 },
        children: [run(text, { bold: opts?.bold || opts?.header, size: SIZE_TABLA })],
      }),
    ],
  });
}

function filaDato(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      celda(label, { bold: true, width: 28 }),
      celda(value, { width: 72 }),
    ],
  });
}

function tablaEmpresa(d: VidaLeyWordDatos): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      filaDato("Razón Social", d.entidadNombre),
      filaDato("RUC", d.ruc?.trim() || ""),
      filaDato("Dirección", d.direccion?.trim() || ""),
      filaDato("Actividad Económica", ACTIVIDAD_ECONOMICA),
    ],
  });
}

const COLS = [
  { key: "n", label: "N°", width: 5, center: true },
  { key: "nombre", label: "NOMBRE Y APELLIDO", width: 22 },
  { key: "dni", label: "DNI", width: 10, center: true },
  { key: "ingreso", label: "FECHA DE INGRESO", width: 11, center: true },
  { key: "rem", label: "REMUNERACION", width: 11, center: true },
  { key: "cargo", label: "CARGO", width: 18 },
  { key: "nac", label: "FECHA DE NACIMIENTO", width: 12, center: true },
  { key: "periodo", label: "PERIODO", width: 11, center: true },
] as const;

function tablaTrabajadores(trabajadores: VidaLeyTrabajadorWord[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: COLS.map((col) => celda(col.label, { header: true, width: col.width, center: true })),
  });
  const body = trabajadores.map((t, i) => {
    const vals = [
      String(i + 1),
      nombreDoc(t),
      t.dni,
      fechaVidaLeyDoc(t.fechaIngreso),
      remuneracionDoc(t.remuneracion),
      cargoDoc(t.cargo),
      fechaVidaLeyDoc(t.fechaNacimiento),
      periodoVidaLey(t.fechaIngreso),
    ];
    return new TableRow({
      children: COLS.map((col, idx) =>
        celda(vals[idx] ?? "", { width: col.width, center: Boolean(col.center) }),
      ),
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...body],
  });
}

export function nombreArchivoVidaLey(d: VidaLeyWordDatos): string {
  const empresa = d.entidadNombre.replace(/[\\/:*?"<>|]/g, " ").slice(0, 40).trim();
  if (d.trabajadores.length === 1) {
    const persona = nombreDoc(d.trabajadores[0]).replace(/[\\/:*?"<>|]/g, " ").slice(0, 50).trim();
    return `Tramite seguro Vida Ley - ${persona}.docx`;
  }
  return `Tramite seguro Vida Ley - ${empresa}.docx`;
}

export function construirDocumentoVidaLey(d: VidaLeyWordDatos): Document {
  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: {
              top: convertMillimetersToTwip(15),
              bottom: convertMillimetersToTwip(15),
              left: convertMillimetersToTwip(15),
              right: convertMillimetersToTwip(15),
            },
          },
        },
        children: [
          parrafo("SEGURO DE VIDA LEY", { center: true, bold: true, after: 80, size: 32 }),
          parrafo(d.entidadNombre.toUpperCase(), { center: true, bold: true, after: 280, size: 28 }),
          parrafo("DATOS DE LA EMPRESA", { bold: true, after: 80 }),
          tablaEmpresa(d),
          parrafo(OBJETO_ASOCIACION, { before: 80, after: 280 }),
          parrafo("DATOS DE LOS TRABAJADORES", { bold: true, after: 80 }),
          tablaTrabajadores(d.trabajadores),
        ],
      },
    ],
  });
}

export async function bufferVidaLeyWord(d: VidaLeyWordDatos): Promise<Buffer> {
  return Packer.toBuffer(construirDocumentoVidaLey(d));
}
