"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EntidadConConteo } from "@inventario/types";
import {
  LABEL_PRINT_LAYOUT_FONTS,
  entidadNombreRequiereEtiquetaOverride,
  suggestNombreEtiqueta,
} from "@inventario/types";
import { Button, ConfirmDialog, Dialog, Input, Label } from "@inventario/ui";
import {
  ActivateIcon,
  DeleteIcon,
  PanelDataTable,
  PanelIconAction,
  PanelTableColgroup,
  PanelTableTd,
  PanelTableTh,
  PanelViewToggle,
  ENTIDADES_TABLE_COLS,
  panelTableShrinkCellClass,
  panelTableNowrapCellClass,
  panelTableClickableRowClass,
  panelTableHeadRowClass,
  panelTableStickyHeadClass,
  useStoredViewMode,
} from "@inventario/ui/panel";
import {
  createEntidad,
  deleteEntidad,
  setEntidadActivo,
  updateEntidad,
} from "@/lib/actions/entidades";
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

function sortEntidades(items: EntidadConConteo[]) {
  return [...items].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return a.nombre.localeCompare(b.nombre);
  });
}

type ConfirmAction =
  | { type: "deactivate"; item: EntidadConConteo }
  | { type: "delete"; item: EntidadConConteo };

function EntidadFields({ entidad, requireAdmin = false }: { entidad?: EntidadConConteo; requireAdmin?: boolean }) {
  const [nombre, setNombre] = useState(entidad?.nombre ?? "");
  const [nombreEtiqueta, setNombreEtiqueta] = useState(entidad?.nombre_etiqueta ?? "");
  const [etiquetaManual, setEtiquetaManual] = useState(Boolean(entidad?.nombre_etiqueta?.trim()));

  useEffect(() => {
    setNombre(entidad?.nombre ?? "");
    setNombreEtiqueta(entidad?.nombre_etiqueta ?? "");
    setEtiquetaManual(Boolean(entidad?.nombre_etiqueta?.trim()));
  }, [entidad]);

  const nombreEtiquetaSugerido = useMemo(
    () =>
      nombre.trim()
        ? suggestNombreEtiqueta(nombre, LABEL_PRINT_LAYOUT_FONTS.entidad)
        : "",
    [nombre],
  );

  const mostrarNombreEtiqueta = useMemo(
    () => entidadNombreRequiereEtiquetaOverride(nombre),
    [nombre],
  );

  useEffect(() => {
    if (!mostrarNombreEtiqueta) {
      setNombreEtiqueta("");
      return;
    }
    if (!etiquetaManual && nombreEtiquetaSugerido) {
      setNombreEtiqueta(nombreEtiquetaSugerido);
    }
  }, [mostrarNombreEtiqueta, nombreEtiquetaSugerido, etiquetaManual]);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="nombre">Razón social</Label>
        <Input
          id="nombre"
          name="nombre"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      {mostrarNombreEtiqueta && (
        <div className="space-y-2">
          <Label htmlFor="nombre_etiqueta">Nombre en etiqueta</Label>
          <Input
            id="nombre_etiqueta"
            name="nombre_etiqueta"
            value={nombreEtiqueta}
            onChange={(e) => {
              setEtiquetaManual(true);
              setNombreEtiqueta(e.target.value);
            }}
            placeholder={nombreEtiquetaSugerido || "Texto corto para la etiqueta"}
          />
          <p className="text-xs text-muted-foreground">
            La razón social es larga para la etiqueta 50×25 mm. Se sugiere un texto más corto; puede
            editarlo si lo necesita.
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="ruc">RUC</Label>
        <Input id="ruc" name="ruc" placeholder="20XXXXXXXXX" defaultValue={entidad?.ruc ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" name="direccion" defaultValue={entidad?.direccion ?? ""} />
        <p className="text-xs text-muted-foreground">
          Corresponde a la sede Principal de la entidad.
        </p>
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        Administrador de la entidad
        {requireAdmin && (
          <span className="mt-1 block text-xs font-normal">
            Se enviará una invitación a este correo. Al ingresar con Google usará el rol de
            administrador de la entidad.
          </span>
        )}
      </p>
      <div className="space-y-2">
        <Label htmlFor="admin_nombre">Nombre</Label>
        <Input
          id="admin_nombre"
          name="admin_nombre"
          required={requireAdmin}
          defaultValue={entidad?.admin_nombre ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin_dni">DNI</Label>
        <Input
          id="admin_dni"
          name="admin_dni"
          required={requireAdmin}
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          pattern="[0-9]{8}"
          title="8 dígitos"
          placeholder="12345678"
          defaultValue={entidad?.admin_dni ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin_email">Correo</Label>
        <Input
          id="admin_email"
          name="admin_email"
          type="email"
          required={requireAdmin}
          defaultValue={entidad?.admin_email ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin_telefono">Teléfono</Label>
        <Input
          id="admin_telefono"
          name="admin_telefono"
          type="tel"
          defaultValue={entidad?.admin_telefono ?? ""}
        />
      </div>
    </>
  );
}

function entidadFromForm(form: FormData) {
  const nombre = String(form.get("nombre"));
  const nombreEtiquetaRaw = String(form.get("nombre_etiqueta") || "").trim();
  const nombreEtiqueta = entidadNombreRequiereEtiquetaOverride(nombre)
    ? nombreEtiquetaRaw || null
    : null;
  return {
    nombre,
    nombre_etiqueta: nombreEtiqueta,
    ruc: String(form.get("ruc") || ""),
    direccion: String(form.get("direccion") || ""),
    admin_nombre: String(form.get("admin_nombre") || ""),
    admin_dni: String(form.get("admin_dni") || ""),
    admin_email: String(form.get("admin_email") || ""),
    admin_telefono: String(form.get("admin_telefono") || ""),
  };
}

function entidadPageHref(entidadId: string) {
  return `/contador/entidades/${encodeURIComponent(entidadId)}`;
}

export function EntidadesPanel({ entidades: initial }: { entidades: EntidadConConteo[] }) {
  const router = useRouter();
  const [entidades, setEntidades] = useState(initial);

  useEffect(() => {
    setEntidades(initial);
  }, [initial]);
  const [busqueda, setBusqueda] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editEntidad, setEditEntidad] = useState<EntidadConConteo | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useStoredViewMode("inventario-view-entidades", "list");

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = !q
      ? entidades
      : entidades.filter(
          (e) =>
            e.nombre.toLowerCase().includes(q) ||
            (e.ruc?.toLowerCase().includes(q) ?? false) ||
            (e.admin_nombre?.toLowerCase().includes(q) ?? false),
        );
    return sortEntidades(base);
  }, [entidades, busqueda]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createEntidad(entidadFromForm(new FormData(form)));
      if (result.error) {
        setError(result.error);
        return;
      }

      setEntidades((prev) =>
        sortEntidades([...prev, { ...result.data!, ambiente_count: 0, activo_count: 0 }]),
      );
      setCreateOpen(false);
      form.reset();
      if (result.inviteMessage) setSuccess(result.inviteMessage);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editEntidad) return;
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateEntidad(editEntidad.id, entidadFromForm(new FormData(event.currentTarget)));
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.inviteMessage) setSuccess(result.inviteMessage);

      setEntidades((prev) =>
        sortEntidades(
          prev.map((e) =>
            e.id === editEntidad.id
              ? {
                  ...result.data!,
                  ambiente_count: e.ambiente_count,
                  activo_count: e.activo_count,
                }
              : e,
          ),
        ),
      );
      setEditEntidad(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleActivate(entidad: EntidadConConteo) {
    setPending(true);
    setError(null);
    try {
      const result = await setEntidadActivo(entidad.id, true);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEntidades((prev) =>
        sortEntidades(
          prev.map((e) =>
            e.id === entidad.id
              ? { ...e, ...result.data!, ambiente_count: e.ambiente_count, activo_count: e.activo_count }
              : e,
          ),
        ),
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    setPending(true);
    setError(null);

    try {
      if (confirmAction.type === "deactivate") {
        const result = await setEntidadActivo(confirmAction.item.id, false);
        if (result.error) {
          setError(result.error);
          return;
        }
        setEntidades((prev) =>
          sortEntidades(
            prev.map((e) =>
              e.id === confirmAction.item.id
                ? {
                    ...e,
                    ...result.data!,
                    ambiente_count: e.ambiente_count,
                    activo_count: e.activo_count,
                  }
                : e,
            ),
          ),
        );
      } else {
        const result = await deleteEntidad(confirmAction.item.id);
        if (result.error) {
          setError(result.error);
          return;
        }
        setEntidades((prev) => prev.filter((e) => e.id !== confirmAction.item.id));
      }
      setConfirmAction(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function renderEntidadActions(entidad: EntidadConConteo) {
    return (
      <div className="flex flex-nowrap items-center justify-end gap-1">
        <PanelIconAction
          label="Editar"
          disabled={pending}
          onClick={() => {
            setError(null);
            setEditEntidad(entidad);
          }}
        >
          <EditIcon />
        </PanelIconAction>
        {!entidad.activo && (
          <PanelIconAction
            label="Reactivar"
            variant="success"
            disabled={pending}
            onClick={() => void handleActivate(entidad)}
          >
            <ActivateIcon />
          </PanelIconAction>
        )}
        {entidad.activo && entidad.activo_count > 0 && (
          <PanelIconAction
            label="Desactivar"
            variant="danger"
            disabled={pending}
            onClick={() => {
              setError(null);
              setConfirmAction({ type: "deactivate", item: entidad });
            }}
          >
            <DeleteIcon />
          </PanelIconAction>
        )}
        {entidad.activo_count === 0 && (
          <PanelIconAction
            label="Eliminar definitivamente"
            variant="danger"
            disabled={pending}
            onClick={() => {
              setError(null);
              setConfirmAction({ type: "delete", item: entidad });
            }}
          >
            <DeleteIcon />
          </PanelIconAction>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PanelPageHeader
        title="Gestión de entidades"
        subtitle="Administra las entidades y sus ambientes de inventario"
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            + Nueva entidad
          </Button>
        }
      />

      <PanelToolbar
        left={
          <PanelCountLabel count={filtradas.length} singular="entidad" plural="entidades" />
        }
        right={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <div className="min-w-[200px] flex-1 sm:max-w-sm sm:flex-none">
              <PanelSearchInput
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar por razón social, RUC o administrador…"
              />
            </div>
            <PanelViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        }
      />

      {success && (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          {success}
        </p>
      )}

      {error && !createOpen && !editEntidad && !confirmAction && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {filtradas.length === 0 ? (
        <PanelEmptyState
          message={
            busqueda.trim()
              ? "No hay entidades que coincidan con la búsqueda."
              : "No hay entidades registradas."
          }
          action={
            !busqueda.trim() ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                + Crear primera entidad
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === "list" ? (
        <PanelDataTable layout="auto">
          <PanelTableColgroup cols={ENTIDADES_TABLE_COLS} />
          <thead className={panelTableStickyHeadClass}>
            <tr className={panelTableHeadRowClass}>
              <PanelTableTh>Razón social</PanelTableTh>
              <PanelTableTh className={panelTableShrinkCellClass}>RUC</PanelTableTh>
              <PanelTableTh>Administrador</PanelTableTh>
              <PanelTableTh>Dirección</PanelTableTh>
              <PanelTableTh align="center" className={panelTableShrinkCellClass}>
                Ambientes
              </PanelTableTh>
              <PanelTableTh className={panelTableNowrapCellClass}>Estado</PanelTableTh>
              <PanelTableTh align="right" className={panelTableNowrapCellClass}>
                Acciones
              </PanelTableTh>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((entidad) => (
              <tr
                key={entidad.id}
                className={panelTableClickableRowClass}
                onClick={() => router.push(entidadPageHref(entidad.id))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(entidadPageHref(entidad.id));
                  }
                }}
                tabIndex={0}
                role="link"
              >
                <PanelTableTd className="font-medium text-primary" title={entidad.nombre}>
                  {entidad.nombre}
                </PanelTableTd>
                <PanelTableTd
                  className={`font-mono text-xs text-muted-foreground ${panelTableShrinkCellClass}`}
                >
                  {entidad.ruc ?? "—"}
                </PanelTableTd>
                <PanelTableTd title={entidad.admin_nombre ?? undefined}>
                  {entidad.admin_nombre ?? "—"}
                </PanelTableTd>
                <PanelTableTd className="text-muted-foreground" title={entidad.direccion ?? undefined}>
                  {entidad.direccion ?? "—"}
                </PanelTableTd>
                <PanelTableTd align="center" className={panelTableShrinkCellClass}>
                  {entidad.ambiente_count}
                </PanelTableTd>
                <PanelTableTd className={panelTableNowrapCellClass}>
                  <StatusBadge variant={entidad.activo ? "active" : "default"}>
                    {entidad.activo ? "Activa" : "Inactiva"}
                  </StatusBadge>
                </PanelTableTd>
                <PanelTableTd
                  align="right"
                  className={`overflow-visible ${panelTableNowrapCellClass}`}
                >
                  <div onClick={(event) => event.stopPropagation()}>
                    {renderEntidadActions(entidad)}
                  </div>
                </PanelTableTd>
              </tr>
            ))}
          </tbody>
        </PanelDataTable>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((entidad) => (
            <article key={entidad.id} className={`${panelCardClass} flex flex-col overflow-hidden`}>
              <Link
                href={entidadPageHref(entidad.id)}
                className="flex flex-1 flex-col outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <div className="flex items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
                  <h3 className="font-semibold leading-snug text-primary">{entidad.nombre}</h3>
                  <StatusBadge variant={entidad.activo ? "active" : "default"}>
                    {entidad.activo ? "Activa" : "Inactiva"}
                  </StatusBadge>
                </div>

                <div className="flex flex-1 flex-col gap-2 px-4 py-3 text-sm">
                  {entidad.ruc && (
                    <p className="text-muted-foreground">
                      RUC: <span className="font-medium text-foreground">{entidad.ruc}</span>
                    </p>
                  )}
                  {entidad.admin_nombre && (
                    <p className="font-medium text-foreground">{entidad.admin_nombre}</p>
                  )}
                  {entidad.direccion && (
                    <p className="text-muted-foreground">{entidad.direccion}</p>
                  )}
                  <p className="text-muted-foreground">
                    {entidad.ambiente_count}{" "}
                    {entidad.ambiente_count === 1 ? "ambiente" : "ambientes"}
                    {entidad.activo_count > 0
                      ? ` · ${entidad.activo_count} ${entidad.activo_count === 1 ? "activo" : "activos"}`
                      : ""}
                  </p>
                </div>
              </Link>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/50 bg-muted/20 px-3 py-2.5">
                {renderEntidadActions(entidad)}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setError(null);
        }}
        title="Nueva entidad"
        description="Se creará la sucursal Principal y se enviará la invitación al administrador."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <EntidadFields requireAdmin />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Crear entidad"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={!!editEntidad}
        onClose={() => {
          setEditEntidad(null);
          setError(null);
        }}
        title="Editar entidad"
        description={editEntidad?.nombre}
      >
        {editEntidad && (
          <form onSubmit={handleEdit} className="space-y-4">
            <EntidadFields entidad={editEntidad} requireAdmin />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditEntidad(null)}>
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
        open={!!confirmAction}
        onClose={() => {
          setConfirmAction(null);
          setError(null);
        }}
        title={
          confirmAction?.type === "delete" ? "Eliminar entidad" : "Desactivar entidad"
        }
        description={
          confirmAction?.type === "delete"
            ? `¿Eliminar definitivamente «${confirmAction.item.nombre}»? Se borrarán también sus sucursales, ambientes (incluido el de preregistros) y responsables. Esta acción no se puede deshacer.`
            : confirmAction
              ? `¿Desactivar «${confirmAction.item.nombre}»? Dejará de aparecer en el inventario operativo; podrá reactivarla después.`
              : undefined
        }
        confirmLabel={
          confirmAction?.type === "delete" ? "Eliminar definitivamente" : "Desactivar"
        }
        confirmVariant={confirmAction?.type === "delete" ? "destructive" : "default"}
        pending={pending}
        error={confirmAction ? error : null}
        onConfirm={() => void handleConfirmAction()}
      />
    </div>
  );
}
