import { NextResponse } from "next/server";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { listTrabajadoresSinVidaLey } from "@/lib/actions/ficha";
import { getTrabajador, listTrabajadores, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { getProfile } from "@/lib/auth/profile";
import { puedeEscribirPlanillas } from "@/lib/auth/access";
import {
  bufferVidaLeyWord,
  nombreArchivoVidaLey,
  type VidaLeyTrabajadorWord,
  type VidaLeyWordDatos,
} from "@/lib/vida-ley-word";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filaDe(t: TrabajadorListItem): VidaLeyTrabajadorWord {
  return {
    nombres: t.persona.nombres,
    apellidoPaterno: t.persona.apellido_paterno,
    apellidoMaterno: t.persona.apellido_materno,
    dni: t.persona.dni,
    fechaIngreso: t.fecha_ingreso,
    remuneracion: t.remuneracion,
    cargo: t.cargo,
    fechaNacimiento: t.persona.fecha_nacimiento,
  };
}

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Inicie sesión para descargar el trámite Vida Ley." }, { status: 401 });
  }
  if (!puedeEscribirPlanillas(profile)) {
    return NextResponse.json({ error: "No tiene permiso para descargar el trámite Vida Ley." }, { status: 403 });
  }

  const url = new URL(request.url);
  const relacionId = url.searchParams.get("relacionId")?.trim() || "";
  const entidadId = url.searchParams.get("entidadId")?.trim() || "";
  const ids = url.searchParams.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];

  let entidad;
  let trabajadores: TrabajadorListItem[] = [];

  if (relacionId) {
    const trabajador = await getTrabajador(relacionId);
    if (!trabajador) {
      return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
    }
    entidad = await getEntidadPlanillas(trabajador.entidad_id);
    trabajadores = [trabajador];
  } else if (entidadId) {
    entidad = await getEntidadPlanillas(entidadId);
    if (!entidad) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
    }
    if (ids.length > 0) {
      const todos = await listTrabajadores(entidadId);
      const pedido = new Set(ids);
      trabajadores = todos.filter((t) => pedido.has(t.id) && t.estado === "ACTIVA");
    } else {
      trabajadores = await listTrabajadoresSinVidaLey(entidadId);
    }
  } else {
    return NextResponse.json({ error: "Indique el trabajador o la empresa." }, { status: 400 });
  }

  if (!entidad) {
    return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  }
  if (trabajadores.length === 0) {
    return NextResponse.json({ error: "No hay trabajadores para el trámite Vida Ley." }, { status: 400 });
  }

  const datos: VidaLeyWordDatos = {
    entidadNombre: entidad.nombre,
    ruc: entidad.ruc,
    direccion: entidad.direccion,
    trabajadores: trabajadores.map(filaDe),
  };

  const buffer = await bufferVidaLeyWord(datos);
  const filename = nombreArchivoVidaLey(datos);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="vida-ley.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
