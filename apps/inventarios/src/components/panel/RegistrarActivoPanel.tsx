"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ActivoForm } from "./ActivoForm";
import { PanelPageHeader } from "./panel-ui";
import {
  AMBIENTE_BREADCRUMB_INDEX_AFTER_SEDE,
  withAmbienteBreadcrumbSelect,
  withSedeBreadcrumb,
} from "@inventario/ui/panel";
import { fetchAmbientesPorSedeWeb } from "@/lib/ambiente-nav";

interface RegistrarActivoPanelProps {
  entidadId: string;
  entidadNombre: string;
  ambienteId: string;
  ambienteNombre: string;
  sedeNombre?: string | null;
  sedeId: string;
  listHref: string;
  entidadHref: string;
  mode?: "contador" | "admin";
  esAmbientePreregistro?: boolean;
  /** Admin: sugerir posible ambiente al preregistrar desde un ambiente real */
  posibleAmbientePreset?: { sedeId: string; ambienteId: string };
  initialCatalogoCodigo?: string;
}

export function RegistrarActivoPanel({
  entidadId,
  entidadNombre,
  ambienteId,
  ambienteNombre,
  sedeNombre,
  sedeId,
  listHref,
  entidadHref,
  mode = "contador",
  esAmbientePreregistro = false,
  posibleAmbientePreset,
  initialCatalogoCodigo,
}: RegistrarActivoPanelProps) {
  const router = useRouter();
  const isAdmin = mode === "admin";
  const esPreregistro = isAdmin || esAmbientePreregistro;

  function handleDone() {
    router.push(listHref);
    router.refresh();
  }

  const sedeBreadcrumbLink =
    sedeId && sedeNombre?.trim()
      ? isAdmin
        ? { href: `/admin/sedes/${sedeId}` }
        : { href: `/contador/entidades/${entidadId}/sedes/${sedeId}` }
      : undefined;

  const nuevoHrefForAmbiente = useCallback(
    (targetAmbienteId: string) =>
      isAdmin
        ? `/admin/ambientes/${targetAmbienteId}/nuevo`
        : `/contador/entidades/${entidadId}/ambientes/${targetAmbienteId}/nuevo`,
    [entidadId, isAdmin],
  );

  const handleAmbienteNav = useCallback(
    (targetAmbienteId: string) => {
      if (targetAmbienteId === ambienteId) return;
      router.push(nuevoHrefForAmbiente(targetAmbienteId));
    },
    [ambienteId, nuevoHrefForAmbiente, router],
  );

  const ambienteSelectProps = useMemo(
    () => ({
      entidadId,
      sedeId,
      ambienteId,
      ambienteNombre,
      onAmbienteChange: handleAmbienteNav,
      fetchAmbientes: fetchAmbientesPorSedeWeb,
    }),
    [entidadId, sedeId, ambienteId, ambienteNombre, handleAmbienteNav],
  );

  const breadcrumbs = useMemo(() => {
    const base = withSedeBreadcrumb(
      isAdmin
        ? [
            { label: "Ambientes", href: entidadHref },
            { label: ambienteNombre, href: listHref },
            { label: "Preregistrar activo" },
          ]
        : esPreregistro
          ? [
              { label: entidadNombre, href: entidadHref },
              { label: ambienteNombre, href: listHref },
              { label: "Preregistrar activo" },
            ]
          : [
              { label: entidadNombre, href: entidadHref },
              { label: ambienteNombre, href: listHref },
              { label: "Crear activo" },
            ],
      sedeNombre,
      1,
      sedeBreadcrumbLink,
    );
    return withAmbienteBreadcrumbSelect(base, AMBIENTE_BREADCRUMB_INDEX_AFTER_SEDE, ambienteSelectProps);
  }, [
    isAdmin,
    entidadHref,
    ambienteNombre,
    listHref,
    esPreregistro,
    entidadNombre,
    sedeNombre,
    sedeBreadcrumbLink,
    ambienteSelectProps,
  ]);

  return (
    <div className="space-y-5">
      <PanelPageHeader breadcrumbs={breadcrumbs} />

      <ActivoForm
        entidades={[]}
        fixedEntidadId={entidadId}
        fixedSedeId={esPreregistro ? undefined : sedeId}
        fixedAmbienteId={esPreregistro ? undefined : ambienteId}
        submitLabel={esPreregistro ? "Preregistrar activo" : "Registrar activo"}
        asignaCodigoInmediato={!esPreregistro}
        posibleAmbientePreset={isAdmin && !esAmbientePreregistro ? posibleAmbientePreset : undefined}
        variant="page"
        initialCatalogoCodigo={initialCatalogoCodigo}
        onSuccess={handleDone}
        onCancel={handleDone}
      />
    </div>
  );
}
