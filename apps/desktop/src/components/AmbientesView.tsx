import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CreateResponsableInput,
  Entidad,
  Espacio,
  EspacioConOcupacion,
  ResponsableConConteo,
  SedeConConteo,
  VisitaCampoActiva,
  VisitaCampoHistorial,
} from "@inventario/types";
import { entidadMuestraSelectorSede, sedeIdSinSelector } from "@inventario/types";
import { ESTRUCTURA_REFRESH_EVENT } from "@inventario/realtime";
import { panelFieldsetClass } from "@inventario/ui/panel";
import { Button, Dialog, EspaciosSedeDialog, ResponsablesPanel, Select } from "@inventario/ui";
import {
  DeleteIcon,
  EditIcon,
  PanelBanner,
  PanelCountLabel,
  PanelDataTable,
  PanelIconAction,
  PanelTableActions,
  PanelTableColgroup,
  PanelTableTd,
  PanelTableTh,
  PanelEmptyState,
  PanelPageHeader,
  PanelSearchInput,
  PanelTabs,
  PanelToolbar,
  PanelViewToggle,
  StatusBadge,
  AMBIENTES_TABLE_COLS,
  AMBIENTES_TABLE_COLS_SIN_SUCURSAL,
  AMBIENTES_TABLE_COLS_VISITA,
  AMBIENTES_TABLE_COLS_SIN_SUCURSAL_VISITA,
  panelCardClass,
  panelTableClickableRowClass,
  panelTableHeadRowClass,
  panelTableShrinkCellClass,
  panelTableStickyHeadClass,
  panelTableNowrapCellClass,
  useStoredViewMode,
  SedeAmbienteFilterSelect,
  VisitasCampoBanner,
  VisitaCampoEstadoBadge,
  VisitasCampoHistorialPanel,
  IniciarVisitaCampoDialog,
  IniciarVisitaCampoButton,
  AmbientesDatosMenu,
} from "@inventario/ui/panel";
import { AmbienteFormFields, ambienteFromForm, etiquetaEspacioAmbiente } from "./AmbienteFormFields";
import { AmbientesImportDialog } from "./AmbientesImportDialog";
import { InventarioImportDialog } from "./InventarioImportDialog";
import { ConfirmDialog, CrearResponsableDialog, EliminarActivosPorCodigosDialog } from "@inventario/ui";
import { GestionarSucursales } from "./GestionarSucursales";
import {
  createAmbiente,
  createEspacio,
  deleteAmbiente,
  deleteEspacio,
  ensureEspaciosHasta,
  listAmbientesPorEntidad,
  listEspacios,
  listEspaciosPorEntidad,
  listSedesConConteo,
  updateAmbiente,
  type AmbienteConSede,
} from "../lib/ubicacion";
import type { AmbienteConVisita } from "../lib/visitas-campo";
import {
  abrirVisitaCampo,
  attachVisitaEstadoToAmbientes,
  cerrarVisitaCampo,
  culminarAmbienteVisita,
  getVisitasCampoActivas,
  getVisitaCampoDetalle,
  listVisitasCampoHistorial,
} from "../lib/visitas-campo";
import {
  createResponsable,
  deleteResponsable,
  listResponsables,
  setResponsableActivo,
  updateResponsable,
} from "../lib/responsables";
import {
  deleteActivosPorCodigos,
  previewDeleteActivosPorCodigos,
  type ActivoConUbicacion,
} from "../lib/activos";
import { InventarioEntidadView } from "./InventarioEntidadView";
import type { AmbienteDestinoNavigation } from "./AgregarBienesSimilaresDialog";

type EntityTab = "inventario" | "ambientes" | "responsables" | "sucursales" | "visitas";

const ENTITY_TABS: { id: EntityTab; label: string }[] = [
  { id: "inventario", label: "Inventario" },
  { id: "ambientes", label: "Ambientes" },
  { id: "responsables", label: "Responsables" },
  { id: "sucursales", label: "Sucursales" },
  { id: "visitas", label: "Visitas de campo" },
];

interface AmbientesViewProps {
  entidades: Entidad[];
  entidad: Entidad;
  entidadId: string;
  onEntidadChange?: (id: string) => void;
  drillDown?: boolean;
  online: boolean;
  onViewActivos: (ambiente: AmbienteConSede) => void;
  activos: ActivoConUbicacion[];
  activosLoading: boolean;
  onPrintLabel: (activo: ActivoConUbicacion) => void;
  onPrintBatch?: (activos: ActivoConUbicacion[]) => void;
  onEditActivo?: (activo: ActivoConUbicacion) => void;
  onIrAmbiente?: (activo: ActivoConUbicacion) => void;
  onActivoUpdated: (activo: ActivoConUbicacion) => void;
  onActivoDeleted?: () => void;
  onAbrirAmbienteDestino?: (destino: AmbienteDestinoNavigation) => void;
  initialTab?: EntityTab;
  sedeFocus?: { id: string; nombre: string };
}

