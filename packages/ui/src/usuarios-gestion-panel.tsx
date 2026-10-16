"use client";

import { useMemo, useState } from "react";
import type { Profile, RolUsuario } from "@inventario/types";
import {
  countContadoresActivos,
  validarDesactivarUsuario,
  validarNombreContador,
} from "@inventario/types";
import { Button, Dialog, Input, Label } from "./components";
import { ConfirmDialog } from "./confirm-dialog";
import {
  DeleteIcon,
  PanelIconAction,
} from "./panel-action-buttons";
import {
  PanelCountLabel,
  PanelEmptyState,
  PanelFlashMessage,
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
  panelTableNameCellClass,
  panelTableNowrapCellClass,
} from "./panel-table-layout";

const USUARIOS_TABLE_COLS = [
  { type: "grow" as const },
  { type: "grow" as const },
  { type: "shrink" as const },
  { type: "grow" as const },
  { type: "shrink" as const },
  { type: "shrink" as const },
];

export interface ProfileConEntidad extends Profile {
  entidad_nombre?: string | null;
  acceso_estado?: "confirmado" | "pendiente" | "sin_cuenta" | "desconocido";
}

export interface UsuariosGestionPanelProps {
  usuarios: ProfileConEntidad[];
  currentUserId: string;
  loading?: boolean;
  pageTitle?: string;
  pageSubtitle?: string;
  onInviteContador: (input: {
    email: string;
    nombre: string;
  }) => Promise<{ error?: string; message?: string | null }>;
  onResendInvitacion: (userId: string) => Promise<{ error?: string; message?: string | null }>;
  onSetUsuarioActivo: (
    userId: string,
    activo: boolean,
  ) => Promise<{ error?: string }>;
  onDeleteUsuario: (userId: string) => Promise<{ error?: string }>;
  onRefresh?: () => void | Promise<void>;
}

type ConfirmAction =
  | { type: "deactivate"; usuario: ProfileConEntidad }
  | { type: "reactivate"; usuario: ProfileConEntidad }
  | { type: "delete"; usuario: ProfileConEntidad };

function rolLabel(rol: RolUsuario | string) {
  if (rol === "CONTADOR") return "Contador";
  if (rol === "ADMIN_ENTIDAD") return "Administrador";
  return rol;
}

function accesoLabel(estado?: ProfileConEntidad["acceso_estado"]) {
  if (estado === "confirmado") return "Ingresó";
  if (estado === "pendiente") return "Pendiente";
  if (estado === "sin_cuenta") return "Sin cuenta";
  if (estado === "desconocido") return "—";
  return null;
}

