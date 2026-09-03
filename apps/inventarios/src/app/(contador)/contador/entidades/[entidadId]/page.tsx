import { redirect, notFound } from "next/navigation";
import { AmbientesPanel } from "@/components/panel/AmbientesPanel";
import { listActivos } from "@/lib/actions/activos";
import { getEntidad } from "@/lib/actions/entidades";
import { listAmbientesPorEntidad, listSedesConConteo } from "@/lib/actions/ubicacion";
import {
  attachVisitaEstadoToAmbientes,
  getVisitasCampoActivas,
  listVisitasCampoHistorial,
} from "@/lib/actions/visitas-campo";
import { listResponsables } from "@/lib/actions/responsables";
import { requireProfile } from "@/lib/auth/profile";

export default async function EntidadAmbientesPage({
  params,
  searchParams,
}: {
  params: Promise<{ entidadId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  try {
    await requireProfile("CONTADOR");
  } catch {
    redirect("/login");
  }

  const { entidadId } = await params;
  const { tab } = await searchParams;
  const entidad = await getEntidad(entidadId);
  if (!entidad) notFound();

  const [ambientesRaw, sedes, responsables, visitasActivas, visitasHistorial, activos] = await Promise.all([
    listAmbientesPorEntidad(entidadId),
    listSedesConConteo(entidadId),
    listResponsables(entidadId),
    getVisitasCampoActivas(entidadId),
    listVisitasCampoHistorial(entidadId),
    listActivos(entidadId),
  ]);
  const ambientes = await attachVisitaEstadoToAmbientes(ambientesRaw, entidadId);

  return (
    <AmbientesPanel
      entidad={entidad}
      ambientes={ambientes}
      sedes={sedes}
      responsables={responsables}
      activos={activos}
      visitasActivas={visitasActivas}
      visitasHistorial={visitasHistorial}
      initialTab={
        tab === "ambientes"
          ? "ambientes"
          : tab === "responsables"
            ? "responsables"
            : tab === "visitas"
              ? "visitas"
              : tab === "sucursales"
                ? "sucursales"
                : undefined
      }
    />
  );
}
