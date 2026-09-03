"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Activo, CreateResponsableInput, Entidad, ResponsableConConteo, SedeConConteo, VisitaCampoActiva, VisitaCampoHistorial } from "@inventario/types";
import { entidadMuestraSelectorSede, sedeIdSinSelector } from "@inventario/types";
import { Button, CrearResponsableDialog, Dialog, EspaciosSedeDialog, ResponsablesPanel } from "@inventario/ui";
import {
  DeleteIcon,
  PanelDataTable,
  PanelIconAction,
  PanelTableActions,
  PanelTableColgroup,
  PanelTableTd,
  PanelTableTh,
  PanelTabs,
  PanelViewToggle,
  AMBIENTES_TABLE_COLS,
  AMBIENTES_TABLE_COLS_SIN_SUCURSAL,
  AMBIENTES_TABLE_COLS_VISITA,
  AMBIENTES_TABLE_COLS_SIN_SUCURSAL_VISITA,
  panelTableClickableRowClass,
  panelTableHeadRowClass,
  panelTableShrinkCellClass,
  panelTableStickyHeadClass,
  panelTableNowrapCellClass,
  useStoredViewMode,
  SedeAmbienteFilterSelect,
  VisitaCampoEstadoBadge,
  VisitasCampoBanner,
  VisitasCampoHistorialPanel,
  IniciarVisitaCampoDialog,
  IniciarVisitaCampoButton,
  AmbientesDatosMenu,
} from "@inventario/ui/panel";
import type { AmbienteConSede } from "@/lib/actions/ubicacion";
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
} from "@/lib/actions/ubicacion";
import type { Espacio, EspacioConOcupacion } from "@inventario/types";
import type { AmbienteConVisita } from "@/lib/actions/visitas-campo";
import {
  abrirVisitaCampo,
  attachVisitaEstadoToAmbientes,
  cerrarVisitaCampo,
  culminarAmbienteVisita,
  getVisitasCampoActivas,
  getVisitaCampoDetalle,
  listVisitasCampoHistorial,
} from "@/lib/actions/visitas-campo";
import {
  createResponsable,
  deleteResponsable,
  listResponsables,
  setResponsableActivo,
  updateResponsable,
} from "@/lib/actions/responsables";
import { AmbienteFormFields, ambienteFromForm, etiquetaEspacioAmbiente } from "./AmbienteFormFields";
import { AmbientesImportDialog } from "./AmbientesImportDialog";
import { InventarioImportDialog } from "./InventarioImportDialog";
import {
  deleteActivosPorCodigos,
  previewDeleteActivosPorCodigos,
} from "@/lib/actions/activos";
import { EliminarActivosPorCodigosDialog } from "@inventario/ui";
import { GestionarSucursales } from "./GestionarSucursales";
import { InventarioGlobalPanel } from "./InventarioGlobalPanel";
import {
  EditIcon,
  PanelCountLabel,
  PanelEmptyState,
  PanelPageHeader,
  PanelSearchInput,
  PanelToolbar,
  StatusBadge,
  panelCardClass,
} from "./panel-ui";

type EntityTab = "inventario" | "ambientes" | "responsables" | "sucursales" | "visitas";

const ENTITY_TABS: { id: EntityTab; label: string }[] = [
  { id: "inventario", label: "Inventario" },
  { id: "ambientes", label: "Ambientes" },
  { id: "responsables", label: "Responsables" },
  { id: "sucursales", label: "Sucursales" },
  { id: "visitas", label: "Visitas de campo" },
];

function parseInitialTab(value?: string): EntityTab {
  if (
    value === "ambientes" ||
    value === "responsables" ||
    value === "sucursales" ||
    value === "visitas"
  ) {
    return value;
  }
  return "inventario";
}

type AmbienteRow = AmbienteConVisita;

interface AmbientesPanelProps {
  entidad: Entidad;
  ambientes: AmbienteRow[];
  sedes: SedeConConteo[];
  responsables: ResponsableConConteo[];
  activos?: Activo[];
  visitasActivas?: VisitaCampoActiva[];
  visitasHistorial?: VisitaCampoHistorial[];
  initialTab?: EntityTab;
  /** Vista filtrada a una sucursal concreta */
  sedeFocus?: { id: string; nombre: string } | null;
  panelMode?: "contador" | "admin";
}

