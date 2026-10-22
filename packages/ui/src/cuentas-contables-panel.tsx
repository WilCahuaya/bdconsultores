"use client";

import { useCallback, useEffect, useState } from "react";
import type { CuentaContable, UpsertCuentaContableInput } from "@inventario/types";
import { validarUpsertCuentaContableInput } from "@inventario/types";
import { Button, Dialog, Input, Label } from "./components";
import { ConfirmDialog } from "./confirm-dialog";
import { EditIcon, PanelCountLabel, PanelEmptyState, PanelFlashMessage, PanelSearchInput, PanelToolbar } from "./panel";
import { DeleteIcon, PanelIconAction } from "./panel-action-buttons";
import {
  PanelDataTable,
  panelTableBodyRowClass,
  panelTableHeadRowClass,
  panelTableStickyHeadClass,
} from "./panel-list-table";
import {
  PanelTableTd,
  PanelTableTh,
  panelTableNameCellClass,
  panelTableNowrapCellClass,
  panelTableShrinkCellClass,
} from "./panel-table-layout";

export interface CuentasContablesPanelProps {
  listCuentas: (query?: string) => Promise<CuentaContable[]>;
  onUpsert: (
    input: UpsertCuentaContableInput,
  ) => Promise<{ data?: CuentaContable; error?: string }>;
  onDelete?: (codigo: string) => Promise<{ error?: string }>;
  readOnly?: boolean;
  reloadKey?: number;
}

