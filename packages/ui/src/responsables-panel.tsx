"use client";

import { useMemo, useState } from "react";
import type {
  CreateResponsableInput,
  ResponsableConConteo,
  TrabajadorPlanillaOpcion,
  UpdateResponsableInput,
} from "@inventario/types";
import { Button, Dialog } from "./components";
import { ConfirmDialog } from "./confirm-dialog";
import { ResponsableAltaForm } from "./responsable-alta-form";
import { ResponsableFormFields, responsableFromForm } from "./responsable-form-fields";
import {
  ActivateIcon,
  DeleteIcon,
  EditIcon,
  PanelCountLabel,
  PanelEmptyState,
  PanelFlashMessage,
  PanelIconAction,
  PanelSearchInput,
  PanelToolbar,
  StatusBadge,
} from "./panel";
import {
  PanelDataTable,
  panelTableBodyRowClass,
  panelTableHeadRowClass,
  panelTableMutedClass,
  panelTableStickyHeadClass,
} from "./panel-list-table";
import {
  PanelTableColgroup,
  PanelTableTd,
  PanelTableTh,
  RESPONSABLES_TABLE_COLS,
  panelTableNowrapCellClass,
  panelTableShrinkCellClass,
} from "./panel-table-layout";

export interface ResponsablesPanelProps {
  /** @deprecated El contexto de entidad se muestra en el banner de la página padre. */
  entidadNombre?: string;
  responsables: ResponsableConConteo[];
  onCreate: (
    input: CreateResponsableInput,
  ) => Promise<{ data?: ResponsableConConteo; error?: string; reused?: boolean }>;
  onUpdate: (
    id: string,
    input: UpdateResponsableInput,
  ) => Promise<{ error?: string }>;
  onSetActivo: (id: string, activo: boolean) => Promise<{ error?: string }>;
  onDelete?: (id: string) => Promise<{ error?: string }>;
  onReload?: () => void | Promise<void>;
  /** Si la empresa usa Planillas, trabajadores activos para copiarlos como responsable. */
  trabajadoresPlanilla?: TrabajadorPlanillaOpcion[] | null;
  cargandoPlanilla?: boolean;
}

function formatOptional(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : "—";
}

function formatAmbientes(item: ResponsableConConteo): string {
  if (item.ambiente_nombres && item.ambiente_nombres.length > 0) {
    return item.ambiente_nombres.join(", ");
  }
  if (item.ambiente_count > 0) return `${item.ambiente_count}`;
  return "—";
}

type ResponsableConfirmAction =
  | { type: "deactivate"; item: ResponsableConConteo }
  | { type: "delete"; item: ResponsableConConteo };

