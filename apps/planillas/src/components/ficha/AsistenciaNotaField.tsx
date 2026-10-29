"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, useToast } from "@inventario/ui";
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

export function AsistenciaNotaIcono({
  relacionId,
  mes,
  nota,
  canWrite,
  nombre,
  etiquetaMes,
}: {
  relacionId: string;
  mes: string;
  nota: string | null;
  canWrite: boolean;
  nombre: string;
  etiquetaMes: string;
}) {
  const [open, setOpen] = useState(false);
  const tiene = Boolean(nota?.trim());
  return (
    <>
      <button
        type="button"
        aria-label="Ver observación"
        title={tiene ? nota?.trim() : "Ver observación"}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent ${
          tiene ? "text-primary" : "text-muted-foreground"
        }`}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
          <path d="M7 3h8l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M15 3v6h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Observación"
        description={`${nombre} · ${etiquetaMes}`}
      >
        <AsistenciaNotaField relacionId={relacionId} mes={mes} nota={nota} canWrite={canWrite} />
      </Dialog>
    </>
  );
}
