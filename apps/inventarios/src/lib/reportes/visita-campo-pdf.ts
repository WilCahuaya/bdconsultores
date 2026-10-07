import { estadoBienLabel, labelFechaEmision, type VisitaCampoHistorial, type VisitaCampoReporte, type VisitaCampoReporteItem } from "@inventario/types";
import { EMPRESA } from "./branding";
import { addPdfLogoWatermark, getBrandLogoPngDataUrl } from "./logo-watermark";

type JsPDFDoc = import("jspdf").jsPDF;

const HEAD_FILL: [number, number, number] = [30, 64, 120];
const TABLE_HEAD = ["Ambiente", "Sucursal", "Bien", "Código", "Detalle", "Motivo", "Revisado por", "Fecha"];

function slugFilename(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function sedeLabel(visita: VisitaCampoHistorial): string {
  return visita.sede_id ? (visita.sede_nombre ?? "Sucursal") : "Todas las sucursales";
}

function detalleItem(item: VisitaCampoReporteItem, tono: "faltante" | "baja" | "estado"): string {
  if (tono === "faltante") return "Pasó a faltante";
  if (tono === "baja") return "De baja";
  if (item.estado_anterior && item.estado_nuevo) {
    return `${estadoBienLabel(item.estado_anterior)} → ${estadoBienLabel(item.estado_nuevo)}`;
  }
  return "";
}

function filaItem(item: VisitaCampoReporteItem, tono: "faltante" | "baja" | "estado"): string[] {
  return [
    item.ambiente_nombre,
    item.sede_nombre,
    item.nombre,
    item.codigo_barras ?? "",
    detalleItem(item, tono),
    item.motivo ?? "",
    item.revisado_por_nombre ?? "",
    item.revisado_at ? formatFecha(item.revisado_at) : "",
  ];
}

function addPageNumbers(doc: JsPDFDoc) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.text(`Página ${i} de ${total}`, pageW - 10, pageH - 8, { align: "right" });
  }
}

export async function exportVisitaCampoReportePdf(input: {
  entidadNombre: string;
  visita: VisitaCampoHistorial;
  reporte: VisitaCampoReporte;
  usuarioNombre: string;
  usuarioEmail: string;
}): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { entidadNombre, visita, reporte, usuarioNombre, usuarioEmail } = input;
  const total =
    reporte.faltantes.length + reporte.bajas.length + reporte.cambios_estado.length;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  let logoPng: string | null = null;
  try {
    logoPng = await getBrandLogoPngDataUrl();
  } catch {
    logoPng = null;
  }

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 10;
  const titulo = `Reporte de visita de campo N.º ${visita.numero}`;
  const estado = visita.cerrado_at
    ? `Cerrada el ${formatFecha(visita.cerrado_at)}`
    : `Abierta el ${formatFecha(visita.abierto_at)}`;
  const meta = [
    `Entidad: ${entidadNombre}`,
    `Sucursal: ${sedeLabel(visita)}`,
    estado,
    `Registros: ${total}`,
  ].join("   |   ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(EMPRESA.razonSocial, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(labelFechaEmision(new Date()), pageW - margin, y, { align: "right" });
  y += 4;

  doc.text(`${EMPRESA.producto}  ·  RUC ${EMPRESA.ruc}`, margin, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(titulo, margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(meta, margin, y, { maxWidth: pageW - margin * 2 });
  y += 4;

  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(`${usuarioNombre} · ${usuarioEmail}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 6;

  const secciones: Array<{
    titulo: string;
    tono: "faltante" | "baja" | "estado";
    items: VisitaCampoReporteItem[];
  }> = [
    { titulo: "Faltantes", tono: "faltante", items: reporte.faltantes },
    { titulo: "Bajas", tono: "baja", items: reporte.bajas },
    { titulo: "Cambiaron de estado", tono: "estado", items: reporte.cambios_estado },
  ];

  const pageH = doc.internal.pageSize.getHeight();
  for (const seccion of secciones) {
    if (y > pageH - 28) {
      doc.addPage();
      y = 14;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${seccion.titulo} (${seccion.items.length})`, margin, y);
    y += 2;

    if (seccion.items.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Sin registros.", margin, y + 4);
      y += 10;
      continue;
    }

    autoTable(doc, {
      head: [TABLE_HEAD],
      body: seccion.items.map((item) => filaItem(item, seccion.tono)),
      startY: y + 2,
      showHead: "everyPage",
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [210, 210, 210],
        lineWidth: 0.1,
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: HEAD_FILL,
        fontSize: 7,
        textColor: [255, 255, 255],
        halign: "center",
        valign: "middle",
        fontStyle: "bold",
      },
      margin: { left: margin, right: margin, top: 14, bottom: 14 },
    });

    y =
      (doc as JsPDFDoc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y += 8;
  }

  if (logoPng) addPdfLogoWatermark(doc, logoPng);
  addPageNumbers(doc);

  const nombre = slugFilename(`${entidadNombre}-visita-${visita.numero}`) || `visita-${visita.numero}`;
  doc.save(`reporte-${nombre}.pdf`);
}
