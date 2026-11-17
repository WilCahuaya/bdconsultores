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
  parseCantidadMenaje,
  parseFechaDDMMYYYY,
  pasoFiltrosColumnaInventario,
  validarFechaDDMMYYYY,
} from "@inventario/types";
import {
  useToast,
  mensajeEliminacionPreregistros,
  AmbienteApartadoNav,
  AmbienteBienesFiltrosMenu,
  MenajeAmbientePanel,
} from "@inventario/ui";
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
import { listProcedenciaFaltanteDetalle } from "@/lib/actions/visitas-campo";
import { FaltanteBienesPanel, useVisitaRevision } from "./VisitaRevisionPanel";
import {
  ActivosInventarioExcelView,
  type CopiarToolbarState,
} from "./ActivosInventarioExcelView";
import { AmbienteReportesExport } from "./AmbienteReportesExport";
import type { FichaAsignacionExportMeta } from "@/lib/actions/ficha-asignacion-meta";
import { fetchAmbientesPorSedeWeb } from "@/lib/ambiente-nav";
import {
  createActivo,
  darDeBajaMenaje,
  deleteActivosPreregistrados,
  eliminarMenaje,
  updateActivo,
  updateActivoSerie,
} from "@/lib/actions/activos";
import { getCatalogoByCodigo } from "@/lib/actions/catalogo";
import { aplicarComprobantesMenaje } from "@/lib/menaje-comprobantes-client";
import { getSignedStorageUrl } from "@/lib/storage-url";
import { buscarCatalogoLocal, ensureCatalogoBusqueda } from "@/lib/catalogo-local";
import {
  ORDEN_INVENTARIO_OPCIONES,
  ordenarActivosInventario,
  type OrdenInventario,
} from "@/lib/inventario-orden";
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
  esAmbienteFaltante?: boolean;
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
  esAmbienteFaltante = false,
  mode = "contador",
}: ActivosAmbientePanelProps) {
  const isAdmin = mode === "admin";
  const router = useRouter();
  const { pushToast } = useToast();
  const [activosList, setActivosList] = useState(activos);
  const [editActivo, setEditActivo] = useState<Activo | null>(null);
  const [copiarToolbar, setCopiarToolbar] = useState<CopiarToolbarState | null>(null);
  const [orden, setOrden] = useState<OrdenInventario>("codigo");
  const [seleccionIds, setSeleccionIds] = useState<string[]>([]);
  const handleCopiarState = useCallback((state: CopiarToolbarState | null) => {
    setCopiarToolbar(state);
  }, []);
  const handleSeleccion = useCallback((ids: string[]) => {
    setSeleccionIds((prev) => {
      if (prev.length === ids.length && prev.every((id, index) => id === ids[index])) return prev;
      return ids;
    });
  }, []);
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

  const guardarSerie = useCallback(
    async (activo: Activo, serie: string) => {
      const result = await updateActivoSerie(activo.id, serie);
      if (result.error) {
        pushToast(result.error);
        return result;
      }
      const value = serie.trim() || null;
      setActivosList((prev) =>
        prev.map((item) => (item.id === activo.id ? { ...item, serie: value } : item)),
      );
    },
    [pushToast],
  );

  const puedeEditarSerie = useCallback(
    (activo: Activo) =>
      activo.estado_registro !== "DADO_DE_BAJA" &&
      (!isAdmin || activo.estado_registro === "PREREGISTRADO"),
    [isAdmin],
  );

  useEffect(() => {
    setEditScope("single");
  }, [editActivo?.id]);
  const [busqueda, setBusqueda] = useState("");
  const [apartado, setApartado] = useState<"bienes" | "menaje">("bienes");
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
  const [procedenciaPorActivo, setProcedenciaPorActivo] = useState<Record<string, string>>({});
  const [origenAmbientePorActivo, setOrigenAmbientePorActivo] = useState<Record<string, string>>({});
  const procedenciaIds = useMemo(
    () => (esAmbienteFaltante ? activosList.map((activo) => activo.id).join(",") : ""),
    [activosList, esAmbienteFaltante],
  );
  useEffect(() => {
    if (isAdmin || !esAmbienteFaltante) {
      setProcedenciaPorActivo({});
      setOrigenAmbientePorActivo({});
      return;
    }
    const ids = procedenciaIds ? procedenciaIds.split(",") : [];
    let cancel = false;
    void listProcedenciaFaltanteDetalle(ids).then((detalle) => {
      if (cancel) return;
      const etiquetas: Record<string, string> = {};
      const origenes: Record<string, string> = {};
      for (const [activoId, item] of Object.entries(detalle)) {
        etiquetas[activoId] = item.etiqueta;
        origenes[activoId] = item.ambienteId;
      }
      setProcedenciaPorActivo(etiquetas);
      setOrigenAmbientePorActivo(origenes);
    });
    return () => {
      cancel = true;
    };
  }, [esAmbienteFaltante, isAdmin, procedenciaIds]);
  const visita = useVisitaRevision({
    entidadId,
    ambienteId,
    activos: activosList.filter((activo) => activo.categoria !== "MENAJE"),
    enabled: !isAdmin && !esAmbientePreregistro && !esAmbienteFaltante,
  });

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
      if (a.categoria === "MENAJE") return false;
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
    const rows = activosBase.filter((a) =>
      pasoFiltrosColumnaInventario(a, columnFilters, {
        aplicarUbicacion: false,
        aplicarCuenta: !isAdmin,
      }),
    );
    return ordenarActivosInventario(rows, orden);
  }, [activosBase, columnFilters, isAdmin, orden]);

  const filtrosResumen = useMemo(() => {
    const partes: string[] = [];
    if (!esAmbientePreregistro && estadoRegistro) {
      const label = FILTROS_ESTADO_AMBIENTE.find((item) => item.value === estadoRegistro)?.label;
      if (label) partes.push(label);
    }
    if (orden !== "codigo") partes.push("Creación");
    if (fechaCorteText !== dateToDDMMYYYY(fechaCorteLocalHoy())) {
      partes.push(fechaCorteText || "fecha");
    }
    return partes.length > 0 ? partes.join(" · ") : null;
  }, [esAmbientePreregistro, estadoRegistro, orden, fechaCorteText]);

  const mostrarMenaje = !isAdmin && !esAmbientePreregistro && !esAmbienteFaltante;
  const menajeLineas = useMemo(
    () =>
      activosList.filter(
        (a) => a.categoria === "MENAJE" && a.estado_registro !== "DADO_DE_BAJA",
      ),
    [activosList],
  );
  const menajeBajas = useMemo(
    () =>
      activosList.filter(
        (a) => a.categoria === "MENAJE" && a.estado_registro === "DADO_DE_BAJA",
      ),
    [activosList],
  );

  const searchMenaje = useCallback(async (query: string, limit?: number) => {
    await ensureCatalogoBusqueda();
    return buscarCatalogoLocal(query, limit);
  }, []);

  const reemplazarMenaje = useCallback((next: Activo) => {
    setActivosList((prev) => {
      const kept = prev.filter((item) => {
        if (item.id === next.id) return false;
        return !(
          item.categoria === "MENAJE" &&
          item.codigo_catalogo === next.codigo_catalogo &&
          item.estado_registro !== "DADO_DE_BAJA"
        );
      });
      return [next, ...kept];
    });
  }, []);

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
        <PanelPageHeader breadcrumbs={listBreadcrumbs} />
        {ambienteResponsable || mostrarMenaje ? (
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            {ambienteResponsable ? (
              <p className="max-w-full shrink-0 pb-1.5 text-sm text-muted-foreground">
                Responsable: {ambienteResponsable}
              </p>
            ) : null}
            {mostrarMenaje ? (
              <AmbienteApartadoNav
                className="flex max-w-full shrink-0 gap-5"
                value={apartado}
                onChange={setApartado}
                menajeCount={menajeLineas.length}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {mostrarMenaje && apartado === "menaje" ? (
        <MenajeAmbientePanel
          lineas={menajeLineas}
          bajas={menajeBajas}
          searchCatalogo={searchMenaje}
          resolveCodigo={getCatalogoByCodigo}
          onVerComprobante={(path) => {
            void getSignedStorageUrl("comprobantes-activos", path).then((result) => {
              if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
            });
          }}
          onAgregar={async (input) => {
            const result = await createActivo({
              entidad_id: entidadId,
              codigo_catalogo: input.codigo,
              nombre: input.nombre,
              categoria: "MENAJE",
              cantidad: input.cantidad,
              material: input.material,
              color: input.color,
              medidas: input.medidas,
              caracteristicas: input.caracteristicas,
              estado_bien: input.estado_bien,
              observacion: input.observacion,
              sede_id: sedeId,
              ambiente_id: ambienteId,
              estado_registro: "REGISTRADO",
            });
            if (result.error || !result.data) {
              return { error: result.error ?? "No se pudo guardar el menaje." };
            }
            const comp = await aplicarComprobantesMenaje({
              entidadId,
              activoId: result.data.id,
              nuevo: input.comprobanteNuevo,
              cambios: input.comprobantesCambio,
            });
            reemplazarMenaje({
              ...result.data,
              ...(comp.comprobantes ? { comprobantes: comp.comprobantes } : {}),
            });
            router.refresh();
            if (comp.error) {
              return {
                aviso: `Menaje registrado. El comprobante no se guardó: ${comp.error}. Edite la fila para cargarlo de nuevo.`,
              };
            }
            return { aviso: result.aviso };
          }}
          onGuardar={async (linea, input) => {
            const comp = await aplicarComprobantesMenaje({
              entidadId,
              activoId: linea.id,
              nuevo: input.comprobanteNuevo,
              cambios: input.comprobantesCambio,
            });
            if (comp.error) return { error: comp.error };
            const result = await updateActivo(linea.id, {
              codigo_catalogo: linea.codigo_catalogo,
              nombre: linea.nombre,
              categoria: "MENAJE",
              cantidad: input.cantidad,
              material: input.material,
              color: input.color,
              medidas: input.medidas,
              caracteristicas: input.caracteristicas,
              estado_bien: input.estado_bien,
              observacion: input.observacion,
              sede_id: sedeId,
              ambiente_id: ambienteId,
            });
            if (result.error || !result.data) {
              return { error: result.error ?? "No se pudo guardar el menaje." };
            }
            reemplazarMenaje({
              ...result.data,
              ...(comp.comprobantes ? { comprobantes: comp.comprobantes } : {}),
            });
            router.refresh();
            return { aviso: result.aviso };
          }}
          onAgregarAdquisicion={async (linea, input) => {
            const total = (linea.cantidad ?? 0) + input.cantidad;
            const tope = parseCantidadMenaje(total);
            if (!tope.cantidad) return { error: tope.error ?? "Cantidad no válida." };
            const comp = await aplicarComprobantesMenaje({
              entidadId,
              activoId: linea.id,
              nuevo: input,
              cambios: [],
            });
            if (comp.error) return { error: comp.error };
            const result = await updateActivo(linea.id, {
              codigo_catalogo: linea.codigo_catalogo,
              nombre: linea.nombre,
              categoria: "MENAJE",
              cantidad: tope.cantidad,
              material: linea.material ?? "",
              color: linea.color ?? "",
              medidas: linea.medidas ?? "",
              caracteristicas: linea.caracteristicas ?? "",
              estado_bien: linea.estado_bien ?? null,
              observacion: linea.observacion ?? "",
              sede_id: sedeId,
              ambiente_id: ambienteId,
            });
            if (result.error || !result.data) {
              return { error: result.error ?? "No se pudo guardar el menaje." };
            }
            reemplazarMenaje({
              ...result.data,
              ...(comp.comprobantes ? { comprobantes: comp.comprobantes } : {}),
            });
            router.refresh();
            return { aviso: `Se sumaron ${input.cantidad}. Total en el ambiente: ${tope.cantidad}.` };
          }}
          onQuitar={async (linea, motivo, cantidad) => {
            const result = await darDeBajaMenaje(linea.id, motivo, cantidad);
            if (!result.error) {
              if (cantidad >= (linea.cantidad ?? 1)) {
                quitarActivos([linea.id]);
              } else {
                setActivosList((prev) =>
                  prev.map((item) =>
                    item.id === linea.id
                      ? { ...item, cantidad: (item.cantidad ?? 1) - cantidad }
                      : item,
                  ),
                );
              }
              router.refresh();
            }
            return { error: result.error, aviso: result.aviso };
          }}
          onEliminar={async (linea) => {
            const result = await eliminarMenaje(linea.id);
            if (!result.error) {
              quitarActivos([linea.id]);
              router.refresh();
            }
            return { error: result.error };
          }}
        />
      ) : null}

      {apartado === "bienes" || !mostrarMenaje ? (
      <>
      {!isAdmin && esAmbienteFaltante ? (
        <FaltanteBienesPanel
          entidadId={entidadId}
          ambienteId={ambienteId}
          activos={activosList.filter((activo) => activo.categoria !== "MENAJE")}
          procedenciaPorActivo={procedenciaPorActivo}
          origenAmbientePorActivo={origenAmbientePorActivo}
        />
      ) : null}

      {showToolbarTrigger && (
        <PanelToolbarExpandTrigger onClick={scrollToToolbar} />
      )}
        <ActivosInventarioExcelView
          className="min-h-0 flex-1"
          layout="global-panel"
          bodyScrollRef={panelScrollRef}
          toolbar={(viewToggle) => (
            <div className={panelInventarioToolbarClass}>
              <div className={panelFilterRowClass} aria-label="Acciones de inventario">
                <div
                  className={`w-full min-w-0 basis-full lg:basis-auto lg:max-w-md lg:flex-1 [&_input]:h-8 [&_input]:py-1 [&_input]:text-sm ${esAmbientePreregistro ? "max-w-none" : ""}`}
                >
                  <PanelSearchInput
                    value={busqueda}
                    onChange={setBusqueda}
                    placeholder="Buscar en nombre, código, cuenta, comprobante, marca…"
                  />
                </div>
                <AmbienteBienesFiltrosMenu
                  resumen={filtrosResumen}
                  estado={
                    esAmbientePreregistro
                      ? undefined
                      : {
                          label: "Estado",
                          value: estadoRegistro,
                          options: FILTROS_ESTADO_AMBIENTE.map((item) => ({
                            value: item.value,
                            label: item.label,
                          })),
                          onChange: (value) => setEstadoRegistro(value as "" | EstadoRegistro),
                        }
                  }
                  orden={{
                    label: "Orden",
                    value: orden,
                    options: ORDEN_INVENTARIO_OPCIONES,
                    onChange: (value) => setOrden(value as OrdenInventario),
                  }}
                  fecha={{
                    id: "ambiente_fecha_corte",
                    value: fechaCorteText,
                    error: fechaCorteError,
                    onChange: (next) => {
                      setFechaCorteText(next);
                      aplicarFechaCorte(next);
                    },
                    onBlur: (value) => aplicarFechaCorte(value, { fromBlur: true }),
                  }}
                />
                {viewToggle}
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
                      selectedIds={seleccionIds}
                    />
                  )}
                  {preregistroHeaderToolbar && (
                    <PreregistroGestionToolbar {...preregistroHeaderToolbar} />
                  )}
                  <span className="panel-count-label hidden text-xs text-muted-foreground lg:inline">
                    {filtrados.length} {filtrados.length === 1 ? "activo" : "activos"}
                  </span>
                  {copiarToolbar && (
                    <button
                      type="button"
                      onClick={copiarToolbar.onOpen}
                      className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90"
                    >
                      Copiar ({copiarToolbar.count})
                    </button>
                  )}
                  <Link
                    href={nuevoHref}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90"
                  >
                    {nuevoLabel}
                  </Link>
                </div>
              </div>
            </div>
          )}
          activos={filtrados}
          onEditActivo={setEditActivo}
          puedeDarDeBaja={!isAdmin && !esAmbientePreregistro}
          puedeValidarPreregistro={!isAdmin && esAmbientePreregistro}
          puedeEliminarPreregistro={esAmbientePreregistro}
          puedeMoverDesdeFaltante={!isAdmin && esAmbienteFaltante}
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
          leyendaVisita={visita.activa ? visita.leyenda : null}
          renderVisita={visita.activa ? visita.renderCelda : undefined}
          procedenciaPorActivo={esAmbienteFaltante ? procedenciaPorActivo : undefined}
          onCopiarStateChange={handleCopiarState}
          onSeleccionChange={handleSeleccion}
          onCommitSerie={guardarSerie}
          puedeEditarSerie={puedeEditarSerie}
        />
      </>
      ) : null}
    </div>
  );
}
