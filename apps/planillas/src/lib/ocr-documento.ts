"use client";

async function imagenDesdePdf(file: File): Promise<Blob> {
  const pdfjs = await import("pdfjs-dist/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo leer el PDF.");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo convertir el PDF."));
    }, "image/png");
  });
}

export async function leerTextoEscaneo(file: File): Promise<string> {
  const source =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      ? await imagenDesdePdf(file)
      : file;
  const Tesseract = (await import("tesseract.js")).default;
  const result = await Tesseract.recognize(source, "spa+eng");
  return result.data.text ?? "";
}
