"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { addContrato, type ContratoRow } from "@/lib/actions/ficha";
import { ESTADO_CONTRATO_LABEL, formatFechaPlanilla, formatRemuneracion } from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";

export function FichaContratos({
  relacionId,
  contratos,
  canWrite,
}: {
  relacionId: string;
  contratos: ContratoRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await addContrato(relacionId, formData);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className={`${panelCardClass} overflow-x-auto p-0`}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Versión</th>
              <th className="px-4 py-2 font-medium">Inicio</th>
              <th className="px-4 py-2 font-medium">Fin</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Remuneración</th>
              <th className="px-4 py-2 font-medium">Vigente</th>
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                  Aún no hay contratos.
                </td>
              </tr>
            ) : (
              contratos.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{c.version}</td>
                  <td className="px-4 py-2">{formatFechaPlanilla(c.fecha_inicio)}</td>
                  <td className="px-4 py-2">{formatFechaPlanilla(c.fecha_fin)}</td>
                  <td className="px-4 py-2">{ESTADO_CONTRATO_LABEL[c.estado]}</td>
                  <td className="px-4 py-2">{formatRemuneracion(c.remuneracion)}</td>
                  <td className="px-4 py-2">{c.es_vigente ? "Sí" : "No"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canWrite ? (
        <form action={onSubmit} key={contratos.length}>
          <FormSection title="Nueva versión" hint="Sin número de contrato. Jornada y horario están en el puesto.">
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField label="Inicio" name="fecha_inicio" />
              <DateField label="Fin" name="fecha_fin" />
              <Field label="Remuneración" name="remuneracion" type="number" />
              <SelectField
                label="Estado"
                name="estado"
                defaultValue="PENDIENTE_DOCS"
                options={Object.entries(ESTADO_CONTRATO_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" name="es_vigente" defaultChecked />
                Marcar como vigente
              </label>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar contrato"}
            </Button>
          </FormSection>
        </form>
      ) : null}
    </div>
  );
}
