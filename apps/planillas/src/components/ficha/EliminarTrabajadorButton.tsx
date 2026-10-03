"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog } from "@inventario/ui";
import { eliminarTrabajador } from "@/lib/actions/trabajadores";
import { nombresCoinciden } from "@/lib/planillas-labels";

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
  const [escrito, setEscrito] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coincide = nombresCoinciden(escrito, nombre);

  async function onConfirm() {
    if (!coincide) return;
    setPending(true);
    const result = await eliminarTrabajador(relacionId, escrito);
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
          setEscrito("");
          setOpen(true);
        }}
      >
        Eliminar
      </Button>
      <ConfirmDialog
        open={open}
        title="Eliminar trabajador"
        description="Se borra la ficha en esta empresa, con sus contratos y documentos. No se puede deshacer. Escriba el nombre completo para confirmar."
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        pending={pending}
        error={error}
        confirmDisabled={!coincide}
        onClose={() => {
          if (pending) return;
          setOpen(false);
          setEscrito("");
          setError(null);
        }}
        onConfirm={() => void onConfirm()}
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">{nombre}</span>
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={escrito}
            autoComplete="off"
            autoFocus
            placeholder="Nombre completo"
            onChange={(event) => setEscrito(event.target.value)}
          />
        </label>
      </ConfirmDialog>
    </>
  );
}
