"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import {
  updatePersonaTrabajador,
  updatePuestoTrabajador,
  type TrabajadorListItem,
} from "@/lib/actions/trabajadores";
import {
  CLASIFICACION_LABEL,
  JORNADA_LABEL,
  cargoCanonico,
  formatFechaPlanilla,
  formatNumeroTrabajador,
  formatRemuneracion,
  montoAsignacionFamiliar,
  opcionesCargo,
} from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";
import { HorarioLaboralField } from "@/components/ficha/HorarioLaboralField";
import { DireccionAfpnetFields, direccionAfpnetDesdePersona } from "@/components/ficha/DireccionAfpnetFields";
import { DocumentoPrevisualizacion, MarcoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { nombreBaseContrato } from "@/lib/nombre-archivo";
import { contratoConfirmado, contratoPrimeroFirmado, type FlujoContrato, type FlujoDocumento } from "@/lib/flujo-ficha";

function respaldoFirmado(
  contrato: FlujoContrato | null,
  documentos: FlujoDocumento[],
  titulos: { contrato: string; solicitud: string },
): { path: string; titulo: string } | null {
  if (!contrato) return null;
  if (contrato.documento_id) {
    const propio = documentos.find(
      (documento) => documento.id === contrato.documento_id && documento.estado === "SI" && documento.storage_path,
    );
    if (propio?.storage_path) return { path: propio.storage_path, titulo: titulos.contrato };
  }
  const solicitud = contrato.solicitud_storage_path?.trim();
  if (solicitud) return { path: solicitud, titulo: titulos.solicitud };
  return null;
}

function nombreContratoArchivo(trabajador: TrabajadorListItem, contrato: FlujoContrato | null): string | null {
  const jornada = trabajador.jornada;
  const cargo = trabajador.cargo;
  const fecha = contrato?.fecha_inicio ?? trabajador.fecha_ingreso;
  if ((jornada !== "TIEMPO_COMPLETO" && jornada !== "TIEMPO_PARCIAL") || !cargo || !fecha) return null;
  return nombreBaseContrato({
    numero: trabajador.numero,
    jornada,
    cargo,
    nombres: trabajador.persona.nombres,
    apellidoPaterno: trabajador.persona.apellido_paterno,
    fecha,
  });
}

function hintFechaIngreso(fechaIngreso: string | null, primero: FlujoContrato | null): string {
  if (!primero) return "Todavía no hay contrato ni solicitud firmado. Escriba el primer día en la empresa.";
  const fechaDoc = primero.fecha_inicio ? formatFechaPlanilla(primero.fecha_inicio) : null;
  if (fechaDoc && fechaIngreso && fechaIngreso !== primero.fecha_inicio) {
    return `En el primer documento figura ${fechaDoc}. Compárela con la previsualización y corríjala si no coincide.`;
  }
  return "Compárela con el primer contrato o solicitud firmado. Puede corregirla si no coincide.";
}

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
  const [direccion, setDireccion] = useState(() => direccionAfpnetDesdePersona(p));

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
      <FormSection title="Persona" hint="Revise lo capturado en Documentos. El DNI no se cambia. Región, provincia y distrito se eligen; la dirección armada entra al contrato y a AFPNet.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="DNI" name="dni" defaultValue={p.dni} readOnly copyable />
          <Field label="Nombres" name="nombres" defaultValue={p.nombres} required readOnly={!canWrite} />
          <Field label="Apellido paterno" name="apellido_paterno" defaultValue={p.apellido_paterno} readOnly={!canWrite} />
          <Field label="Apellido materno" name="apellido_materno" defaultValue={p.apellido_materno} readOnly={!canWrite} />
          <DateField label="Fecha de nacimiento" name="fecha_nacimiento" defaultValue={p.fecha_nacimiento} readOnly={!canWrite} />
          <Field label="Celular" name="celular" defaultValue={p.celular} inputMode="tel" readOnly={!canWrite} />
          <Field label="Correo" name="correo" type="email" defaultValue={p.correo} readOnly={!canWrite} />
          <DireccionAfpnetFields value={direccion} onChange={setDireccion} canWrite={canWrite} />
          <Field
            label="Asignación familiar (según ficha)"
            name="recibe_asignacion_familiar_vista"
            defaultValue={
              trabajador.recibe_asignacion_familiar === true
                ? `Sí · S/ ${formatRemuneracion(montoAsignacionFamiliar(true))}`
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
  const cesada = trabajador.estado === "CESADA";
  const vigente = contratoConfirmado(trabajador.contratos);
  const primero = contratoPrimeroFirmado(trabajador.contratos);
  const firmadoVigente = respaldoFirmado(vigente, trabajador.documentos, {
    contrato: "Contrato firmado vigente",
    solicitud: "Solicitud de registro vigente",
  });
  const firmadoPrimero = respaldoFirmado(primero, trabajador.documentos, {
    contrato: "Primer contrato firmado",
    solicitud: "Primera solicitud firmada",
  });

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
    <MarcoPrevisualizacion
      titulo={firmadoVigente?.titulo ?? "Contrato o solicitud vigente"}
      storagePath={firmadoVigente?.path ?? null}
      nombreDescarga={firmadoVigente ? nombreContratoArchivo(trabajador, vigente) : null}
    >
    <div className="space-y-4">
      {cesada ? (
        <p className="text-sm text-muted-foreground">
          Dado de baja el {formatFechaPlanilla(trabajador.fecha_cese)}. El cese es de la empresa, no de un contrato.
        </p>
      ) : null}
      <form action={onSubmit} className="space-y-4">
        <FormSection
          title="Puesto en esta empresa"
          hint="Cargo, horario y jornada salen del último contrato o solicitud firmado. La fecha de ingreso sale del primero; si todavía no hay uno, escríbala aquí."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nº"
              name="numero"
              required={canWrite}
              readOnly={!canWrite}
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]{1,4}"
              placeholder="01"
              title="Número del trabajador, por ejemplo 01"
              defaultValue={formatNumeroTrabajador(trabajador.numero)}
            />
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
            <div className="space-y-3 sm:col-span-2">
              <DateField
                label="Fecha de ingreso a la empresa"
                name="fecha_ingreso"
                defaultValue={trabajador.fecha_ingreso || primero?.fecha_inicio || ""}
                readOnly={!canWrite}
                hint={hintFechaIngreso(trabajador.fecha_ingreso, primero)}
              />
              {firmadoPrimero ? (
                <DocumentoPrevisualizacion
                  titulo={firmadoPrimero.titulo}
                  storagePath={firmadoPrimero.path}
                  nombreDescarga={nombreContratoArchivo(trabajador, primero)}
                />
              ) : null}
            </div>
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
    </div>
    </MarcoPrevisualizacion>
  );
}