export function ResponsablesPanel({
  responsables,
  onCreate,
  onUpdate,
  onSetActivo,
  onDelete,
  onReload,
  trabajadoresPlanilla = null,
  cargandoPlanilla = false,
}: ResponsablesPanelProps) {
  const [busqueda, setBusqueda] = useState("");
  const [ocultarInactivos, setOcultarInactivos] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ResponsableConConteo | null>(null);
  const [confirmAction, setConfirmAction] = useState<ResponsableConfirmAction | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    let list = responsables;
    if (ocultarInactivos) list = list.filter((r) => r.activo);
    const q = busqueda.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        (r.dni?.includes(q) ?? false) ||
        (r.email?.toLowerCase().includes(q) ?? false) ||
        (r.cargo?.toLowerCase().includes(q) ?? false) ||
        (r.telefono?.toLowerCase().includes(q) ?? false),
    );
  }, [responsables, busqueda, ocultarInactivos]);

  async function handleCreate(input: CreateResponsableInput) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await onCreate(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      const nombre = result.data?.nombre ?? input.nombre;
      setMessage(
        result.reused
          ? `«${nombre}» ya estaba como responsable. Se usará ese registro.`
          : `Responsable «${nombre}» registrado.`,
      );
      setCreateOpen(false);
      void onReload?.();
    } finally {
      setPending(false);
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await onUpdate(editTarget.id, responsableFromForm(new FormData(e.currentTarget)));
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Responsable actualizado.");
      setEditTarget(null);
      void onReload?.();
    } finally {
      setPending(false);
    }
  }

  async function handleActivate(item: ResponsableConConteo) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await onSetActivo(item.id, true);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(`Responsable «${item.nombre}» reactivado.`);
      void onReload?.();
    } finally {
      setPending(false);
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;

    setPending(true);
    setConfirmError(null);
    setError(null);
    setMessage(null);

    try {
      if (confirmAction.type === "deactivate") {
        const result = await onSetActivo(confirmAction.item.id, false);
        if (result.error) {
          setConfirmError(result.error);
          return;
        }
        setMessage("Responsable desactivado.");
        setConfirmAction(null);
        void onReload?.();
        return;
      }

      if (!onDelete) {
        setConfirmAction(null);
        return;
      }

      const result = await onDelete(confirmAction.item.id);
      if (result.error) {
        setConfirmError(result.error);
        return;
      }
      setMessage("Responsable eliminado.");
      setConfirmAction(null);
      void onReload?.();
    } finally {
      setPending(false);
    }
  }

  const confirmTitle =
    confirmAction?.type === "delete" ? "Eliminar responsable" : "Desactivar responsable";

  const confirmDescription = confirmAction
    ? confirmAction.type === "delete"
      ? `¿Eliminar definitivamente a «${confirmAction.item.nombre}»? Esta acción no se puede deshacer.`
      : `¿Desactivar a «${confirmAction.item.nombre}»? Podrá reactivarlo o eliminarlo después desde «Mostrar inactivos».`
    : undefined;

  return (
    <div className="space-y-4">
      <PanelToolbar
        left={
          <PanelCountLabel
            count={filtrados.length}
            singular="responsable"
            plural="responsables"
          />
        }
        right={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <div className="min-w-[200px] flex-1 sm:max-w-xs sm:flex-none">
              <PanelSearchInput
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar por nombre, DNI, correo o teléfono…"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOcultarInactivos((v) => !v)}
            >
              {ocultarInactivos ? "Mostrar inactivos" : "Ocultar inactivos"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setError(null);
                setCreateOpen(true);
              }}
            >
              + Agregar responsable
            </Button>
          </div>
        }
      />

      {message && <PanelFlashMessage variant="success">{message}</PanelFlashMessage>}
      {error && !createOpen && <PanelFlashMessage variant="error">{error}</PanelFlashMessage>}

      {filtrados.length === 0 ? (
        <PanelEmptyState
          message={
            responsables.length === 0
              ? "Aún no hay responsables registrados para esta entidad."
              : "No hay responsables que coincidan con la búsqueda."
          }
          action={
            responsables.length === 0 ? (
              <Button
                type="button"
                onClick={() => {
                  setError(null);
                  setCreateOpen(true);
                }}
              >
                + Agregar primer responsable
              </Button>
            ) : undefined
          }
        />
      ) : (
        <PanelDataTable layout="auto">
          <PanelTableColgroup cols={RESPONSABLES_TABLE_COLS} />
          <thead className={panelTableStickyHeadClass}>
            <tr className={panelTableHeadRowClass}>
              <PanelTableTh>Nombre</PanelTableTh>
              <PanelTableTh className={panelTableShrinkCellClass}>DNI</PanelTableTh>
              <PanelTableTh className={panelTableShrinkCellClass}>Cargo</PanelTableTh>
              <PanelTableTh>Correo</PanelTableTh>
              <PanelTableTh className={panelTableShrinkCellClass}>Teléfono</PanelTableTh>
              <PanelTableTh>Ambientes a cargo</PanelTableTh>
              <PanelTableTh className={panelTableNowrapCellClass}>Estado</PanelTableTh>
              <PanelTableTh align="right" className={panelTableNowrapCellClass}>
                Acciones
              </PanelTableTh>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((item) => (
              <tr key={item.id} className={panelTableBodyRowClass}>
                <PanelTableTd className="font-medium" title={item.nombre}>
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{item.nombre}</span>
                    {item.es_administrador && (
                      <StatusBadge variant="pending">Administrador</StatusBadge>
                    )}
                  </span>
                </PanelTableTd>
                <PanelTableTd
                  className={`${panelTableMutedClass} ${panelTableShrinkCellClass} font-mono tabular-nums`}
                  title={item.dni ?? undefined}
                >
                  {formatOptional(item.dni)}
                </PanelTableTd>
                <PanelTableTd
                  className={`${panelTableMutedClass} ${panelTableShrinkCellClass}`}
                  title={item.cargo ?? undefined}
                >
                  {item.cargo ?? "—"}
                </PanelTableTd>
                <PanelTableTd
                  className={panelTableMutedClass}
                  title={item.email ?? undefined}
                >
                  {formatOptional(item.email)}
                </PanelTableTd>
                <PanelTableTd
                  className={`${panelTableMutedClass} ${panelTableShrinkCellClass}`}
                  title={item.telefono ?? undefined}
                >
                  {formatOptional(item.telefono)}
                </PanelTableTd>
                <PanelTableTd className={panelTableMutedClass} title={formatAmbientes(item)}>
                  {formatAmbientes(item)}
                </PanelTableTd>
                <PanelTableTd className={panelTableNowrapCellClass}>
                  <StatusBadge variant={item.activo ? "active" : "default"}>
                    {item.activo ? "Activo" : "Inactivo"}
                  </StatusBadge>
                </PanelTableTd>
                <PanelTableTd
                  align="right"
                  className={`overflow-visible ${panelTableNowrapCellClass}`}
                >
                  <div className="flex flex-nowrap items-center justify-end gap-1">
                    <PanelIconAction
                      label="Editar"
                      disabled={pending}
                      onClick={() => setEditTarget(item)}
                    >
                      <EditIcon />
                    </PanelIconAction>
                    {!item.es_administrador && (
                      <>
                        {!item.activo && (
                          <PanelIconAction
                            label="Activar"
                            variant="success"
                            disabled={pending}
                            onClick={() => void handleActivate(item)}
                          >
                            <ActivateIcon />
                          </PanelIconAction>
                        )}
                        <PanelIconAction
                          label={item.activo ? "Desactivar" : "Eliminar definitivamente"}
                          variant="danger"
                          disabled={pending}
                          onClick={() =>
                            setConfirmAction(
                              item.activo
                                ? { type: "deactivate", item }
                                : { type: "delete", item },
                            )
                          }
                        >
                          <DeleteIcon />
                        </PanelIconAction>
                      </>
                    )}
                  </div>
                </PanelTableTd>
              </tr>
            ))}
          </tbody>
        </PanelDataTable>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo responsable">
        <ResponsableAltaForm
          idPrefix="new_resp"
          trabajadoresPlanilla={trabajadoresPlanilla}
          cargandoPlanilla={cargandoPlanilla}
          pending={pending}
          error={error}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(input) => void handleCreate(input)}
        />
      </Dialog>

      <Dialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Editar responsable"
      >
        {editTarget && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void handleEdit(e)}>
            {editTarget.es_administrador && (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                ponsable es Este resel administrador de la entidad. Solo puede editar el teléfono;
                el resto de datos se muestran y los actualiza el contador en la ficha de la entidad.
              </p>
            )}
            <div className="sm:col-span-2">
              <ResponsableFormFields idPrefix="edit_resp" responsable={editTarget} />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => {
          setConfirmAction(null);
          setConfirmError(null);
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={
          confirmAction?.type === "delete" ? "Eliminar definitivamente" : "Desactivar"
        }
        confirmVariant={confirmAction?.type === "delete" ? "destructive" : "default"}
        pending={pending}
        error={confirmError}
        onConfirm={() => void handleConfirmAction()}
      />
    </div>
  );
}
