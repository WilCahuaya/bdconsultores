"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { descargarAsistenciaExcel } from "@/lib/descargar-asistencia-excel";
import { mesActualLima } from "@/lib/horario-asistencia";
import { FeriadosMesPicker } from "@/components/ficha/FeriadosMesPicker";

export function AsistenciasMesBar({
  entidadId,
  mesInicial,
  feriadosIniciales = [],
  canWrite = true,
}: {
  entidadId: string;
  mesInicial?: string;
  feriadosIniciales?: string[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [mes, setMes] = useState(mesInicial && /^\d{4}-\d{2}$/.test(mesInicial) ? mesInicial : mesActualLima());
  const [pending, setPending] = useState(false);

  function irAlMes(next: string) {
    setMes(next);
    router.push(`/asistencias?entidadId=${entidadId}&mes=${next}`);
  }

  async function onDescargarEmpresa() {
    setPending(true);
    const result = await descargarAsistenciaExcel({ mes, entidadId });
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Excel de la empresa descargado.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Mes</span>
          <input
            type="month"
            value={mes}
            onChange={(event) => irAlMes(event.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          />
        </label>
        {canWrite ? (
          <Button type="button" disabled={pending} onClick={() => void onDescargarEmpresa()}>
            {pending ? "Preparando…" : "Descargar Excel de la empresa"}
          </Button>
        ) : null}
      </div>
      <FeriadosMesPicker
        entidadId={entidadId}
        mes={mes}
        fechasIniciales={feriadosIniciales}
        canWrite={canWrite}
      />
    </div>
  );
}

export function DescargarAsistenciaTrabajador({
  relacionId,
  mes,
}: {
  relacionId: string;
  mes: string;
}) {
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Descargar Excel"
      title="Descargar Excel"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent disabled:opacity-50"
      onClick={() => {
        setPending(true);
        void descargarAsistenciaExcel({ mes, relacionId }).then((result) => {
          setPending(false);
          if (result.error) pushToast(result.error, "error");
        });
      }}
    >
      {pending ? (
        <span className="text-xs">…</span>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
          <path d="M12 4v11" />
          <path d="m7 11 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      )}
    </button>
  );
}
