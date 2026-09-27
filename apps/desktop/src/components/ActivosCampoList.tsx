import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Ambiente, CategoriaBien, Entidad, EstadoRegistro, Sede } from "@inventario/types";
import {
  aniosAdquisicionDesdeActivos,
  entidadMuestraSelectorSede,
  matchesCodigoBarrasQuery,
  pasoFiltroAnioAdquisicion,
  pasoFiltroSerieComprobante,
  seriesComprobanteDesdeActivos,
  sedeIdSinSelector,
} from "@inventario/types";
import { Button, ComprobanteSerieFiltroInput, Select, useToast, mensajeEliminacionPreregistros, PreregistroGestionToolbar, type PreregistroGestionToolbarState } from "@inventario/ui";
import { listAmbientes, listAmbientesPorEntidad, listSedes } from "../lib/ubicacion";
import {
  PanelSearchInput,
  PanelToolbarExpandTrigger,
  panelFilterRowClass,
  panelInventarioPageClass,
  panelInventarioToolbarClass,
  panelToolbarActionsClass,
  usePanelInventarioUnifiedScroll,
} from "@inventario/ui/panel";
import type { ActivoConUbicacion } from "../lib/activos";
import { deleteActivosPreregistrados } from "../lib/activos";
import type { InventarioExportMeta } from "../lib/inventario-export";
import type { AmbienteDestinoNavigation } from "./AgregarBienesSimilaresDialog";
import { ActivosInventarioExcelView } from "./ActivosInventarioExcelView";
import { InventarioExportButtons } from "./InventarioExportButtons";

const FILTROS_ESTADO: { value: "" | EstadoRegistro; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "REGISTRADO", label: "Registrados" },
  { value: "PREREGISTRADO", label: "Preregistrados" },
  { value: "DADO_DE_BAJA", label: "Dados de baja" },
];

const FILTROS_ESTADO_AMBIENTE: { value: "" | EstadoRegistro; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "REGISTRADO", label: "Registrados" },
  { value: "DADO_DE_BAJA", label: "Dados de baja" },
];

const FILTROS_CATEGORIA: { value: "" | CategoriaBien; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "ACTIVO", label: "Activo" },
  { value: "CUENTA_ORDEN", label: "Cta. Orden" },
];

type ActivosListVariant = "entity" | "global" | "ambiente" | "entity-inventario";

interface ActivosCampoListProps {
  className?: string;
  variant?: ActivosListVariant;
  compactLayout?: boolean;
  toolbarExtra?: ReactNode;
  statusBanner?: ReactNode;
  entidades: Entidad[];
  entidadId: string;
  onEntidadChange?: (id: string) => void;
  activos: ActivoConUbicacion[];
  loading: boolean;
  online: boolean;
  fixedSedeId?: string;
  fixedAmbienteId?: string;
  esAmbientePreregistro?: boolean;
  headerExtra?: ReactNode;
  leyendaVisita?: ReactNode;
  renderVisita?: (activo: ActivoConUbicacion) => ReactNode;
  procedenciaPorActivo?: Record<string, string>;
  ambienteFilter?: { id: string; nombre: string };
  onClearAmbienteFilter?: () => void;
  onPrintLabel: (activo: ActivoConUbicacion) => void;
  onPrintBatch?: (activos: ActivoConUbicacion[]) => void;
  onEditActivo?: (activo: ActivoConUbicacion) => void;
  onIrAmbiente?: (activo: ActivoConUbicacion) => void;
  onAbrirAmbienteDestino?: (destino: AmbienteDestinoNavigation) => void;
  onActivoUpdated: (activo: ActivoConUbicacion) => void;
  onActivoDeleted?: () => void;
  exportMeta?: InventarioExportMeta;
  reportesExport?: ReactNode;
}

