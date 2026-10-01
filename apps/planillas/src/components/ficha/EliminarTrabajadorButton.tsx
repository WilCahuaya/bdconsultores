"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog } from "@inventario/ui";
import { eliminarTrabajador } from "@/lib/actions/trabajadores";

export function EliminarTrabajadorButton({
  relacionId,
  nombre,
  entidadId,
}: {
  relacionId: string;
  nombre: string;
  entidadId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setPending(true);
    const result = await eliminarTrabajador(relacionId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/?entidadId=${entidadId}`);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Eliminar trabajador
      </Button>
      <ConfirmDialog
        open={open}
        title="Eliminar trabajador"
        description={`Se borra la ficha de ${nombre} en esta empresa, con sus contratos y documentos. No se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        pending={pending}
        error={error}
        onClose={() => {
          if (pending) return;
          setOpen(false);
          setError(null);
        }}
        onConfirm={() => void onConfirm()}
      />
    </>
  );
}
