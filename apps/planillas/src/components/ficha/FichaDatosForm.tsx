"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import {
  updatePersonaTrabajador,
  updatePuestoTrabajador,
  type TrabajadorListItem,
} from "@/lib/actions/trabajadores";
import { CLASIFICACION_LABEL, JORNADA_LABEL, cargoCanonico, opcionesCargo } from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";
import { HorarioLaboralField } from "@/components/ficha/HorarioLaboralField";

export function FichaPersonaForm({
  trabajador,
  canWrite,
}: {
  trabajador: TrabajadorListItem;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const p = trabajador.persona;

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await updatePersonaTrabajador(trabajador.id, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Persona guardada.");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <FormSection title="Persona" hint="Estos datos salen del DNI y de la ficha. El DNI no se cambia. La dirección sí va en el contrato.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="DNI" name="dni" defaultValue={p.dni} readOnly />
          <Field label="Nombres" name="nombres" defaultValue={p.nombres} required readOnly={!canWrite} />
          <Field label="Apellido paterno" name="apellido_paterno" defaultValue={p.apellido_paterno} readOnly={!canWrite} />
          <Field label="Apellido materno" name="apellido_materno" defaultValue={p.apellido_materno} readOnly={!canWrite} />
          <DateField label="Fecha de nacimiento" name="fecha_nacimiento" defaultValue={p.fecha_nacimiento} readOnly={!canWrite} />
          <Field label="Celular" name="celular" defaultValue={p.celular} readOnly={!canWrite} />
          <Field label="Correo" name="correo" type="email" defaultValue={p.correo} readOnly={!canWrite} />
          <Field label="Dirección" name="direccion" defaultValue={p.direccion} readOnly={!canWrite} />
          <Field
            label="Asignación familiar (según ficha)"
            name="recibe_asignacion_familiar_vista"
            defaultValue={
              trabajador.recibe_asignacion_familiar === true
                ? "Sí"
                : trabajador.recibe_asignacion_familiar === false
                  ? "No"
                  : "Aún no indicado en la ficha"
            }
            readOnly
          />
        </div>
      </FormSection>
      {canWrite ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar persona"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Solo consulta.</p>
      )}
    </form>
  );
}

export function FichaPuestoForm({
  trabajador,
  canWrite,
}: {
  trabajador: TrabajadorListItem;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [jornada, setJornada] = useState(trabajador.jornada ?? "");

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await updatePuestoTrabajador(trabajador.id, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Puesto guardado.");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <FormSection
        title="Puesto en esta empresa"
        hint="La fecha de ingreso no cambia con cada contrato. El cese es cuando deja la empresa."
      >
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
          <DateField
            label="Fecha de ingreso a la empresa"
            name="fecha_ingreso"
            defaultValue={trabajador.fecha_ingreso}
            readOnly={!canWrite}
          />
          <DateField
            label="Fecha de cese en la empresa"
            name="fecha_cese"
            defaultValue={trabajador.fecha_cese}
            readOnly={!canWrite}
          />
        </div>
      </FormSection>
      {canWrite ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar puesto"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Solo consulta.</p>
      )}
    </form>
  );
}
