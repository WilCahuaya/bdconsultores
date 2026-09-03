import { GState } from "jspdf";
import {
  BRAND_LOGO_PATH,
  BRAND_LOGO_TRANSFORM,
  BRAND_LOGO_VIEWBOX,
} from "../../components/public/brand-logo-path";

/** Color marca B&D (hsl 198 51% 47%) */
const BRAND_FILL = "#3B92A8";

let cachedLogoPng: string | null = null;

export async function getBrandLogoPngDataUrl(): Promise<string> {
  if (cachedLogoPng) return cachedLogoPng;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_LOGO_VIEWBOX}">
  <g transform="${BRAND_LOGO_TRANSFORM}" fill="${BRAND_FILL}" stroke="none">
    <path d="${BRAND_LOGO_PATH}" />
  </g>
</svg>`;

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 504;
      canvas.height = 530;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo crear el canvas del logo."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      cachedLogoPng = canvas.toDataURL("image/png");
      resolve(cachedLogoPng);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar el logo."));
    };
    img.src = url;
  });
}

type JsPDFDoc = import("jspdf").jsPDF;

/** Marca de agua centrada en todas las páginas del PDF. */
export function addPdfLogoWatermark(doc: JsPDFDoc, logoPng: string, opacity = 0.09): void {
  const total = doc.getNumberOfPages();
  const logoW = 130;
  const logoH = (logoW * 530) / 504;

  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const x = (pageW - logoW) / 2;
    const y = (pageH - logoH) / 2;

    doc.setGState(new GState({ opacity }));
    doc.addImage(logoPng, "PNG", x, y, logoW, logoH);
    doc.setGState(new GState({ opacity: 1 }));
  }
}
