"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Activo, EstadoRegistro, InventarioColumnFilters } from "@inventario/types";
import {
  emptyInventarioColumnFilters,
  filtrarActivosPorFechaCorte,
  matchesInventarioBusquedaMultiColumna,
  opcionesFiltroColumnaDesdeActivos,
  parseFechaDDMMYYYY,
  pasoFiltrosColumnaInventario,
  validarFechaDDMMYYYY,
} from "@inventario/types";
import { useToast, mensajeEliminacionPreregistros, FechaDdMmYyyyInput } from "@inventario/ui";
import {
  ActivoEditScopeNav,
  type ActivoEditScope,
  AMBIENTE_BREADCRUMB_INDEX_AFTER_SEDE,
  PreregistroGestionToolbar,
  withAmbienteBreadcrumbSelect,
  withSedeBreadcrumb,
  type PreregistroGestionToolbarState,
} from "@inventario/ui/panel";
import { ActivoForm } from "./ActivoForm";
import { ActivosInventarioExcelView } from "./ActivosInventarioExcelView";
import { AmbienteReportesExport } from "./AmbienteReportesExport";
import type { FichaAsignacionExportMeta } from "@/lib/actions/ficha-asignacion-meta";
import { fetchAmbientesPorSedeWeb } from "@/lib/ambiente-nav";
import { deleteActivosPreregistrados } from "@/lib/actions/activos";
import { useEjemplaresResumen } from "@/hooks/useEjemplaresResumen";
import {
  PanelPageHeader,
  PanelSearchInput,
  PanelToolbarExpandTrigger,
  panelFilterRowClass,
  panelInventarioPageClass,
  panelInventarioChromeClass,
  panelInventarioToolbarClass,
  panelToolbarActionsClass,
  usePanelInventarioUnifiedScroll,
  type PanelBreadcrumbItem,
} from "./panel-ui";

function dateToDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function dateFromISO(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** Misma fecha en SSR y primer render del cliente (día UTC); luego se sincroniza al día local. */
function fechaCorteInicial(): Date {
  const n = new Date();
  return new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 12, 0, 0);
}

function fechaCorteLocalHoy(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0);
}

interface ActivosAmbientePanelProps {
  entidadId: string;
  entidadNombre: string;
  ambienteId: string;
  ambienteNombre: string;
  ambienteResponsable?: string | null;
  sedeNombre?: string | null;
  sedeId: string;
  fichaExportMeta?: FichaAsignacionExportMeta;
  activos: Activo[];
  usuarioNombre: string;
  usuarioEmail: string;
  esAmbientePreregistro?: boolean;
  /** contador: registro completo; admin: solo preregistro */
  mode?: "contador" | "admin";
}

const FILTROS_ESTADO_AMBIENTE: { value: "" | EstadoRegistro; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "REGISTRADO", label: "Registrados" },
  { value: "DADO_DE_BAJA", label: "Dados de baja" },
];

