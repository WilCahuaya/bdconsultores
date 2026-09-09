"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { saveVidaLey, type VidaLeyRow } from "@/lib/actions/ficha";
import { Field, DateField } from "@/components/fields";

export function FichaVidaLey({
  relacionId,
  vidaLey,
  canWrite,
}: {
  relacionId: string;
  vidaLey: VidaLeyRow | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setOk(false);
    const result = await saveVidaLey(relacionId, formData);
    setPending(false);
    if (result.error) setError(result.error);
    else {
      setOk(true);
      router.refresh();
    }
  }

  return (
    <form action={onSubmit} className={`${panelCardClass} space-y-4 p-5`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estado" name="estado" defaultValue={vidaLey?.estado} readOnly={!canWrite} />
        <Field label="N° póliza" name="numero_poliza" defaultValue={vidaLey?.numero_poliza} readOnly={!canWrite} />
        <DateField label="Inicio" name="fecha_inicio" defaultValue={vidaLey?.fecha_inicio} readOnly={!canWrite} />
        <DateField label="Fin" name="fecha_fin" defaultValue={vidaLey?.fecha_fin} readOnly={!canWrite} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-primary">Vida Ley guardada.</p> : null}
      {canWrite ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar Vida Ley"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Solo consulta.</p>
      )}
    </form>
  );
}
