import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Activo } from "@inventario/types";
import {
  formatActivoCodigoDisplay,
  formatFechaISOToCortoES,
  formatMonedaPE,
  categoriaBienLetra,
  esActivoPreregistrado,
} from "@inventario/types";
import { Button, useToast } from "@inventario/ui";
import {
  ActivosInventarioTable,
  CopiarBienesSeleccionDialog,
  EliminarPreregistradosBulkDialog,
  EstadoBienBadge,
  fechaAdquisicionToneClass,
  InventarioTablaLeyenda,
  PreregistroGestionToolbar,
  TablePagination,
  inventarioCuentaContable,
  inventarioDepreciacionFila,
  inventarioDescripcion,
  formatInventarioListaTexto,
  panelCardClass,
  panelDataCardsWrapClass,
  panelInventarioBodyScrollClass,
  panelInventarioListClass,
  panelInventarioPaginationFooterClass,
  panelInventarioScrollClass,
  useInventarioSelection,
  useTablePagination,
  type EliminarPreregistradosBulkMode,
  type PreregistroGestionToolbarState,
} from "@inventario/ui/panel";
import { createActivosSimilares, type ActivoConUbicacion } from "../lib/activos";
import { listAmbientes, listSedes } from "../lib/ubicacion";
import type { AmbienteDestinoNavigation } from "./AgregarBienesSimilaresDialog";
import { ActivosCampoAcciones } from "./ActivosCampoAcciones";
import { ComprobanteCell } from "./ComprobanteCell";
import { ComprobanteInline } from "./ComprobanteInline";

function puedeImprimirEtiqueta(activo: Activo): boolean {
  return activo.estado_registro === "REGISTRADO" && Boolean(activo.codigo_barras);
}

function puedeCopiarBien(activo: Activo): boolean {
  return activo.estado_registro !== "DADO_DE_BAJA";
}

export interface GestionPreregistrosConfig {
  alcanceLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  onDeleteActivos: (activos: ActivoConUbicacion[]) => Promise<{ error?: string }>;
  onSuccess?: () => void;
  toolbarPlacement?: "inline" | "header";
  onToolbarStateChange?: (state: PreregistroGestionToolbarState | null) => void;
}

function InfoItem({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value?: string | null;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`truncate text-sm ${valueClassName ?? "text-foreground"}`}>{value?.trim() || "—"}</p>
    </div>
  );
}

function ValorCardItem({ activo }: { activo: Activo }) {
  const esMercado = activo.valor_es_mercado;
  const monto = activo.valor_adquisicion;
  if (monto == null) return <InfoItem label="Precio" />;
  const etiqueta = esMercado ? "VM" : "PA";
  return (
    <InfoItem label="Precio" value={`${etiqueta} S/ ${formatMonedaPE(monto)}`} />
  );
}

