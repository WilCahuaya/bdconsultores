"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { guardarNotaAsistenciaMes } from "@/lib/actions/asistencias";

export function AsistenciaNotaField({
  relacionId,
  mes,
  nota,
  canWrite,
  compact = false,
}: {
  relacionId: string;
  mes: string;
  nota: string | null;
  canWrite: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const inicial = nota ?? "";
  const [value, setValue] = useState(inicial);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setValue(inicial);
  }, [inicial, mes]);

  async function guardar() {
    const next = value.trim();
    if (next === inicial.trim()) return;
    setPending(true);
    const result = await guardarNotaAsistenciaMes(relacionId, mes, next);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Observación guardada.");
    router.refresh();
  }

  if (!canWrite) {
    return <p className="text-sm text-muted-foreground">{inicial || "—"}</p>;
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void guardar()}
        disabled={pending}
        rows={compact ? 2 : 3}
        maxLength={500}
        placeholder="Ej. falta firma, vacaciones, ingreso a mitad de mes"
        className="flex min-h-[2.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {!compact ? (
        <Button type="button" variant="outline" disabled={pending} onClick={() => void guardar()}>
          {pending ? "Guardando…" : "Guardar observación"}
        </Button>
      ) : null}
    </div>
  );
}
