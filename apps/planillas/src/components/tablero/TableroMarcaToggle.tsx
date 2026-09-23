"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@inventario/ui";
import { marcarTablero } from "@/lib/actions/tablero";
import type { TableroMarcaClave } from "@/lib/tablero";

export function TableroMarcaToggle({
  entidadId,
  mes,
  clave,
  hecho,
  label,
}: {
  entidadId: string;
  mes: string;
  clave: TableroMarcaClave;
  hecho: boolean;
  label: string;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  async function onToggle(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setPending(true);
    const result = await marcarTablero(entidadId, mes, clave, !hecho);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(event) => void onToggle(event)}
      className="rounded border border-current/30 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium hover:bg-background disabled:opacity-60"
      title={hecho ? `Quitar ${label}` : `Marcar ${label}`}
    >
      {pending ? "…" : hecho ? `${label}: Sí` : `${label}: No`}
    </button>
  );
}
