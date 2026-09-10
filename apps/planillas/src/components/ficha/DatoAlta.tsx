"use client";

import { Button, useToast } from "@inventario/ui";

function Copiar({ value }: { value: string }) {
  const { pushToast } = useToast();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!value}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => pushToast("Copiado."),
          () => pushToast("No se pudo copiar.", "error"),
        );
      }}
    >
      Copiar
    </Button>
  );
}

export function DatoAlta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm">{value || "—"}</p>
      </div>
      {value ? <Copiar value={value} /> : null}
    </div>
  );
}
