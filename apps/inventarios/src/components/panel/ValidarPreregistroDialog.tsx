"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Ambiente, Sede } from "@inventario/types";
import { entidadMuestraSelectorSede, sedeIdSinSelector } from "@inventario/types";
import { Button, Dialog, Label, Select } from "@inventario/ui";
import { registrarActivo } from "@/lib/actions/activos";
import { listAmbientes, listSedes } from "@/lib/actions/ubicacion";

interface ValidarPreregistroDialogProps {
  open: boolean;
  onClose: () => void;
  entidadId: string;
  activoId: string;
  nombre: string;
  codigoCatalogo?: string;
  posibleAmbienteId?: string | null;
  posibleAmbienteNombre?: string | null;
  onSuccess?: () => void;
}

export function ValidarPreregistroDialog({
  open,
  onClose,
  entidadId,
  activoId,
  nombre,
  codigoCatalogo,
  posibleAmbienteId,
  posibleAmbienteNombre,
  onSuccess,
}: ValidarPreregistroDialogProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [sedeId, setSedeId] = useState("");
  const [ambienteId, setAmbienteId] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPending(false);
    setSedeId("");
    setAmbienteId("");
    void listSedes(entidadId).then((data) => {
      setSedes(data);
      const implicitId = sedeIdSinSelector(data);
      if (implicitId) setSedeId(implicitId);
    });
  }, [open, entidadId]);

  const mostrarSelectorSede = entidadMuestraSelectorSede(sedes);

  useEffect(() => {
    if (!open || !posibleAmbienteId || sedes.length === 0) return;

    void (async () => {
      for (const sede of sedes) {
        const ambientesSede = await listAmbientes(sede.id);
        const match = ambientesSede.find((a) => a.id === posibleAmbienteId);
        if (match) {
          setSedeId(sede.id);
          setAmbienteId(match.id);
          setAmbientes(ambientesSede);
          return;
        }
      }
    })();
  }, [open, posibleAmbienteId, sedes]);

  useEffect(() => {
    if (!sedeId) {
      setAmbientes([]);
      if (!posibleAmbienteId) setAmbienteId("");
      return;
    }
    void listAmbientes(sedeId).then((data) => {
      setAmbientes(data);
      if (ambienteId && !data.some((a) => a.id === ambienteId)) {
        setAmbienteId("");
      }
    });
  }, [sedeId, posibleAmbienteId, ambienteId]);

  async function handleConfirm() {
    if (!sedeId || !ambienteId) {
      setError("Seleccione el ambiente donde registrará el bien.");
      return;
    }

    setPending(true);
    setError(null);
    const result = await registrarActivo(activoId, { sedeId, ambienteId });
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onClose();
    onSuccess?.();
    router.refresh();
  }

  const descripcion = codigoCatalogo
    ? `«${nombre}» (catálogo ${codigoCatalogo}) pasará a REGISTRADO con código de barras.`
    : `«${nombre}» pasará a REGISTRADO con código de barras.`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Validar preregistro"
      description={descripcion}
      className="max-w-md"
    >
      <div className="space-y-4">
        {posibleAmbienteNombre && (
          <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
            Posible ambiente sugerido: <strong>{posibleAmbienteNombre}</strong>
          </p>
        )}

        {mostrarSelectorSede && (
        <div className="space-y-2">
          <Label htmlFor="validar-sede">Sede destino</Label>
          <Select
            id="validar-sede"
            value={sedeId}
            onChange={(value) => {
              setSedeId(value);
              setAmbienteId("");
            }}
            options={[
              { value: "", label: "Seleccione…" },
              ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
            ]}
          />
        </div>
        )}

        {(sedeId || !mostrarSelectorSede) && (
          <div className="space-y-2">
            <Label htmlFor="validar-ambiente">Ambiente destino</Label>
            <Select
              id="validar-ambiente"
              value={ambienteId}
              onChange={setAmbienteId}
              options={[
                { value: "", label: "Seleccione…" },
                ...ambientes.map((a) => ({ value: a.id, label: a.nombre })),
              ]}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={pending || !sedeId || !ambienteId}
          >
            {pending ? "Registrando…" : "Validar y registrar"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
