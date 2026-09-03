import { redirect, notFound } from "next/navigation";
import { RegistrarActivoPanel } from "@/components/panel/RegistrarActivoPanel";
import { getEntidad } from "@/lib/actions/entidades";
import { getAmbiente } from "@/lib/actions/ubicacion";
import { requireProfile } from "@/lib/auth/profile";

export default async function NuevoActivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ entidadId: string; ambienteId: string }>;
  searchParams: Promise<{ catalogo?: string }>;
}) {
  try {
    await requireProfile("CONTADOR");
  } catch {
    redirect("/login");
  }

  const { entidadId, ambienteId } = await params;
  const { catalogo: catalogoParam } = await searchParams;
  const initialCatalogoCodigo = catalogoParam?.replace(/\D/g, "").padStart(8, "0").slice(-8) || undefined;
  const [entidad, ambienteData] = await Promise.all([
    getEntidad(entidadId),
    getAmbiente(ambienteId),
  ]);

  if (!entidad || !ambienteData || ambienteData.entidad_id !== entidadId) {
    notFound();
  }

  const listHref = `/contador/entidades/${entidadId}/ambientes/${ambienteId}`;
  const entidadHref = `/contador/entidades/${entidadId}`;

  return (
    <RegistrarActivoPanel
      entidadId={entidadId}
      entidadNombre={entidad.nombre}
      ambienteId={ambienteId}
      ambienteNombre={ambienteData.ambiente.nombre}
      sedeNombre={ambienteData.sede_nombre}
      sedeId={ambienteData.ambiente.sede_id}
      esAmbientePreregistro={ambienteData.ambiente.es_preregistro}
      listHref={listHref}
      entidadHref={entidadHref}
      initialCatalogoCodigo={initialCatalogoCodigo}
    />
  );
}
