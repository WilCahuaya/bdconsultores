"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { createTrabajador } from "@/lib/actions/trabajadores";
import { CLASIFICACION_LABEL, JORNADA_LABEL } from "@/lib/planillas-labels";
import { Field, SelectField } from "@/components/fields";
import type { Entidad } from "@inventario/types";

export function NuevoTrabajadorForm({
  entidades,
  defaultEntidadId,
}: {
  entidades: Entidad[];
  defaultEntidadId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createTrabajador(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.relacionId) router.push(`/trabajadores/${result.relacionId}`);
  }

  return (
    <form action={onSubmit} className={`${panelCardClass} space-y-5 p-5`}>
      <p className="text-sm text-muted-foreground">
        Si el DNI ya está registrado, se reutiliza esa persona y se crea la relación en esta empresa.
      </p>
      <SelectField
        label="Empresa"
        name="entidad_id"
        defaultValue={defaultEntidadId}
        options={entidades.map((e) => ({ value: e.id, label: e.nombre }))}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="DNI" name="dni" required />
        <Field label="Nombres" name="nombres" required />
        <Field label="Apellido paterno" name="apellido_paterno" />
        <Field label="Apellido materno" name="apellido_materno" />
        <Field label="Fecha de nacimiento" name="fecha_nacimiento" type="date" />
        <Field label="Celular" name="celular" />
        <Field label="Correo" name="correo" type="email" />
        <Field label="Dirección" name="direccion" />
        <Field label="Cargo" name="cargo" />
        <SelectField
          label="Clasificación"
          name="clasificacion"
          allowEmpty
          options={Object.entries(CLASIFICACION_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Jornada"
          name="jornada"
          allowEmpty
          options={Object.entries(JORNADA_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Field label="Fecha de ingreso" name="fecha_ingreso" type="date" />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Registrar trabajador"}
      </Button>
    </form>
  );
}
