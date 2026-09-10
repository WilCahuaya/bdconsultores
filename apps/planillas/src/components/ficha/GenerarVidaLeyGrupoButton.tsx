"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { generarVidaLeyGrupo } from "@/lib/actions/ficha";
import { descargarVidaLeyWord } from "@/lib/descargar-vida-ley-word";

export function GenerarVidaLeyGrupoButton({
  entidadId,
  cantidad,
}: {
  entidadId: string;
  cantidad: number;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  async function onGenerar() {
    setPending(true);
    const result = await generarVidaLeyGrupo(entidadId);
    if (result.error || !result.ids?.length) {
      setPending(false);
      pushToast(result.error ?? "No hay trabajadores sin Vida Ley.", "error");
      return;
    }
    const descarga = await descargarVidaLeyWord({ entidadId, ids: result.ids });
    setPending(false);
    if (descarga.error) {
      pushToast(descarga.error, "error");
      return;
    }
    pushToast(
      result.count === 1
        ? "Trámite Vida Ley elaborado para 1 trabajador."
        : `Trámite Vida Ley elaborado para ${result.count} trabajadores.`,
    );
    router.refresh();
  }

  return (
    <Button type="button" disabled={pending || cantidad === 0} onClick={() => void onGenerar()}>
      {pending
        ? "Generando…"
        : cantidad === 0
          ? "Sin pendientes de Vida Ley"
          : `Generar Vida Ley del grupo (${cantidad})`}
    </Button>
  );
}
