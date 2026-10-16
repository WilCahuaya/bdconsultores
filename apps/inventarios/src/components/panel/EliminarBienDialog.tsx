"use client";

import { useEffect, useState } from "react";
import type { Activo } from "@inventario/types";
import { Button, Dialog, Input, Label } from "@inventario/ui";
import { ActivoEditScopeNav, type ActivoEditScope } from "@inventario/ui/panel";
import { deleteBienRegistrado } from "@/lib/actions/activos";
import { useEjemplaresResumen } from "@/hooks/useEjemplaresResumen";

const CONFIRM_WORD = "ELIMINAR";

export function EliminarBienDialog({
  activo,
  open,
  onClose,
  onDeleted,
}: {
  activo: Activo;
  open: boolean;
  onClose: () => void;
  onDeleted?: (ids: string[]) => void;
}) {
  const { resumen, loading } = useEjemplaresResumen(open ? activo.id : null);
  const registrados = resumen?.registrados ?? 0;
  const [scope, setScope] = useState<ActivoEditScope>("single");
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScope("single");
    setConfirmText("");
    setPending(false);
    setError(null);
  }, [open, activo.id]);

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;
  const cantidad = scope === "bulk" && registrados > 1 ? registrados : 1;

  async function handleDelete() {
    if (!confirmed || pending) return;
    setPending(true);
    setError(null);
    const result = await deleteBienRegistrado(activo.id, scope === "bulk" ? "bulk" : "single");
    setPending(false);
    if (result.error || !result.data) {
      setError(result.error ?? "No se pudo eliminar.");
      return;
    }
    onDeleted?.(result.data.activo_ids);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Eliminar bien">
      <div className="space-y-4">
        <p className="text-sm text-foreground">
          <span className="font-medium">{activo.nombre}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          El bien se borra de forma permanente. No se puede deshacer.
        </p>

        {registrados > 1 && (
          <ActivoEditScopeNav
            scope={scope}
            ejemplaresTotal={registrados}
            onScopeChange={setScope}
            disabled={pending || loading}
            singleHint="Solo se elimina este bien."
            bulkHint="Se eliminan todas las unidades registradas del mismo lote."
          />
        )}

        <div className="space-y-2">
          <Label htmlFor="eliminar_bien_confirm">
            Escriba <strong>{CONFIRM_WORD}</strong> para confirmar
            {cantidad > 1 ? ` la eliminación de ${cantidad} ejemplares` : ""}.
          </Label>
          <Input
            id="eliminar_bien_confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
          />
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/50 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed || pending || loading}
            onClick={() => void handleDelete()}
          >
            {pending ? "Eliminando…" : cantidad > 1 ? `Eliminar ${cantidad}` : "Eliminar"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
