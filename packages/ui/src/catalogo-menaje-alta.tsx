"use client";

import { useState, type FormEvent } from "react";
import type { CatalogoNacional } from "@inventario/types";
import { Button, Input, Label } from "./components";
import { PanelFlashMessage } from "./panel";

export interface CatalogoMenajeAltaProps {
  initialDenominacion?: string;
  onSubmit: (denominacion: string) => Promise<{ data?: CatalogoNacional; error?: string }>;
  onItemCreated?: (item: CatalogoNacional) => void | Promise<void>;
  onClose?: () => void;
  hideIntro?: boolean;
}

export function CatalogoMenajeAlta({
  initialDenominacion = "",
  onSubmit,
  onItemCreated,
  onClose,
  hideIntro = false,
}: CatalogoMenajeAltaProps) {
  const [denominacion, setDenominacion] = useState(initialDenominacion);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await onSubmit(denominacion);
      if (result.error || !result.data) {
        setError(result.error ?? "No se pudo crear el ítem.");
        return;
      }
      await onItemCreated?.(result.data);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      {!hideIntro && (
        <p className="text-sm text-muted-foreground">
          El código MJ se asigna solo. Material, color y medidas se anotan en cada existencia.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="alta_menaje_denominacion">Denominación</Label>
        <Input
          id="alta_menaje_denominacion"
          required
          value={denominacion}
          onChange={(event) => setDenominacion(event.target.value)}
          placeholder="Ej. OLLA"
        />
      </div>
      {error && <PanelFlashMessage variant="error">{error}</PanelFlashMessage>}
      <div className="flex justify-end gap-2">
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Agregar"}
        </Button>
      </div>
    </form>
  );
}