function ActivosInventarioMobileCards({
  activos,
  entidadId,
  online,
  emptyMessage,
  onPrintLabel,
  onPrintBatch,
  onEditActivo,
  onIrAmbiente,
  onAbrirAmbienteDestino,
  onActivoUpdated,
  onActivoDeleted,
  onActivoEliminado,
  withSelection,
  withPreregistroSelection,
  selectedIds,
  onToggleSelect,
  puedeSeleccionar,
  mostrarUbicacion = false,
  ubicacionMultiplesSedes = false,
  puedeEliminarPreregistro = false,
  renderVisita,
  procedenciaPorActivo,
}: {
  activos: ActivoConUbicacion[];
  entidadId: string;
  online: boolean;
  emptyMessage?: string;
  onPrintLabel: (activo: ActivoConUbicacion) => void;
  onPrintBatch?: (activos: ActivoConUbicacion[]) => void;
  onEditActivo?: (activo: ActivoConUbicacion) => void;
  onIrAmbiente?: (activo: ActivoConUbicacion) => void;
  onAbrirAmbienteDestino?: (destino: AmbienteDestinoNavigation) => void;
  onActivoUpdated: (activo: ActivoConUbicacion) => void;
  onActivoDeleted?: () => void;
  onActivoEliminado?: (activoId: string) => void;
  withSelection?: boolean;
  withPreregistroSelection?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  puedeSeleccionar?: (activo: ActivoConUbicacion) => boolean;
  mostrarUbicacion?: boolean;
  ubicacionMultiplesSedes?: boolean;
  puedeEliminarPreregistro?: boolean;
  renderVisita?: (activo: ActivoConUbicacion) => ReactNode;
  procedenciaPorActivo?: Record<string, string>;
}) {
  if (activos.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "No hay activos registrados."}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 sm:p-4">
      {activos.map((activo, index) => {
        const descripcion = inventarioDescripcion(activo);
        const inactivo = activo.estado_registro === "DADO_DE_BAJA";
        const { valorNeto } = inventarioDepreciacionFila(activo, inactivo);
        const preregistrado = activo.estado_registro === "PREREGISTRADO";
        const catLetra = categoriaBienLetra(activo.categoria);

        return (
          <article
            key={activo.id}
            className={`${panelCardClass} p-4 ${
              inactivo
                ? "border-red-500/40 bg-red-500/5"
                : preregistrado
                  ? "border-amber-500/40 bg-amber-500/5"
                  : ""
            }`}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              {((withSelection &&
                (puedeSeleccionar ? puedeSeleccionar(activo) : puedeImprimirEtiqueta(activo))) ||
                (withPreregistroSelection && puedeSeleccionar?.(activo))) &&
                selectedIds &&
                onToggleSelect && (
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-input"
                  checked={selectedIds.has(activo.id)}
                  onChange={() => onToggleSelect(activo.id)}
                  aria-label={`Seleccionar ${activo.nombre}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  #{index + 1} · {catLetra} ·{" "}
                  {inactivo
                    ? "Dado de baja"
                    : preregistrado
                      ? "Preregistrado"
                      : formatActivoCodigoDisplay(activo)}
                </p>
                <h3
                  className={`mt-1 text-base font-semibold leading-snug text-foreground ${
                    inactivo ? "line-through decoration-red-400/60" : ""
                  }`}
                >
                  {activo.nombre}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {formatActivoCodigoDisplay(activo)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {inventarioCuentaContable(activo)}
                </p>
              </div>
              <EstadoBienBadge estado={activo.estado_bien} />
            </div>

            {procedenciaPorActivo ? (
              <p className="mb-3 text-xs text-foreground">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                  Viene de:{" "}
                </span>
                {procedenciaPorActivo[activo.id]?.trim() || "—"}
              </p>
            ) : null}

            {renderVisita ? (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Visita
                </span>
                {renderVisita(activo)}
              </div>
            ) : null}

            {descripcion && (
              <p className="mb-3 text-xs leading-snug text-muted-foreground">{descripcion}</p>
            )}

            {mostrarUbicacion && (
              <p className="mb-3 text-xs text-foreground">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                  Ubicación:{" "}
                </span>
                {activo.ambiente_nombre?.trim() || "—"}
                {ubicacionMultiplesSedes && activo.sede_nombre?.trim() ? (
                  <span className="text-[10px] text-muted-foreground">
                    {" "}
                    · {activo.sede_nombre.trim()}
                  </span>
                ) : null}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoItem
                label="Fecha adq."
                value={formatFechaISOToCortoES(activo.fecha_adquisicion)}
                valueClassName={
                  activo.fecha_adquisicion
                    ? fechaAdquisicionToneClass(activo.valor_es_mercado)
                    : undefined
                }
              />
              <ValorCardItem activo={activo} />
              <InfoItem
                label="Valor neto"
                value={valorNeto != null ? `S/ ${formatMonedaPE(valorNeto)}` : undefined}
              />
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                CP:
              </span>
              <ComprobanteInline activo={activo} />
            </div>

            {activo.observacion?.trim() && (
              <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Obs: </span>
                {formatInventarioListaTexto(activo.observacion)}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
              <p className="text-xs text-muted-foreground">Acciones</p>
              <ActivosCampoAcciones
                entidadId={entidadId || activo.entidad_id}
                activo={activo}
                online={online}
                onPrintLabel={onPrintLabel}
                onPrintBatch={onPrintBatch}
                onEdit={onEditActivo}
                onIrAmbiente={onIrAmbiente}
                onAbrirAmbienteDestino={onAbrirAmbienteDestino}
                onValidated={onActivoUpdated}
                onActivoDeleted={onActivoDeleted}
                onActivoEliminado={onActivoEliminado}
                puedeEliminarPreregistro={puedeEliminarPreregistro}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

interface ActivosInventarioExcelViewProps {
  activos: ActivoConUbicacion[];
  entidadId: string;
  online: boolean;
  emptyMessage?: string;
  mostrarPosibleAmbiente?: boolean;
  mostrarUbicacion?: boolean;
  ubicacionMultiplesSedes?: boolean;
  onPrintLabel: (activo: ActivoConUbicacion) => void;
  onActivoUpdated: (activo: ActivoConUbicacion) => void;
  onActivoDeleted?: () => void;
  onPrintBatch?: (activos: ActivoConUbicacion[]) => void;
  onEditActivo?: (activo: ActivoConUbicacion) => void;
  onIrAmbiente?: (activo: ActivoConUbicacion) => void;
  onAbrirAmbienteDestino?: (destino: AmbienteDestinoNavigation) => void;
  onSelectionChange?: (selected: ActivoConUbicacion[]) => void;
  onActivoEliminado?: (activoId: string) => void;
  gestionPreregistros?: GestionPreregistrosConfig;
  layout?: "default" | "global-panel";
  bodyScrollRef?: (node: HTMLDivElement | null) => void;
  toolbar?: ReactNode;
  embeddedInParentScroll?: boolean;
  tableScrollRef?: (node: HTMLDivElement | null) => void;
  className?: string;
  leyendaVisita?: ReactNode;
  renderVisita?: (activo: ActivoConUbicacion) => ReactNode;
  procedenciaPorActivo?: Record<string, string>;
  onCommitSerie?: (
    activo: ActivoConUbicacion,
    serie: string,
  ) => Promise<{ error?: string } | void>;
}

export function ActivosInventarioExcelView({
  activos,
  entidadId,
  online,
  emptyMessage = "No hay activos registrados.",
  mostrarPosibleAmbiente = false,
  mostrarUbicacion = false,
  ubicacionMultiplesSedes = false,
  onPrintLabel,
  onActivoUpdated,
  onActivoDeleted,
  onPrintBatch,
  onEditActivo,
  onIrAmbiente,
  onAbrirAmbienteDestino,
  onSelectionChange,
  onActivoEliminado,
  gestionPreregistros,
  layout = "default",
  bodyScrollRef,
  toolbar,
  embeddedInParentScroll = false,
  tableScrollRef,
  className,
  leyendaVisita,
  renderVisita,
  procedenciaPorActivo,
  onCommitSerie,
}: ActivosInventarioExcelViewProps) {
  const preregistrados = useMemo(() => activos.filter(esActivoPreregistrado), [activos]);
  const gestionEnabled = Boolean(gestionPreregistros && preregistrados.length > 0);
  const puedeEliminarPreregistro = Boolean(gestionPreregistros);
  const printSelectionEnabled = Boolean(onPrintBatch && !mostrarPosibleAmbiente && !gestionEnabled);
  const copiaEnabled = !mostrarPosibleAmbiente;
  const { pushToast } = useToast();
  const [copiarOpen, setCopiarOpen] = useState(false);

  const [bulkDialog, setBulkDialog] = useState<{
    open: boolean;
    mode: EliminarPreregistradosBulkMode;
  }>({ open: false, mode: "seleccionados" });

  const openEliminarSeleccionados = useCallback(
    () => setBulkDialog({ open: true, mode: "seleccionados" }),
    [],
  );
  const openVaciarPreregistrados = useCallback(
    () => setBulkDialog({ open: true, mode: "vaciar" }),
    [],
  );

  const paginationKey = useMemo(
    () => `${activos.length}:${activos[0]?.id ?? ""}`,
    [activos],
  );
  const {
    paginated,
    page,
    setPage,
    setPageSize,
    totalPages,
    total,
    rangeStart,
    rangeEnd,
    pageSize,
    pageSizeOptions,
    rowOffset,
  } = useTablePagination(activos, paginationKey);

  const selectionEnabled = copiaEnabled || gestionEnabled || printSelectionEnabled;
  const puedeMarcarActivo = copiaEnabled
    ? puedeCopiarBien
    : gestionEnabled
      ? esActivoPreregistrado
      : puedeImprimirEtiqueta;

  const {
    selectedIds,
    selectableOnPage,
    allPageSelected,
    toggleSelect,
    toggleSelectAllPage,
    clearSelection,
    selectedActivos,
  } = useInventarioSelection(activos, paginated, puedeMarcarActivo, selectionEnabled);

  const preregSelectedActivos = selectedActivos.filter(esActivoPreregistrado);

  const seleccionFirma = selectedActivos.map((activo) => activo.id).join(",");

  useEffect(() => {
    if (!onSelectionChange) return;
    if (!printSelectionEnabled) {
      onSelectionChange([]);
      return;
    }
    onSelectionChange(selectedActivos.filter(puedeImprimirEtiqueta));
    // seleccionFirma representa los ids marcados; selectedActivos cambia de referencia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionFirma, onSelectionChange, printSelectionEnabled]);

  const preregistroToolbarState = useMemo((): PreregistroGestionToolbarState | null => {
    if (!gestionEnabled || !gestionPreregistros) return null;
    return {
      totalPreregistrados: preregistrados.length,
      selectedCount: preregSelectedActivos.length,
      disabled: gestionPreregistros.disabled,
      disabledReason: gestionPreregistros.disabledReason,
      onEliminarSeleccionados: openEliminarSeleccionados,
      onVaciar: openVaciarPreregistrados,
    };
  }, [
    gestionEnabled,
    gestionPreregistros?.disabled,
    gestionPreregistros?.disabledReason,
    preregistrados.length,
    preregSelectedActivos.length,
    openEliminarSeleccionados,
    openVaciarPreregistrados,
  ]);

  const preregistroToolbar = preregistroToolbarState ? (
    <PreregistroGestionToolbar {...preregistroToolbarState} />
  ) : null;

  const toolbarPlacement =
    gestionPreregistros?.toolbarPlacement ?? (layout === "global-panel" ? "header" : "inline");

  useEffect(() => {
    if (toolbarPlacement !== "header") return;
    gestionPreregistros?.onToolbarStateChange?.(preregistroToolbarState);
    return () => gestionPreregistros?.onToolbarStateChange?.(null);
  }, [toolbarPlacement, gestionPreregistros?.onToolbarStateChange, preregistroToolbarState]);

  const inlinePreregistroToolbar = toolbarPlacement === "inline" ? preregistroToolbar : null;

  const bulkDialogNode =
    gestionEnabled && gestionPreregistros ? (
      <EliminarPreregistradosBulkDialog
        open={bulkDialog.open}
        mode={bulkDialog.mode}
        count={bulkDialog.mode === "vaciar" ? preregistrados.length : preregSelectedActivos.length}
        alcanceLabel={bulkDialog.mode === "vaciar" ? gestionPreregistros.alcanceLabel : undefined}
        onClose={() => setBulkDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={async () => {
          const targets = bulkDialog.mode === "vaciar" ? preregistrados : preregSelectedActivos;
          return gestionPreregistros.onDeleteActivos(targets);
        }}
        onSuccess={() => {
          clearSelection();
          gestionPreregistros.onSuccess?.();
        }}
      />
    ) : null;

  const confirmarCopia = useCallback(
    async (
      items: { id: string; cantidad: number }[],
      ubicacion?: { sedeId: string; ambienteId: string },
    ) => {
      let creados = 0;
      for (const item of items) {
        const result = await createActivosSimilares(item.id, item.cantidad, ubicacion);
        if (result.error) {
          return {
            error:
              creados > 0
                ? `${result.error} Se crearon ${creados} antes de detenerse.`
                : result.error,
          };
        }
        creados += result.data?.creados ?? item.cantidad;
      }
      clearSelection();
      pushToast(
        creados === 1 ? "Se creó 1 copia." : `Se crearon ${creados} copias.`,
        "success",
      );
      onActivoDeleted?.();
      return {};
    },
    [clearSelection, onActivoDeleted, pushToast],
  );

  const copiarBar =
    copiaEnabled && selectedActivos.length > 0 ? (
      <div className="flex justify-end px-3 py-2">
        <Button type="button" size="sm" onClick={() => setCopiarOpen(true)}>
          Copiar ({selectedActivos.length})
        </Button>
      </div>
    ) : null;

  const copiarDialog = copiaEnabled ? (
    <CopiarBienesSeleccionDialog
      open={copiarOpen}
      bienes={selectedActivos.map((activo) => ({
        id: activo.id,
        nombre: activo.nombre,
        codigo: formatActivoCodigoDisplay(activo),
        entidadId: activo.entidad_id,
      }))}
      onClose={() => setCopiarOpen(false)}
      onListSedes={listSedes}
      onListAmbientes={listAmbientes}
      onConfirm={confirmarCopia}
    />
  ) : null;

  const mobileCards = (
    <div className={panelDataCardsWrapClass}>
      <ActivosInventarioMobileCards
        activos={paginated}
        entidadId={entidadId}
        online={online}
        emptyMessage={emptyMessage}
        onPrintLabel={onPrintLabel}
        onPrintBatch={onPrintBatch}
        onEditActivo={onEditActivo}
        onIrAmbiente={onIrAmbiente}
        onAbrirAmbienteDestino={onAbrirAmbienteDestino}
        onActivoUpdated={onActivoUpdated}
        onActivoDeleted={onActivoDeleted}
        onActivoEliminado={onActivoEliminado}
        withSelection={selectionEnabled}
        selectedIds={selectionEnabled ? selectedIds : undefined}
        onToggleSelect={selectionEnabled ? toggleSelect : undefined}
        puedeSeleccionar={selectionEnabled ? puedeMarcarActivo : undefined}
        mostrarUbicacion={mostrarUbicacion}
        ubicacionMultiplesSedes={ubicacionMultiplesSedes}
        puedeEliminarPreregistro={puedeEliminarPreregistro}
        renderVisita={renderVisita}
        procedenciaPorActivo={procedenciaPorActivo}
      />
    </div>
  );

  const tableBlock = (
    <ActivosInventarioTable
      activos={activos}
      paginated={paginated}
      rowOffset={rowOffset}
      emptyMessage={emptyMessage}
      mostrarPosibleAmbiente={mostrarPosibleAmbiente}
      mostrarUbicacion={mostrarUbicacion}
      ubicacionMultiplesSedes={ubicacionMultiplesSedes}
      embeddedInParentScroll={layout === "global-panel" || embeddedInParentScroll}
      tableScrollRef={layout === "global-panel" ? undefined : tableScrollRef}
      selection={
        selectionEnabled
          ? {
              withSelection: true,
              selectedIds,
              selectableOnPage,
              allPageSelected,
              onToggleSelect: toggleSelect,
              onToggleSelectAllPage: toggleSelectAllPage,
              puedeSeleccionar: puedeMarcarActivo,
            }
          : undefined
      }
      renderVisita={renderVisita}
      procedenciaPorActivo={procedenciaPorActivo}
      onCommitSerie={onCommitSerie}
      renderComprobante={(activo) => <ComprobanteCell activo={activo} />}
      renderAcciones={(activo) => (
        <ActivosCampoAcciones
          entidadId={entidadId || activo.entidad_id}
          activo={activo}
          online={online}
          onPrintLabel={onPrintLabel}
          onPrintBatch={onPrintBatch}
          onEdit={onEditActivo}
          onIrAmbiente={onIrAmbiente}
          onAbrirAmbienteDestino={onAbrirAmbienteDestino}
          onValidated={onActivoUpdated}
          onActivoDeleted={onActivoDeleted}
          onActivoEliminado={onActivoEliminado}
          puedeEliminarPreregistro={puedeEliminarPreregistro}
          compact
          variant="icons"
        />
      )}
    />
  );

  const paginationBlock = (
    <TablePagination
      page={page}
      totalPages={totalPages}
      total={total}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      legend={<InventarioTablaLeyenda inline />}
    />
  );

  if (layout === "global-panel") {
    const listClass = className
      ? `${panelInventarioListClass} min-h-0 flex-1 ${className}`
      : `${panelInventarioListClass} min-h-0 flex-1`;

    return (
      <>
        <div className={listClass}>
          <div className={panelInventarioScrollClass}>
            <div ref={bodyScrollRef} className={panelInventarioBodyScrollClass}>
              {toolbar}
              {inlinePreregistroToolbar}
              {copiarBar}
              {leyendaVisita}
              <div className={panelDataCardsWrapClass}>{mobileCards}</div>
              {tableBlock}
            </div>
          </div>
        </div>
        <div className={panelInventarioPaginationFooterClass}>{paginationBlock}</div>
        {bulkDialogNode}
        {copiarDialog}
      </>
    );
  }

  return (
    <div
      className={
        embeddedInParentScroll
          ? "min-w-0 w-full max-w-full"
          : "min-w-0 w-full max-w-full rounded-xl border border-border/60 bg-card shadow-sm"
      }
    >
      {inlinePreregistroToolbar}
      {copiarBar}
      {leyendaVisita}
      {mobileCards}
      {tableBlock}
      {paginationBlock}
      {bulkDialogNode}
      {copiarDialog}
    </div>
  );
}