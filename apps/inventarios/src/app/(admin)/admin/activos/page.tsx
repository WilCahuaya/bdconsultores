import { redirect } from "next/navigation";
import { AdminAmbientesPanel } from "@/components/panel/AdminAmbientesPanel";
import { getProfile } from "@/lib/auth/profile";
import { getEntidad } from "@/lib/actions/entidades";
import { listResponsables } from "@/lib/actions/responsables";
import { listAmbientesPorEntidad, listSedesConConteo } from "@/lib/actions/ubicacion";
import {
  attachVisitaEstadoToAmbientes,
  getVisitasCampoActivas,
  listVisitasCampoHistorial,
} from "@/lib/actions/visitas-campo";

export default async function AdminAmbientesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "ADMIN_ENTIDAD" || !profile.entidad_id) {
    redirect("/login");
  }

  const entidadId = profile.entidad_id;
  const { tab } = await searchParams;
  const [entidad, ambientesRaw, sedes, responsables, visitasActivas, visitasHistorial] =
    await Promise.all([
      getEntidad(entidadId),
      listAmbientesPorEntidad(entidadId),
      listSedesConConteo(entidadId),
      listResponsables(entidadId),
      getVisitasCampoActivas(entidadId),
      listVisitasCampoHistorial(entidadId),
    ]);
  const ambientes = await attachVisitaEstadoToAmbientes(ambientesRaw, entidadId);

  if (!entidad) redirect("/login");

  return (
    <AdminAmbientesPanel
      entidad={entidad}
      ambientes={ambientes}
      sedes={sedes}
      responsables={responsables}
      visitasActivas={visitasActivas}
      visitasHistorial={visitasHistorial}
      initialTab={
        tab === "responsables" ? "responsables" : tab === "visitas" ? "visitas" : undefined
      }
    />
  );
}