export function UsuariosGestionPanel({
  usuarios,
  currentUserId,
  loading = false,
  pageTitle,
  pageSubtitle,
  onInviteContador,
  onResendInvitacion,
  onSetUsuarioActivo,
  onDeleteUsuario,
  onRefresh,
}: UsuariosGestionPanelProps) {
  const [busqueda, setBusqueda] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [resendUserId, setResendUserId] = useState<string | null>(null);

  const contadoresActivos = useMemo(() => countContadoresActivos(usuarios), [usuarios]);
  const mostrarAcceso = useMemo(
    () => usuarios.some((u) => u.acceso_estado !== undefined),
    [usuarios],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.entidad_nombre?.toLowerCase().includes(q) ?? false) ||
        rolLabel(u.rol).toLowerCase().includes(q),
    );
  }, [usuarios, busqueda]);

  function motivoNoDesactivar(usuario: ProfileConEntidad): string | null {
    return validarDesactivarUsuario({
      target: usuario,
      actorId: currentUserId,
      usuarios,
    });
  }

  function motivoNoEliminar(usuario: ProfileConEntidad): string | null {
    if (usuario.activo) return "Desactive el usuario antes de eliminarlo.";
    if (usuario.id === currentUserId) return "No puede eliminar su propio usuario.";
    return null;
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    const nombreError = validarNombreContador(nombre);
    if (nombreError) {
      setError(nombreError);
      setPending(false);
      return;
    }

    try {
      const result = await onInviteContador({ nombre, email });
      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage(result.message ?? "Contador agregado correctamente.");
      setNombre("");
      setEmail("");
      setInviteOpen(false);
      void onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al invitar contador.");
    } finally {
      setPending(false);
    }
  }

  async function handleResend(userId: string) {
    setPending(true);
    setResendUserId(userId);
    setMessage(null);
    setError(null);

    try {
      const result = await onResendInvitacion(userId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Invitación reenviada.");
      void onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reenviar la invitación.");
    } finally {
      setPending(false);
      setResendUserId(null);
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    setPending(true);
    setConfirmError(null);

    try {
      const { usuario } = confirmAction;
      let result: { error?: string };

      if (confirmAction.type === "delete") {
        result = await onDeleteUsuario(usuario.id);
      } else {
        result = await onSetUsuarioActivo(
          usuario.id,
          confirmAction.type === "reactivate",
        );
      }

      if (result.error) {
        setConfirmError(result.error);
        return;
      }

      const accionLabel =
        confirmAction.type === "delete"
          ? "eliminado"
          : confirmAction.type === "reactivate"
            ? "reactivado"
            : "desactivado";

      setMessage(`Usuario ${usuario.nombre} ${accionLabel}.`);
      setConfirmAction(null);
      void onRefresh?.();
    } finally {
      setPending(false);
    }
  }

  const confirmCopy = (() => {
    if (!confirmAction) return null;
    const { usuario, type } = confirmAction;
    if (type === "deactivate") {
      return {
        title: "Desactivar usuario",
        description: `¿Desactivar a «${usuario.nombre}» (${usuario.email})? No podrá ingresar al sistema.`,
        confirmLabel: "Desactivar",
        confirmVariant: "destructive" as const,
      };
    }
    if (type === "reactivate") {
      return {
        title: "Reactivar usuario",
        description: `¿Reactivar a «${usuario.nombre}» (${usuario.email})? Volverá a poder ingresar.`,
        confirmLabel: "Reactivar",
        confirmVariant: "default" as const,
      };
    }
    return {
      title: "Eliminar usuario",
      description: `¿Eliminar definitivamente a «${usuario.nombre}» (${usuario.email})? Se borrará su cuenta de acceso. Solo es posible si no tiene activos ni historial asociados.`,
      confirmLabel: "Eliminar",
      confirmVariant: "destructive" as const,
    };
  })();

  return (
    <div className="space-y-4">
      {(pageTitle || pageSubtitle) && (
        <div>
          {pageTitle && <h2 className="text-lg font-semibold">{pageTitle}</h2>}
          {pageSubtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{pageSubtitle}</p>
          )}
        </div>
      )}

      <PanelToolbar
        left={
          <div>
            <PanelCountLabel count={filtrados.length} singular="usuario" plural="usuarios" />
            <p className="text-xs text-muted-foreground">
              {contadoresActivos === 1
                ? "1 contador activo"
                : `${contadoresActivos} contadores activos`}
            </p>
          </div>
        }
        right={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <div className="min-w-[200px] flex-1 sm:max-w-sm sm:flex-none">
              <PanelSearchInput
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar por nombre, correo, rol o entidad…"
              />
            </div>
            <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
              Invitar contador
            </Button>
          </div>
        }
      />

      {message && <PanelFlashMessage variant="success">{message}</PanelFlashMessage>}
      {error && <PanelFlashMessage variant="error">{error}</PanelFlashMessage>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
      ) : filtrados.length === 0 ? (
        <PanelEmptyState message="No hay usuarios que coincidan con la búsqueda." />
      ) : (
        <PanelDataTable layout="auto">
          <PanelTableColgroup cols={USUARIOS_TABLE_COLS} />
          <thead className={panelTableStickyHeadClass}>
            <tr className={panelTableHeadRowClass}>
              <PanelTableTh className={panelTableNameCellClass}>Nombre</PanelTableTh>
              <PanelTableTh>Correo</PanelTableTh>
              <PanelTableTh className={panelTableNowrapCellClass}>Rol</PanelTableTh>
              <PanelTableTh>Entidad</PanelTableTh>
              {mostrarAcceso && (
                <PanelTableTh className={panelTableNowrapCellClass}>Acceso</PanelTableTh>
              )}
              <PanelTableTh className={panelTableNowrapCellClass}>Estado</PanelTableTh>
              <PanelTableTh align="right" className={panelTableNowrapCellClass}>
                Acciones
              </PanelTableTh>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((usuario) => {
              const esYo = usuario.id === currentUserId;
              const bloqueoDesactivar = usuario.activo ? motivoNoDesactivar(usuario) : null;
              const bloqueoEliminar = motivoNoEliminar(usuario);

              return (
                <tr key={usuario.id} className={panelTableBodyRowClass}>
                  <PanelTableTd className={panelTableNameCellClass}>
                    {usuario.nombre}
                    {esYo && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(usted)</span>
                    )}
                  </PanelTableTd>
                  <PanelTableTd className={panelTableMutedClass}>{usuario.email}</PanelTableTd>
                  <PanelTableTd className={panelTableNowrapCellClass}>
                    {rolLabel(usuario.rol)}
                  </PanelTableTd>
                  <PanelTableTd className={panelTableMutedClass}>
                    {usuario.entidad_nombre ?? "—"}
                  </PanelTableTd>
                  {mostrarAcceso && (
                    <PanelTableTd className={panelTableNowrapCellClass}>
                      {accesoLabel(usuario.acceso_estado) ? (
                        <StatusBadge
                          variant={
                            usuario.acceso_estado === "confirmado"
                              ? "active"
                              : usuario.acceso_estado === "pendiente"
                                ? "pending"
                                : "default"
                          }
                        >
                          {accesoLabel(usuario.acceso_estado)}
                        </StatusBadge>
                      ) : (
                        "—"
                      )}
                    </PanelTableTd>
                  )}
                  <PanelTableTd className={panelTableNowrapCellClass}>
                    <StatusBadge variant={usuario.activo ? "active" : "default"}>
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </StatusBadge>
                  </PanelTableTd>
                  <PanelTableTd align="right" className={panelTableNowrapCellClass}>
                    <div className="flex flex-nowrap items-center justify-end gap-1">
                      {!esYo && usuario.activo && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          title="Reenviar correo de invitación"
                          onClick={() => void handleResend(usuario.id)}
                        >
                          {resendUserId === usuario.id && pending
                            ? "Enviando…"
                            : "Reenviar invitación"}
                        </Button>
                      )}
                      {usuario.activo ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={Boolean(bloqueoDesactivar) || pending}
                          title={bloqueoDesactivar ?? "Desactivar acceso"}
                          onClick={() => {
                            setConfirmError(null);
                            setConfirmAction({ type: "deactivate", usuario });
                          }}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              setConfirmError(null);
                              setConfirmAction({ type: "reactivate", usuario });
                            }}
                          >
                            Reactivar
                          </Button>
                          <PanelIconAction
                            label="Eliminar"
                            variant="danger"
                            disabled={Boolean(bloqueoEliminar) || pending}
                            title={bloqueoEliminar ?? "Eliminar usuario"}
                            onClick={() => {
                              setConfirmError(null);
                              setConfirmAction({ type: "delete", usuario });
                            }}
                          >
                            <DeleteIcon />
                          </PanelIconAction>
                        </>
                      )}
                    </div>
                  </PanelTableTd>
                </tr>
              );
            })}
          </tbody>
        </PanelDataTable>
      )}

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invitar contador">
        <form onSubmit={(e) => void handleInvite(e)} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contador_nombre">Nombre</Label>
            <Input
              id="contador_nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contador_email">Correo (Google)</Label>
            <Input
              id="contador_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
            />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar invitación"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => {
          setConfirmAction(null);
          setConfirmError(null);
        }}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.description}
        confirmLabel={confirmCopy?.confirmLabel}
        confirmVariant={confirmCopy?.confirmVariant}
        pending={pending}
        error={confirmError}
        onConfirm={() => void handleConfirmAction()}
      />
    </div>
  );
}
