"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { CatalogoNacional } from "@inventario/types";
import { Button, Dialog, Input, Label } from "./components";
import { ConfirmDialog } from "./confirm-dialog";
import { DeleteIcon, PanelIconAction } from "./panel-action-buttons";
import {
  EditIcon,
  PanelCountLabel,
  PanelEmptyState,
  PanelFlashMessage,
  PanelSearchInput,
  PanelToolbar,
  TablePagination,
  useTablePagination,
} from "./panel";
import { PanelDataTable, panelTableBodyRowClass, panelTableHeadRowClass } from "./panel-list-table";

export interface CatalogoMenajePanelProps {
  listItems: () => Promise<CatalogoNacional[]>;
  onUpdate: (
    codigo: string,
    denominacion: string,
  ) => Promise<{ data?: CatalogoNacional; error?: string }>;
  onDelete: (codigo: string) => Promise<{ error?: string }>;
  reloadKey?: number;
  readOnly?: boolean;
}

export function CatalogoMenajePanel({
  listItems,
  onUpdate,
  onDelete,
  reloadKey = 0,
  readOnly = false,
}: CatalogoMenajePanelProps) {
  const [items, setItems] = useState<CatalogoNacional[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<CatalogoNacional | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CatalogoNacional | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listItems());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el catálogo de menajes.");
    } finally {
      setLoading(false);
    }
  }, [listItems]);

  useEffect(() => {
    void reload();
  }, [reload, reloadKey]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.codigo.toLowerCase().includes(q) || item.denominacion.toLowerCase().includes(q),
    );
  }, [items, busqueda]);

  const {
    paginated,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
    total,
    totalPages,
    rangeStart,
    rangeEnd,
  } = useTablePagination(filtrados, busqueda.trim(), { initialPageSize: 25 });

  function openEdit(item: CatalogoNacional) {
    setEditTarget(item);
    setEditNombre(item.denominacion);
    setConfirmError(null);
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    setPending(true);
    setConfirmError(null);
    try {
      const result = await onUpdate(editTarget.codigo, editNombre);
      if (result.error) {
        setConfirmError(result.error);
        return;
      }
      setMessage(`Ítem ${editTarget.codigo} actualizado.`);
      setEditTarget(null);
      void reload();
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setPending(true);
    setConfirmError(null);
    try {
      const result = await onDelete(deleteTarget.codigo);
      if (result.error) {
        setConfirmError(result.error);
        return;
      }
      setMessage(`Ítem ${deleteTarget.codigo} eliminado.`);
      setDeleteTarget(null);
      void reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <PanelToolbar
        left={
          <PanelCountLabel count={filtrados.length} singular="ítem de menaje" plural="ítems de menaje" />
        }
        right={
          <div className="min-w-[200px] flex-1 sm:max-w-xs sm:flex-none">
            <PanelSearchInput
              value={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar código o denominación…"
            />
          </div>
        }
      />

      {message && <PanelFlashMessage variant="success">{message}</PanelFlashMessage>}
      {error && <PanelFlashMessage variant="error">{error}</PanelFlashMessage>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando catálogo de menajes…</p>
      ) : filtrados.length === 0 ? (
        <PanelEmptyState
          message={
            items.length === 0
              ? "Aún no hay ítems en el catálogo de menajes."
              : "No hay ítems que coincidan con la búsqueda."
          }
        />
      ) : (
        <PanelDataTable
          layout="auto"
          scroll
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
              unitLabel="ítems"
            />
          }
        >
          <thead>
            <tr className={panelTableHeadRowClass}>
              <th className="px-3 py-2 text-left text-xs font-medium">Código</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Denominación</th>
              <th className="px-3 py-2 text-right text-xs font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((item) => (
              <tr key={item.codigo} className={panelTableBodyRowClass}>
                <td className="px-3 py-2 font-mono text-sm">{item.codigo.trim()}</td>
                <td className="px-3 py-2 text-sm">{item.denominacion}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {!readOnly && (
                      <>
                        <PanelIconAction label="Editar" onClick={() => openEdit(item)}>
                          <EditIcon />
                        </PanelIconAction>
                        <PanelIconAction label="Eliminar" onClick={() => setDeleteTarget(item)}>
                          <DeleteIcon />
                        </PanelIconAction>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </PanelDataTable>
      )}

      <Dialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Editar ítem de menaje"
      >
        {editTarget && (
          <form className="space-y-4" onSubmit={(event) => void handleEditSubmit(event)}>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input readOnly value={editTarget.codigo.trim()} className="bg-muted font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menaje_denominacion">Denominación</Label>
              <Input
                id="menaje_denominacion"
                required
                value={editNombre}
                onChange={(event) => setEditNombre(event.target.value)}
              />
            </div>
            {confirmError && <PanelFlashMessage variant="error">{confirmError}</PanelFlashMessage>}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar ítem de menaje"
        description={
          deleteTarget
            ? `Se eliminará ${deleteTarget.codigo.trim()} · ${deleteTarget.denominacion}. Solo si ningún bien lo usa.`
            : ""
        }
        confirmVariant="destructive"
        confirmLabel={pending ? "Eliminando…" : "Eliminar"}
        pending={pending}
        error={confirmError}
        onConfirm={() => void handleDeleteConfirm()}
        onClose={() => {
          if (pending) return;
          setDeleteTarget(null);
          setConfirmError(null);
        }}
      />
    </div>
  );
}
