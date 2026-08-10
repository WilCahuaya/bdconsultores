"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Activo, InventarioColumnFilterOptions, InventarioColumnFilters } from "@inventario/types";
import { esActivoPreregistrado } from "@inventario/types";
import {
  ActivosInventarioTable,
  EliminarPreregistradosBulkDialog,
  InventarioTablaLeyenda,
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
import { ActivoAccionesBar } from "./ActivoAccionesBar";
import { ActivosInventarioMobileCards } from "./ActivosInventarioMobileCards";
import { ComprobanteCell } from "./ComprobanteCell";

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
  toolbar?: ReactNode;
  embeddedInParentScroll?: boolean;
  tableScrollRef?: (node: HTMLDivElement | null) => void;
  className?: string;
  columnFilters?: InventarioColumnFilters;
  onColumnFiltersChange?: (next: InventarioColumnFilters) => void;
  columnFilterOptions?: InventarioColumnFilterOptions;
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
}: ActivosInventarioExcelViewProps) {
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

  const {
    selectedIds,
    selectableOnPage,
    allPageSelected,
    toggleSelect,
    toggleSelectAllPage,
    clearSelection,
    selectedActivos,
  } = useInventarioSelection(activos, paginated, esActivoPreregistrado, gestionEnabled);

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
      selectedCount: selectedActivos.length,
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
    selectedActivos.length,
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
        count={bulkDialog.mode === "vaciar" ? preregistrados.length : selectedActivos.length}
        alcanceLabel={bulkDialog.mode === "vaciar" ? gestionPreregistros.alcanceLabel : undefined}
        onClose={() => setBulkDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={async () => {
          const targets = bulkDialog.mode === "vaciar" ? preregistrados : selectedActivos;
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
      embeddedInParentScroll={layout === "global-panel" || embeddedInParentScroll}
      tableScrollRef={layout === "global-panel" ? undefined : tableScrollRef}
      selection={
        gestionEnabled
          ? {
              withSelection: true,
              selectedIds,
              selectableOnPage,
              allPageSelected,
              onToggleSelect: toggleSelect,
              onToggleSelectAllPage: toggleSelectAllPage,
              puedeSeleccionar: esActivoPreregistrado,
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
      withPreregistroSelection={gestionEnabled}
      selectedIds={gestionEnabled ? selectedIds : undefined}
      onToggleSelect={gestionEnabled ? toggleSelect : undefined}
      puedeSeleccionar={gestionEnabled ? esActivoPreregistrado : undefined}
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
              <div className={panelDataCardsWrapClass}>{mobileCards}</div>
              {tableBlock}
            </div>
          </div>
        </div>
        <div className={panelInventarioPaginationFooterClass}>{paginationBlock}</div>
        {bulkDialogNode}
      </>
    );
  }

  return (
    <div className={excelViewShellClass(embeddedInParentScroll)}>
      {inlinePreregistroToolbar}
      <div className={panelDataCardsWrapClass}>{mobileCards}</div>
      {tableBlock}
      {paginationBlock}
      {bulkDialogNode}
    </div>
  );
}
