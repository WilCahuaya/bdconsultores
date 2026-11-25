import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { zipSync } from "fflate";

export interface CompraPdf {
  tipo: "01" | "02" | "03";
  serie: string;
  numero: string;
  numeroFinal: string | null;
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  fechaEmision: string | null;
  moneda: string | null;
  total: number | null;
  periodo: string;
  empresa: string;
  rucEmpresa: string;
}

const TIPO: Record<CompraPdf["tipo"], string> = {
  "01": "Factura electronica",
  "02": "Recibo por honorarios",
  "03": "Boleta de venta electronica",
};

export function etiquetaTipo(tipo: CompraPdf["tipo"]): string {
  return TIPO[tipo];
}

export function nombrePdf(compra: Pick<CompraPdf, "tipo" | "serie" | "numero" | "numeroFinal">): string {
  const serie = compra.serie || "SIN-SERIE";
  const numero = compra.numeroFinal ? `${compra.numero}-${compra.numeroFinal}` : compra.numero;
  return sanitizar(`${compra.tipo}-${serie}-${numero}.pdf`);
}

export async function pdfCompra(compra: CompraPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.14, 0.2);
  const muted = rgb(0.35, 0.4, 0.45);
  let y = 780;

  page.drawText("Resumen del Registro de Compras", { x: 48, y, size: 16, font: bold, color: ink });
  y -= 22;
  page.drawText(win(TIPO[compra.tipo]), { x: 48, y, size: 12, font, color: ink });
  y -= 28;

  const filas: Array<[string, string]> = [
    ["Empresa", `${compra.rucEmpresa}  ${compra.empresa}`],
    ["Periodo", periodoLegible(compra.periodo)],
    ["Proveedor", compra.razonSocialEmisor || "—"],
    ["RUC emisor", compra.rucEmisor || "—"],
    ["Serie", compra.serie || "—"],
    ["Numero", compra.numeroFinal ? `${compra.numero} al ${compra.numeroFinal}` : compra.numero],
    ["Fecha de emision", fechaLegible(compra.fechaEmision)],
    ["Importe", importeLegible(compra.total, compra.moneda)],
  ];

  for (const [label, value] of filas) {
    page.drawText(label, { x: 48, y, size: 9, font, color: muted });
    y -= 14;
    page.drawText(win(value), { x: 48, y, size: 12, font: bold, color: ink });
    y -= 22;
  }

  y -= 12;
  const nota =
    "Este PDF se armo con los datos del Registro de Compras de SUNAT. No es la representacion impresa del emisor ni reemplaza el XML.";
  page.drawText(nota, { x: 48, y, size: 9, font, color: muted, maxWidth: 500 });
  return doc.save();
}

export async function zipPdfs(archivos: Array<{ nombre: string; bytes: Uint8Array }>): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  for (const archivo of archivos) {
    entries[archivo.nombre] = archivo.bytes;
  }
  return zipSync(entries, { level: 6 });
}

function periodoLegible(periodo: string): string {
  if (!/^[0-9]{6}$/.test(periodo)) return periodo;
  return `${periodo.slice(4, 6)}/${periodo.slice(0, 4)}`;
}

function fechaLegible(iso: string | null): string {
  if (!iso) return "—";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

function importeLegible(total: number | null, moneda: string | null): string {
  if (total == null) return "—";
  const texto = total.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${moneda || "PEN"} ${texto}`;
}

function sanitizar(nombre: string): string {
  return nombre.replace(/[^\w.\-]+/g, "_");
}

function win(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}
