"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, FileInput, useToast } from "@inventario/ui";
import { TIPOS_DOCUMENTO_BAJA, type TipoDocumentoPlanilla } from "@inventario/types";
import {
  darDeBajaTrabajador,
  updatePersonaTrabajador,
  updatePuestoTrabajador,
  type TrabajadorListItem,
} from "@/lib/actions/trabajadores";
import { addDocumento, setDocumentoArchivo } from "@/lib/actions/ficha";
import {
  CLASIFICACION_LABEL,
  JORNADA_LABEL,
  TIPO_DOCUMENTO_LABEL,
  cargoCanonico,
  formatFechaPlanilla,
  formatRemuneracion,
  montoAsignacionFamiliar,
  opcionesCargo,
} from "@/lib/planillas-labels";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";
import { documentoCargado } from "@/lib/flujo-ficha";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";
import { HorarioLaboralField } from "@/components/ficha/HorarioLaboralField";
import { DireccionAfpnetFields, direccionAfpnetDesdePersona } from "@/components/ficha/DireccionAfpnetFields";

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
  const [bajaPending, setBajaPending] = useState(false);
  const [mostrarBaja, setMostrarBaja] = useState(false);
  const [fechaCese, setFechaCese] = useState("");
  const [tipoBaja, setTipoBaja] = useState<TipoDocumentoPlanilla>("CARTA_RENUNCIA");
  const [archivoBaja, setArchivoBaja] = useState<File | null>(null);
  const [archivoTrBaja, setArchivoTrBaja] = useState<File | null>(null);
  const [jornada, setJornada] = useState(trabajador.jornada ?? "");
  const cesada = trabajador.estado === "CESADA";
  const yaHaySustentoBaja = TIPOS_DOCUMENTO_BAJA.some((tipo) => documentoCargado(trabajador.documentos, tipo));
  const yaHayTrBaja = documentoCargado(trabajador.documentos, "TR_BAJA");

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

  async function subirDocumento(tipo: TipoDocumentoPlanilla, file: File): Promise<string | null> {
    const data = new FormData();
    data.set("tipo", tipo);
    data.set("estado", "PENDIENTE");
    const created = await addDocumento(trabajador.id, data);
    if (created.error || !created.documentoId) {
      return created.error ?? "No se pudo registrar el documento de baja.";
    }
    const upload = await uploadDocumentoFile(trabajador.entidad_id, trabajador.id, created.documentoId, file);
    if (upload.error || !upload.path) {
      return upload.error ?? "No se pudo subir el documento de baja.";
    }
    const savedFile = await setDocumentoArchivo(trabajador.id, created.documentoId, upload.path);
    return savedFile.error ?? null;
  }

  async function onBaja() {
    if (!fechaCese.trim()) return;
    if (!yaHaySustentoBaja && !archivoBaja) {
      pushToast("Suba la carta de renuncia o el término de contrato.", "error");
      return;
    }
    if (!yaHayTrBaja && !archivoTrBaja) {
      pushToast("Suba el documento de T-Registro baja.", "error");
      return;
    }
    setBajaPending(true);
    if (archivoBaja) {
      const errorSustento = await subirDocumento(tipoBaja, archivoBaja);
      if (errorSustento) {
        setBajaPending(false);
        pushToast(errorSustento, "error");
        return;
      }
    }
    if (archivoTrBaja) {
      const errorTr = await subirDocumento("TR_BAJA", archivoTrBaja);
      if (errorTr) {
        setBajaPending(false);
        pushToast(errorTr, "error");
        return;
      }
    }
    const form = new FormData();
    form.set("fecha_cese", fechaCese);
    const result = await darDeBajaTrabajador(trabajador.id, form);
    setBajaPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setMostrarBaja(false);
    setArchivoBaja(null);
    setArchivoTrBaja(null);
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
        description="La ficha pasa a cesada. La fecha de cese es de la empresa, no del fin de un contrato. Hace falta la carta de renuncia o el término de contrato, y el documento de T-Registro baja."
        confirmLabel="Dar de baja"
        confirmVariant="destructive"
        pending={bajaPending}
        confirmDisabled={!fechaCese.trim() || (!yaHaySustentoBaja && !archivoBaja) || (!yaHayTrBaja && !archivoTrBaja)}
        onConfirm={() => void onBaja()}
      >
        <DateField label="Fecha de cese en la empresa" name="fecha_cese" value={fechaCese} onChange={setFechaCese} />
        <SelectField
          label="Documento de baja"
          name="tipo_baja"
          value={tipoBaja}
          options={TIPOS_DOCUMENTO_BAJA.map((tipo) => ({ value: tipo, label: TIPO_DOCUMENTO_LABEL[tipo] }))}
          onChange={(event) => setTipoBaja(event.target.value as TipoDocumentoPlanilla)}
        />
        <FileInput
          accept={DOCUMENTO_ACCEPT}
          disabled={bajaPending}
          file={archivoBaja}
          buttonLabel={archivoBaja ? "Cambiar archivo" : "Subir documento"}
          emptyLabel={
            yaHaySustentoBaja
              ? "Ya hay un documento de baja. Puede subir otro o usar el que está."
              : "PDF, JPG, PNG o WEBP. Máximo 10 MB."
          }
          onFileChange={setArchivoBaja}
        />
        <FileInput
          accept={DOCUMENTO_ACCEPT}
          disabled={bajaPending}
          file={archivoTrBaja}
          buttonLabel={archivoTrBaja ? "Cambiar T-Registro baja" : "Subir T-Registro baja"}
          emptyLabel={
            yaHayTrBaja
              ? "Ya hay T-Registro baja. Puede subir otro o usar el que está."
              : "Constancia de baja en T-Registro. PDF, JPG, PNG o WEBP. Máximo 10 MB."
          }
          onFileChange={setArchivoTrBaja}
        />
      </ConfirmDialog>
    </div>
  );
}
