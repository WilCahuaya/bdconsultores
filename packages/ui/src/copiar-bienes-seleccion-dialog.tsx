"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MAX_ACTIVOS_SIMILARES_CANTIDAD,
  entidadMuestraSelectorSede,
  sedeIdSinSelector,
} from "@inventario/types";
import { Button, Dialog, Input, Label, Select } from "./components";

export interface BienSeleccionCopia {
  id: string;
  nombre: string;
  codigo?: string | null;
  entidadId: string;
}

export interface SedeOpcionCopia {
  id: string;
  nombre: string;
  es_principal?: boolean;
  activo?: boolean;
}

export interface AmbienteOpcionCopia {
  id: string;
  nombre: string;
}

interface CopiarBienesSeleccionDialogProps {
  open: boolean;
  bienes: BienSeleccionCopia[];
  onClose: () => void;
  onListSedes: (entidadId: string) => Promise<SedeOpcionCopia[]>;
  onListAmbientes: (sedeId: string) => Promise<AmbienteOpcionCopia[]>;
  onConfirm: (
    items: { id: string; cantidad: number }[],
    ubicacion?: { sedeId: string; ambienteId: string },
  ) => Promise<{ error?: string }>;
}

export function CopiarBienesSeleccionDialog({
  open,
  bienes,
  onClose,
  onListSedes,
  onListAmbientes,
  onConfirm,
}: CopiarBienesSeleccionDialogProps) {
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [destino, setDestino] = useState<"actual" | "otro">("actual");
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

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const bien of bienes) next[bien.id] = "1";
    setCantidades(next);
    setDestino("actual");
    setSedes([]);
    setAmbientes([]);
    setSedeId("");
    setAmbienteId("");
    setError(null);
    setPending(false);
    // firmaBienes cambia solo si cambia la selección, no en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, firmaBienes]);

  useEffect(() => {
    if (!open || destino !== "otro" || !mismaEntidad) return;
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
  }, [open, destino, mismaEntidad, entidadIds, onListSedes]);

  useEffect(() => {
    if (!open || destino !== "otro" || !sedeEfectiva) {
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
  }, [open, destino, sedeEfectiva, onListAmbientes]);

  const items = bienes.map((bien) => {
    const n = Number.parseInt(cantidades[bien.id] ?? "", 10);
    return { bien, cantidad: Number.isFinite(n) ? n : 0 };
  });
  const cantidadesValidas = items.every(
    (item) => item.cantidad >= 1 && item.cantidad <= MAX_ACTIVOS_SIMILARES_CANTIDAD,
  );
  const destinoValido = destino === "actual" || (mismaEntidad && Boolean(sedeEfectiva && ambienteId));
  const total = items.reduce((sum, item) => sum + (item.cantidad > 0 ? item.cantidad : 0), 0);

  async function handleConfirm() {
    if (!cantidadesValidas) {
      setError(`Cada cantidad debe estar entre 1 y ${MAX_ACTIVOS_SIMILARES_CANTIDAD}.`);
      return;
    }
    if (destino === "otro" && !mismaEntidad) {
      setError("Para copiar a otro ambiente, seleccione bienes de una sola entidad.");
      return;
    }
    if (!destinoValido) {
      setError("Seleccione la sede y el ambiente de destino.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onConfirm(
      items.map((item) => ({ id: item.bien.id, cantidad: item.cantidad })),
      destino === "otro" ? { sedeId: sedeEfectiva, ambienteId } : undefined,
    );
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Copiar bienes"
      description="Indique cuántas copias crear de cada bien. Las copias no llevan serie, foto ni comprobante."
      className="max-w-lg"
    >
      <div className="space-y-4">
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {items.map(({ bien }) => (
            <li
              key={bien.id}
              className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{bien.nombre}</p>
                {bien.codigo && (
                  <p className="truncate text-xs text-muted-foreground">{bien.codigo}</p>
                )}
              </div>
              <div className="w-20 shrink-0">
                <Label htmlFor={`copia-${bien.id}`} className="sr-only">
                  Cantidad de {bien.nombre}
                </Label>
                <Input
                  id={`copia-${bien.id}`}
                  type="number"
                  min={1}
                  max={MAX_ACTIVOS_SIMILARES_CANTIDAD}
                  value={cantidades[bien.id] ?? "1"}
                  onChange={(e) => {
                    setCantidades((prev) => ({ ...prev, [bien.id]: e.target.value }));
                    if (error) setError(null);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Destino</legend>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/60 px-3 py-2.5 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="destino_copia_grupo"
              className="mt-0.5"
              checked={destino === "actual"}
              onChange={() => {
                setDestino("actual");
                if (error) setError(null);
              }}
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">Mismo ambiente</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Cada copia queda en el ambiente del bien original.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/60 px-3 py-2.5 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="destino_copia_grupo"
              className="mt-0.5"
              checked={destino === "otro"}
              onChange={() => {
                setDestino("otro");
                if (error) setError(null);
              }}
            />
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium text-foreground">Otro ambiente</span>
              {destino === "otro" && (
                <span className="mt-2 block space-y-3" onClick={(e) => e.preventDefault()}>
                  {!mismaEntidad ? (
                    <p className="text-xs text-destructive">
                      Seleccione bienes de una sola entidad para elegir otro ambiente.
                    </p>
                  ) : (
                    <>
                      {mostrarSelectorSede && (
                        <div className="space-y-1.5">
                          <Label htmlFor="copia_grupo_sede" className="text-xs">
                            Sede
                          </Label>
                          <Select
                            id="copia_grupo_sede"
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
                        <Label htmlFor="copia_grupo_ambiente" className="text-xs">
                          Ambiente
                        </Label>
                        <Select
                          id="copia_grupo_ambiente"
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
                    </>
                  )}
                </span>
              )}
            </span>
          </label>
        </fieldset>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={pending || !cantidadesValidas || !destinoValido || bienes.length === 0}
          >
            {pending ? "Copiando…" : `Crear ${total} copia${total === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
