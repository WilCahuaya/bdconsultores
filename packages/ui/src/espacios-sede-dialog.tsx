"use client";

import { useEffect, useState } from "react";
import type { EspacioConOcupacion } from "@inventario/types";
import {
  espacioRepetidoEnSucursal,
  mensajeEspacioRepetido,
  nombreEspacioDesdeNumero,
  numeroEspacioDesdeEtiqueta,
} from "@inventario/types";
import { Button, Dialog, Input, Label, Textarea } from "./components";

function rellenarNumeroEspacio(raw: string): string {
  const n = numeroEspacioDesdeEtiqueta(nombreEspacioDesdeNumero(raw));
  return n == null ? raw : String(n).padStart(2, "0");
}

function textoOcupacion(espacio: EspacioConOcupacion): string {
  const nombres = (espacio.ocupantes ?? [])
    .map((o) => o.nombre.trim())
    .filter(Boolean);
  if (nombres.length === 0) {
    const legacy = espacio.ambiente_nombre?.trim();
    return legacy ? `Ocupado por: ${legacy}` : "Libre";
  }
  if (nombres.length === 1) return `Ocupado por: ${nombres[0]}`;
  return `Ocupado por ${nombres.length} ambientes: ${nombres.join(", ")}`;
}

export function EspaciosSedeDialog({
  open,
  onClose,
  sedeNombre,
  espacios,
  pending,
  error,
  onReload,
  onCreate,
  onUpdateDescripcion,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  sedeNombre: string;
  espacios: EspacioConOcupacion[];
  pending?: boolean;
  error?: string | null;
  onReload: () => void | Promise<void>;
  onCreate: (nombre: string, descripcion: string) => Promise<{ error?: string }>;
  onUpdateDescripcion: (espacioId: string, descripcion: string) => Promise<{ error?: string }>;
  onDelete: (espacioId: string) => Promise<{ error?: string }>;
}) {
  const [numero, setNumero] = useState("");
  const [descripcionUno, setDescripcionUno] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [localPending, setLocalPending] = useState(false);

  useEffect(() => {
    if (open) {
      setNumero("");
      setDescripcionUno("");
      setEditId(null);
      setEditDesc("");
      setLocalError(null);
      void onReload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open]);

  const busy = pending || localPending;
  const message = localError || error;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nombreEspacioDesdeNumero(numero);
    const descripcion = descripcionUno.trim();
    if (!nombre) {
      setLocalError("Indique el número del espacio (ej. 01, 10, 25).");
      return;
    }
    if (espacioRepetidoEnSucursal(nombre, espacios)) {
      setLocalError(mensajeEspacioRepetido(nombre));
      return;
    }
    setLocalPending(true);
    setLocalError(null);
    const result = await onCreate(nombre, descripcion);
    setLocalPending(false);
    if (result.error) {
      setLocalError(result.error);
      return;
    }
    setNumero("");
    setDescripcionUno("");
    await onReload();
  }

  async function handleSaveDescripcion(espacioId: string) {
    const descripcion = editDesc.trim();
    setLocalPending(true);
    setLocalError(null);
    const result = await onUpdateDescripcion(espacioId, descripcion);
    setLocalPending(false);
    if (result.error) {
      setLocalError(result.error);
      return;
    }
    setEditId(null);
    setEditDesc("");
    await onReload();
  }

  async function handleDelete(espacio: EspacioConOcupacion) {
    const ocupacion = textoOcupacion(espacio);
    const aviso =
      ocupacion === "Libre"
        ? `¿Eliminar "${espacio.nombre}"?`
        : `¿Eliminar "${espacio.nombre}"? ${ocupacion}. Esos ambientes quedarán sin espacio.`;
    if (!confirm(aviso)) return;
    setLocalPending(true);
    setLocalError(null);
    const result = await onDelete(espacio.id);
    setLocalPending(false);
    if (result.error) {
      setLocalError(result.error);
      return;
    }
    await onReload();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Espacios — ${sedeNombre}`}
      description="Espacios del primer piso. El edificio y los demás pisos se arman en Ubicación física. Varios ambientes pueden ocupar el mismo espacio."
      className="max-w-xl"
    >
      <div className="space-y-4">
        <form onSubmit={handleCreate} className="space-y-2 rounded-md border border-border/60 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label htmlFor="espacio_numero">Nuevo espacio</Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm font-medium text-muted-foreground">Espacio</span>
                <Input
                  id="espacio_numero"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="01"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onBlur={() => setNumero((actual) => rellenarNumeroEspacio(actual))}
                  required
                  className="max-w-[6rem]"
                  aria-label="Número del espacio"
                />
              </div>
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={busy}>
              Agregar
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="espacio_desc_uno">Descripción (opcional)</Label>
            <Textarea
              id="espacio_desc_uno"
              rows={2}
              placeholder="Ej. Aula de música, primer piso"
              value={descripcionUno}
              onChange={(e) => setDescripcionUno(e.target.value)}
            />
          </div>
        </form>

        {message && <p className="text-sm text-destructive">{message}</p>}

        {espacios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay espacios. Agregue el primero con su número.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2 text-sm">
            {espacios.map((e) => {
              const desc = e.descripcion?.trim() ?? "";
              const editando = editId === e.id;
              return (
                <li key={e.id} className="rounded px-2 py-1.5 hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{e.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {desc || "Sin descripción"}
                      </p>
                      <p className="text-xs text-muted-foreground">{textoOcupacion(e)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setLocalError(null);
                          if (editando) {
                            setEditId(null);
                            setEditDesc("");
                            return;
                          }
                          setEditId(e.id);
                          setEditDesc(desc);
                        }}
                      >
                        {editando ? "Cancelar" : "Editar"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => void handleDelete(e)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                  {editando && (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        rows={2}
                        value={editDesc}
                        onChange={(ev) => setEditDesc(ev.target.value)}
                        aria-label={`Descripción de ${e.nombre}`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleSaveDescripcion(e.id)}
                      >
                        Guardar descripción
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
