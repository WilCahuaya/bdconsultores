"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { savePension, type PensionRow } from "@/lib/actions/ficha";
import { TIPO_PENSION_LABEL, TRAMITE_PENSION_LABEL } from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";

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
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await savePension(relacionId, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Pensiones guardadas.");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <FormSection title="AFP / ONP" hint="El tipo (AFP u ONP) se marca en Documentos. Aquí el estudio registra el alta de AFP (nombre, CUSPP y trámite).">
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
        <DateField label="Fecha de trámite" name="fecha_tramite" defaultValue={pension?.fecha_tramite} readOnly={!canWrite} />
      </div>
      {canWrite ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar pensiones"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Solo consulta.</p>
      )}
      </FormSection>
    </form>
  );
}
