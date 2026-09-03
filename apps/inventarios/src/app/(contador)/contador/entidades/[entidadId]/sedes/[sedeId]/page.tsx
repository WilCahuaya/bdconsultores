import { redirect, notFound } from "next/navigation";
import { AmbientesPanel } from "@/components/panel/AmbientesPanel";
import { getEntidad } from "@/lib/actions/entidades";
import { getSede, listAmbientesPorEntidad, listSedesConConteo } from "@/lib/actions/ubicacion";
import { listResponsables } from "@/lib/actions/responsables";
import {
  attachVisitaEstadoToAmbientes,
  getVisitasCampoActivas,
  listVisitasCampoHistorial,
} from "@/lib/actions/visitas-campo";
import { requireProfile } from "@/lib/auth/profile";

export default async function SedeAmbientesPage({
  params,
}: {
  params: Promise<{ entidadId: string; sedeId: string }>;
}) {
  try {
    await requireProfile("CONTADOR");
  } catch {
    redirect("/login");
  }

  const { entidadId, sedeId } = await params;
  const [entidad, sede] = await Promise.all([getEntidad(entidadId), getSede(sedeId)]);

  if (!entidad || !sede || sede.entidad_id !== entidadId) {
    notFound();
  }

  const [ambientesRaw, sedes, responsables, visitasActivas, visitasHistorial] = await Promise.all([
    listAmbientesPorEntidad(entidadId, sedeId),
    listSedesConConteo(entidadId),
    listResponsables(entidadId),
    getVisitasCampoActivas(entidadId),
    listVisitasCampoHistorial(entidadId),
  ]);
  const ambientes = await attachVisitaEstadoToAmbientes(ambientesRaw, entidadId);

  return (
    <AmbientesPanel
      entidad={entidad}
      ambientes={ambientes}
      sedes={sedes}
      responsables={responsables}
      visitasActivas={visitasActivas}
      visitasHistorial={visitasHistorial}
      sedeFocus={{ id: sede.id, nombre: sede.nombre }}
    />
  );
}
