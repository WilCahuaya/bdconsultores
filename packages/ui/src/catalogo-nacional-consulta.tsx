"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CatalogoNacional,
  CuentaContable,
  UpdateCatalogoNacionalContabilidadInput,
  UpsertCuentaContableInput,
} from "@inventario/types";
import {
  CATALOGO_CONSULTA_MAX_RESULTS,
  CATALOGO_ORIGEN_LABELS,
  minCatalogoQueryLength,
} from "@inventario/types";
import { Button, Dialog, Input, Label } from "./components";
import { PorcentajeInput } from "./porcentaje-input";
import { CuentaContableFields } from "./cuenta-contable-fields";
import { PanelIconAction, ViewIcon } from "./panel-action-buttons";
import {
  EditIcon,
  PanelCountLabel,
  PanelEmptyState,
  PanelFlashMessage,
  PanelSearchInput,
  PanelToolbar,
  StatusBadge,
  TablePagination,
  useTablePagination,
} from "./panel";
import {
  PanelDataTable,
  panelTableBodyRowClass,
  panelTableHeadRowClass,
  panelTableStickyHeadClass,
} from "./panel-list-table";
import { PanelTableColgroup } from "./panel-table-layout";
import {
  CATALOGO_ITEM_TABLE_COLS,
  CatalogoItemDetalle,
  CatalogoItemTableCells,
  CatalogoItemTableHead,
} from "./catalogo-item-display";

export interface CatalogoNacionalConsultaProps {
  searchItems: (query: string) => Promise<CatalogoNacional[]>;
  searchCuentasContables: (query: string) => Promise<CuentaContable[]>;
  offlineHint?: string;
  readOnlyContabilidad?: boolean;
  onUpdateContabilidad?: (
    codigo: string,
    input: UpdateCatalogoNacionalContabilidadInput,
  ) => Promise<{ data?: CatalogoNacional; error?: string }>;
  onCreateCuentaContable?: (
    input: UpsertCuentaContableInput,
  ) => Promise<{ data?: CuentaContable; error?: string }>;
  onBusquedaChange?: (query: string) => void;
}

