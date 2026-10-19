"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Activo, InventarioColumnFilterOptions, InventarioColumnFilters } from "@inventario/types";
import { esActivoPreregistrado, formatActivoCodigoDisplay } from "@inventario/types";
import { Button, useToast } from "@inventario/ui";
import {
  ActivosInventarioTable,
  CopiarBienesSeleccionDialog,
  EliminarPreregistradosBulkDialog,
  InventarioTablaLeyenda,
  PanelViewToggle,
  PreregistroGestionToolbar,
  TablePagination,
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
import { createActivosSimilares } from "@/lib/actions/activos";
import { listAmbientes, listSedes } from "@/lib/actions/ubicacion";
import { ActivoAccionesBar } from "./ActivoAccionesBar";
import { ActivosInventarioMobileCards } from "./ActivosInventarioMobileCards";
import { ComprobanteCell } from "./ComprobanteCell";

export interface CopiarToolbarState {
  count: number;
  onOpen: () => void;
}

export interface GestionPreregistrosConfig {
  alcanceLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  onDeleteActivos: (activos: Activo[]) => Promise<{ error?: string }>;
  onSuccess?: () => void;
  /** Por defecto: `header` en layout global-panel, `inline` en el resto. */
  toolbarPlacement?: "inline" | "header";
  onToolbarStateChange?: (state: PreregistroGestionToolbarState | null) => void;
}

interface ActivosInventarioExcelViewProps {
  activos: Activo[];
  onEditActivo: (activo: Activo) => void;
  onIrAmbiente?: (activo: Activo) => void;
  puedeDarDeBaja?: boolean;
  puedeValidarPreregistro?: boolean;
  puedeEliminarPreregistro?: boolean;
  puedeMoverDesdeFaltante?: boolean;
  gestionPreregistros?: GestionPreregistrosConfig;
  onActivoEliminado?: (activoId: string) => void;
  editarLabel?: string;
  mostrarEstadoRegistro?: boolean;
  mostrarPosibleAmbiente?: boolean;
  mostrarUbicacion?: boolean;
  ubicacionMultiplesSedes?: boolean;
  emptyActionLabel?: string;
  modoAdmin?: boolean;
  layout?: "default" | "global-panel";
  bodyScrollRef?: (node: HTMLDivElement | null) => void;
  toolbar?: ReactNode | ((viewToggle: ReactNode) => ReactNode);
  embeddedInParentScroll?: boolean;
  tableScrollRef?: (node: HTMLDivElement | null) => void;
  className?: string;
  columnFilters?: InventarioColumnFilters;
  onColumnFiltersChange?: (next: InventarioColumnFilters) => void;
  columnFilterOptions?: InventarioColumnFilterOptions;
  /** Fecha de corte para depreciación / valor neto (por defecto: hoy). */
  fechaCorte?: Date;
  leyendaVisita?: ReactNode;
  renderVisita?: (activo: Activo) => ReactNode;
  procedenciaPorActivo?: Record<string, string>;
  /** Si se informa, el botón Copiar lo pinta el padre (barra de Nuevo activo). */
  onCopiarStateChange?: (state: CopiarToolbarState | null) => void;
  /** Ids marcados, para imprimir solo esos en orden de código. */
  onSeleccionChange?: (ids: string[]) => void;
}

function puedeCopiarBien(activo: Activo): boolean {
  return activo.estado_registro !== "DADO_DE_BAJA";
}

function excelViewShellClass(embeddedInParentScroll: boolean): string {
  return embeddedInParentScroll
    ? "min-w-0 w-full max-w-full"
    : "min-w-0 w-full max-w-full rounded-xl border border-border/60 bg-card shadow-sm";
}

export function ActivosInventarioExcelView({
  activos,
  onEditActivo,
  onIrAmbiente,
  puedeDarDeBaja = true,
  puedeValidarPreregistro = false,
  puedeEliminarPreregistro = false,
  puedeMoverDesdeFaltante = false,
  gestionPreregistros,
  onActivoEliminado,
  editarLabel,
  mostrarEstadoRegistro = false,
  mostrarPosibleAmbiente = false,
  mostrarUbicacion = false,
  ubicacionMultiplesSedes = false,
  emptyActionLabel = "+ Nuevo activo",
  modoAdmin = false,
  layout = "default",
  bodyScrollRef,
  toolbar,
  embeddedInParentScroll = false,
  tableScrollRef,
  className,
  columnFilters,
  onColumnFiltersChange,
  columnFilterOptions,
  fechaCorte,
  leyendaVisita,
  renderVisita,
  procedenciaPorActivo,
  onCopiarStateChange,
  onSeleccionChange,
}: ActivosInventarioExcelViewProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [copiarOpen, setCopiarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const cardsWrapClass = `${panelDataCardsWrapClass}${viewMode === "cards" ? " is-active" : ""}`;
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

  const preregistrados = useMemo(() => activos.filter(esActivoPreregistrado), [activos]);
  const gestionEnabled = Boolean(
    gestionPreregistros && puedeEliminarPreregistro && preregistrados.length > 0,
  );
  const copiaEnabled = !mostrarPosibleAmbiente;
  const selectionEnabled = copiaEnabled || gestionEnabled;
  const puedeMarcarActivo = copiaEnabled ? puedeCopiarBien : esActivoPreregistrado;

  const {
    selectedIds,
    selectableOnPage,
    allPageSelected,
    toggleSelect,
    toggleSelectAllPage,
    clearSelection,
    selectedActivos,
  } = useInventarioSelection(activos, paginated, puedeMarcarActivo, selectionEnabled);

  const preregSeleccionados = selectedActivos.filter(esActivoPreregistrado);

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

  const accionesProps = {
    puedeDarDeBaja,
    puedeValidarPreregistro,
    puedeEliminarPreregistro,
    puedeMoverDesdeFaltante,
    editarLabel,
    modoAdmin,
  };

  const emptyMessage =
    activos.length === 0
      ? `No hay activos registrados. Use «${emptyActionLabel}» para agregar el primero.`
      : "";

  const toolbarPlacement =
    gestionPreregistros?.toolbarPlacement ?? (layout === "global-panel" ? "header" : "inline");

  const preregistroToolbarState = useMemo((): PreregistroGestionToolbarState | null => {
    if (!gestionEnabled || !gestionPreregistros) return null;
    return {
      totalPreregistrados: preregistrados.length,
      selectedCount: preregSeleccionados.length,
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
    preregSeleccionados.length,
    openEliminarSeleccionados,
    openVaciarPreregistrados,
  ]);

  const preregistroToolbar = preregistroToolbarState ? (
    <PreregistroGestionToolbar {...preregistroToolbarState} />
  ) : null;

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
        count={bulkDialog.mode === "vaciar" ? preregistrados.length : preregSeleccionados.length}
        alcanceLabel={bulkDialog.mode === "vaciar" ? gestionPreregistros.alcanceLabel : undefined}
        onClose={() => setBulkDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={async () => {
          const targets = bulkDialog.mode === "vaciar" ? preregistrados : preregSeleccionados;
          return gestionPreregistros.onDeleteActivos(targets);
        }}
        onSuccess={() => {
          clearSelection();
          gestionPreregistros.onSuccess?.();
        }}
      />
    ) : null;

  const tableBlock = (
    <ActivosInventarioTable
      activos={activos}
      paginated={paginated}
      rowOffset={rowOffset}
      emptyMessage={emptyMessage}
      mostrarEstadoRegistro={mostrarEstadoRegistro}
      mostrarPosibleAmbiente={mostrarPosibleAmbiente}
      mostrarUbicacion={mostrarUbicacion}
      ubicacionMultiplesSedes={ubicacionMultiplesSedes}
      modoAdmin={modoAdmin}
      columnFilters={columnFilters}
      onColumnFiltersChange={onColumnFiltersChange}
      columnFilterOptions={columnFilterOptions}
      fechaCorte={fechaCorte}
      renderVisita={renderVisita}
      procedenciaPorActivo={procedenciaPorActivo}
      embeddedInParentScroll={layout === "global-panel" || embeddedInParentScroll}
      tableScrollRef={layout === "global-panel" ? undefined : tableScrollRef}
      wrapClassName={viewMode === "cards" ? "is-hidden" : undefined}
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
      renderComprobante={(activo, meta) => (
        <ComprobanteCell
          activo={activo}
          className={meta?.columnFiltered ? "inventario-col-filtered" : undefined}
        />
      )}
      renderAcciones={(activo) => (
        <ActivoAccionesBar
          activo={activo}
          onEdit={onEditActivo}
          onIrAmbiente={onIrAmbiente}
          onActivoEliminado={onActivoEliminado}
          compact
          variant="icons"
          {...accionesProps}
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
      router.refresh();
      return {};
    },
    [clearSelection, pushToast, router],
  );

  const openCopiar = useCallback(() => setCopiarOpen(true), []);

  useEffect(() => {
    if (!onCopiarStateChange) return;
    if (!copiaEnabled || selectedActivos.length === 0) {
      onCopiarStateChange(null);
      return;
    }
    onCopiarStateChange({ count: selectedActivos.length, onOpen: openCopiar });
  }, [copiaEnabled, onCopiarStateChange, openCopiar, selectedActivos.length]);

  useEffect(() => {
    return () => onCopiarStateChange?.(null);
  }, [onCopiarStateChange]);

  const seleccionKey = selectedActivos.map((activo) => activo.id).join("\n");
  useEffect(() => {
    onSeleccionChange?.(seleccionKey ? seleccionKey.split("\n") : []);
  }, [onSeleccionChange, seleccionKey]);

  const copiarBar =
    !onCopiarStateChange && copiaEnabled && selectedActivos.length > 0 ? (
      <div className="flex justify-end px-3 py-2">
        <Button type="button" size="sm" onClick={openCopiar}>
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

  const viewToggle = (
    <PanelViewToggle value={viewMode} onChange={setViewMode} listLabel="Tabla" />
  );
  const toolbarNode = typeof toolbar === "function" ? toolbar(viewToggle) : toolbar;

  const mobileCards = (
    <ActivosInventarioMobileCards
      activos={paginated}
      onEditActivo={onEditActivo}
      onIrAmbiente={onIrAmbiente}
      onActivoEliminado={onActivoEliminado}
      {...accionesProps}
      emptyActionLabel={emptyActionLabel}
      mostrarEstadoRegistro={mostrarEstadoRegistro}
      mostrarUbicacion={mostrarUbicacion}
      ubicacionMultiplesSedes={ubicacionMultiplesSedes}
      withPreregistroSelection={selectionEnabled}
      selectedIds={selectionEnabled ? selectedIds : undefined}
      onToggleSelect={selectionEnabled ? toggleSelect : undefined}
      puedeSeleccionar={selectionEnabled ? puedeMarcarActivo : undefined}
      fechaCorte={fechaCorte}
      renderVisita={renderVisita}
      procedenciaPorActivo={procedenciaPorActivo}
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
              {toolbarNode}
              {inlinePreregistroToolbar}
              {copiarBar}
              {leyendaVisita}
              {typeof toolbar === "function" ? null : viewToggle}
              <div className={cardsWrapClass}>{mobileCards}</div>
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
    <div className={excelViewShellClass(embeddedInParentScroll)}>
      {inlinePreregistroToolbar}
      {copiarBar}
      {leyendaVisita}
      {viewToggle}
      <div className={cardsWrapClass}>{mobileCards}</div>
      {tableBlock}
      {paginationBlock}
      {bulkDialogNode}
      {copiarDialog}
    </div>
  );
}