export function CuentasContablesPanel({
  listCuentas,
  onUpsert,
  onDelete,
  readOnly = false,
  reloadKey = 0,
}: CuentasContablesPanelProps) {
  const [items, setItems] = useState<CuentaContable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editTarget, setEditTarget] = useState<CuentaContable | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formCodigo, setFormCodigo] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CuentaContable | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lista = await listCuentas(busqueda.trim());
      setItems(lista);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las cuentas contables.");
    } finally {
      setLoading(false);
    }
  }, [listCuentas, busqueda]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, busqueda.trim() ? 250 : 0);
    return () => clearTimeout(timer);
  }, [reload, reloadKey, busqueda]);

  const filtrados = items;

  function openCreate() {
    setCreateOpen(true);
    setEditTarget(null);
    setFormCodigo("");
    setFormNombre("");
    setFormError(null);
  }

  function openEdit(item: CuentaContable) {
    setEditTarget(item);
    setCreateOpen(false);
    setFormCodigo(item.codigo);
    setFormNombre(item.nombre ?? "");
    setFormError(null);
  }

  function closeForm() {
    setEditTarget(null);
    setCreateOpen(false);
    setFormCodigo("");
    setFormNombre("");
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: UpsertCuentaContableInput = {
      codigo: formCodigo,
      nombre: formNombre,
    };
    const validationError = validarUpsertCuentaContableInput(input);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setPending(true);
    setFormError(null);
    setError(null);
    setMessage(null);
    try {
      const result = await onUpsert(input);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setMessage(
        editTarget
          ? `Cuenta ${input.codigo.trim()} actualizada.`
          : `Cuenta ${input.codigo.trim()} creada.`,
      );
      closeForm();
      void reload();
    } finally {
      setPending(false);
    }
  }

  const formOpen = Boolean(editTarget) || createOpen;

  async function handleDeleteConfirm() {
    if (!deleteTarget || !onDelete) return;
    setPending(true);
    setConfirmError(null);
    try {
      const result = await onDelete(deleteTarget.codigo);
      if (result.error) {
        setConfirmError(result.error);
        return;
      }
      setMessage(`Cuenta ${deleteTarget.codigo} eliminada.`);
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
          <PanelCountLabel
            count={filtrados.length}
            singular="cuenta contable"
            plural="cuentas contables"
          />
        }
        right={
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-md">
            <div className="min-w-[200px] flex-1">
              <PanelSearchInput
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar código o nombre…"
              />
            </div>
            {!readOnly && (
              <Button type="button" size="sm" onClick={openCreate}>
                + Nueva cuenta
              </Button>
            )}
          </div>
        }
      />

      {message && <PanelFlashMessage variant="success">{message}</PanelFlashMessage>}
      {error && !formOpen && !deleteTarget && (
        <PanelFlashMessage variant="error">{error}</PanelFlashMessage>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando cuentas contables…</p>
      ) : filtrados.length === 0 ? (
        <PanelEmptyState
          message={
            items.length === 0
              ? "Aún no hay cuentas contables registradas."
              : "No hay cuentas que coincidan con la búsqueda."
          }
          action={
            !readOnly && items.length === 0 ? (
              <Button type="button" onClick={openCreate}>
                + Crear primera cuenta
              </Button>
            ) : undefined
          }
        />
      ) : (
        <PanelDataTable layout="auto" scroll>
            <thead className={panelTableStickyHeadClass}>
              <tr className={panelTableHeadRowClass}>
                <PanelTableTh className={panelTableShrinkCellClass}>Código cuenta contable</PanelTableTh>
                <PanelTableTh className={panelTableNameCellClass}>Nombre cuenta contable</PanelTableTh>
                <PanelTableTh align="right" className={panelTableNowrapCellClass}>
                  {readOnly ? "Ver" : "Acciones"}
                </PanelTableTh>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((item) => (
                <tr key={item.codigo} className={panelTableBodyRowClass}>
                  <PanelTableTd className={`${panelTableShrinkCellClass} font-mono`}>
                    {item.codigo}
                  </PanelTableTd>
                  <PanelTableTd className={panelTableNameCellClass} title={item.nombre ?? undefined}>
                    {item.nombre ?? "—"}
                  </PanelTableTd>
                  <PanelTableTd align="right" className={`overflow-visible ${panelTableNowrapCellClass}`}>
                    <div className="flex justify-end gap-1">
                      {!readOnly ? (
                        <>
                          <PanelIconAction label="Editar" onClick={() => openEdit(item)}>
                            <EditIcon />
                          </PanelIconAction>
                          {onDelete && (
                            <PanelIconAction
                              label="Eliminar"
                              variant="danger"
                              onClick={() => {
                                setConfirmError(null);
                                setDeleteTarget(item);
                              }}
                            >
                              <DeleteIcon />
                            </PanelIconAction>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </PanelTableTd>
                </tr>
              ))}
            </tbody>
        </PanelDataTable>
      )}

      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editTarget ? "Editar cuenta contable" : "Nueva cuenta contable"}
      >
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="cuenta_form_codigo">Código cuenta contable</Label>
            <Input
              id="cuenta_form_codigo"
              value={formCodigo}
              readOnly={Boolean(editTarget)}
              disabled={pending || Boolean(editTarget)}
              placeholder="3361"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{1,6}"
              title="Hasta 6 dígitos"
              className="font-mono"
              onChange={(e) => setFormCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {editTarget && (
              <p className="text-xs text-muted-foreground">
                El código no se puede cambiar porque está vinculado al catálogo.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cuenta_form_nombre">Nombre cuenta contable</Label>
            <Input
              id="cuenta_form_nombre"
              required
              value={formNombre}
              disabled={pending}
              placeholder="Equipos diversos"
              onChange={(e) => setFormNombre(e.target.value)}
            />
          </div>
          {formError && <PanelFlashMessage variant="error">{formError}</PanelFlashMessage>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !formNombre.trim()}>
              {pending ? "Guardando…" : editTarget ? "Guardar cambios" : "Crear cuenta"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setConfirmError(null);
        }}
        title="Eliminar cuenta contable"
        description={
          deleteTarget
            ? `¿Eliminar la cuenta ${deleteTarget.codigo}${deleteTarget.nombre ? ` (${deleteTarget.nombre})` : ""}? Solo es posible si ningún bien del catálogo la usa.`
            : undefined
        }
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        pending={pending}
        error={confirmError}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  );
}
