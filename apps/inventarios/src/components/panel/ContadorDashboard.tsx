"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EntidadConConteo } from "@inventario/types";
import {
  EntidadResumenPanel,
  PanelDataTable,
  PanelCountLabel,
  PanelEmptyState,
  PanelPageHeader,
  PanelSearchInput,
  PanelTableColgroup,
  PanelTableTd,
  PanelTableTh,
  panelCardClass,
  panelTableClickableRowClass,
  panelTableHeadRowClass,
  panelTableStickyHeadClass,
  ENTIDADES_TABLE_COLS,
} from "@inventario/ui/panel";
import { listActivos, type ActivoConUbicacion } from "@/lib/actions/activos";
import { listAmbientesPorEntidad, listSedesConConteo } from "@/lib/actions/ubicacion";

const ENTIDAD_COLS = ENTIDADES_TABLE_COLS.slice(0, 3);

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

  const [busqueda, setBusqueda] = useState("");
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

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return entidades;
    return entidades.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) ||
        (e.ruc?.toLowerCase().includes(q) ?? false),
    );
  }, [entidades, busqueda]);

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
          <PanelDataTable layout="fixed">
            <PanelTableColgroup cols={ENTIDAD_COLS} />
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
                const selected = entidad.id === selectedId;
                return (
                  <tr
                    key={entidad.id}
                    className={`${panelTableClickableRowClass} ${
                      selected ? "bg-primary/10 hover:bg-primary/15" : ""
                    }`}
                    onClick={() => seleccionarEntidad(entidad.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        seleccionarEntidad(entidad.id);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    aria-current={selected ? "true" : undefined}
                  >
                    <PanelTableTd className="font-medium text-primary">{entidad.nombre}</PanelTableTd>
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
