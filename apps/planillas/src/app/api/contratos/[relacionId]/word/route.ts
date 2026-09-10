import { NextResponse } from "next/server";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { listContratos } from "@/lib/actions/ficha";
import { getTrabajador } from "@/lib/actions/trabajadores";
import { getProfile } from "@/lib/auth/profile";
import { bufferContratoWord, nombreArchivoContrato, type ContratoWordDatos } from "@/lib/contrato-word";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { relacionId: string } },
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Inicie sesión para descargar el contrato." }, { status: 401 });
  }

  const trabajador = await getTrabajador(params.relacionId);
  if (!trabajador) {
    return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
  }

  const contratoId = new URL(request.url).searchParams.get("contratoId");
  const [entidad, contratos] = await Promise.all([
    getEntidadPlanillas(trabajador.entidad_id),
    listContratos(params.relacionId),
  ]);
  if (!entidad) {
    return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  }

  const contrato =
    (contratoId ? contratos.find((c) => c.id === contratoId) : null) ??
    contratos.find((c) => !c.datos_confirmados && c.estado === "ELABORADO") ??
    contratos.find((c) => c.es_vigente) ??
    contratos[0];
  if (!contrato) {
    return NextResponse.json({ error: "No hay contrato para generar." }, { status: 404 });
  }

  const jornada = contrato.jornada ?? trabajador.jornada;
  if (jornada !== "TIEMPO_COMPLETO" && jornada !== "TIEMPO_PARCIAL") {
    return NextResponse.json({ error: "El contrato no tiene tipo (completo o parcial)." }, { status: 400 });
  }
  const cargo = contrato.cargo ?? trabajador.cargo;
  if (!cargo) {
    return NextResponse.json({ error: "El contrato no tiene cargo." }, { status: 400 });
  }
  const fechaInicio = contrato.fecha_inicio;
  if (!fechaInicio) {
    return NextResponse.json({ error: "El contrato no tiene fecha de inicio." }, { status: 400 });
  }
  const remuneracion = contrato.remuneracion ?? trabajador.remuneracion;
  if (remuneracion == null || remuneracion <= 0) {
    return NextResponse.json({ error: "El contrato no tiene remuneración." }, { status: 400 });
  }

  const datos: ContratoWordDatos = {
    jornada,
    entidadNombre: entidad.nombre,
    ruc: entidad.ruc,
    domicilio: entidad.direccion,
    rlNombre: entidad.representante_legal_nombre ?? null,
    rlDni: entidad.representante_legal_dni ?? null,
    rlCargo: entidad.representante_legal_cargo ?? null,
    personaNombres: trabajador.persona.nombres,
    apellidoPaterno: trabajador.persona.apellido_paterno,
    apellidoMaterno: trabajador.persona.apellido_materno,
    dni: trabajador.persona.dni,
    direccion: trabajador.persona.direccion,
    cargo,
    fechaInicio,
    fechaFin: contrato.fecha_fin,
    remuneracion,
    horario: contrato.horario ?? trabajador.horario,
  };

  const buffer = await bufferContratoWord(datos);
  const filename = nombreArchivoContrato(datos);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="contrato.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