interface AmbienteCardProps {
  ambiente: AmbienteRow;
  entidadNombre: string;
  activosHref: string;
  onEdit: () => void;
  onDelete: () => void;
}

function AmbienteCard({ ambiente, entidadNombre, activosHref, onEdit, onDelete }: AmbienteCardProps) {
  const espacioLabel = etiquetaEspacioAmbiente({
    esPreregistro: ambiente.es_preregistro,
    espacioNombre: ambiente.espacio_nombre,
  });
  return (
    <article className={`${panelCardClass} flex flex-col overflow-hidden`}>
      <Link
        href={activosHref}
        className="flex flex-1 flex-col outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
          <h3 className="font-semibold leading-snug text-primary">{ambiente.nombre}</h3>
          <StatusBadge variant="active">Activo</StatusBadge>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            {ambiente.responsable ?? "Sin responsable asignado"}
          </p>
          <p className="text-sm text-muted-foreground" title={ambiente.es_preregistro ? "Ambiente de preregistros: no es un local físico" : undefined}>
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
      </Link>

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

export function AmbientesPanel({
  entidad,
  ambientes: initial,
  sedes: initialSedes,
  responsables: initialResponsables,
  activos = [],
  visitasActivas: initialVisitasActivas = [],
  visitasHistorial: initialVisitasHistorial = [],
  initialTab = "inventario",
  sedeFocus = null,
  panelMode = "contador",
}: AmbientesPanelProps) {
  const isAdmin = panelMode === "admin";
  const entidadHref = isAdmin ? "/admin/activos" : `/contador/entidades/${entidad.id}`;
  const sedeHref = (sedeId: string) =>
    isAdmin
      ? `/admin/sedes/${sedeId}`
      : `/contador/entidades/${entidad.id}/sedes/${sedeId}`;
  const activoHref = (ambienteId: string) =>
    isAdmin ? `/admin/ambientes/${ambienteId}` : `/contador/entidades/${entidad.id}/ambientes/${ambienteId}`;
  const router = useRouter();
  const [tab, setTab] = useState<EntityTab>(parseInitialTab(initialTab));

  function handleTabChange(next: EntityTab) {
    setTab(next);
    if (sedeFocus) return;
    const path = entidadHref;
    router.replace(next === "inventario" ? path : `${path}?tab=${next}`, { scroll: false });
  }

  const [ambientes, setAmbientes] = useState(initial);
  const [sedes, setSedes] = useState(initialSedes);
  const [responsables, setResponsables] = useState(initialResponsables);
  const [busqueda, setBusqueda] = useState("");
  const [sedeFilterId, setSedeFilterId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createResponsableOpen, setCreateResponsableOpen] = useState(false);
  const [createResponsableId, setCreateResponsableId] = useState("");
  const [createEspacioId, setCreateEspacioId] = useState("");
  const [editResponsableOpen, setEditResponsableOpen] = useState(false);
  const [editResponsableId, setEditResponsableId] = useState("");
  const [editEspacioId, setEditEspacioId] = useState("");
  const [editAmbiente, setEditAmbiente] = useState<AmbienteRow | null>(null);
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [manageEspaciosSedeId, setManageEspaciosSedeId] = useState<string | null>(null);
  const [manageEspaciosList, setManageEspaciosList] = useState<EspacioConOcupacion[]>([]);
  const [manageEspaciosPending, setManageEspaciosPending] = useState(false);
  const [manageEspaciosError, setManageEspaciosError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useStoredViewMode("inventario-view-ambientes", "list");
  const [visitasActivas, setVisitasActivas] = useState(initialVisitasActivas);
  const [visitasHistorial, setVisitasHistorial] = useState(initialVisitasHistorial);

  useEffect(() => {
    setAmbientes(initial);
  }, [initial]);
  useEffect(() => {
    setSedes(initialSedes);
  }, [initialSedes]);
  useEffect(() => {
    setResponsables(initialResponsables);
  }, [initialResponsables]);
  useEffect(() => {
    void listEspaciosPorEntidad(entidad.id).then(setEspacios);
  }, [entidad.id]);
  useEffect(() => {
    setVisitasActivas(initialVisitasActivas);
  }, [initialVisitasActivas]);
  useEffect(() => {
    setVisitasHistorial(initialVisitasHistorial);
  }, [initialVisitasHistorial]);

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

  const puedeGestionarVisita = panelMode === "contador";
  const visitaAbierta = visitasActivas.length > 0;
  const sedesEnVisita = visitasActivas
    .map((v) => v.sede_id)
    .filter((id): id is string => Boolean(id));
  const todasEnVisita = visitasActivas.some((v) => !v.sede_id);

  const sedeActivaId = sedeFocus?.id ?? sedeFilterId;
  const sedeFiltrada = Boolean(sedeActivaId);
  const entidadMultiplesSedes = entidadMuestraSelectorSede(sedes);
  const ocultarSucursalEnLista = !entidadMultiplesSedes || sedeFiltrada;

  // Siempre mostrar tab Sucursales: con 0–1 sede también hay que poder crear/gestionar.
  const entityTabs = ENTITY_TABS;

  useEffect(() => {
    setSedeFilterId("");
    setBusqueda("");
  }, [entidad.id, sedeFocus?.id]);

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

  async function syncEspaciosEntidad() {
    const list = await listEspaciosPorEntidad(entidad.id);
    setEspacios(list);
  }

  async function reloadManageEspacios() {
    if (!manageEspaciosSedeId) return;
    setManageEspaciosPending(true);
    setManageEspaciosError(null);
    const data = await listEspacios(manageEspaciosSedeId);
    setManageEspaciosList(data);
    setManageEspaciosPending(false);
  }

  async function syncVisitaYAmbientes() {
    const [visitas, historial, ambList] = await Promise.all([
      getVisitasCampoActivas(entidad.id),
      listVisitasCampoHistorial(entidad.id),
      listAmbientesPorEntidad(entidad.id, sedeFocus?.id),
    ]);
    const enriched = await attachVisitaEstadoToAmbientes(ambList, entidad.id);
    setVisitasActivas(visitas);
    setVisitasHistorial(historial);
    setAmbientes(enriched);
    router.refresh();
  }

  async function syncAmbientesYResponsables() {
    const [ambList, respList, sedeList, espacioList] = await Promise.all([
      listAmbientesPorEntidad(entidad.id, sedeFocus?.id),
      listResponsables(entidad.id),
      listSedesConConteo(entidad.id),
      listEspaciosPorEntidad(entidad.id),
    ]);
    const enriched = await attachVisitaEstadoToAmbientes(ambList, entidad.id);
    setAmbientes(enriched);
    setResponsables(respList);
    setSedes(sedeList);
    setEspacios(espacioList);
    router.refresh();
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
    if (!confirm("¿Cerrar esta visita de campo? Quedará registrada en el historial.")) return;
    setCerrarPendingId(visitaId);
    setVisitaError(null);
    const result = await cerrarVisitaCampo(visitaId, entidad.id);
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
    const result = await culminarAmbienteVisita(ambienteId, entidad.id);
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
    const detalle = await getVisitaCampoDetalle(visita.id);
    setDetalleAmbientes(detalle);
    setDetalleLoading(false);
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
    if (!sedeActivaId) return ambientes;
    return ambientes.filter((a) => a.sede_id === sedeActivaId);
  }, [ambientes, sedeActivaId]);

  const ambientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ambientesBase;
    return ambientesBase.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        (a.descripcion?.toLowerCase().includes(q) ?? false) ||
        (a.responsable?.toLowerCase().includes(q) ?? false) ||
        (a.espacio_nombre?.toLowerCase().includes(q) ?? false) ||
        (entidadMultiplesSedes && !sedeFiltrada && a.sede_nombre.toLowerCase().includes(q)),
    );
  }, [ambientesBase, busqueda, entidadMultiplesSedes, sedeFiltrada]);

  const gruposPorSede = useMemo(() => {
    const porSede = new Map<string, AmbienteRow[]>();
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

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);

    const input = ambienteFromForm(new FormData(form));
    const sede = sedes.find((s) => s.id === input.sedeId);
    const result = await createAmbiente({
      sedeId: input.sedeId,
      nombre: input.nombre,
      descripcion: input.descripcion,
      responsableId: input.responsableId,
      espacioId: input.espacioId,
    });

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    const espacioNombre =
      espacios.find((e) => e.id === input.espacioId)?.nombre ?? null;
    const nuevo: AmbienteRow = {
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
    setAmbientes((prev) =>
      [...prev, nuevo].sort((a, b) => {
        if (a.sede_es_principal !== b.sede_es_principal) return a.sede_es_principal ? -1 : 1;
        if (a.sede_nombre !== b.sede_nombre) return a.sede_nombre.localeCompare(b.sede_nombre);
        return a.nombre.localeCompare(b.nombre);
      }),
    );
    setSedes((prev) =>
      prev.map((s) =>
        s.id === input.sedeId ? { ...s, ambiente_count: s.ambiente_count + 1 } : s,
      ),
    );
    setCreateOpen(false);
    form.reset();
    setCreateResponsableId("");
    setCreateEspacioId("");
    await syncAmbientesYResponsables();
    router.refresh();
  }

  async function handleEditAmbiente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editAmbiente) return;
    setPending(true);
    setError(null);

    const input = ambienteFromForm(new FormData(event.currentTarget));
    const result = await updateAmbiente(editAmbiente.id, input);

    setPending(false);
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
    await syncAmbientesYResponsables();
    router.refresh();
  }

  async function handleDeleteAmbiente(amb: AmbienteRow) {
    if (!confirm(`¿Eliminar el ambiente "${amb.nombre}"?`)) return;
    setError(null);

    const result = await deleteAmbiente(amb.id);
    if (result.error) {
      setError(result.error);
      return;
    }

    setAmbientes((prev) => prev.filter((a) => a.id !== amb.id));
    setSedes((prev) =>
      prev.map((s) =>
        s.id === amb.sede_id ? { ...s, ambiente_count: Math.max(0, s.ambiente_count - 1) } : s,
      ),
    );
    await syncAmbientesYResponsables();
    router.refresh();
  }

  function verAmbientesDeSede(sedeId: string) {
    setSedeFilterId(sedeId);
    setTab("ambientes");
    setBusqueda("");
  }

  const breadcrumbs = sedeFocus
    ? isAdmin
      ? [
          { label: "Ambientes", href: entidadHref },
          { label: sedeFocus.nombre },
        ]
      : [
          { label: "Entidades", href: "/contador/entidades" },
          { label: entidad.nombre, href: entidadHref },
          { label: sedeFocus.nombre },
        ]
    : isAdmin
      ? [{ label: "Ambientes" }]
      : [
          { label: "Entidades", href: "/contador/entidades" },
          { label: entidad.nombre },
        ];

  return (
    <div
      className={
        !sedeFocus && tab === "inventario"
          ? "flex min-h-0 flex-1 flex-col gap-1"
          : "space-y-4"
      }
    >
      <PanelPageHeader
        breadcrumbs={breadcrumbs}
        subtitle={
          sedeFocus
            ? `Ambientes de la sucursal · ${sedeFocus.nombre}`
            : entidad.ruc
              ? `RUC ${entidad.ruc} · Inventario, ambientes y sucursales`
              : "Inventario, ambientes y sucursales"
        }
      />

      {!sedeFocus && (
        <PanelTabs
          tabs={entityTabs}
          value={tab}
          onChange={handleTabChange}
          actions={
            puedeGestionarVisita ? (
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
            ) : undefined
          }
        />
      )}

      {!sedeFocus && tab === "inventario" ? (
        <InventarioGlobalPanel
          mode={isAdmin ? "admin" : "contador"}
          entidades={[entidad]}
          activos={activos}
          fixedEntidadId={entidad.id}
          fixedEntidadNombre={entidad.nombre}
          embeddedInEntityPage
          entityPageHref={entidadHref}
          onOpenEliminarPorCodigos={!isAdmin ? () => setEliminarOpen(true) : undefined}
        />
      ) : !sedeFocus && tab === "visitas" ? (
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
              return {
                data: { ...result.data, ambiente_count: 0 },
              };
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
            void syncAmbientesYResponsables();
          }}
        />
      ) : (
        <>
      {!sedeFocus && (
        <VisitasCampoBanner
          visitas={visitasActivas}
          puedeGestionar={puedeGestionarVisita}
          cerrarPendingId={cerrarPendingId}
          onCerrar={handleCerrarVisita}
          error={visitaError}
        />
      )}

      <PanelToolbar
        left={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <PanelCountLabel
              count={ambientesFiltrados.length}
              singular="ambiente"
              plural="ambientes"
            />
            {!sedeFocus && entidadMultiplesSedes && (
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
            {!isAdmin && tab === "ambientes" && (
              <AmbientesDatosMenu
                onAction={(action) => {
                  if (action === "import-ambientes") setImportAmbientesOpen(true);
                  else setImportActivosOpen(true);
                }}
                importActivosDisabled={ambientes.length === 0}
                importActivosDisabledReason="Primero importe o cree ambientes"
              />
            )}
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              + Crear ambiente
            </Button>
          </div>
        }
      />

      {error && !createOpen && !editAmbiente && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {gruposPorSede.length === 0 ? (
        <PanelEmptyState
          message={
            busqueda.trim() || sedeFilterId
              ? "No hay ambientes que coincidan con la búsqueda o el filtro."
              : "No hay ambientes registrados."
          }
          action={
            !busqueda.trim() ? (
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
                onClick={() => router.push(activoHref(amb.id))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(activoHref(amb.id));
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
                      {puedeGestionarVisita &&
                        !amb.es_preregistro &&
                        amb.visita_estado === "EN_PROCESO" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={culminarPendingId === amb.id}
                            onClick={() => handleCulminarAmbiente(amb.id)}
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
                <PanelTableTd align="right" className={`overflow-visible ${panelTableNowrapCellClass}`}>
                  <div onClick={(event) => event.stopPropagation()}>
                    <PanelTableActions
                      onEdit={() => {
                        setError(null);
                        setEditAmbiente(amb);
                      }}
                      onDelete={() => handleDeleteAmbiente(amb)}
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
              activosHref={activoHref(amb.id)}
              onEdit={() => {
                setError(null);
                setEditAmbiente(amb);
              }}
              onDelete={() => handleDeleteAmbiente(amb)}
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
                    activosHref={activoHref(amb.id)}
                    onEdit={() => {
                      setError(null);
                      setEditAmbiente(amb);
                    }}
                    onDelete={() => handleDeleteAmbiente(amb)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={closeCreateAmbiente}
        title="Nuevo ambiente"
        description={
          sedeFocus
            ? `Registre un ambiente en ${sedeFocus.nombre}.`
            : !entidadMultiplesSedes
              ? `Registre un ambiente en ${sedes[0]?.nombre ?? "la sucursal principal"}.`
              : "Registre un ambiente en la sucursal que corresponda."
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <AmbienteFormFields
            sedes={sedes}
            responsables={responsables}
            espacios={espacios}
            defaultSedeId={sedeActivaId || sedeIdSinSelector(sedes) || undefined}
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
            <Button type="submit" disabled={pending}>
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
          <form onSubmit={handleEditAmbiente} className="space-y-4">
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
        onConfirm={confirmarAbrirVisita}
      />

      {!isAdmin && (
        <>
          <AmbientesImportDialog
            open={importAmbientesOpen}
            onClose={() => setImportAmbientesOpen(false)}
            entidad={entidad}
            onImported={() => void syncAmbientesYResponsables()}
          />
          <InventarioImportDialog
            open={importActivosOpen}
            onClose={() => setImportActivosOpen(false)}
            entidades={[entidad]}
            fixedEntidad={entidad}
            onImported={() => void syncAmbientesYResponsables()}
          />
          <EliminarActivosPorCodigosDialog
            open={eliminarOpen}
            onClose={() => setEliminarOpen(false)}
            entidades={[entidad]}
            fixedEntidadId={entidad.id}
            onPreview={previewDeleteActivosPorCodigos}
            onDelete={deleteActivosPorCodigos}
            onDeleted={() => {
              void syncAmbientesYResponsables();
              router.refresh();
            }}
          />
        </>
      )}

    </div>
  );
}
