"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EntidadConConteo } from "@inventario/types";
import { entidadEtiqueta, sortEntidadesByNumero } from "@inventario/types";
import { Select } from "@inventario/ui";
import {
  EntidadResumenPanel,
  PanelEmptyState,
  PanelPageHeader,
} from "@inventario/ui/panel";
import { listActivos, type ActivoConUbicacion } from "@/lib/actions/activos";
import { listAmbientesPorEntidad, listSedesConConteo } from "@/lib/actions/ubicacion";

interface ContadorDashboardProps {
  entidades: EntidadConConteo[];
}

function resolveEntidadId(entidades: EntidadConConteo[], preferredId: string): string {
  if (preferredId && entidades.some((e) => e.id === preferredId)) return preferredId;
  return entidades[0]?.id ?? "";
}

export function ContadorDashboard({ entidades }: ContadorDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedIdFromUrl = searchParams.get("entidad")?.trim() || "";

  const [activos, setActivos] = useState<ActivoConUbicacion[]>([]);
  const [ambientes, setAmbientes] = useState<
    Awaited<ReturnType<typeof listAmbientesPorEntidad>>
  >([]);
  const [sedes, setSedes] = useState<Awaited<ReturnType<typeof listSedesConConteo>>>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const selectedId = useMemo(
    () => resolveEntidadId(entidades, selectedIdFromUrl),
    [entidades, selectedIdFromUrl],
  );

  const entidadSeleccionada = useMemo(
    () => entidades.find((e) => e.id === selectedId) ?? null,
    [entidades, selectedId],
  );

  const opcionesEntidad = useMemo(
    () =>
      sortEntidadesByNumero(entidades).map((entidad) => ({
        value: entidad.id,
        label: entidadEtiqueta(entidad),
      })),
    [entidades],
  );

  const seleccionarEntidad = useCallback(
    (entidadId: string) => {
      router.replace(`/contador?entidad=${encodeURIComponent(entidadId)}`);
    },
    [router],
  );

  useEffect(() => {
    if (entidades.length === 0) return;
    if (!selectedIdFromUrl || !entidades.some((e) => e.id === selectedIdFromUrl)) {
      router.replace(`/contador?entidad=${encodeURIComponent(selectedId)}`);
    }
  }, [entidades, selectedId, selectedIdFromUrl, router]);

  useEffect(() => {
    if (!selectedId) {
      setActivos([]);
      setAmbientes([]);
      setSedes([]);
      setErrorDetalle(null);
      return;
    }

    let cancelled = false;
    setLoadingDetalle(true);
    setErrorDetalle(null);

    void (async () => {
      try {
        const [listaActivos, listaAmbientes, listaSedes] = await Promise.all([
          listActivos(selectedId),
          listAmbientesPorEntidad(selectedId),
          listSedesConConteo(selectedId),
        ]);
        if (cancelled) return;
        setActivos(listaActivos);
        setAmbientes(listaAmbientes);
        setSedes(listaSedes);
      } catch {
        if (!cancelled) {
          setErrorDetalle("No se pudo cargar el resumen de la entidad.");
        }
      } finally {
        if (!cancelled) setLoadingDetalle(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <div className="space-y-4">
      <PanelPageHeader
        title="Dashboard"
        subtitle="Seleccione una entidad para ver el resumen contable y sus ambientes"
      />

      {entidades.length === 0 ? (
        <PanelEmptyState message="No hay entidades registradas." />
      ) : (
        <div className="w-full max-w-xl space-y-1">
          <label htmlFor="dashboard-entidad" className="text-xs font-medium text-muted-foreground">
            Entidad
          </label>
          <Select
            id="dashboard-entidad"
            aria-label="Entidad"
            value={selectedId}
            onChange={seleccionarEntidad}
            options={opcionesEntidad}
            className="max-w-none"
          />
        </div>
      )}

      {entidadSeleccionada && (
        <>
          {loadingDetalle ? (
            <p className="text-sm text-muted-foreground">Cargando resumen…</p>
          ) : errorDetalle ? (
            <p className="text-sm text-destructive">{errorDetalle}</p>
          ) : (
            <EntidadResumenPanel
              showEntidadHeader={false}
              entidadNombre={entidadSeleccionada.nombre}
              entidadRuc={entidadSeleccionada.ruc}
              activos={activos}
              ambientes={ambientes.map((a) => ({
                id: a.id,
                nombre: a.nombre,
                descripcion: a.descripcion,
                responsable: a.responsable,
                sede_id: a.sede_id,
                sede_nombre: a.sede_nombre,
                sede_es_principal: a.sede_es_principal,
                activo_count: a.activo_count,
                activo: a.activo,
              }))}
              sedes={sedes.map((s) => ({
                id: s.id,
                nombre: s.nombre,
                es_principal: s.es_principal,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
