import { NextResponse } from "next/server";
import { comprasSunatParaZip } from "@/lib/actions/compras-sunat";
import { nombrePdf, pdfCompra, zipPdfs } from "@/lib/sunat/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const entidadId = url.searchParams.get("entidadId")?.trim() ?? "";
  const periodo = url.searchParams.get("periodo")?.trim() ?? "";
  if (!entidadId || !/^[0-9]{6}$/.test(periodo)) {
    return NextResponse.json({ error: "Faltan la empresa o el mes." }, { status: 400 });
  }

  const datos = await comprasSunatParaZip(entidadId, periodo);
  if (datos.error || !datos.compras) {
    return NextResponse.json({ error: datos.error ?? "No se pudo armar el ZIP." }, { status: 400 });
  }

  const archivos = await Promise.all(
    datos.compras.map(async (compra) => ({
      nombre: nombrePdf({
        tipo: compra.tipo,
        serie: compra.serie,
        numero: compra.numero,
        numeroFinal: compra.numero_final,
      }),
      bytes: await pdfCompra({
        tipo: compra.tipo,
        serie: compra.serie,
        numero: compra.numero,
        numeroFinal: compra.numero_final,
        rucEmisor: compra.ruc_emisor,
        razonSocialEmisor: compra.razon_social_emisor,
        fechaEmision: compra.fecha_emision,
        moneda: compra.moneda,
        total: compra.total,
        periodo,
        empresa: datos.empresa ?? "",
        rucEmpresa: datos.rucEmpresa ?? "",
        aviso: "El detalle de lo comprado se arma en el PDF de cada fila, que consulta el XML en SUNAT.",
      }),
    })),
  );
  const zip = await zipPdfs(archivos);
  const filename = `compras-${datos.rucEmpresa || "ruc"}-${periodo}.zip`;

  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
