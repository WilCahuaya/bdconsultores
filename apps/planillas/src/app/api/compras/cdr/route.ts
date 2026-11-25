import { NextResponse } from "next/server";
import { archivoCompraSunat } from "@/lib/actions/compras-sunat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Falta el comprobante." }, { status: 400 });
  const archivo = await archivoCompraSunat(id, "cdr");
  if (archivo.error || !archivo.bytes) {
    return NextResponse.json({ error: archivo.error ?? "No se pudo bajar el CDR." }, { status: 400 });
  }
  return new NextResponse(Buffer.from(archivo.bytes), {
    headers: {
      "Content-Type": archivo.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${archivo.filename ?? "comprobante.cdr.zip"}"`,
      "Cache-Control": "no-store",
    },
  });
}
