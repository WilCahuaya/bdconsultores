"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { savePension, type PensionRow } from "@/lib/actions/ficha";
import { TIPO_PENSION_LABEL, TRAMITE_PENSION_LABEL } from "@/lib/planillas-labels";
import { Field, SelectField } from "@/components/fields";

export function FichaPensiones({
  relacionId,
  pension,
  canWrite,
}: {
  relacionId: string;
  pension: PensionRow | null;
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
    const result = await savePension(relacionId, formData);
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
        <SelectField
          label="Sistema"
          name="tipo"
          defaultValue={pension?.tipo ?? "AFP"}
          disabled={!canWrite}
          options={Object.entries(TIPO_PENSION_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Field label="AFP" name="afp_nombre" defaultValue={pension?.afp_nombre} readOnly={!canWrite} />
        <Field label="CUSPP" name="cuspp" defaultValue={pension?.cuspp} readOnly={!canWrite} />
        <SelectField
          label="Trámite AFP"
          name="tramite_estado"
          defaultValue={pension?.tramite_estado ?? "PENDIENTE"}
          disabled={!canWrite}
          options={Object.entries(TRAMITE_PENSION_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Field label="Fecha de trámite" name="fecha_tramite" type="date" defaultValue={pension?.fecha_tramite} readOnly={!canWrite} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-primary">Pensiones guardadas.</p> : null}
      {canWrite ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar pensiones"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Solo consulta.</p>
      )}
    </form>
  );
}
