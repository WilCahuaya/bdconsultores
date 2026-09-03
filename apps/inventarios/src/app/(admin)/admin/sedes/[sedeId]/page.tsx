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
import { getProfile } from "@/lib/auth/profile";

export default async function AdminSedeAmbientesPage({
  params,
}: {
  params: Promise<{ sedeId: string }>;
}) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "ADMIN_ENTIDAD" || !profile.entidad_id) {
    redirect("/login");
  }

  const { sedeId } = await params;
  const sede = await getSede(sedeId);
  if (!sede || sede.entidad_id !== profile.entidad_id) {
    notFound();
  }

  const [entidad, ambientesRaw, sedes, responsables, visitasActivas, visitasHistorial] =
    await Promise.all([
      getEntidad(profile.entidad_id),
      listAmbientesPorEntidad(profile.entidad_id, sedeId),
      listSedesConConteo(profile.entidad_id),
      listResponsables(profile.entidad_id),
      getVisitasCampoActivas(profile.entidad_id),
      listVisitasCampoHistorial(profile.entidad_id),
    ]);
  const ambientes = await attachVisitaEstadoToAmbientes(ambientesRaw, profile.entidad_id);

  if (!entidad) redirect("/login");

  return (
    <AmbientesPanel
      panelMode="admin"
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
