"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EntidadConConteo } from "@inventario/types";
import { entidadEtiqueta, sortEntidadesByNumero } from "@inventario/types";
import { ESTRUCTURA_REFRESH_EVENT } from "@inventario/realtime";
import { Select } from "@inventario/ui";
import {
  EntidadResumenPanel,
  PanelEmptyState,
  PanelPageHeader,
} from "@inventario/ui/panel";
import type { ActivoConUbicacion } from "../lib/activos";
import {
  listAmbientesPorEntidad,
  listSedesConConteo,
  type AmbienteConSede,
} from "../lib/ubicacion";
import type { SedeConConteo } from "@inventario/types";

interface DesktopDashboardProps {
  entidades: EntidadConConteo[];
  selectedEntidadId: string;
  onSelectEntidad: (entidadId: string) => void;
  activos: ActivoConUbicacion[];
  activosLoading?: boolean;
}

export function DesktopDashboard({
  entidades,
  selectedEntidadId,
  onSelectEntidad,
  activos,
  activosLoading = false,
}: DesktopDashboardProps) {
  const [ambientes, setAmbientes] = useState<AmbienteConSede[]>([]);
  const [sedes, setSedes] = useState<SedeConConteo[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [estructuraTick, setEstructuraTick] = useState(0);
  const hasDetalleRef = useRef(false);
  const prevEntidadIdRef = useRef(selectedEntidadId);

  const entidadSeleccionada = useMemo(
    () => entidades.find((e) => e.id === selectedEntidadId) ?? null,
    [entidades, selectedEntidadId],
  );

  const opcionesEntidad = useMemo(
    () =>
      sortEntidadesByNumero(entidades).map((entidad) => ({
        value: entidad.id,
        label: entidadEtiqueta(entidad),
      })),
    [entidades],
  );

  useEffect(() => {
    if (!selectedEntidadId) {
      hasDetalleRef.current = false;
      prevEntidadIdRef.current = selectedEntidadId;
      setAmbientes([]);
      setSedes([]);
      setErrorDetalle(null);
      setMetaLoading(false);
      return;
    }

    if (prevEntidadIdRef.current !== selectedEntidadId) {
      prevEntidadIdRef.current = selectedEntidadId;
      hasDetalleRef.current = false;
    }

    let cancelled = false;
    const silent = hasDetalleRef.current;
    if (!silent) setMetaLoading(true);
    setErrorDetalle(null);

    void (async () => {
      try {
        const [listaAmbientes, listaSedes] = await Promise.all([
          listAmbientesPorEntidad(selectedEntidadId),
          listSedesConConteo(selectedEntidadId),
        ]);
        if (!cancelled) {
          setAmbientes(listaAmbientes);
          setSedes(listaSedes);
          hasDetalleRef.current = true;
        }
      } catch {
        if (!cancelled) {
          setErrorDetalle("No se pudo cargar el resumen de la entidad.");
        }
      } finally {
        if (!cancelled && !silent) setMetaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEntidadId, estructuraTick]);

  useEffect(() => {
    if (!selectedEntidadId) return;
    const onEstructuraRefresh = () => {
      setEstructuraTick((n) => n + 1);
    };
    window.addEventListener(ESTRUCTURA_REFRESH_EVENT, onEstructuraRefresh);
    return () => {
      window.removeEventListener(ESTRUCTURA_REFRESH_EVENT, onEstructuraRefresh);
    };
  }, [selectedEntidadId]);

  const loadingDetalle = activosLoading || metaLoading;

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
            value={selectedEntidadId}
            onChange={onSelectEntidad}
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
