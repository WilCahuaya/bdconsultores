"use client";

import { useState } from "react";
import { Button } from "@inventario/ui";
import { ValidarPreregistroDialog } from "./ValidarPreregistroDialog";

export function RegistrarActivoButton({
  entidadId,
  activoId,
  nombre,
  codigoCatalogo,
  posibleAmbienteId,
  posibleAmbienteNombre,
  compact = false,
  label,
  className,
  onValidated,
}: {
  entidadId: string;
  activoId: string;
  nombre: string;
  codigoCatalogo?: string;
  posibleAmbienteId?: string | null;
  posibleAmbienteNombre?: string | null;
  compact?: boolean;
  label?: string;
  className?: string;
  onValidated?: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const buttonLabel = label ?? (compact ? "Validar" : "Validar → REGISTRADO");

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={className ?? (compact ? "h-7 px-2 text-[10px]" : undefined)}
        onClick={() => setDialogOpen(true)}
      >
        {buttonLabel}
      </Button>

      <ValidarPreregistroDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        entidadId={entidadId}
        activoId={activoId}
        nombre={nombre}
        codigoCatalogo={codigoCatalogo}
        posibleAmbienteId={posibleAmbienteId}
        posibleAmbienteNombre={posibleAmbienteNombre}
        onSuccess={onValidated}
      />
    </>
  );
}
