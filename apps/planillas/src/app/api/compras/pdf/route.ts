import { NextResponse } from "next/server";
import { compraSunatParaPdf } from "@/lib/actions/compras-sunat";
import { nombrePdf, pdfCompra } from "@/lib/sunat/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Falta el comprobante." }, { status: 400 });

  const datos = await compraSunatParaPdf(id);
  if (datos.error || !datos.compra) {
    return NextResponse.json({ error: datos.error ?? "No se pudo armar el PDF." }, { status: 400 });
  }

  const compra = datos.compra;
  const bytes = await pdfCompra({
    tipo: compra.tipo,
    serie: compra.serie,
    numero: compra.numero,
    numeroFinal: compra.numero_final,
    rucEmisor: compra.ruc_emisor,
    razonSocialEmisor: compra.razon_social_emisor,
    fechaEmision: compra.fecha_emision,
    moneda: compra.moneda,
    total: compra.total,
    periodo: compra.periodo,
    empresa: compra.empresa,
    rucEmpresa: compra.rucEmpresa,
  });
  const filename = nombrePdf({
    tipo: compra.tipo,
    serie: compra.serie,
    numero: compra.numero,
    numeroFinal: compra.numero_final,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
