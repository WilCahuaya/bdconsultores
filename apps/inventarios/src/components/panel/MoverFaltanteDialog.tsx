"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, Label, Select } from "@inventario/ui";
import { listAmbientesPorEntidad } from "@/lib/actions/ubicacion";
import { listProcedenciaFaltanteDetalle, resolverBienFaltante } from "@/lib/actions/visitas-campo";

interface MoverFaltanteDialogProps {
  open: boolean;
  onClose: () => void;
  entidadId: string;
  ambienteId: string;
  activoId: string;
  nombre: string;
}

export function MoverFaltanteDialog({
  open,
  onClose,
  entidadId,
  ambienteId,
  activoId,
  nombre,
}: MoverFaltanteDialogProps) {
  const router = useRouter();
  const [destinos, setDestinos] = useState<{ id: string; label: string }[]>([]);
  const [destino, setDestino] = useState("");
  const [sugeridoId, setSugeridoId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDestino("");
      setSugeridoId("");
      setError(null);
      setPending(false);
      return;
    }
    let cancel = false;
    void Promise.all([
      listAmbientesPorEntidad(entidadId),
      listProcedenciaFaltanteDetalle([activoId]),
    ]).then(([lista, procedencia]) => {
      if (cancel) return;
      const opciones = lista
        .filter((ambiente) => !ambiente.es_preregistro && !ambiente.es_faltante)
        .map((ambiente) => ({
          id: ambiente.id,
          label: ambiente.sede_nombre
            ? `${ambiente.nombre} · ${ambiente.sede_nombre}`
            : ambiente.nombre,
        }));
      setDestinos(opciones);
      const origenId = procedencia[activoId]?.ambienteId ?? "";
      if (origenId && opciones.some((ambiente) => ambiente.id === origenId)) {
        setDestino(origenId);
        setSugeridoId(origenId);
      }
    });
    return () => {
      cancel = true;
    };
  }, [open, entidadId, activoId]);

  async function confirmar() {
    if (!destino) return;
    setPending(true);
    setError(null);
    const result = await resolverBienFaltante({
      entidadId,
      ambienteId,
      activoId,
      accion: "MOVER",
      destinoAmbienteId: destino,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Mover bien"
      description={nombre}
      confirmLabel="Mover"
      pending={pending}
      error={error}
      confirmDisabled={!destino}
      onConfirm={() => void confirmar()}
    >
      <div className="space-y-1.5">
        <Label htmlFor="mover_faltante_destino">Ambiente destino</Label>
        <Select
          id="mover_faltante_destino"
          value={destino}
          onChange={(value) => {
            setDestino(value);
            if (error) setError(null);
          }}
          disabled={pending}
          options={[
            { value: "", label: "Seleccione ambiente…" },
            ...destinos.map((item) => ({ value: item.id, label: item.label })),
          ]}
        />
        {sugeridoId && destino === sugeridoId ? (
          <p className="text-xs text-muted-foreground">Sugerido: el ambiente del que proviene.</p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
