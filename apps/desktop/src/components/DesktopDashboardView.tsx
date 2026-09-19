"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EntidadConConteo } from "@inventario/types";
import { entidadEtiqueta, sortEntidadesByNumero } from "@inventario/types";
import { ESTRUCTURA_REFRESH_EVENT } from "@inventario/realtime";
import {
  EntidadResumenPanel,
  PanelCountLabel,
  PanelDataTable,
  PanelEmptyState,
  PanelPageHeader,
  PanelSearchInput,
  PanelTableColgroup,
  PanelTableTd,
  PanelTableTh,
  ENTIDADES_TABLE_COLS,
  panelCardClass,
  panelTableClickableRowClass,
  panelTableHeadRowClass,
  panelTableStickyHeadClass,
} from "@inventario/ui/panel";
import type { ActivoConUbicacion } from "../lib/activos";
import {
  listAmbientesPorEntidad,
  listSedesConConteo,
  type AmbienteConSede,
} from "../lib/ubicacion";
import type { SedeConConteo } from "@inventario/types";

const DASHBOARD_ENTIDAD_COLS = ENTIDADES_TABLE_COLS.slice(0, 3);

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
  const [busqueda, setBusqueda] = useState("");
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

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = !q
      ? entidades
      : entidades.filter(
          (e) =>
            entidadEtiqueta(e).toLowerCase().includes(q) ||
            e.nombre.toLowerCase().includes(q) ||
            (e.numero_interno?.toLowerCase().includes(q) ?? false) ||
            (e.ruc?.toLowerCase().includes(q) ?? false),
        );
    return sortEntidadesByNumero(base);
  }, [entidades, busqueda]);

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

      <div className={panelCardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <PanelCountLabel count={filtradas.length} singular="entidad" plural="entidades" />
          <div className="min-w-[12rem] flex-1 sm:max-w-xs">
            <PanelSearchInput
              value={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar razón social o RUC…"
            />
          </div>
        </div>

        {filtradas.length === 0 ? (
          <PanelEmptyState
            message={
              busqueda.trim()
                ? "No hay entidades que coincidan con la búsqueda."
                : "No hay entidades registradas."
            }
          />
        ) : (
          <PanelDataTable layout="auto">
            <PanelTableColgroup cols={DASHBOARD_ENTIDAD_COLS} />
            <thead className={panelTableStickyHeadClass}>
              <tr className={panelTableHeadRowClass}>
                <PanelTableTh>Razón social</PanelTableTh>
                <PanelTableTh className="shrink-0">RUC</PanelTableTh>
                <PanelTableTh align="center" className="shrink-0">
                  Ambientes
                </PanelTableTh>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((entidad) => {
                const selected = entidad.id === selectedEntidadId;
                return (
                  <tr
                    key={entidad.id}
                    className={`${panelTableClickableRowClass} ${
                      selected ? "bg-primary/10 hover:bg-primary/15" : ""
                    }`}
                    onClick={() => onSelectEntidad(entidad.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectEntidad(entidad.id);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    aria-current={selected ? "true" : undefined}
                  >
                    <PanelTableTd className="font-medium text-primary">{entidadEtiqueta(entidad)}</PanelTableTd>
                    <PanelTableTd className="font-mono text-xs text-muted-foreground">
                      {entidad.ruc ?? "—"}
                    </PanelTableTd>
                    <PanelTableTd align="center">{entidad.ambiente_count}</PanelTableTd>
                  </tr>
                );
              })}
            </tbody>
          </PanelDataTable>
        )}
      </div>

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
