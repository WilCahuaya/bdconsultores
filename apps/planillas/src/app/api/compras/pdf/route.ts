import { NextResponse } from "next/server";
import { prepararPdfCompra } from "@/lib/actions/compras-sunat";
import { nombrePdf, pdfCompra } from "@/lib/sunat/pdf";
import { rutaPdf } from "@/lib/sunat/rutas";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Falta el comprobante." }, { status: 400 });

  const datos = await prepararPdfCompra(id);
  if (datos.error || !datos.compra) {
    return NextResponse.json({ error: datos.error ?? "No se pudo armar el PDF." }, { status: 400 });
  }

  const compra = datos.compra;
  const supabase = await createClient();
  const guardado = await supabase.storage.from("sunat-compras").download(
    rutaPdf({
      entidadId: compra.entidadId,
      periodo: compra.periodo,
      tipo: compra.tipo,
      serie: compra.serie,
      numero: compra.numero,
    }),
  );
  if (guardado.data) {
    const filename = nombrePdf({
      tipo: compra.tipo,
      serie: compra.serie,
      numero: compra.numero,
      numeroFinal: compra.numero_final,
    });
    return new NextResponse(Buffer.from(await guardado.data.arrayBuffer()), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const bytes = await pdfCompra({
    tipo: compra.tipo,
    serie: compra.serie,
    numero: compra.numero,
    numeroFinal: compra.numero_final,
    rucEmisor: compra.ruc_emisor,
    razonSocialEmisor: compra.razon_social_emisor,
    fechaEmision: compra.fecha_emision,
    moneda: compra.moneda,
    base: datos.base,
    igv: datos.igv,
    total: compra.total,
    periodo: compra.periodo,
    empresa: compra.empresa,
    rucEmpresa: compra.rucEmpresa,
    detalle: datos.detalle,
    aviso: datos.aviso,
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
