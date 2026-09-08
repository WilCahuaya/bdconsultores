"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { updateDatosTrabajador, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { CLASIFICACION_LABEL, JORNADA_LABEL } from "@/lib/planillas-labels";
import { Field, SelectField } from "@/components/fields";

export function FichaDatosForm({
  trabajador,
  canWrite,
}: {
  trabajador: TrabajadorListItem;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);
  const p = trabajador.persona;

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setOk(false);
    const result = await updateDatosTrabajador(trabajador.id, formData);
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
        <Field label="DNI" name="dni" defaultValue={p.dni} readOnly />
        <Field label="Nombres" name="nombres" defaultValue={p.nombres} required readOnly={!canWrite} />
        <Field label="Apellido paterno" name="apellido_paterno" defaultValue={p.apellido_paterno} readOnly={!canWrite} />
        <Field label="Apellido materno" name="apellido_materno" defaultValue={p.apellido_materno} readOnly={!canWrite} />
        <Field label="Fecha de nacimiento" name="fecha_nacimiento" type="date" defaultValue={p.fecha_nacimiento} readOnly={!canWrite} />
        <Field label="Celular" name="celular" defaultValue={p.celular} readOnly={!canWrite} />
        <Field label="Correo" name="correo" type="email" defaultValue={p.correo} readOnly={!canWrite} />
        <Field label="Dirección" name="direccion" defaultValue={p.direccion} readOnly={!canWrite} />
        <Field label="Cargo" name="cargo" defaultValue={trabajador.cargo} readOnly={!canWrite} />
        <SelectField
          label="Clasificación"
          name="clasificacion"
          defaultValue={trabajador.clasificacion}
          allowEmpty
          disabled={!canWrite}
          options={Object.entries(CLASIFICACION_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Jornada"
          name="jornada"
          defaultValue={trabajador.jornada}
          allowEmpty
          disabled={!canWrite}
          options={Object.entries(JORNADA_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Field label="Fecha de ingreso" name="fecha_ingreso" type="date" defaultValue={trabajador.fecha_ingreso} readOnly={!canWrite} />
        <Field label="Fecha de cese" name="fecha_cese" type="date" defaultValue={trabajador.fecha_cese} readOnly={!canWrite} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-primary">Datos guardados.</p> : null}
      {canWrite ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar datos"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Solo consulta.</p>
      )}
    </form>
  );
}
