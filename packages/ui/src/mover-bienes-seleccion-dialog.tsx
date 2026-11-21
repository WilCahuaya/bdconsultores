"use client";

import { useEffect, useMemo, useState } from "react";
import { entidadMuestraSelectorSede, sedeIdSinSelector } from "@inventario/types";
import { Button, Dialog, Label, Select } from "./components";
import type {
  AmbienteOpcionCopia,
  BienSeleccionCopia,
  SedeOpcionCopia,
} from "./copiar-bienes-seleccion-dialog";

interface MoverBienesSeleccionDialogProps {
  open: boolean;
  bienes: BienSeleccionCopia[];
  onClose: () => void;
  onListSedes: (entidadId: string) => Promise<SedeOpcionCopia[]>;
  onListAmbientes: (sedeId: string) => Promise<AmbienteOpcionCopia[]>;
  onConfirm: (ubicacion: { sedeId: string; ambienteId: string }) => Promise<{ error?: string }>;
}

export function MoverBienesSeleccionDialog({
  open,
  bienes,
  onClose,
  onListSedes,
  onListAmbientes,
  onConfirm,
}: MoverBienesSeleccionDialogProps) {
  const [sedes, setSedes] = useState<SedeOpcionCopia[]>([]);
  const [ambientes, setAmbientes] = useState<AmbienteOpcionCopia[]>([]);
  const [sedeId, setSedeId] = useState("");
  const [ambienteId, setAmbienteId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firmaBienes = bienes.map((b) => `${b.id}:${b.entidadId}`).join("|");
  const entidadIds = useMemo(() => {
    const ids = new Set<string>();
    if (!firmaBienes) return [];
    for (const part of firmaBienes.split("|")) {
      const entidadId = part.slice(part.indexOf(":") + 1);
      if (entidadId) ids.add(entidadId);
    }
    return [...ids];
  }, [firmaBienes]);
  const mismaEntidad = entidadIds.length === 1;
  const mostrarSelectorSede = entidadMuestraSelectorSede(sedes);
  const sedeEfectiva = mostrarSelectorSede ? sedeId : sedeIdSinSelector(sedes) ?? "";
  const destinoValido = mismaEntidad && Boolean(sedeEfectiva && ambienteId);

  useEffect(() => {
    if (!open) return;
    setSedes([]);
    setAmbientes([]);
    setSedeId("");
    setAmbienteId("");
    setError(null);
    setPending(false);
  }, [open, firmaBienes]);

  useEffect(() => {
    if (!open || !mismaEntidad) return;
    let cancelled = false;
    void onListSedes(entidadIds[0]!).then((rows) => {
      if (cancelled) return;
      const activas = rows.filter((s) => s.activo !== false);
      setSedes(activas);
      if (!entidadMuestraSelectorSede(activas)) {
        setSedeId(sedeIdSinSelector(activas) ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, mismaEntidad, entidadIds, onListSedes]);

  useEffect(() => {
    if (!open || !sedeEfectiva) {
      setAmbientes([]);
      return;
    }
    let cancelled = false;
    void onListAmbientes(sedeEfectiva).then((rows) => {
      if (!cancelled) setAmbientes(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, sedeEfectiva, onListAmbientes]);

  async function handleConfirm() {
    if (!mismaEntidad) {
      setError("Para mover en grupo, seleccione bienes de una sola entidad.");
      return;
    }
    if (!destinoValido) {
      setError("Seleccione la sede y el ambiente de destino.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onConfirm({ sedeId: sedeEfectiva, ambienteId });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  const total = bienes.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Mover bienes"
      description="Los bienes pasan al ambiente elegido. Marca, serie y el resto de datos se conservan."
      className="max-w-lg"
    >
      <div className="space-y-4">
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {bienes.map((bien) => (
            <li key={bien.id} className="rounded-md border border-border/60 px-3 py-2">
              <p className="truncate text-sm font-medium text-foreground">{bien.nombre}</p>
              {bien.codigo && (
                <p className="truncate text-xs text-muted-foreground">{bien.codigo}</p>
              )}
            </li>
          ))}
        </ul>

        {!mismaEntidad ? (
          <p className="text-sm text-destructive">
            Seleccione bienes de una sola entidad para moverlos juntos.
          </p>
        ) : (
          <div className="space-y-3">
            {mostrarSelectorSede && (
              <div className="space-y-1.5">
                <Label htmlFor="mover_grupo_sede">Sede</Label>
                <Select
                  id="mover_grupo_sede"
                  value={sedeId}
                  onChange={(value) => {
                    setSedeId(value);
                    setAmbienteId("");
                    if (error) setError(null);
                  }}
                  options={[
                    { value: "", label: "Seleccione sede…" },
                    ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
                  ]}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="mover_grupo_ambiente">Ambiente</Label>
              <Select
                id="mover_grupo_ambiente"
                value={ambienteId}
                disabled={!sedeEfectiva}
                onChange={(value) => {
                  setAmbienteId(value);
                  if (error) setError(null);
                }}
                options={[
                  { value: "", label: "Seleccione ambiente…" },
                  ...ambientes.map((a) => ({ value: a.id, label: a.nombre })),
                ]}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={pending || !destinoValido || total === 0}
          >
            {pending ? "Moviendo…" : `Mover ${total} bien${total === 1 ? "" : "es"}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