export function CatalogoNacionalConsulta({
  searchItems,
  searchCuentasContables,
  offlineHint,
  readOnlyContabilidad = false,
  onUpdateContabilidad,
  onCreateCuentaContable,
  onBusquedaChange,
}: CatalogoNacionalConsultaProps) {
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState<CatalogoNacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [viewTarget, setViewTarget] = useState<CatalogoNacional | null>(null);
  const [editTarget, setEditTarget] = useState<CatalogoNacional | null>(null);
  const [editCuenta, setEditCuenta] = useState("");
  const [editContabilidad, setEditContabilidad] = useState("");
  const [editDepreciacion, setEditDepreciacion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canEditContabilidad = Boolean(onUpdateContabilidad) && !readOnlyContabilidad;

  useEffect(() => {
    onBusquedaChange?.(busqueda);
  }, [busqueda, onBusquedaChange]);

  useEffect(() => {
    const trimmed = busqueda.trim();
    if (trimmed.length < minCatalogoQueryLength(trimmed)) {
      setItems([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const result = await searchItems(trimmed);
          setItems(result);
          setSearched(true);
        } finally {
          setLoading(false);
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [busqueda, searchItems]);

  const filtrados = useMemo(() => items, [items]);
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
  } = useTablePagination(filtrados, busqueda.trim(), { initialPageSize: 25 });

  function openEdit(item: CatalogoNacional) {
    setEditTarget(item);
    setEditCuenta(item.cuenta_codigo ?? "");
    setEditContabilidad(item.contabilidad ?? "");
    setEditDepreciacion(item.depreciacion ?? "");
    setError(null);
  }

  function mergeUpdatedItem(updated: CatalogoNacional) {
    setItems((prev) => prev.map((row) => (row.codigo === updated.codigo ? updated : row)));
    setViewTarget((prev) => (prev?.codigo === updated.codigo ? updated : prev));
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !onUpdateContabilidad) return;

    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await onUpdateContabilidad(editTarget.codigo, {
        cuenta_codigo: editCuenta,
        contabilidad: editContabilidad,
        depreciacion: editDepreciacion,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.data) {
        mergeUpdatedItem(result.data);
      }
      setMessage(`Datos contables del ítem ${editTarget.codigo} actualizados.`);
      setEditTarget(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="catalogo-tabla-panel space-y-4">
      <p className="text-sm text-muted-foreground">
        Consulta del catálogo oficial SBN. Los datos SBN (código, denominación, grupo, clase, etc.)
        son de solo lectura; puede completar o corregir la cuenta contable y la depreciación conforme los vaya identificando.
        {offlineHint ? ` ${offlineHint}` : ""}
        {readOnlyContabilidad
          ? " Sin conexión no se pueden editar los datos contables del catálogo nacional."
          : ""}
      </p>

      {message && <PanelFlashMessage variant="success">{message}</PanelFlashMessage>}

      <PanelToolbar
        left={
          searched ? (
            <PanelCountLabel
              count={filtrados.length}
              singular="resultado"
              plural="resultados"
            />
          ) : (
            <span className="text-sm text-muted-foreground">Escriba para buscar</span>
          )
        }
        right={
          <div className="min-w-[220px] flex-1 sm:max-w-md sm:flex-none">
            <PanelSearchInput
              value={busqueda}
              onChange={setBusqueda}
              placeholder="Código o denominación del catálogo nacional…"
            />
          </div>
        }
      />

      {loading && <p className="text-sm text-muted-foreground">Buscando en catálogo nacional…</p>}

      {!loading && searched && filtrados.length === 0 && (
        <PanelEmptyState message="No se encontraron ítems del catálogo nacional con ese criterio. Use «Agregar uno nuevo» para registrar el ítem en el catálogo oficial." />
      )}

      {!loading && filtrados.length > 0 && (
        <PanelDataTable
          layout="auto"
          scroll
          className="catalogo-cols-full"
          footer={
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
              unitLabel="resultados"
              legend={
                filtrados.length >= CATALOGO_CONSULTA_MAX_RESULTS ? (
                  <span className="text-xs text-muted-foreground">
                    Mostrando hasta {CATALOGO_CONSULTA_MAX_RESULTS} coincidencias. Afine la búsqueda
                    para ver otros resultados.
                  </span>
                ) : undefined
              }
            />
          }
        >
              <PanelTableColgroup cols={CATALOGO_ITEM_TABLE_COLS} />
              <thead className={panelTableStickyHeadClass}>
                <tr className={panelTableHeadRowClass}>
                  <CatalogoItemTableHead
                    actionsLabel={canEditContabilidad ? "Acciones" : "Ver"}
                  />
                </tr>
              </thead>
              <tbody>
                {paginated.map((item) => (
                  <tr key={item.codigo} className={panelTableBodyRowClass}>
                    <CatalogoItemTableCells
                      item={item}
                      estadoBadge={
                        <StatusBadge variant={item.estado === "ACTIVO" ? "active" : "default"}>
                          {item.estado ?? "—"}
                        </StatusBadge>
                      }
                      actions={
                        <div className="flex flex-nowrap items-center justify-end gap-1">
                          <PanelIconAction label="Ver detalle" onClick={() => setViewTarget(item)}>
                            <ViewIcon />
                          </PanelIconAction>
                          {canEditContabilidad && (
                            <PanelIconAction
                              label="Editar datos contables"
                              onClick={() => openEdit(item)}
                            >
                              <EditIcon />
                            </PanelIconAction>
                          )}
                        </div>
                      }
                    />
                  </tr>
                ))}
              </tbody>
        </PanelDataTable>
      )}

      {!loading && !searched && busqueda.trim().length === 0 && (
        <PanelEmptyState message="Ingrese al menos 2 letras o un dígito para buscar en el catálogo nacional." />
      )}

      <Dialog
        open={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        title="Ítem del catálogo nacional"
      >
        {viewTarget && (
          <CatalogoItemDetalle item={viewTarget} origenLabel={CATALOGO_ORIGEN_LABELS.NACIONAL} />
        )}
      </Dialog>

      <Dialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Datos contables del ítem"
      >
        {editTarget && (
          <form className="space-y-4" onSubmit={(e) => void handleEditSubmit(e)}>
            <p className="text-sm text-muted-foreground">
              Complete los campos contables de este ítem SBN (cuenta contable y depreciación). El resto
              del registro no se modifica.
            </p>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input readOnly disabled value={editTarget.codigo} className="bg-muted font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Denominación</Label>
              <Input
                readOnly
                disabled
                value={editTarget.denominacion}
                className="bg-muted"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <CuentaContableFields
                  codigo={editCuenta}
                  nombre={editContabilidad}
                  onCodigoChange={setEditCuenta}
                  onNombreChange={setEditContabilidad}
                  searchCuentas={searchCuentasContables}
                  disabled={pending}
                  codigoId="edit_cuenta_codigo"
                  allowCreateNew={Boolean(onCreateCuentaContable)}
                  onCreateCuenta={onCreateCuentaContable}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit_depreciacion">Depreciación anual</Label>
                <PorcentajeInput
                  id="edit_depreciacion"
                  value={editDepreciacion}
                  disabled={pending}
                  onChange={setEditDepreciacion}
                />
              </div>
            </div>
            {error && <PanelFlashMessage variant="error">{error}</PanelFlashMessage>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
