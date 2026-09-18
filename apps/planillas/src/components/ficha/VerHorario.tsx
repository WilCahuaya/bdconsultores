"use client";

import { useState } from "react";
import { HorarioContratoVista } from "@/components/ficha/HorarioContratoVista";

export function VerHorario({ value }: { value: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  if (!value?.trim()) return null;

  return (
    <li>
      <button type="button" className="text-sm text-primary hover:underline" onClick={() => setOpen((v) => !v)}>
        {open ? "Ocultar horario" : "Ver horario"}
      </button>
      {open ? (
        <HorarioContratoVista value={value} className="mt-2 text-sm text-muted-foreground" />
      ) : null}
    </li>
  );
}
