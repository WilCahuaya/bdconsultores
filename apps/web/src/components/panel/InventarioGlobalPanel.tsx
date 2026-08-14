"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Activo, Entidad, EstadoRegistro, InventarioColumnFilters } from "@inventario/types";
import {
  emptyInventarioColumnFilters,
  filtrarActivosPorFechaCorte,
  hasActiveInventarioColumnFilters,
  matchesInventarioBusquedaMultiColumna,
  opcionesFiltroColumnaDesdeActivos,
  parseFechaDDMMYYYY,
  pasoFiltrosColumnaInventario,
  validarFechaDDMMYYYY,
} from "@inventario/types";
import { ActivoEditScopeNav, type ActivoEditScope } from "@inventario/ui/panel";
import {
  Button,
  EliminarActivosPorCodigosButton,
  FechaDdMmYyyyInput,
  Select,
  useToast,
  mensajeEliminacionPreregistros,
  PreregistroGestionToolbar,
  type PreregistroGestionToolbarState,
} from "@inventario/ui";
import { deleteActivosPreregistrados } from "@/lib/actions/activos";
import { ActivoForm } from "./ActivoForm";
import { ActivosInventarioExcelView } from "./ActivosInventarioExcelView";
import { useEjemplaresResumen } from "@/hooks/useEjemplaresResumen";
import {
  PanelCountLabel,
  PanelPageHeader,
  PanelSearchInput,
  panelFilterRowClass,
  panelInventarioPageClass,
  panelInventarioToolbarClass,
  panelToolbarActionsClass,
  PanelToolbarExpandTrigger,
  usePanelInventarioUnifiedScroll,
  type PanelBreadcrumbItem,
} from "./panel-ui";

interface InventarioItem extends Activo {
  entidad_nombre?: string;
  sede_nombre?: string;
  ambiente_nombre?: string;
  posible_ambiente_nombre?: string;
  posible_sede_nombre?: string;
  posible_sede_id?: string | null;
}

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

interface InventarioGlobalPanelProps {
  entidades: Entidad[];
  activos: InventarioItem[];
  initialEstado?: EstadoRegistro | "";
  mode?: "contador" | "admin";
  /** Fija la entidad (admin o pestaña inventario en entidad). */
  fixedEntidadId?: string;
  fixedEntidadNombre?: string;
  /** Dentro de la página de entidad: títulos y migas acordes. */
  embeddedInEntityPage?: boolean;
  entityPageHref?: string;
  /** Abre el diálogo de eliminación por códigos (inventario de entidad, contador). */
  onOpenEliminarPorCodigos?: () => void;
}

const FILTROS_ESTADO: { value: "" | EstadoRegistro; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "REGISTRADO", label: "Registrados" },
  { value: "PREREGISTRADO", label: "Preregistrados" },
  { value: "DADO_DE_BAJA", label: "Dados de baja" },
];