export function ActivosCampoList({
  className,
  variant = "entity",
  compactLayout = false,
  toolbarExtra,
  statusBanner,
  entidades,
  entidadId,
  onEntidadChange,
  activos,
  loading,
  online,
  fixedSedeId,
  fixedAmbienteId,
  esAmbientePreregistro = false,
  headerExtra,
  leyendaVisita,
  renderVisita,
  procedenciaPorActivo,
  ambienteFilter,
  onClearAmbienteFilter,
  onPrintLabel,
  onPrintBatch,
  onEditActivo,
  onIrAmbiente,
  onAbrirAmbienteDestino,
  onActivoUpdated,
  onActivoDeleted,
  exportMeta,
  reportesExport,
}: ActivosCampoListProps) {
  const { pushToast } = useToast();
  const [activosLocal, setActivosLocal] = useState(activos);

  useEffect(() => {
    setActivosLocal(activos);
  }, [activos]);

  const quitarActivos = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setActivosLocal((prev) => prev.filter((a) => !idSet.has(a.id)));
  }, []);

  const isGlobal = variant === "global";
  const isAmbiente = variant === "ambiente";
  const isEntityInventario = variant === "entity-inventario";

  const handleActivoUpdatedLocal = useCallback(
    (updated: ActivoConUbicacion) => {
      setActivosLocal((prev) => {
        const idx = prev.findIndex((a) => a.id === updated.id);
        if (idx < 0) return prev;
        if (isAmbiente && esAmbientePreregistro && updated.estado_registro !== "PREREGISTRADO") {
          return prev.filter((a) => a.id !== updated.id);
        }
        if (isAmbiente && fixedAmbienteId && updated.ambiente_id !== fixedAmbienteId) {
          return prev.filter((a) => a.id !== updated.id);
        }
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
      onActivoUpdated(updated);
    },
    [esAmbientePreregistro, fixedAmbienteId, isAmbiente, onActivoUpdated],
  );
  const hideUbicacionFilters = isAmbiente;
  const [filter, setFilter] = useState("");
  const [estadoRegistro, setEstadoRegistro] = useState<"" | EstadoRegistro>(
    esAmbientePreregistro ? "PREREGISTRADO" : "",
  );
  const [categoria, setCategoria] = useState<"" | CategoriaBien>("");
  const [filterEntidadId, setFilterEntidadId] = useState("");
  const [sedeId, setSedeId] = useState(fixedSedeId ?? "");
  const [ambienteId, setAmbienteId] = useState(fixedAmbienteId ?? ambienteFilter?.id ?? "");
  const [anioAdquisicion, setAnioAdquisicion] = useState("");
  const [serieComprobanteFiltro, setSerieComprobanteFiltro] = useState("");
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [selectedActivos, setSelectedActivos] = useState<ActivoConUbicacion[]>([]);

  const sedesEntidadId = isGlobal ? filterEntidadId : entidadId;
  const mostrarSelectorSede = entidadMuestraSelectorSede(sedes);
  const mostrarFiltrosAdquisicion = isEntityInventario || (isGlobal && Boolean(filterEntidadId));
  const entidadFiltrosAdquisicionId = isEntityInventario ? entidadId : filterEntidadId;
  const aniosAdquisicionDisponibles = useMemo(
    () =>
      aniosAdquisicionDesdeActivos(
        activosLocal.filter(
          (a) => !entidadFiltrosAdquisicionId || a.entidad_id === entidadFiltrosAdquisicionId,
        ),
      ),
    [activosLocal, entidadFiltrosAdquisicionId],
  );
  const seriesComprobanteDisponibles = useMemo(
    () =>
      seriesComprobanteDesdeActivos(
        activosLocal.filter(
          (a) => !entidadFiltrosAdquisicionId || a.entidad_id === entidadFiltrosAdquisicionId,
        ),
      ),
    [activosLocal, entidadFiltrosAdquisicionId],
  );

  useEffect(() => {
    if (fixedSedeId) setSedeId(fixedSedeId);
  }, [fixedSedeId]);

  useEffect(() => {
    if (fixedAmbienteId) setAmbienteId(fixedAmbienteId);
  }, [fixedAmbienteId]);

  useEffect(() => {
    if (!sedesEntidadId) {
      if (!isAmbiente) {
        setSedes([]);
        if (!fixedSedeId) setSedeId("");
        if (!fixedAmbienteId) setAmbienteId("");
        setAmbientes([]);
      }
      return;
    }
    void listSedes(sedesEntidadId).then((data) => {
      setSedes(data);
      if (!fixedSedeId) {
        const implicitId = sedeIdSinSelector(data);
        setSedeId(implicitId ?? "");
        if (implicitId) {
          void listAmbientes(implicitId).then(setAmbientes);
        } else if (!fixedAmbienteId) {
          setAmbientes([]);
        }
      }
    });
  }, [sedesEntidadId, isAmbiente, fixedSedeId, fixedAmbienteId]);

  useEffect(() => {
    if (!sedeId) {
      setAmbientes([]);
      return;
    }
    void listAmbientes(sedeId).then(setAmbientes);
  }, [sedeId]);

  useEffect(() => {
    if (!ambienteFilter || !entidadId) return;
    setAmbienteId(ambienteFilter.id);
    const match = activos.find((a) => a.ambiente_id === ambienteFilter.id);
    if (match?.sede_id) {
      setSedeId(match.sede_id);
      return;
    }
    void listAmbientesPorEntidad(entidadId).then((all) => {
      const amb = all.find((a) => a.id === ambienteFilter.id);
      if (!amb) return;
      setSedeId(amb.sede_id);
      void listAmbientes(amb.sede_id).then(setAmbientes);
    });
  }, [ambienteFilter, entidadId, activos]);

  async function handleEntidadFilterChange(value: string) {
    if (isGlobal) {
      setFilterEntidadId(value);
    } else {
      onEntidadChange?.(value);
    }
    if (!fixedSedeId) setSedeId("");
    if (!fixedAmbienteId) setAmbienteId("");
    setAmbientes([]);
    onClearAmbienteFilter?.();
    if (!value) {
      setSedes([]);
      return;
    }
    const data = await listSedes(value);
    setSedes(data);
    if (!fixedSedeId) {
      const implicitId = sedeIdSinSelector(data);
      setSedeId(implicitId ?? "");
      if (implicitId) {
        const ambList = await listAmbientes(implicitId);
        setAmbientes(ambList);
      }
    }
  }

  async function handleSedeFilterChange(value: string) {
    setSedeId(value);
    setAmbienteId("");
    onClearAmbienteFilter?.();
    if (!value) {
      setAmbientes([]);
      return;
    }
    const data = await listAmbientes(value);
    setAmbientes(data);
  }

  function limpiarFiltros() {
    if (isGlobal) setFilterEntidadId("");
    if (!fixedSedeId) {
      const implicitId = sedeIdSinSelector(sedes);
      setSedeId(implicitId ?? "");
      if (implicitId) {
        void listAmbientes(implicitId).then(setAmbientes);
      } else {
        setAmbientes([]);
      }
    }
    if (!fixedAmbienteId) setAmbienteId("");
    setEstadoRegistro(esAmbientePreregistro ? "PREREGISTRADO" : "");
    setCategoria("");
    setFilter("");
    setAnioAdquisicion("");
    setSerieComprobanteFiltro("");
    if (!isEntityInventario && !sedesEntidadId) {
      setSedes([]);
    }
    onClearAmbienteFilter?.();
  }

  const hasActiveFilters = Boolean(
    (isGlobal && filterEntidadId) ||
      (!isGlobal && !isAmbiente && !isEntityInventario && entidadId) ||
      (mostrarSelectorSede && sedeId) ||
      ambienteId ||
      estadoRegistro ||
      categoria ||
      filter.trim() ||
      anioAdquisicion ||
      serieComprobanteFiltro.trim(),
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return activosLocal.filter((a) => {
      if (isGlobal && filterEntidadId && a.entidad_id !== filterEntidadId) return false;
      if (!isGlobal && !isAmbiente && entidadId && a.entidad_id !== entidadId) return false;
      const sedeFiltro = fixedSedeId ?? sedeId;
      const ambienteFiltro = fixedAmbienteId ?? ambienteId;
      if (sedeFiltro && a.sede_id !== sedeFiltro) return false;
      if (ambienteFiltro && a.ambiente_id !== ambienteFiltro) return false;
      if (isAmbiente && esAmbientePreregistro) {
        if (a.estado_registro !== "PREREGISTRADO") return false;
      } else if (isAmbiente && a.estado_registro === "PREREGISTRADO") {
        return false;
      } else if (estadoRegistro && a.estado_registro !== estadoRegistro) {
        return false;
      }
      if (categoria && a.categoria !== categoria) return false;
      if (mostrarFiltrosAdquisicion && !pasoFiltroAnioAdquisicion(a.fecha_adquisicion, anioAdquisicion)) {
        return false;
      }
      if (mostrarFiltrosAdquisicion && !pasoFiltroSerieComprobante(a, serieComprobanteFiltro)) {
        return false;
      }
      if (!q) return true;
      if (matchesCodigoBarrasQuery(filter, a.codigo_barras, a.codigo_catalogo)) return true;
      const haystack = [
        a.nombre,
        a.entidad_nombre,
        a.ambiente_nombre,
        a.sede_nombre,
        a.marca,
        a.modelo,
        a.motivo_baja,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [
    activosLocal,
    sedeId,
    ambienteId,
    fixedSedeId,
    fixedAmbienteId,
    estadoRegistro,
    categoria,
    filter,
    isGlobal,
    isAmbiente,
    filterEntidadId,
    entidadId,
    esAmbientePreregistro,
    mostrarFiltrosAdquisicion,
    anioAdquisicion,
    serieComprobanteFiltro,
  ]);

  const emptyMessage = isAmbiente
    ? activos.length === 0
      ? "Aún no hay activos en este ambiente. Use «Nuevo activo» para registrar el primero."
      : filtered.length === 0
        ? "No hay activos que coincidan con los filtros aplicados."
        : "No hay activos que coincidan con la búsqueda."
    : isGlobal
      ? activos.length === 0
        ? "No hay activos cargados. Sincronice o espere la conexión."
        : filtered.length === 0
          ? "No hay activos que coincidan con los filtros aplicados."
          : "No hay activos que coincidan con la búsqueda."
      : isEntityInventario
        ? activos.length === 0
          ? "Aún no hay activos en esta entidad. Sincronice o registre bienes en un ambiente."
          : filtered.length === 0
            ? "No hay activos que coincidan con los filtros aplicados."
            : "No hay activos que coincidan con la búsqueda."
      : !entidadId
        ? "Seleccione una entidad para ver el inventario de activos."
        : activos.length === 0
          ? "Aún no hay activos en esta entidad. Use «Registrar activo» o espere la sincronización."
          : filtered.length === 0
            ? "No hay activos que coincidan con los filtros aplicados."
            : "No hay activos que coincidan con la búsqueda.";

  const useCompactGlobal = isGlobal && compactLayout;
  const useCompactInventarioPanel = useCompactGlobal || isEntityInventario;
  const usePanelScrollLayout = useCompactInventarioPanel || isAmbiente;
  const entidadInventarioNombre =
    entidades.find((e) => e.id === entidadId)?.nombre ?? "la entidad";
  const { panelScrollRef, showToolbarTrigger, scrollToToolbar } = usePanelInventarioUnifiedScroll();
  const [preregistroHeaderToolbar, setPreregistroHeaderToolbar] =
    useState<PreregistroGestionToolbarState | null>(null);

  async function eliminarPreregistradosActivos(list: ActivoConUbicacion[]) {
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
    onActivoDeleted?.();
    return {};
  }

  const gestionPreregistrosAlcance = esAmbientePreregistro
    ? "de este ambiente"
    : estadoRegistro === "PREREGISTRADO"
      ? "del filtro actual"
      : isEntityInventario || (!isGlobal && entidadId)
        ? "de la entidad"
        : "del filtro actual";

  const puedeGestionarPreregistros =
    esAmbientePreregistro || estadoRegistro === "PREREGISTRADO";

  const gestionPreregistros = useMemo(
    () =>
      puedeGestionarPreregistros
        ? {
            alcanceLabel: gestionPreregistrosAlcance,
            onDeleteActivos: eliminarPreregistradosActivos,
            toolbarPlacement: "header" as const,
            onToolbarStateChange: setPreregistroHeaderToolbar,
          }
        : undefined,
    [puedeGestionarPreregistros, gestionPreregistrosAlcance, eliminarPreregistradosActivos],
  );

  const ambienteToolbar = isAmbiente ? (
    <div className={panelInventarioToolbarClass}>
      <div
        className={panelFilterRowClass}
        role={esAmbientePreregistro ? undefined : "tablist"}
        aria-label="Filtros de inventario"
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
          className="inline-flex flex-wrap gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5"
          role="tablist"
          aria-label="Categoría"
        >
          {FILTROS_CATEGORIA.map((f) => (
            <button
              key={f.value || "all-cat"}
              type="button"
              role="tab"
              aria-selected={categoria === f.value}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                categoria === f.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setCategoria(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="min-w-[10rem] flex-1 md:max-w-xs [&_input]:h-8 [&_input]:py-1 [&_input]:text-sm">
          <PanelSearchInput
            value={filter}
            onChange={setFilter}
            placeholder="Buscar por código, nombre, marca…"
          />
        </div>

        <div className={`${panelToolbarActionsClass} ml-auto`}>
          {preregistroHeaderToolbar && (
            <PreregistroGestionToolbar {...preregistroHeaderToolbar} />
          )}
          {reportesExport ??
            (exportMeta && (
              <InventarioExportButtons activos={filtered} meta={exportMeta} />
            ))}
          {onPrintBatch && selectedActivos.length > 0 && (
            <Button type="button" size="sm" className="h-8 px-2 text-xs" onClick={() => onPrintBatch(selectedActivos)}>
              Imprimir lote ({selectedActivos.length})
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "activo" : "activos"}
            {loading ? " · …" : ""}
          </span>
          {toolbarExtra}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={`${usePanelScrollLayout ? `${panelInventarioPageClass} flex min-h-0 flex-col gap-1` : "space-y-3"} ${className ?? ""}`}>
      {headerExtra}
      {usePanelScrollLayout && showToolbarTrigger && (
        <PanelToolbarExpandTrigger onClick={scrollToToolbar} />
      )}
      {useCompactInventarioPanel ? (
        <ActivosInventarioExcelView
          className="min-h-0 flex-1"
          layout="global-panel"
          bodyScrollRef={panelScrollRef}
          toolbar={
            <>
              <div className={panelInventarioToolbarClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="panel-toolbar-title min-w-0">
                    <h1 className="panel-toolbar-heading text-foreground">
                      {isEntityInventario ? "Inventario de la entidad" : "Inventario global"}
                    </h1>
                    <p className="panel-toolbar-subtitle">
                      {isEntityInventario
                        ? `Todos los bienes de ${entidadInventarioNombre} en todos los ambientes`
                        : "Consulta y gestión de activos en todas las entidades"}
                    </p>
                  </div>
                  <div className={panelToolbarActionsClass}>
                    {preregistroHeaderToolbar && (
            <PreregistroGestionToolbar {...preregistroHeaderToolbar} />
          )}
                    {toolbarExtra}
                    {exportMeta && (
                      <InventarioExportButtons activos={filtered} meta={exportMeta} />
                    )}
                    {onPrintBatch && selectedActivos.length > 0 && (
                      <Button type="button" size="sm" className="h-8 px-2 text-xs" onClick={() => onPrintBatch(selectedActivos)}>
                        Imprimir lote ({selectedActivos.length})
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {filtered.length} {filtered.length === 1 ? "activo" : "activos"}
                      {loading ? " · …" : ""}
                    </span>
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

                  <div
                    className="inline-flex flex-wrap gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5"
                    role="tablist"
                    aria-label="Categoría"
                  >
                    {FILTROS_CATEGORIA.map((f) => (
                      <button
                        key={f.value || "all-cat"}
                        type="button"
                        role="tab"
                        aria-selected={categoria === f.value}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          categoria === f.value
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setCategoria(f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 md:justify-end">
                    <div className="min-w-[10rem] flex-1 md:max-w-xs [&_input]:h-8 [&_input]:py-1 [&_input]:text-sm">
                      <PanelSearchInput
                        value={filter}
                        onChange={setFilter}
                        placeholder={
                          isEntityInventario
                            ? "Buscar código, nombre, sucursal o ambiente…"
                            : "Buscar código, nombre, entidad…"
                        }
                      />
                    </div>

                    {isGlobal && (
                      <Select
                        aria-label="Entidad"
                        size="compact"
                        value={filterEntidadId}
                        onChange={(value) => void handleEntidadFilterChange(value)}
                        options={[
                          { value: "", label: "Entidad: todas" },
                          ...entidades.map((e) => ({ value: e.id, label: e.nombre })),
                        ]}
                      />
                    )}

                    {mostrarSelectorSede && (
                    <Select
                      aria-label="Sede"
                      size="compact"
                      value={sedeId}
                      disabled={isGlobal ? !filterEntidadId : !entidadId}
                      onChange={(value) => void handleSedeFilterChange(value)}
                      options={[
                        { value: "", label: "Sede: todas" },
                        ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
                      ]}
                    />
                    )}

                    <Select
                      aria-label="Ambiente"
                      size="compact"
                      value={ambienteId}
                      disabled={(mostrarSelectorSede && !sedeId) || (isGlobal ? !filterEntidadId : !entidadId)}
                      onChange={(value) => {
                        setAmbienteId(value);
                        onClearAmbienteFilter?.();
                      }}
                      options={[
                        { value: "", label: "Ambiente: todos" },
                        ...ambientes.map((a) => ({ value: a.id, label: a.nombre })),
                      ]}
                    />

                    {mostrarFiltrosAdquisicion && (
                      <Select
                        aria-label="Año de adquisición"
                        size="compact"
                        value={anioAdquisicion}
                        onChange={setAnioAdquisicion}
                        options={[
                          { value: "", label: "Año: todos" },
                          ...aniosAdquisicionDisponibles.map((y) => ({
                            value: String(y),
                            label: String(y),
                          })),
                        ]}
                      />
                    )}

                    {mostrarFiltrosAdquisicion && (
                      <ComprobanteSerieFiltroInput
                        value={serieComprobanteFiltro}
                        onChange={setSerieComprobanteFiltro}
                        series={seriesComprobanteDisponibles}
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
              {statusBanner}
            </>
          }
          activos={filtered}
          entidadId={entidadId}
          online={online}
          emptyMessage={emptyMessage}
          mostrarPosibleAmbiente={esAmbientePreregistro}
          onPrintLabel={onPrintLabel}
          onActivoUpdated={handleActivoUpdatedLocal}
          onActivoDeleted={onActivoDeleted}
          onPrintBatch={onPrintBatch}
          onEditActivo={onEditActivo}
          onIrAmbiente={isGlobal || isEntityInventario ? onIrAmbiente : undefined}
          onAbrirAmbienteDestino={onAbrirAmbienteDestino}
          onSelectionChange={setSelectedActivos}
          mostrarUbicacion={isEntityInventario}
          ubicacionMultiplesSedes={isEntityInventario && mostrarSelectorSede}
          gestionPreregistros={gestionPreregistros}
          onActivoEliminado={(id) => quitarActivos([id])}
        />
      ) : isAmbiente ? (
        <ActivosInventarioExcelView
          className="min-h-0 flex-1"
          layout="global-panel"
          bodyScrollRef={panelScrollRef}
          toolbar={ambienteToolbar}
          activos={filtered}
          entidadId={entidadId}
          online={online}
          emptyMessage={emptyMessage}
          mostrarPosibleAmbiente={esAmbientePreregistro}
          onPrintLabel={onPrintLabel}
          onActivoUpdated={handleActivoUpdatedLocal}
          onActivoDeleted={onActivoDeleted}
          onPrintBatch={onPrintBatch}
          onEditActivo={onEditActivo}
          onAbrirAmbienteDestino={onAbrirAmbienteDestino}
          onSelectionChange={setSelectedActivos}
          gestionPreregistros={gestionPreregistros}
          onActivoEliminado={(id) => quitarActivos([id])}
          leyendaVisita={leyendaVisita}
          renderVisita={renderVisita}
          procedenciaPorActivo={procedenciaPorActivo}
        />
      ) : (
        <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTROS_ESTADO.map((f) => (
            <Button
              key={f.value || "all"}
              type="button"
              size="sm"
              variant={estadoRegistro === f.value ? "default" : "outline"}
              onClick={() => setEstadoRegistro(f.value)}
            >
              {f.label}
            </Button>
          ))}
          {FILTROS_CATEGORIA.map((f) => (
            <Button
              key={f.value || "all-cat"}
              type="button"
              size="sm"
              variant={categoria === f.value ? "default" : "outline"}
              onClick={() => setCategoria(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportMeta && (
            <InventarioExportButtons activos={filtered} meta={exportMeta} />
          )}
          {onPrintBatch && selectedActivos.length > 0 && (
            <Button type="button" size="sm" onClick={() => onPrintBatch(selectedActivos)}>
              Imprimir lote ({selectedActivos.length})
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "activo" : "activos"}
            {loading ? " · …" : ""}
          </span>
        </div>
      </div>

      {!hideUbicacionFilters && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="filtro_entidad" className="text-xs font-medium text-muted-foreground">
              Entidad
            </label>
            <Select
              id="filtro_entidad"
              value={isGlobal ? filterEntidadId : entidadId}
              onChange={(value) => void handleEntidadFilterChange(value)}
              options={[
                { value: "", label: isGlobal ? "Todas" : "Seleccione…" },
                ...entidades.map((e) => ({ value: e.id, label: e.nombre })),
              ]}
            />
          </div>
          {mostrarSelectorSede && (
          <div className="space-y-1">
            <label htmlFor="filtro_sede" className="text-xs font-medium text-muted-foreground">
              Sede
            </label>
            <Select
              id="filtro_sede"
              value={sedeId}
              disabled={!sedesEntidadId}
              onChange={(value) => void handleSedeFilterChange(value)}
              options={[
                { value: "", label: "Todas" },
                ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
              ]}
            />
          </div>
          )}
          <div className="space-y-1">
            <label htmlFor="filtro_ambiente" className="text-xs font-medium text-muted-foreground">
              Ambiente
            </label>
            <Select
              id="filtro_ambiente"
              value={ambienteId}
              disabled={mostrarSelectorSede ? !sedeId : !sedesEntidadId}
              onChange={(value) => {
                setAmbienteId(value);
                onClearAmbienteFilter?.();
              }}
              options={[
                { value: "", label: "Todos" },
                ...ambientes.map((a) => ({ value: a.id, label: a.nombre })),
              ]}
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <Button type="button" variant="outline" className="w-full" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          </div>
        </div>
      )}

      <PanelSearchInput
        value={filter}
        onChange={setFilter}
        placeholder={
          isGlobal
            ? "Buscar por código, nombre, entidad, sede o ambiente…"
            : "Buscar por código, nombre, sede o ambiente…"
        }
      />
        </>
      )}

      {!usePanelScrollLayout && (
      <ActivosInventarioExcelView
        activos={filtered}
        entidadId={entidadId}
        online={online}
        emptyMessage={emptyMessage}
        mostrarPosibleAmbiente={esAmbientePreregistro}
        onPrintLabel={onPrintLabel}
        onActivoUpdated={handleActivoUpdatedLocal}
        onActivoDeleted={onActivoDeleted}
        onPrintBatch={onPrintBatch}
        onEditActivo={onEditActivo}
        onIrAmbiente={isGlobal ? onIrAmbiente : undefined}
        onAbrirAmbienteDestino={onAbrirAmbienteDestino}
        onSelectionChange={setSelectedActivos}
        gestionPreregistros={gestionPreregistros}
        onActivoEliminado={(id) => quitarActivos([id])}
      />
      )}
    </div>
  );
}
