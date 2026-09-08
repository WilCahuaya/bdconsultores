"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { addDocumento, type DocumentoRow } from "@/lib/actions/ficha";
import { ESTADO_DOCUMENTO_LABEL, TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { Field, SelectField } from "@/components/fields";

export function FichaDocumentos({
  relacionId,
  documentos,
  canWrite,
}: {
  relacionId: string;
  documentos: DocumentoRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await addDocumento(relacionId, formData);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className={`${panelCardClass} divide-y p-0`}>
        {documentos.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Aún no hay documentos registrados. La carga de PDF viene después.</li>
        ) : (
          documentos.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>{TIPO_DOCUMENTO_LABEL[d.tipo]}</span>
              <span className="text-muted-foreground">{ESTADO_DOCUMENTO_LABEL[d.estado]}</span>
            </li>
          ))
        )}
      </ul>
      {canWrite ? (
        <form action={onSubmit} key={documentos.length} className={`${panelCardClass} space-y-4 p-5`}>
          <p className="text-sm font-medium">Registrar documento (checklist)</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tipo"
              name="tipo"
              options={Object.entries(TIPO_DOCUMENTO_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <SelectField
              label="Estado"
              name="estado"
              defaultValue="PENDIENTE"
              options={Object.entries(ESTADO_DOCUMENTO_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <Field label="Observaciones" name="observaciones" />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
