"use client";

import { useEffect, useState } from "react";
import type { CreateResponsableInput, Responsable, TrabajadorPlanillaOpcion } from "@inventario/types";
import { Dialog } from "./components";
import { ResponsableAltaForm } from "./responsable-alta-form";

export interface CrearResponsableDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (
    input: CreateResponsableInput,
  ) => Promise<{ data?: Responsable; error?: string }>;
  onCreated?: (responsable: Responsable) => void;
  title?: string;
  /** Si la empresa usa Planillas, trabajadores activos para copiarlos como responsable. */
  trabajadoresPlanilla?: TrabajadorPlanillaOpcion[] | null;
  cargandoPlanilla?: boolean;
}

export function CrearResponsableDialog({
  open,
  onClose,
  onCreate,
  onCreated,
  title = "Nuevo responsable",
  trabajadoresPlanilla = null,
  cargandoPlanilla = false,
}: CrearResponsableDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function handleClose() {
    if (pending) return;
    setError(null);
    onClose();
  }

  async function handleSave(input: CreateResponsableInput) {
    setPending(true);
    setError(null);
    try {
      const result = await onCreate(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.data) onCreated?.(result.data);
      setError(null);
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={title} className="max-w-lg">
      <ResponsableAltaForm
        idPrefix="crear_resp"
        trabajadoresPlanilla={trabajadoresPlanilla}
        cargandoPlanilla={cargandoPlanilla}
        pending={pending}
        error={error}
        onCancel={handleClose}
        onSubmit={(input) => void handleSave(input)}
      />
    </Dialog>
  );
}
