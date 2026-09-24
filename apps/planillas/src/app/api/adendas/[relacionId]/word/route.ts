import { NextResponse } from "next/server";
import { listAdendas } from "@/lib/actions/adendas";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { listContratos } from "@/lib/actions/ficha";
import { getTrabajador } from "@/lib/actions/trabajadores";
import { bufferAdendaWord, nombreArchivoAdenda, type AdendaWordDatos } from "@/lib/adenda-word";
import { getProfile } from "@/lib/auth/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { relacionId: string } },
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Inicie sesión para descargar la adenda." }, { status: 401 });
  }

  const adendaId = new URL(request.url).searchParams.get("adendaId");
  if (!adendaId) {
    return NextResponse.json({ error: "Falta la adenda." }, { status: 400 });
  }

  const trabajador = await getTrabajador(params.relacionId);
  if (!trabajador) {
    return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
  }

  const [entidad, adendas, contratos] = await Promise.all([
    getEntidadPlanillas(trabajador.entidad_id),
    listAdendas(params.relacionId),
    listContratos(params.relacionId),
  ]);
  if (!entidad) {
    return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  }

  const adenda = adendas.find((item) => item.id === adendaId);
  if (!adenda) {
    return NextResponse.json({ error: "Adenda no encontrada." }, { status: 404 });
  }
  const contrato = contratos.find((item) => item.id === adenda.contrato_id);
  const jornada = contrato?.jornada ?? trabajador.jornada;
  if (jornada !== "TIEMPO_COMPLETO" && jornada !== "TIEMPO_PARCIAL") {
    return NextResponse.json({ error: "El contrato no tiene tipo (completo o parcial)." }, { status: 400 });
  }
  if (!contrato?.fecha_inicio) {
    return NextResponse.json({ error: "El contrato no tiene fecha de inicio." }, { status: 400 });
  }
  if (!adenda.cargo_anterior) {
    return NextResponse.json({ error: "La adenda no tiene el cargo anterior." }, { status: 400 });
  }

  const datos: AdendaWordDatos = {
    tipo: adenda.tipo,
    jornadaContrato: jornada,
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
    fechaContrato: contrato.fecha_inicio,
    fechaVigencia: adenda.fecha_vigencia,
    fechaSuscripcion: adenda.fecha_suscripcion,
    cargoAnterior: adenda.cargo_anterior,
    cargoNuevo: adenda.cargo_nuevo,
    remuneracionNueva: adenda.remuneracion_nueva == null ? null : Number(adenda.remuneracion_nueva),
    horarioNuevo: adenda.horario_nuevo,
    jornadaNueva: adenda.jornada_nueva,
  };

  const buffer = await bufferAdendaWord(datos);
  const filename = nombreArchivoAdenda(datos);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="adenda.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
