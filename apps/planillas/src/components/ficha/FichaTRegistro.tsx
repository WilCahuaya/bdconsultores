"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { addTRegistro, type TRegistroRow } from "@/lib/actions/ficha";
import { TIPO_T_REGISTRO_LABEL, formatFechaPlanilla } from "@/lib/planillas-labels";
import { Field, DateField, SelectField } from "@/components/fields";

export function FichaTRegistro({
  relacionId,
  items,
  canWrite,
}: {
  relacionId: string;
  items: TRegistroRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(items.length === 0);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await addTRegistro(relacionId, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setMostrarForm(false);
    pushToast("Registro guardado.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className={`${panelCardClass} divide-y p-0`}>
        {items.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Sin altas ni bajas registradas.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {TIPO_T_REGISTRO_LABEL[item.tipo]}
                {item.fecha ? ` · ${formatFechaPlanilla(item.fecha)}` : ""}
              </span>
              <span className="text-muted-foreground">{item.realizado ? "Realizado" : "Pendiente"}</span>
            </li>
          ))
        )}
      </ul>
      {canWrite && !mostrarForm ? (
        <Button type="button" variant="outline" onClick={() => setMostrarForm(true)}>
          Registrar alta o baja
        </Button>
      ) : null}
      {canWrite && mostrarForm ? (
        <form action={onSubmit} key={items.length} className={`${panelCardClass} space-y-4 p-5`}>
          <p className="text-sm font-medium">Registrar alta o baja</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tipo"
              name="tipo"
              options={Object.entries(TIPO_T_REGISTRO_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <DateField label="Fecha" name="fecha" />
            <Field label="Observaciones" name="observaciones" />
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="realizado" />
              Ya se realizó en T-Registro
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar"}
            </Button>
            {items.length > 0 ? (
              <Button type="button" variant="outline" disabled={pending} onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
