import { redirect, notFound } from "next/navigation";
import { RegistrarActivoPanel } from "@/components/panel/RegistrarActivoPanel";
import { getEntidad } from "@/lib/actions/entidades";
import { getAmbiente } from "@/lib/actions/ubicacion";
import { getProfile } from "@/lib/auth/profile";

export default async function AdminNuevoActivoPage({
  params,
}: {
  params: Promise<{ ambienteId: string }>;
}) {
  const profile = await getProfile();
  if (!profile || profile.rol !== "ADMIN_ENTIDAD" || !profile.entidad_id) {
    redirect("/login");
  }

  const { ambienteId } = await params;
  const [entidad, ambienteData] = await Promise.all([
    getEntidad(profile.entidad_id),
    getAmbiente(ambienteId),
  ]);

  if (!entidad || !ambienteData || ambienteData.entidad_id !== profile.entidad_id) {
    notFound();
  }

  const listHref = `/admin/ambientes/${ambienteId}`;

  return (
    <RegistrarActivoPanel
      mode="admin"
      entidadId={profile.entidad_id}
      entidadNombre={entidad.nombre}
      ambienteId={ambienteId}
      ambienteNombre={ambienteData.ambiente.nombre}
      sedeNombre={ambienteData.sede_nombre}
      sedeId={ambienteData.ambiente.sede_id}
      esAmbientePreregistro={ambienteData.ambiente.es_preregistro}
      posibleAmbientePreset={
        ambienteData.ambiente.es_preregistro
          ? undefined
          : { sedeId: ambienteData.ambiente.sede_id, ambienteId }
      }
      listHref={listHref}
      entidadHref="/admin/activos"
    />
  );
}
