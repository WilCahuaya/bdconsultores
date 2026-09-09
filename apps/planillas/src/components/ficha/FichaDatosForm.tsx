"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@inventario/ui";
import { updateDatosTrabajador, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { CLASIFICACION_LABEL, JORNADA_LABEL, cargoCanonico, opcionesCargo } from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";
import { HorarioLaboralField } from "@/components/ficha/HorarioLaboralField";

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
  const [jornada, setJornada] = useState(trabajador.jornada ?? "");
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
    <form action={onSubmit} className="space-y-4">
      <FormSection title="Persona" hint="Datos de la persona. El DNI no se cambia. La dirección sí va en el contrato.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="DNI" name="dni" defaultValue={p.dni} readOnly />
          <Field label="Nombres" name="nombres" defaultValue={p.nombres} required readOnly={!canWrite} />
          <Field label="Apellido paterno" name="apellido_paterno" defaultValue={p.apellido_paterno} readOnly={!canWrite} />
          <Field label="Apellido materno" name="apellido_materno" defaultValue={p.apellido_materno} readOnly={!canWrite} />
          <DateField label="Fecha de nacimiento" name="fecha_nacimiento" defaultValue={p.fecha_nacimiento} readOnly={!canWrite} />
          <Field label="Celular" name="celular" defaultValue={p.celular} readOnly={!canWrite} />
          <Field label="Correo" name="correo" type="email" defaultValue={p.correo} readOnly={!canWrite} />
          <Field label="Dirección" name="direccion" defaultValue={p.direccion} readOnly={!canWrite} />
        </div>
      </FormSection>
      <FormSection title="Puesto en esta empresa" hint="Cargo, jornada y horario de esta relación laboral.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Cargo"
            name="cargo"
            defaultValue={cargoCanonico(trabajador.cargo) ?? trabajador.cargo}
            allowEmpty
            disabled={!canWrite}
            options={opcionesCargo(trabajador.cargo)}
          />
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
            value={jornada}
            allowEmpty
            disabled={!canWrite}
            options={Object.entries(JORNADA_LABEL).map(([value, label]) => ({ value, label }))}
            onChange={(event) => setJornada(event.target.value)}
          />
          <HorarioLaboralField jornada={jornada} defaultValue={trabajador.horario} readOnly={!canWrite} />
          <DateField label="Fecha de ingreso" name="fecha_ingreso" defaultValue={trabajador.fecha_ingreso} readOnly={!canWrite} />
          <DateField label="Fecha de cese" name="fecha_cese" defaultValue={trabajador.fecha_cese} readOnly={!canWrite} />
        </div>
      </FormSection>
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
