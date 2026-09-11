import { NextResponse } from "next/server";
import { datosAsistenciaEmpresa, datosAsistenciaTrabajador } from "@/lib/actions/asistencias";
import {
  bufferAsistenciaExcel,
  nombreArchivoAsistenciaEmpresa,
  nombreArchivoAsistenciaTrabajador,
} from "@/lib/asistencia-excel";
import { getProfile } from "@/lib/auth/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Inicie sesión para descargar la asistencia." }, { status: 401 });
  }
  const url = new URL(request.url);
  const mes = url.searchParams.get("mes")?.trim() ?? "";
  const relacionId = url.searchParams.get("relacionId")?.trim() ?? "";
  const entidadId = url.searchParams.get("entidadId")?.trim() ?? "";

  if (relacionId) {
    const datos = await datosAsistenciaTrabajador(relacionId, mes);
    if (datos.error || !datos.empresa || !datos.trabajador) {
      return NextResponse.json({ error: datos.error ?? "No se pudo armar el Excel." }, { status: 400 });
    }
    const buffer = await bufferAsistenciaExcel(datos.empresa, [datos.trabajador], mes);
    const filename = nombreArchivoAsistenciaTrabajador(datos.trabajador.nombre);
    return excelResponse(buffer, filename);
  }

  if (entidadId) {
    const datos = await datosAsistenciaEmpresa(entidadId, mes);
    if (datos.error || !datos.empresa || !datos.trabajadores) {
      return NextResponse.json({ error: datos.error ?? "No se pudo armar el Excel." }, { status: 400 });
    }
    const buffer = await bufferAsistenciaExcel(datos.empresa, datos.trabajadores, mes);
    const filename = nombreArchivoAsistenciaEmpresa(mes, datos.empresa.nombre);
    return excelResponse(buffer, filename);
  }

  return NextResponse.json({ error: "Indique la empresa o el trabajador." }, { status: 400 });
}

function excelResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="asistencia.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