function AmbienteCard({
  ambiente,
  entidadNombre,
  onEdit,
  onDelete,
  onViewActivos,
}: {
  ambiente: AmbienteConSede;
  entidadNombre: string;
  onEdit: () => void;
  onDelete: () => void;
  onViewActivos: () => void;
}) {
  const espacioLabel = etiquetaEspacioAmbiente({
    esPreregistro: ambiente.es_preregistro,
    espacioNombre: ambiente.espacio_nombre,
  });
  return (
    <article className={`${panelCardClass} flex flex-col overflow-hidden`}>
      <button
        type="button"
        className="flex flex-1 flex-col text-left outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={onViewActivos}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
          <h3 className="font-semibold leading-snug text-primary">{ambiente.nombre}</h3>
          <StatusBadge variant="active">Activo</StatusBadge>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            {ambiente.responsable ?? "Sin responsable asignado"}
          </p>
          <p
            className="text-sm text-muted-foreground"
            title={
              ambiente.es_preregistro
                ? "Ambiente de preregistros: no es un local físico"
                : undefined
            }
          >
            Espacio: {espacioLabel}
          </p>
          {ambiente.descripcion ? (
            <p className="text-muted-foreground">{ambiente.descripcion}</p>
          ) : (
            <p className="italic text-muted-foreground">Sin descripción</p>
          )}
          <p className="text-sm text-muted-foreground">
            {ambiente.activo_count} {ambiente.activo_count === 1 ? "activo" : "activos"}
          </p>
          <p className="mt-auto pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Entidad: {entidadNombre}
          </p>
        </div>
      </button>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/50 bg-muted/20 px-3 py-2.5">
        <PanelIconAction label="Editar" onClick={onEdit}>
          <EditIcon />
        </PanelIconAction>
        <PanelIconAction label="Eliminar" variant="danger" onClick={onDelete}>
          <DeleteIcon />
        </PanelIconAction>
      </div>
    </article>
  );
}