export function InventarioGlobalPanel({
  entidades,
  activos,
  initialEstado = "",
  mode = "contador",
  fixedEntidadId,
  fixedEntidadNombre,
  embeddedInEntityPage = false,
  entityPageHref,
  onOpenEliminarPorCodigos,
}: InventarioGlobalPanelProps) {
  const isAdmin = mode === "admin";
  const hasFixedEntidad = Boolean(fixedEntidadId);
  const router = useRouter();
  const { pushToast } = useToast();
  const [activosList, setActivosList] = useState(activos);
  const [busqueda, setBusqueda] = useState("");
  const [entidadId, setEntidadId] = useState(
    hasFixedEntidad ? (fixedEntidadId ?? "") : isAdmin ? (fixedEntidadId ?? "") : "",
  );
  const [estadoRegistro, setEstadoRegistro] = useState<"" | EstadoRegistro>(initialEstado);
  const [columnFilters, setColumnFilters] = useState<InventarioColumnFilters>(() =>
    emptyInventarioColumnFilters(),
  );
  const [fechaCorteText, setFechaCorteText] = useState(() => dateToDDMMYYYY(fechaCorteInicial()));
  const [fechaCorte, setFechaCorte] = useState(() => fechaCorteInicial());
  const [fechaCorteError, setFechaCorteError] = useState<string | null>(null);
  const [editActivo, setEditActivo] = useState<InventarioItem | null>(null);
  const [editScope, setEditScope] = useState<ActivoEditScope>("single");
  const { resumen: ejemplaresResumen } = useEjemplaresResumen(editActivo?.id);
  const ejemplaresTotal = ejemplaresResumen?.total ?? 0;
  const { panelScrollRef, showToolbarTrigger, scrollToToolbar } = usePanelInventarioUnifiedScroll();

  useEffect(() => {
    const local = fechaCorteLocalHoy();
    setFechaCorte(local);
    setFechaCorteText(dateToDDMMYYYY(local));
  }, []);

  useEffect(() => {
    setActivosList(activos);
  }, [activos]);

  const quitarActivos = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setActivosList((prev) => prev.filter((a) => !idSet.has(a.id)));
  }, []);

  const eliminarPreregistradosActivos = useCallback(
    async (list: InventarioItem[]) => {
      const byEntidad = new Map<string, string[]>();
      for (const activo of list) {
        const ids = byEntidad.get(activo.entidad_id) ?? [];
        ids.push(activo.id);
        byEntidad.set(activo.entidad_id, ids);
      }
      let eliminados = 0;
      for (const [eid, ids] of byEntidad) {
        const result = await deleteActivosPreregistrados(eid, ids);
        if (result.error) {
          pushToast(result.error, "error");
          return { error: result.error };
        }
        eliminados += result.data?.eliminados ?? ids.length;
      }
      quitarActivos(list.map((a) => a.id));
      pushToast(mensajeEliminacionPreregistros(eliminados), "success");
      void router.refresh();
      return {};
    },
    [pushToast, quitarActivos, router],
  );

  useEffect(() => {
    setEditScope("single");
  }, [editActivo?.id]);

  const activeEntidadId = hasFixedEntidad
    ? fixedEntidadId!
    : isAdmin
      ? (fixedEntidadId ?? "")
      : entidadId;

  const activosScoped = useMemo(
    () => activosList.filter((a) => !activeEntidadId || a.entidad_id === activeEntidadId),
    [activosList, activeEntidadId],
  );

  const ubicacionMultiplesSedes = useMemo(() => {
    const sedeIds = new Set(
      activosScoped.map((a) => a.sede_id).filter((id): id is string => Boolean(id)),
    );
    return sedeIds.size > 1;
  }, [activosScoped]);

  const gestionPreregistrosAlcance =
    estadoRegistro === "PREREGISTRADO"
      ? "del filtro actual"
      : hasFixedEntidad || activeEntidadId
        ? "de la entidad"
        : "del filtro actual";
  const puedeGestionarPreregistros = estadoRegistro === "PREREGISTRADO";
  const [preregistroHeaderToolbar, setPreregistroHeaderToolbar] =
    useState<PreregistroGestionToolbarState | null>(null);
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
      alcanceLabel: gestionPreregistrosAlcance,
      onDeleteActivos: eliminarPreregistradosActivos,
      toolbarPlacement: "header" as const,
      onToolbarStateChange: syncPreregistroToolbar,
    }),
    [gestionPreregistrosAlcance, eliminarPreregistradosActivos, syncPreregistroToolbar],
  );

  const activosBase = useMemo(() => {
    const scoped = activosList.filter((a) => {
      if (activeEntidadId && a.entidad_id !== activeEntidadId) return false;
      if (estadoRegistro && a.estado_registro !== estadoRegistro) return false;
      return matchesInventarioBusquedaMultiColumna(a, busqueda);
    });
    return filtrarActivosPorFechaCorte(scoped, fechaCorte);
  }, [activosList, busqueda, activeEntidadId, estadoRegistro, fechaCorte]);

  const columnFilterOptions = useMemo(
    () =>
      opcionesFiltroColumnaDesdeActivos(activosBase, {
        incluirUbicacion: true,
        incluirCuenta: !isAdmin,
        ubicacionConSede: ubicacionMultiplesSedes,
      }),
    [activosBase, isAdmin, ubicacionMultiplesSedes],
  );

  const filtrados = useMemo(() => {
    return activosBase.filter((a) =>
      pasoFiltrosColumnaInventario(a, columnFilters, {
        aplicarUbicacion: true,
        aplicarCuenta: !isAdmin,
        ubicacionConSede: ubicacionMultiplesSedes,
      }),
    );
  }, [activosBase, columnFilters, isAdmin, ubicacionMultiplesSedes]);

  const hasActiveFilters = Boolean(
    (!hasFixedEntidad && !isAdmin && entidadId) ||
      estadoRegistro ||
      busqueda.trim() ||
      hasActiveInventarioColumnFilters(columnFilters),
  );

  function irAlAmbiente(activo: InventarioItem) {
    if (!activo.ambiente_id) return;
    const href = isAdmin
      ? `/admin/ambientes/${activo.ambiente_id}`
      : activo.entidad_id
        ? `/contador/entidades/${activo.entidad_id}/ambientes/${activo.ambiente_id}`
        : null;
    if (href) router.push(href);
  }

  function handleSuccess() {
    setEditActivo(null);
    router.refresh();
  }

  function limpiarFiltros() {
    if (!hasFixedEntidad && !isAdmin) {
      setEntidadId("");
    }
    setEstadoRegistro("");
    setBusqueda("");
    setColumnFilters(emptyInventarioColumnFilters());
  }

  if (editActivo) {
    const editTitle =
      isAdmin && editActivo.estado_registro !== "PREREGISTRADO"
        ? "Editar ubicación"
        : isAdmin && editActivo.estado_registro === "PREREGISTRADO"
          ? "Editar preregistro"
          : "Editar activo";

    const editBreadcrumbs: PanelBreadcrumbItem[] = embeddedInEntityPage
      ? [
          ...(entityPageHref
            ? [{ label: fixedEntidadNombre ?? "Entidad", href: entityPageHref }]
            : [{ label: fixedEntidadNombre ?? "Entidad" }]),
          { label: "Inventario", onClick: () => setEditActivo(null) },
          { label: editActivo.nombre },
          { label: editTitle },
        ]
      : isAdmin
        ? [
            { label: "Inventario global", href: "/admin/inventario" },
            { label: editActivo.nombre, onClick: () => setEditActivo(null) },
            { label: editTitle },
          ]
        : [
            { label: "Inventario global", onClick: () => setEditActivo(null) },
            { label: editActivo.nombre },
            { label: editTitle },
          ];

    return (
      <div className="space-y-5">
        <PanelPageHeader breadcrumbs={editBreadcrumbs} />
        <ActivoEditScopeNav
          scope={editScope}
          ejemplaresTotal={ejemplaresTotal}
          onScopeChange={setEditScope}
        />
        <ActivoForm
          entidades={entidades}
          fixedEntidadId={editActivo.entidad_id}
          fixedSedeId={isAdmin ? undefined : editActivo.sede_id ?? undefined}
          fixedAmbienteId={isAdmin ? undefined : editActivo.ambiente_id ?? undefined}
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
          asignaCodigoInmediato={!isAdmin && editActivo.estado_registro !== "PREREGISTRADO"}
          variant="page"
          onSuccess={handleSuccess}
          onCancel={() => setEditActivo(null)}
        />
      </div>
    );
  }

  return (
    <>
      <div className={`${panelInventarioPageClass} flex min-h-0 flex-col gap-1`}>
        {showToolbarTrigger && (
          <PanelToolbarExpandTrigger onClick={scrollToToolbar} />
        )}
        <ActivosInventarioExcelView
          className="min-h-0 flex-1"
          layout="global-panel"
          bodyScrollRef={panelScrollRef}
          toolbar={
            <div className={panelInventarioToolbarClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="panel-toolbar-title min-w-0">
                  <h1 className="panel-toolbar-heading text-foreground">
                    {embeddedInEntityPage ? "Inventario de la entidad" : "Inventario global"}
                  </h1>
                  <p className="panel-toolbar-subtitle">
                    {hasFixedEntidad
                      ? `Todos los bienes de ${fixedEntidadNombre ?? "la entidad"} en todos los ambientes`
                      : "Consulta y gestión de activos en todas las entidades"}
                  </p>
                </div>
                <div className={panelToolbarActionsClass}>
                  {preregistroHeaderToolbar && (
                    <PreregistroGestionToolbar {...preregistroHeaderToolbar} />
                  )}
                  {onOpenEliminarPorCodigos && (
                    <EliminarActivosPorCodigosButton onClick={onOpenEliminarPorCodigos} />
                  )}
                  <PanelCountLabel count={filtrados.length} singular="activo" plural="activos" />
                </div>
              </div>

              <div className={panelFilterRowClass} role="tablist" aria-label="Filtros de inventario">
                <div className="inline-flex flex-wrap gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5">
                  {FILTROS_ESTADO.map((f) => (
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

                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 md:justify-end">
                  <div className="min-w-[10rem] flex-1 md:max-w-md [&_input]:h-8 [&_input]:py-1 [&_input]:text-sm">
                    <PanelSearchInput
                      value={busqueda}
                      onChange={setBusqueda}
                      placeholder="Buscar en nombre, código, cuenta, comprobante, ubicación…"
                    />
                  </div>

                  <div className="w-[9.5rem] shrink-0 space-y-0.5">
                    <label
                      htmlFor="inventario_fecha_corte"
                      className="sr-only"
                    >
                      Fecha de corte
                    </label>
                    <FechaDdMmYyyyInput
                      id="inventario_fecha_corte"
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

                  {!hasFixedEntidad && !isAdmin && (
                    <Select
                      aria-label="Entidad"
                      size="compact"
                      value={entidadId}
                      onChange={setEntidadId}
                      options={[
                        { value: "", label: "Entidad: todas" },
                        ...entidades.map((e) => ({ value: e.id, label: e.nombre })),
                      ]}
                    />
                  )}

                  {hasActiveFilters && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={limpiarFiltros}
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          }
          activos={filtrados}
          onEditActivo={setEditActivo}
          onIrAmbiente={irAlAmbiente}
          puedeDarDeBaja={!isAdmin}
          puedeValidarPreregistro={!isAdmin}
          puedeEliminarPreregistro={puedeGestionarPreregistros}
          gestionPreregistros={puedeGestionarPreregistros ? gestionPreregistrosConfig : undefined}
          onActivoEliminado={(id) => quitarActivos([id])}
          modoAdmin={isAdmin}
          mostrarEstadoRegistro={isAdmin}
          mostrarUbicacion
          ubicacionMultiplesSedes={ubicacionMultiplesSedes}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          columnFilterOptions={columnFilterOptions}
          fechaCorte={fechaCorte}
          editarLabel={isAdmin ? undefined : "Editar activo"}
        />
      </div>
    </>
  );
}
