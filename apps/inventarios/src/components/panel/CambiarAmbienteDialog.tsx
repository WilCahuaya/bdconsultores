"use client";

import { useRouter } from "next/navigation";
import type { Activo } from "@inventario/types";
import { Dialog } from "@inventario/ui";
import { ActivoForm } from "./ActivoForm";

interface CambiarAmbienteDialogProps {
  open: boolean;
  onClose: () => void;
  activo: Activo;
  onSuccess?: () => void;
}

export function CambiarAmbienteDialog({
  open,
  onClose,
  activo,
  onSuccess,
}: CambiarAmbienteDialogProps) {
  const router = useRouter();

  function handleSuccess() {
    onClose();
    onSuccess?.();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Editar bien"
      description={`Actualice ubicación, estado u observaciones de «${activo.nombre}».`}
      className="max-w-2xl lg:max-w-3xl"
    >
      <ActivoForm
        entidades={[]}
        fixedEntidadId={activo.entidad_id}
        activo={activo}
        mode="edit"
        soloUbicacion
        submitLabel="Guardar"
        variant="modal"
        onSuccess={handleSuccess}
      />
    </Dialog>
  );
}