export function AmbientesView({
  entidades,
  entidad,
  entidadId,
  onEntidadChange,
  drillDown = false,
  online,
  onViewActivos,
  activos,
  activosLoading,
  onPrintLabel,
  onPrintBatch,
  onEditActivo,
  onIrAmbiente,
  onActivoUpdated,
  onActivoDeleted,
  onAbrirAmbienteDestino,
  initialTab = "inventario",
  sedeFocus,
}: AmbientesViewProps) {
  const [ambientes, setAmbientes] = useState<AmbienteConVisita[]>([]);
  const [sedes, setSedes] = useState<SedeConConteo[]>([]);
  const [responsables, setResponsables] = useState<ResponsableConConteo[]>([]);
  const [visitasActivas, setVisitasActivas] = useState<VisitaCampoActiva[]>([]);
  const [visitasHistorial, setVisitasHistorial] = useState<VisitaCampoHistorial[]>([]);
  const [visitaPending, setVisitaPending] = useState(false);
  const [cerrarPendingId, setCerrarPendingId] = useState<string | null>(null);
  const [visitaError, setVisitaError] = useState<string | null>(null);
  const [culminarPendingId, setCulminarPendingId] = useState<string | null>(null);
  const [detalleVisita, setDetalleVisita] = useState<VisitaCampoHistorial | null>(null);
  const [detalleAmbientes, setDetalleAmbientes] = useState<Awaited<ReturnType<typeof getVisitaCampoDetalle>> | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [abrirVisitaOpen, setAbrirVisitaOpen] = useState(false);
  const [abrirVisitaError, setAbrirVisitaError] = useState<string | null>(null);
  const [importAmbientesOpen, setImportAmbientesOpen] = useState(false);
  const [importActivosOpen, setImportActivosOpen] = useState(false);
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [tab, setTab] = useState<EntityTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [sedeFilterId, setSedeFilterId] = useState(sedeFocus?.id ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [createResponsableOpen, setCreateResponsableOpen] = useState(false);
  const [createResponsableId, setCreateResponsableId] = useState("");
  const [createEspacioId, setCreateEspacioId] = useState("");
  const [editResponsableOpen, setEditResponsableOpen] = useState(false);
  const [editResponsableId, setEditResponsableId] = useState("");
  const [editEspacioId, setEditEspacioId] = useState("");
  const [editAmbiente, setEditAmbiente] = useState<AmbienteConVisita | null>(null);
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [manageEspaciosSedeId, setManageEspaciosSedeId] = useState<string | null>(null);
  const [manageEspaciosList, setManageEspaciosList] = useState<EspacioConOcupacion[]>([]);
  const [manageEspaciosPending, setManageEspaciosPending] = useState(false);
  const [manageEspaciosError, setManageEspaciosError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AmbienteConVisita | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useStoredViewMode("inventario-view-ambientes", "list");

  const sedeFiltrada = Boolean(sedeFilterId);
  const entidadMultiplesSedes = entidadMuestraSelectorSede(sedes);
  const ocultarSucursalEnLista = !entidadMultiplesSedes || sedeFiltrada;

  // Siempre mostrar tab Sucursales: con 0–1 sede también hay que poder crear/gestionar.
  const entityTabs = ENTITY_TABS;

  useEffect(() => {
    if (editAmbiente) {
      setEditResponsableId(editAmbiente.responsable_id ?? "");
      setEditEspacioId(editAmbiente.espacio_id ?? "");
      setEditResponsableOpen(false);
    }
  }, [editAmbiente]);

  function closeCreateAmbiente() {
    setCreateOpen(false);
    setCreateResponsableOpen(false);
    setCreateResponsableId("");
    setCreateEspacioId("");
    setError(null);
  }

  function closeEditAmbiente() {
    setEditAmbiente(null);
    setEditResponsableOpen(false);
    setEditResponsableId("");
    setEditEspacioId("");
    setError(null);
  }

  const visitaAbierta = visitasActivas.length > 0;
  const sedesEnVisita = visitasActivas
    .map((v) => v.sede_id)
    .filter((id): id is string => Boolean(id));
  const todasEnVisita = visitasActivas.some((v) => !v.sede_id);

  function verAmbientesDeSede(sedeId: string) {
    setSedeFilterId(sedeId);
    setTab("ambientes");
    setBusqueda("");
  }

  useEffect(() => {
    setSedeFilterId(sedeFocus?.id ?? "");
    setBusqueda("");
  }, [entidadId, sedeFocus?.id]);

  const hasLoadedRef = useRef(false);
  const prevEntidadKeyRef = useRef(`${entidad.id}:${sedeFocus?.id ?? ""}`);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    const entidadKey = `${entidad.id}:${sedeFocus?.id ?? ""}`;
    if (prevEntidadKeyRef.current !== entidadKey) {
      prevEntidadKeyRef.current = entidadKey;
      hasLoadedRef.current = false;
    }

    const silent = opts?.silent ?? hasLoadedRef.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [ambList, sedeList, respList, espacioList, visitas, historial] =
        await Promise.all([
          listAmbientesPorEntidad(entidad.id, sedeFocus?.id),
          listSedesConConteo(entidad.id),
          listResponsables(entidad.id),
          listEspaciosPorEntidad(entidad.id),
          getVisitasCampoActivas(entidad.id).catch(() => []),
          listVisitasCampoHistorial(entidad.id).catch(() => []),
        ]);

      const enriched = await attachVisitaEstadoToAmbientes(ambList, entidad.id);
      setAmbientes(enriched);
      setSedes(sedeList);
      setResponsables(respList.data ?? []);
      setVisitasActivas(visitas);
      setVisitasHistorial(historial);
      setEspacios(espacioList);
      hasLoadedRef.current = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudieron cargar los ambientes";
      setError(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [entidad.id, sedeFocus?.id]);

  useEffect(() => {
    setTab(initialTab);
  }, [entidadId, initialTab]);

  useEffect(() => {
    void loadData();
  }, [online, loadData]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onEstructuraRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void loadData({ silent: true });
      }, 400);
    };
    window.addEventListener(ESTRUCTURA_REFRESH_EVENT, onEstructuraRefresh);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(ESTRUCTURA_REFRESH_EVENT, onEstructuraRefresh);
    };
  }, [loadData]);

  async function syncEspaciosEntidad() {
    const list = await listEspaciosPorEntidad(entidad.id);
    setEspacios(list);
  }

  async function reloadManageEspacios() {
    if (!manageEspaciosSedeId) return;
    setManageEspaciosPending(true);
    setManageEspaciosError(null);
    try {
      const data = await listEspacios(manageEspaciosSedeId);
      setManageEspaciosList(data);
    } finally {
      setManageEspaciosPending(false);
    }
  }

  async function syncVisitaYAmbientes() {
    const [visitas, respResult, historial, sedeList, espacioList] = await Promise.all([
      getVisitasCampoActivas(entidad.id),
      listResponsables(entidad.id),
      listVisitasCampoHistorial(entidad.id),
      listSedesConConteo(entidad.id),
      listEspaciosPorEntidad(entidad.id),
    ]);
    const ambList = await listAmbientesPorEntidad(entidad.id, sedeFocus?.id);
    const enriched = await attachVisitaEstadoToAmbientes(ambList, entidad.id);
    setAmbientes(enriched);
    if (!respResult.error) setResponsables(respResult.data ?? []);
    setSedes(sedeList);
    setEspacios(espacioList);
    setVisitasActivas(visitas);
    setVisitasHistorial(historial);
  }

  async function syncAmbientesYResponsables() {
    await syncVisitaYAmbientes();
  }

  function handleAbrirVisita() {
    setAbrirVisitaError(null);
    setAbrirVisitaOpen(true);
  }

  async function confirmarAbrirVisita(sedeId: string | null) {
    setVisitaPending(true);
    setAbrirVisitaError(null);
    const result = await abrirVisitaCampo(entidad.id, sedeId);
    setVisitaPending(false);
    if (result.error) {
      setAbrirVisitaError(result.error);
      return;
    }
    setAbrirVisitaOpen(false);
    setVisitaError(null);
    await syncVisitaYAmbientes();
  }

  async function handleCerrarVisita(visitaId: string) {
    if (!confirm("¿Terminar esta visita de campo? Quedará registrada en el historial.")) return;
    setCerrarPendingId(visitaId);
    setVisitaError(null);
    const result = await cerrarVisitaCampo(visitaId);
    setCerrarPendingId(null);
    if (result.error) {
      setVisitaError(result.error);
      return;
    }
    await syncVisitaYAmbientes();
  }

  async function handleCulminarAmbiente(ambienteId: string) {
    setCulminarPendingId(ambienteId);
    setVisitaError(null);
    const result = await culminarAmbienteVisita(ambienteId);
    setCulminarPendingId(null);
    if (result.error) {
      setVisitaError(result.error);
      return;
    }
    await syncVisitaYAmbientes();
  }

  async function handleVerDetalleVisita(visita: VisitaCampoHistorial) {
    setDetalleVisita(visita);
    setDetalleLoading(true);
    setDetalleAmbientes(null);
    try {
      const detalle = await getVisitaCampoDetalle(visita.id);
      setDetalleAmbientes(detalle);
    } finally {
      setDetalleLoading(false);
    }
  }

  function responsableNombreById(id: string | null) {
    if (!id) return null;
    return responsables.find((r) => r.id === id)?.nombre ?? null;
  }

  async function createResponsableDesdeAmbiente(input: CreateResponsableInput) {
    const result = await createResponsable(entidad.id, input);
    if (result.data) {
      const nuevo: ResponsableConConteo = { ...result.data, ambiente_count: 0 };
      setResponsables((prev) => [...prev, nuevo]);
      return { data: nuevo };
    }
    return { error: result.error };
  }

  const ambientesBase = useMemo(() => {
    if (!sedeFilterId) return ambientes;
    return ambientes.filter((a) => a.sede_id === sedeFilterId);
  }, [ambientes, sedeFilterId]);

  const ambientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ambientesBase;
    return ambientesBase.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        (a.descripcion?.toLowerCase().includes(q) ?? false) ||
        (a.responsable?.toLowerCase().includes(q) ?? false) ||
        (entidadMultiplesSedes && !sedeFiltrada && a.sede_nombre.toLowerCase().includes(q)),
    );
  }, [ambientesBase, busqueda, entidadMultiplesSedes, sedeFiltrada]);

  const gruposPorSede = useMemo(() => {
    const porSede = new Map<string, AmbienteConVisita[]>();
    for (const amb of ambientesFiltrados) {
      const lista = porSede.get(amb.sede_id) ?? [];
      lista.push(amb);
      porSede.set(amb.sede_id, lista);
    }

    return sedes
      .filter((sede) => porSede.has(sede.id))
      .map((sede) => ({
        sede,
        ambientes: porSede.get(sede.id)!,
      }));
  }, [ambientesFiltrados, sedes]);

  function sortAmbientes(rows: AmbienteConVisita[]) {
    return [...rows].sort((a, b) => {
      if (a.sede_es_principal !== b.sede_es_principal) return a.sede_es_principal ? -1 : 1;
      if (a.sede_nombre !== b.sede_nombre) return a.sede_nombre.localeCompare(b.sede_nombre);
      return a.nombre.localeCompare(b.nombre);
    });
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);

    try {
      const input = ambienteFromForm(new FormData(form));
      const sede = sedes.find((s) => s.id === input.sedeId);
      const result = await createAmbiente({
        sedeId: input.sedeId,
        nombre: input.nombre,
        descripcion: input.descripcion,
        responsableId: input.responsableId,
        espacioId: input.espacioId,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const espacioNombre =
        espacios.find((e) => e.id === input.espacioId)?.nombre ?? null;
      const nuevo: AmbienteConVisita = {
        ...result.data!,
        sede_nombre: sede?.nombre ?? "",
        sede_es_principal: sede?.es_principal ?? false,
        espacio_nombre: espacioNombre,
        activo_count: 0,
        visita_estado: visitaAbierta ? "EN_PROCESO" : null,
        responsable:
          result.data?.responsable ??
          responsableNombreById(input.responsableId) ??
          null,
      };
      setAmbientes((prev) => sortAmbientes([...prev, nuevo]));
      setSedes((prev) =>
        prev.map((s) =>
          s.id === input.sedeId ? { ...s, ambiente_count: s.ambiente_count + 1 } : s,
        ),
      );
      setCreateOpen(false);
      form.reset();
      setCreateResponsableId("");
      setCreateEspacioId("");
      void syncAmbientesYResponsables();
    } finally {
      setPending(false);
    }
  }

  async function handleEditAmbiente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editAmbiente) return;
    setPending(true);
    setError(null);

    try {
      const input = ambienteFromForm(new FormData(event.currentTarget));
      const result = await updateAmbiente(editAmbiente.id, input);

      if (result.error) {
        setError(result.error);
        return;
      }

      setAmbientes((prev) =>
        prev.map((a) =>
          a.id === editAmbiente.id
            ? {
                ...a,
                nombre: input.nombre.trim(),
                descripcion: input.descripcion.trim() || null,
                responsable_id: input.responsableId,
                responsable: responsableNombreById(input.responsableId),
                espacio_id: input.espacioId,
                espacio_nombre:
                  espacios.find((e) => e.id === input.espacioId)?.nombre ?? null,
              }
            : a,
        ),
      );
      setEditAmbiente(null);
      void syncAmbientesYResponsables();
    } finally {
      setPending(false);
    }
  }

  async function confirmDeleteAmbiente() {
    if (!deleteTarget) return;
    setPending(true);
    setError(null);

    try {
      const result = await deleteAmbiente(deleteTarget.id);

      if (result.error) {
        setError(result.error);
        return;
      }

      setAmbientes((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setSedes((prev) =>
        prev.map((s) =>
          s.id === deleteTarget.sede_id
            ? { ...s, ambiente_count: Math.max(0, s.ambiente_count - 1) }
            : s,
        ),
      );
      setDeleteTarget(null);
      void syncAmbientesYResponsables();
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={
        !sedeFocus && tab === "inventario"
          ? "flex min-h-0 min-w-0 w-full flex-1 flex-col gap-1"
          : "min-w-0 w-full space-y-4"
      }
    >
      {!drillDown && (
        <PanelPageHeader
          title="Gestión de ambientes"
          subtitle="Administra los ambientes y sucursales de la entidad"
          actions={
            <Button
              type="button"
              disabled={sedes.length === 0}
              onClick={() => {
                setError(null);
                setCreateOpen(true);
              }}
            >
              + Crear ambiente
            </Button>
          }
        />
      )}

      {!drillDown && entidades.length > 1 && onEntidadChange ? (
        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <fieldset className={panelFieldsetClass}>
            <legend className="px-1 text-sm font-semibold text-foreground">Entidad de trabajo</legend>
            <Select
              value={entidadId}
              onChange={onEntidadChange}
              options={entidades.map((e) => ({ value: e.id, label: e.nombre }))}
            />
          </fieldset>
          <PanelBanner
            label="Entidad"
            title={entidad.nombre}
            subtitle={entidad.ruc ? `RUC ${entidad.ruc}` : undefined}
          />
        </div>
      ) : null}

      {!sedeFocus && (
        <PanelTabs
          tabs={entityTabs}
          value={tab}
          onChange={setTab}
          actions={
            <IniciarVisitaCampoButton
              visitas={visitasActivas}
              sedes={sedes.map((s) => ({
                id: s.id,
                nombre: s.nombre,
                es_principal: s.es_principal,
              }))}
              pending={visitaPending}
              onClick={handleAbrirVisita}
            />
          }
        />
      )}

      {!sedeFocus && tab === "inventario" ? (
        <InventarioEntidadView
          entidad={entidad}
          entidades={entidades}
          activos={activos}
          activosLoading={activosLoading}
          online={online}
          onPrintLabel={onPrintLabel}
          onPrintBatch={onPrintBatch}
          onEditActivo={onEditActivo}
          onIrAmbiente={onIrAmbiente}
          onAbrirAmbienteDestino={onAbrirAmbienteDestino}
          onActivoUpdated={onActivoUpdated}
          onActivoDeleted={onActivoDeleted}
          onOpenEliminarPorCodigos={() => setEliminarOpen(true)}
        />
      ) : (
        <>
          {!sedeFocus && tab === "visitas" ? (
            <VisitasCampoHistorialPanel
              historial={visitasHistorial}
              loadingDetalle={detalleLoading}
              detalle={detalleAmbientes}
              detalleVisita={detalleVisita}
              onVerDetalle={handleVerDetalleVisita}
              onCerrarDetalle={() => {
                setDetalleVisita(null);
                setDetalleAmbientes(null);
              }}
            />
          ) : !sedeFocus && tab === "responsables" ? (
            <ResponsablesPanel
              responsables={responsables}
              onCreate={async (input) => {
                const result = await createResponsable(entidad.id, input);
                if (result.data) {
                  await syncAmbientesYResponsables();
                  return { data: { ...result.data, ambiente_count: 0 } };
                }
                return { error: result.error };
              }}
              onUpdate={async (id, input) => {
                const result = await updateResponsable(id, input);
                if (!result.error) await syncAmbientesYResponsables();
                return result;
              }}
              onSetActivo={setResponsableActivo}
              onDelete={deleteResponsable}
              onReload={syncAmbientesYResponsables}
            />
          ) : !sedeFocus && tab === "sucursales" ? (
            <GestionarSucursales
              entidadId={entidad.id}
              sedes={sedes}
              onViewAmbientes={verAmbientesDeSede}
              onEspaciosChange={() => {
                void syncEspaciosEntidad();
              }}
              onSedesChange={(next) => {
                setSedes(next);
                setAmbientes((prev) =>
                  prev.map((a) => {
                    const sede = next.find((s) => s.id === a.sede_id);
                    if (!sede) return a;
                    return {
                      ...a,
                      sede_nombre: sede.nombre,
                      sede_es_principal: sede.es_principal,
                    };
                  }),
                );
                void syncAmbientesYResponsables();
              }}
            />
          ) : (
            <>
              <VisitasCampoBanner
                visitas={visitasActivas}
                puedeGestionar
                cerrarPendingId={cerrarPendingId}
                onCerrar={(id) => void handleCerrarVisita(id)}
                error={visitaError}
              />

              <PanelToolbar
                left={
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <PanelCountLabel
                      count={ambientesFiltrados.length}
                      singular="ambiente"
                      plural="ambientes"
                    />
                    {entidadMultiplesSedes && !sedeFocus && (
                      <SedeAmbienteFilterSelect
                        sedes={sedes}
                        value={sedeFilterId}
                        onChange={setSedeFilterId}
                      />
                    )}
                  </div>
                }
                right={
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <div className="min-w-[200px] flex-1 sm:max-w-sm sm:flex-none">
                      <PanelSearchInput
                        value={busqueda}
                        onChange={setBusqueda}
                        placeholder={
                          ocultarSucursalEnLista
                            ? "Buscar ambiente o responsable…"
                            : "Buscar ambiente, responsable o sucursal…"
                        }
                      />
                    </div>
                    <PanelViewToggle value={viewMode} onChange={setViewMode} />
                    {tab === "ambientes" && (
                      <AmbientesDatosMenu
                        disabled={loading}
                        onAction={(action) => {
                          if (action === "import-ambientes") setImportAmbientesOpen(true);
                          else setImportActivosOpen(true);
                        }}
                        importActivosDisabled={loading || ambientes.length === 0}
                        importActivosDisabledReason={
                          ambientes.length === 0
                            ? "Primero importe o cree ambientes"
                            : undefined
                        }
                      />
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={loading || sedes.length === 0}
                      onClick={() => {
                        setError(null);
                        setCreateOpen(true);
                      }}
                    >
                      + Crear ambiente
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => void loadData()}
                    >
                      Actualizar
                    </Button>
                  </div>
                }
              />

              {error && !createOpen && !editAmbiente && !deleteTarget && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {loading ? (
                <p className="text-sm text-muted-foreground">Cargando ambientes…</p>
              ) : gruposPorSede.length === 0 ? (
                <PanelEmptyState
                  message={
                    busqueda.trim()
                      ? "No hay ambientes que coincidan con la búsqueda."
                      : "No hay ambientes registrados."
                  }
                  action={
                    !busqueda.trim() && sedes.length > 0 ? (
                      <Button type="button" onClick={() => setCreateOpen(true)}>
                        + Crear primer ambiente
                      </Button>
                    ) : undefined
                  }
                />
              ) : viewMode === "list" ? (
                <PanelDataTable layout="auto">
                  <PanelTableColgroup
                    cols={
                      ocultarSucursalEnLista
                        ? visitaAbierta
                          ? AMBIENTES_TABLE_COLS_SIN_SUCURSAL_VISITA
                          : AMBIENTES_TABLE_COLS_SIN_SUCURSAL
                        : visitaAbierta
                          ? AMBIENTES_TABLE_COLS_VISITA
                          : AMBIENTES_TABLE_COLS
                    }
                  />
                  <thead className={panelTableStickyHeadClass}>
                    <tr className={panelTableHeadRowClass}>
                      <PanelTableTh>Ambiente</PanelTableTh>
                      <PanelTableTh className={panelTableNowrapCellClass}>Espacio que ocupa</PanelTableTh>
                      <PanelTableTh>Responsable</PanelTableTh>
                      <PanelTableTh>Descripción</PanelTableTh>
                      {!ocultarSucursalEnLista && <PanelTableTh className={panelTableShrinkCellClass}>Sucursal</PanelTableTh>}
                      <PanelTableTh align="center" className={panelTableShrinkCellClass}>
                        Activos
                      </PanelTableTh>
                      {visitaAbierta && (
                        <PanelTableTh className={panelTableNowrapCellClass}>Visita</PanelTableTh>
                      )}
                      <PanelTableTh className={panelTableNowrapCellClass}>Estado</PanelTableTh>
                      <PanelTableTh align="right" className={panelTableNowrapCellClass}>
                        Acciones
                      </PanelTableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {ambientesFiltrados.map((amb) => (
                      <tr
                        key={amb.id}
                        className={panelTableClickableRowClass}
                        onClick={() => onViewActivos(amb)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onViewActivos(amb);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                      >
                        <PanelTableTd className="font-medium text-primary" title={amb.nombre}>
                          {amb.nombre}
                        </PanelTableTd>
                        <PanelTableTd
                          className={panelTableNowrapCellClass}
                          title={
                            amb.es_preregistro
                              ? "Ambiente de preregistros: no es un local físico"
                              : amb.espacio_nombre ?? undefined
                          }
                        >
                          {etiquetaEspacioAmbiente({
                            esPreregistro: amb.es_preregistro,
                            espacioNombre: amb.espacio_nombre,
                          })}
                        </PanelTableTd>
                        <PanelTableTd title={amb.responsable ?? undefined}>
                          {amb.responsable ?? "—"}
                        </PanelTableTd>
                        <PanelTableTd className="text-muted-foreground" title={amb.descripcion ?? undefined}>
                          {amb.descripcion ?? "—"}
                        </PanelTableTd>
                        {!ocultarSucursalEnLista && (
                          <PanelTableTd className={panelTableShrinkCellClass} title={amb.sede_nombre}>
                            <div onClick={(event) => event.stopPropagation()}>
                              <button
                                type="button"
                                className="truncate font-medium text-primary hover:underline"
                                title="Ver ambientes de esta sucursal"
                                onClick={() => setSedeFilterId(amb.sede_id)}
                              >
                                {amb.sede_nombre}
                              </button>
                            </div>
                          </PanelTableTd>
                        )}
                        <PanelTableTd align="center" className={panelTableShrinkCellClass}>
                          {amb.activo_count}
                        </PanelTableTd>
                        {visitaAbierta && (
                          <PanelTableTd className={panelTableNowrapCellClass}>
                            <div
                              className="flex flex-col items-start gap-1"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <VisitaCampoEstadoBadge estado={amb.visita_estado} />
                              {!amb.es_preregistro && amb.visita_estado === "EN_PROCESO" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  disabled={culminarPendingId === amb.id}
                                  onClick={() => void handleCulminarAmbiente(amb.id)}
                                >
                                  {culminarPendingId === amb.id ? "…" : "Culminar"}
                                </Button>
                              )}
                            </div>
                          </PanelTableTd>
                        )}
                        <PanelTableTd className={panelTableNowrapCellClass}>
                          <StatusBadge variant="active">Activo</StatusBadge>
                        </PanelTableTd>
                        <PanelTableTd
                          align="right"
                          className={`overflow-visible ${panelTableNowrapCellClass}`}
                        >
                          <div onClick={(event) => event.stopPropagation()}>
                            <PanelTableActions
                              onEdit={() => {
                                setError(null);
                                setEditAmbiente(amb);
                              }}
                              onDelete={() => {
                                setError(null);
                                setDeleteTarget(amb);
                              }}
                            />
                          </div>
                        </PanelTableTd>
                      </tr>
                    ))}
                  </tbody>
                </PanelDataTable>
              ) : ocultarSucursalEnLista ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {ambientesFiltrados.map((amb) => (
                    <AmbienteCard
                      key={amb.id}
                      ambiente={amb}
                      entidadNombre={entidad.nombre}
                      onEdit={() => {
                        setError(null);
                        setEditAmbiente(amb);
                      }}
                      onDelete={() => {
                        setError(null);
                        setDeleteTarget(amb);
                      }}
                      onViewActivos={() => onViewActivos(amb)}
                    />
                  ))}
                </div>
              ) : (
            <div className="space-y-8">
              {gruposPorSede.map(({ sede, ambientes: lista }) => (
                <section key={sede.id}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-left text-lg font-bold uppercase tracking-wide text-primary hover:underline"
                      title="Ver ambientes de esta sucursal"
                      onClick={() => setSedeFilterId(sede.id)}
                    >
                      {sede.nombre}
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {lista.length} {lista.length === 1 ? "ambiente" : "ambientes"}
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {lista.map((amb) => (
                      <AmbienteCard
                        key={amb.id}
                        ambiente={amb}
                        entidadNombre={entidad.nombre}
                        onEdit={() => {
                          setError(null);
                          setEditAmbiente(amb);
                        }}
                        onDelete={() => {
                          setError(null);
                          setDeleteTarget(amb);
                        }}
                        onViewActivos={() => onViewActivos(amb)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
            </>
          )}
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={closeCreateAmbiente}
        title="Nuevo ambiente"
        description={
          sedeFiltrada
            ? `Registre un ambiente en ${sedes.find((s) => s.id === sedeFilterId)?.nombre ?? "esta sucursal"}.`
            : !entidadMultiplesSedes
              ? `Registre un ambiente en ${sedes[0]?.nombre ?? "la sucursal principal"}.`
              : "Registre un ambiente en la sucursal que corresponda."
        }
      >
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          <AmbienteFormFields
            sedes={sedes}
            responsables={responsables}
            espacios={espacios}
            defaultSedeId={sedeFilterId || sedeIdSinSelector(sedes) || undefined}
            showSedeSelect={entidadMultiplesSedes}
            responsableId={createResponsableId}
            onResponsableIdChange={setCreateResponsableId}
            onRequestCreateResponsable={() => setCreateResponsableOpen(true)}
            espacioId={createEspacioId}
            onEspacioIdChange={setCreateEspacioId}
            onRequestManageEspacios={(sedeId) => {
              setManageEspaciosError(null);
              setManageEspaciosSedeId(sedeId);
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeCreateAmbiente}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || sedes.length === 0}>
              {pending ? "Guardando…" : "Crear ambiente"}
            </Button>
          </div>
        </form>
      </Dialog>

      <CrearResponsableDialog
        open={createOpen && createResponsableOpen}
        onClose={() => setCreateResponsableOpen(false)}
        onCreate={createResponsableDesdeAmbiente}
        onCreated={(nuevo) => {
          setCreateResponsableId(nuevo.id);
          setCreateResponsableOpen(false);
        }}
      />

      <Dialog
        open={!!editAmbiente}
        onClose={closeEditAmbiente}
        title="Editar ambiente"
        description={editAmbiente?.nombre}
      >
        {editAmbiente && (
          <form onSubmit={(e) => void handleEditAmbiente(e)} className="space-y-4">
            <AmbienteFormFields
              ambiente={editAmbiente}
              sedes={sedes}
              responsables={responsables}
              espacios={espacios}
              responsableId={editResponsableId}
              onResponsableIdChange={setEditResponsableId}
              onRequestCreateResponsable={() => setEditResponsableOpen(true)}
              espacioId={editEspacioId}
              onEspacioIdChange={setEditEspacioId}
              esPreregistro={editAmbiente.es_preregistro}
              onRequestManageEspacios={(sedeId) => {
                setManageEspaciosError(null);
                setManageEspaciosSedeId(sedeId);
              }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeEditAmbiente}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <CrearResponsableDialog
        open={Boolean(editAmbiente) && editResponsableOpen}
        onClose={() => setEditResponsableOpen(false)}
        onCreate={createResponsableDesdeAmbiente}
        onCreated={(nuevo) => {
          setEditResponsableId(nuevo.id);
          setEditResponsableOpen(false);
        }}
      />

      <EspaciosSedeDialog
        open={!!manageEspaciosSedeId}
        onClose={() => {
          setManageEspaciosSedeId(null);
          void syncEspaciosEntidad();
        }}
        sedeNombre={
          sedes.find((s) => s.id === manageEspaciosSedeId)?.nombre ?? "Sucursal"
        }
        espacios={manageEspaciosList}
        pending={manageEspaciosPending}
        error={manageEspaciosError}
        onReload={reloadManageEspacios}
        onCreate={async (nombre) => {
          if (!manageEspaciosSedeId) return { error: "Sucursal no válida." };
          const result = await createEspacio(manageEspaciosSedeId, nombre);
          if (result.error) return { error: result.error };
          return {};
        }}
        onEnsureHasta={async (cantidad) => {
          if (!manageEspaciosSedeId) return { error: "Sucursal no válida." };
          const result = await ensureEspaciosHasta(manageEspaciosSedeId, cantidad);
          if (result.error) return { error: result.error };
          return { creados: result.creados };
        }}
        onDelete={async (espacioId) => {
          const result = await deleteEspacio(espacioId);
          if (result.error) return { error: result.error };
          return {};
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setError(null);
        }}
        title="Eliminar ambiente"
        description={
          deleteTarget
            ? `¿Eliminar el ambiente «${deleteTarget.nombre}»? Solo es posible si no tiene activos registrados.`
            : undefined
        }
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        pending={pending}
        error={deleteTarget ? error : null}
        onConfirm={() => void confirmDeleteAmbiente()}
      />

      <IniciarVisitaCampoDialog
        open={abrirVisitaOpen}
        onClose={() => {
          setAbrirVisitaOpen(false);
          setAbrirVisitaError(null);
        }}
        sedes={sedes.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          es_principal: s.es_principal,
        }))}
        sedesEnVisita={sedesEnVisita}
        todasEnVisita={todasEnVisita}
        pending={visitaPending}
        error={abrirVisitaError}
        onConfirm={(sedeId) => void confirmarAbrirVisita(sedeId)}
      />

      <AmbientesImportDialog
        open={importAmbientesOpen}
        onClose={() => setImportAmbientesOpen(false)}
        entidad={entidad}
        online={online}
        onImported={() => void syncAmbientesYResponsables()}
      />
      <InventarioImportDialog
        open={importActivosOpen}
        onClose={() => setImportActivosOpen(false)}
        entidades={[entidad]}
        fixedEntidad={entidad}
        online={online}
        onImported={() => void syncAmbientesYResponsables()}
      />
      <EliminarActivosPorCodigosDialog
        open={eliminarOpen}
        onClose={() => setEliminarOpen(false)}
        entidades={[entidad]}
        fixedEntidadId={entidad.id}
        onPreview={previewDeleteActivosPorCodigos}
        onDelete={deleteActivosPorCodigos}
        onDeleted={() => void syncAmbientesYResponsables()}
      />
    </div>
  );
}
