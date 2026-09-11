"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { descargarAsistenciaExcel } from "@/lib/descargar-asistencia-excel";
import { mesActualLima } from "@/lib/horario-asistencia";

export function AsistenciasMesBar({
  entidadId,
  mesInicial,
  canWrite = true,
}: {
  entidadId: string;
  mesInicial?: string;
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
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void descargarAsistenciaExcel({ mes, relacionId }).then((result) => {
          setPending(false);
          if (result.error) pushToast(result.error, "error");
        });
      }}
    >
      {pending ? "…" : "Excel"}
    </Button>
  );
}
