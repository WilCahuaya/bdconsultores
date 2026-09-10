"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, useToast } from "@inventario/ui";
import {
  darDeBajaTrabajador,
  updatePersonaTrabajador,
  updatePuestoTrabajador,
  type TrabajadorListItem,
} from "@/lib/actions/trabajadores";
import {
  CLASIFICACION_LABEL,
  JORNADA_LABEL,
  cargoCanonico,
  formatFechaPlanilla,
  opcionesCargo,
  opcionesTipoVia,
} from "@/lib/planillas-labels";
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
      <FormSection title="Persona" hint="Revise lo capturado en Documentos. El DNI no se cambia. Tipo de vía, nombre, número, referencia, distrito, provincia y región salen en AFPNet y la dirección armada entra al contrato.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="DNI" name="dni" defaultValue={p.dni} readOnly />
          <Field label="Nombres" name="nombres" defaultValue={p.nombres} required readOnly={!canWrite} />
          <Field label="Apellido paterno" name="apellido_paterno" defaultValue={p.apellido_paterno} readOnly={!canWrite} />
          <Field label="Apellido materno" name="apellido_materno" defaultValue={p.apellido_materno} readOnly={!canWrite} />
          <DateField label="Fecha de nacimiento" name="fecha_nacimiento" defaultValue={p.fecha_nacimiento} readOnly={!canWrite} />
          <Field label="Celular" name="celular" defaultValue={p.celular} inputMode="tel" readOnly={!canWrite} />
          <Field label="Correo" name="correo" type="email" defaultValue={p.correo} readOnly={!canWrite} />
          <SelectField
            label="Tipo de vía"
            name="tipo_via"
            defaultValue={p.tipo_via}
            allowEmpty
            disabled={!canWrite}
            options={opcionesTipoVia(p.tipo_via)}
          />
          <Field label="Nombre de avenida, calle o jirón" name="via_nombre" defaultValue={p.via_nombre} readOnly={!canWrite} />
          <Field label="Número de casa" name="via_numero" defaultValue={p.via_numero} readOnly={!canWrite} />
          <Field
            label="Referencia"
            name="referencia"
            defaultValue={p.referencia}
            placeholder="Si no tiene número de casa"
            readOnly={!canWrite}
          />
          <Field label="Distrito" name="distrito" defaultValue={p.distrito} readOnly={!canWrite} />
          <Field label="Provincia" name="provincia" defaultValue={p.provincia} readOnly={!canWrite} />
          <Field label="Región" name="region" defaultValue={p.region} readOnly={!canWrite} />
          <input type="hidden" name="direccion" defaultValue={p.direccion ?? ""} />
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
  const [bajaPending, setBajaPending] = useState(false);
  const [mostrarBaja, setMostrarBaja] = useState(false);
  const [fechaCese, setFechaCese] = useState("");
  const [jornada, setJornada] = useState(trabajador.jornada ?? "");
  const cesada = trabajador.estado === "CESADA";

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

  async function onBaja() {
    const form = new FormData();
    form.set("fecha_cese", fechaCese);
    setBajaPending(true);
    const result = await darDeBajaTrabajador(trabajador.id, form);
    setBajaPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setMostrarBaja(false);
    pushToast("Trabajador dado de baja.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form action={onSubmit} className="space-y-4">
        <FormSection
          title="Puesto en esta empresa"
          hint="La fecha de ingreso es de la estadía en la empresa. No es el inicio de un contrato; puede haber varios contratos después."
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
            {cesada ? (
              <DateField
                label="Fecha de cese en la empresa"
                name="fecha_cese_vista"
                defaultValue={trabajador.fecha_cese}
                readOnly
              />
            ) : null}
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
      {cesada ? (
        <p className="text-sm text-muted-foreground">
          Dado de baja el {formatFechaPlanilla(trabajador.fecha_cese)}. El cese es de la empresa, no de un contrato.
        </p>
      ) : canWrite ? (
        <div className="space-y-2">
          <Button type="button" variant="outline" onClick={() => setMostrarBaja(true)}>
            Dar de baja
          </Button>
          <p className="text-sm text-muted-foreground">Solo cuando deja la empresa. El fin de un contrato no es un cese.</p>
        </div>
      ) : null}
      <ConfirmDialog
        open={mostrarBaja}
        onClose={() => {
          if (bajaPending) return;
          setMostrarBaja(false);
        }}
        title="Dar de baja"
        description="La ficha pasa a cesada. Esto no es el fin de un contrato: es cuando deja la empresa."
        confirmLabel="Dar de baja"
        confirmVariant="destructive"
        pending={bajaPending}
        confirmDisabled={!fechaCese.trim()}
        onConfirm={() => void onBaja()}
      >
        <DateField label="Fecha de cese en la empresa" name="fecha_cese" value={fechaCese} onChange={setFechaCese} />
      </ConfirmDialog>
    </div>
  );
}