export function ActivosAmbientePanel({
  entidadId,
  entidadNombre,
  ambienteId,
  ambienteNombre,
  ambienteResponsable,
  sedeNombre,
  sedeId,
  fichaExportMeta,
  activos,
  usuarioNombre,
  usuarioEmail,
  esAmbientePreregistro = false,
  mode = "contador",
}: ActivosAmbientePanelProps) {
  const isAdmin = mode === "admin";
  const router = useRouter();
  const { pushToast } = useToast();
  const [activosList, setActivosList] = useState(activos);
  const [editActivo, setEditActivo] = useState<Activo | null>(null);
  const [editScope, setEditScope] = useState<ActivoEditScope>("single");
  const { resumen: ejemplaresResumen } = useEjemplaresResumen(editActivo?.id);
  const ejemplaresTotal = ejemplaresResumen?.total ?? 0;

  useEffect(() => {
    setActivosList(activos);
  }, [activos]);

  const quitarActivos = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setActivosList((prev) => prev.filter((a) => !idSet.has(a.id)));
  }, []);

  useEffect(() => {
    setEditScope("single");
  }, [editActivo?.id]);
  const [busqueda, setBusqueda] = useState("");
  const [estadoRegistro, setEstadoRegistro] = useState<"" | EstadoRegistro>(
    esAmbientePreregistro ? "PREREGISTRADO" : "",
  );
  const [columnFilters, setColumnFilters] = useState<InventarioColumnFilters>(() =>
    emptyInventarioColumnFilters(),
  );
  const [fechaCorteText, setFechaCorteText] = useState(() => dateToDDMMYYYY(fechaCorteInicial()));
  const [fechaCorte, setFechaCorte] = useState(() => fechaCorteInicial());
  const [fechaCorteError, setFechaCorteError] = useState<string | null>(null);
  const { panelScrollRef, showToolbarTrigger, scrollToToolbar } = usePanelInventarioUnifiedScroll();
  const [preregistroHeaderToolbar, setPreregistroHeaderToolbar] =
    useState<PreregistroGestionToolbarState | null>(null);

  useEffect(() => {
    const local = fechaCorteLocalHoy();
    setFechaCorte(local);
    setFechaCorteText(dateToDDMMYYYY(local));
  }, []);

  const syncPreregistroToolbar = useCallback((state: PreregistroGestionToolbarState | null) => {
    setPreregistroHeaderToolbar((prev) => {
      if (!state && !prev) return prev;
      if (
        state &&
        prev &&
        state.totalPreregistrados === prev.totalPreregistrados &&
        state.selectedCount === prev.selectedCount &&
        state.disabled === prev.disabled &&
        state.disabledReason === prev.disabledReason
      ) {
        return prev;
      }
      return state;
    });
  }, []);

  const aplicarFechaCorte = (raw: string, { fromBlur }: { fromBlur?: boolean } = {}) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (fromBlur) {
        setFechaCorteError("Ingrese la fecha de corte.");
        setFechaCorteText(dateToDDMMYYYY(fechaCorte));
      } else {
        setFechaCorteError(null);
      }
      return;
    }
    const iso = parseFechaDDMMYYYY(trimmed);
    if (iso) {
      setFechaCorteError(null);
      setFechaCorteText(dateToDDMMYYYY(dateFromISO(iso)));
      setFechaCorte(dateFromISO(iso));
      return;
    }
    const completa = /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed);
    if (completa || fromBlur) {
      setFechaCorteError(validarFechaDDMMYYYY(trimmed) ?? "Fecha inválida.");
      if (fromBlur) setFechaCorteText(dateToDDMMYYYY(fechaCorte));
      return;
    }
    setFechaCorteError(null);
  };

  const gestionPreregistrosConfig = useMemo(
    () => ({
      alcanceLabel: esAmbientePreregistro ? "de este ambiente" : "del filtro actual",
      onDeleteActivos: async (list: Activo[]) => {
        const result = await deleteActivosPreregistrados(
          entidadId,
          list.map((a) => a.id),
        );
        if (result.error) {
          pushToast(result.error, "error");
          return { error: result.error };
        }
        const eliminados = result.data?.eliminados ?? list.length;
        quitarActivos(list.map((a) => a.id));
        pushToast(mensajeEliminacionPreregistros(eliminados), "success");
        void router.refresh();
        return {};
      },
      toolbarPlacement: "header" as const,
      onToolbarStateChange: syncPreregistroToolbar,
    }),
    [esAmbientePreregistro, entidadId, pushToast, quitarActivos, router, syncPreregistroToolbar],
  );

  const nuevoHref = isAdmin
    ? `/admin/ambientes/${ambienteId}/nuevo`
    : `/contador/entidades/${entidadId}/ambientes/${ambienteId}/nuevo`;

  const nuevoLabel = isAdmin || esAmbientePreregistro ? "+ Preregistrar activo" : "+ Nuevo activo";
  const editarLabel = isAdmin ? undefined : "Editar activo";

  const sedeBreadcrumbLink =
    sedeId && sedeNombre?.trim()
      ? isAdmin
        ? { href: `/admin/sedes/${sedeId}` }
        : { href: `/contador/entidades/${entidadId}/sedes/${sedeId}` }
      : undefined;

  const ambienteListHref = useCallback(
    (targetAmbienteId: string) =>
      isAdmin
        ? `/admin/ambientes/${targetAmbienteId}`
        : `/contador/entidades/${entidadId}/ambientes/${targetAmbienteId}`,
    [entidadId, isAdmin],
  );

  const handleAmbienteNav = useCallback(
    (targetAmbienteId: string) => {
      if (targetAmbienteId === ambienteId) return;
      router.push(ambienteListHref(targetAmbienteId));
    },
    [ambienteId, ambienteListHref, router],
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

  const listBreadcrumbs: PanelBreadcrumbItem[] = useMemo(() => {
    const base = withSedeBreadcrumb(
      isAdmin
        ? [
            { label: "Ambientes", href: "/admin/activos" },
            { label: ambienteNombre },
          ]
        : [
            { label: entidadNombre, href: `/contador/entidades/${entidadId}` },
            { label: ambienteNombre },
          ],
      sedeNombre,
      1,
      sedeBreadcrumbLink,
    );
    return withAmbienteBreadcrumbSelect(base, AMBIENTE_BREADCRUMB_INDEX_AFTER_SEDE, ambienteSelectProps);
  }, [
    isAdmin,
    ambienteNombre,
    entidadNombre,
    entidadId,
    sedeNombre,
    sedeBreadcrumbLink,
    ambienteSelectProps,
  ]);

  const activosBase = useMemo(() => {
    const scoped = activosList.filter((a) => {
      if (esAmbientePreregistro) {
        if (a.estado_registro !== "PREREGISTRADO") return false;
      } else if (a.estado_registro === "PREREGISTRADO") {
        return false;
      } else if (estadoRegistro && a.estado_registro !== estadoRegistro) {
        return false;
      }
      return matchesInventarioBusquedaMultiColumna(a, busqueda);
    });
    return filtrarActivosPorFechaCorte(scoped, fechaCorte);
  }, [activosList, busqueda, estadoRegistro, esAmbientePreregistro, fechaCorte]);

  const columnFilterOptions = useMemo(
    () =>
      opcionesFiltroColumnaDesdeActivos(activosBase, {
        incluirUbicacion: false,
        incluirCuenta: !isAdmin,
      }),
    [activosBase, isAdmin],
  );

  const filtrados = useMemo(() => {
    return activosBase.filter((a) =>
      pasoFiltrosColumnaInventario(a, columnFilters, {
        aplicarUbicacion: false,
        aplicarCuenta: !isAdmin,
      }),
    );
  }, [activosBase, columnFilters, isAdmin]);

  function handleSuccess() {
    setEditActivo(null);
    router.refresh();
  }

  if (editActivo) {
    const editTitle =
      isAdmin && editActivo.estado_registro !== "PREREGISTRADO"
        ? "Editar ubicación"
        : isAdmin && editActivo.estado_registro === "PREREGISTRADO"
          ? "Editar preregistro"
          : "Editar activo";

    const editBreadcrumbs: PanelBreadcrumbItem[] = withAmbienteBreadcrumbSelect(
      withSedeBreadcrumb(
        [
          ...(isAdmin
            ? [{ label: "Ambientes", href: "/admin/activos" }]
            : [{ label: entidadNombre, href: `/contador/entidades/${entidadId}` }]),
          { label: ambienteNombre, onClick: () => setEditActivo(null) },
          { label: editActivo.nombre },
          { label: editTitle },
        ],
        sedeNombre,
        1,
        sedeBreadcrumbLink,
      ),
      AMBIENTE_BREADCRUMB_INDEX_AFTER_SEDE,
      ambienteSelectProps,
    );

    return (
      <div className="space-y-5">
        <PanelPageHeader breadcrumbs={editBreadcrumbs} />
        <ActivoEditScopeNav
          scope={editScope}
          ejemplaresTotal={ejemplaresTotal}
          onScopeChange={setEditScope}
        />
        <ActivoForm
          entidades={[]}
          fixedEntidadId={entidadId}
          fixedSedeId={isAdmin ? undefined : sedeId}
          fixedAmbienteId={isAdmin ? undefined : ambienteId}
          activo={editActivo}
          mode="edit"
          editScope={editScope}
          ejemplaresTotal={ejemplaresTotal}
          submitLabel={
            editScope === "bulk" && ejemplaresTotal > 1
              ? `Guardar en ${ejemplaresTotal} ejemplares`
              : isAdmin
                ? editActivo.estado_registro === "PREREGISTRADO"
                  ? "Guardar preregistro"
                  : "Guardar"
                : "Guardar cambios"
          }
          soloUbicacion={isAdmin && editActivo.estado_registro !== "PREREGISTRADO"}
          modoAdmin={isAdmin}
          asignaCodigoInmediato={
            !isAdmin && editActivo.estado_registro !== "PREREGISTRADO"
          }
          variant="page"
          onSuccess={handleSuccess}
          onCancel={() => setEditActivo(null)}
        />
      </div>
    );
  }

  return (
    <div className={`${panelInventarioPageClass} flex min-h-0 flex-col gap-1`}>
      <div className={panelInventarioChromeClass}>
        <PanelPageHeader
          breadcrumbs={listBreadcrumbs}
          subtitle={
            ambienteResponsable ? `Responsable: ${ambienteResponsable}` : undefined
          }
        />

      </div>

      {showToolbarTrigger && (
        <PanelToolbarExpandTrigger onClick={scrollToToolbar} />
      )}
        <ActivosInventarioExcelView
          className="min-h-0 flex-1"
          layout="global-panel"
          bodyScrollRef={panelScrollRef}
          toolbar={
            <div className={panelInventarioToolbarClass}>
              <div
                className={panelFilterRowClass}
                role={esAmbientePreregistro ? undefined : "tablist"}
                aria-label={esAmbientePreregistro ? "Filtros de inventario" : "Filtros de inventario"}
              >
                {!esAmbientePreregistro && (
                  <div className="inline-flex flex-wrap gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5">
                    {FILTROS_ESTADO_AMBIENTE.map((f) => (
                      <button
                        key={f.value || "all"}
                        type="button"
                        role="tab"
                        aria-selected={estadoRegistro === f.value}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          estadoRegistro === f.value
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setEstadoRegistro(f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`min-w-[10rem] flex-1 md:max-w-md [&_input]:h-8 [&_input]:py-1 [&_input]:text-sm ${esAmbientePreregistro ? "w-full max-w-none" : ""}`}
                >
                  <PanelSearchInput
                    value={busqueda}
                    onChange={setBusqueda}
                    placeholder="Buscar en nombre, código, cuenta, comprobante, marca…"
                  />
                </div>

                <div className="w-[9.5rem] shrink-0 space-y-0.5">
                  <label htmlFor="ambiente_fecha_corte" className="sr-only">
                    Fecha de corte
                  </label>
                  <FechaDdMmYyyyInput
                    id="ambiente_fecha_corte"
                    value={fechaCorteText}
                    onChange={(next) => {
                      setFechaCorteText(next);
                      aplicarFechaCorte(next);
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => aplicarFechaCorte(e.currentTarget.value, { fromBlur: true })}
                    aria-invalid={Boolean(fechaCorteError)}
                    aria-label="Fecha de corte"
                    title="Fecha de corte (depreciación y valor neto)"
                    className="h-8 text-sm"
                  />
                  {fechaCorteError && (
                    <p className="text-[10px] leading-tight text-destructive">{fechaCorteError}</p>
                  )}
                </div>

                <div className={`${panelToolbarActionsClass} ml-auto`}>
                  {!esAmbientePreregistro && (
                    <AmbienteReportesExport
                      entidadId={entidadId}
                      entidadNombre={entidadNombre}
                      sedeId={sedeId}
                      ambienteId={ambienteId}
                      ambienteNombre={ambienteNombre}
                      ambienteResponsable={ambienteResponsable}
                      fichaExportMeta={fichaExportMeta}
                      usuarioNombre={usuarioNombre}
                      usuarioEmail={usuarioEmail}
                      esAdmin={isAdmin}
                    />
                  )}
                  {preregistroHeaderToolbar && (
                    <PreregistroGestionToolbar {...preregistroHeaderToolbar} />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {filtrados.length} {filtrados.length === 1 ? "activo" : "activos"}
                  </span>
                  <Link
                    href={nuevoHref}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90"
                  >
                    {nuevoLabel}
                  </Link>
                </div>
              </div>
            </div>
          }
          activos={filtrados}
          onEditActivo={setEditActivo}
          puedeDarDeBaja={!isAdmin && !esAmbientePreregistro}
          puedeValidarPreregistro={!isAdmin && esAmbientePreregistro}
          puedeEliminarPreregistro={esAmbientePreregistro}
          gestionPreregistros={esAmbientePreregistro ? gestionPreregistrosConfig : undefined}
          onActivoEliminado={(id) => quitarActivos([id])}
          modoAdmin={isAdmin}
          mostrarEstadoRegistro={!esAmbientePreregistro}
          mostrarPosibleAmbiente={esAmbientePreregistro}
          emptyActionLabel={nuevoLabel}
          editarLabel={editarLabel}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          columnFilterOptions={columnFilterOptions}
          fechaCorte={fechaCorte}
        />
    </div>
  );
}
