"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { savePension, setDocumentoArchivo, type DocumentoRow, type PensionRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import {
  AFPNET_URL,
  AFP_NOMBRES,
  TIPO_DOCUMENTO_LABEL,
  formatFechaPlanilla,
  nombreCompleto,
  urlPortalAfp,
} from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";
import { DatoAlta } from "@/components/ficha/DatoAlta";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";
import type { Entidad } from "@inventario/types";

function EnlaceAfpnet({ afpNombre }: { afpNombre?: string | null }) {
  const portal = urlPortalAfp(afpNombre);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={AFPNET_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Abrir AFPNet
      </a>
      {portal && afpNombre ? (
        <a
          href={portal}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Abrir {afpNombre}
        </a>
      ) : null}
    </div>
  );
}

export function FichaPensiones({
  relacionId,
  pension,
  trabajador,
  entidad,
  documentoPension,
  documentoTramiteAfp,
  canWrite,
}: {
  relacionId: string;
  pension: PensionRow | null;
  trabajador: TrabajadorListItem;
  entidad: Entidad | null;
  documentoPension: DocumentoRow | null;
  documentoTramiteAfp: DocumentoRow | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [fileAlta, setFileAlta] = useState<File | null>(null);
  const tipo = pension?.tipo ?? "";
  const esAfp = tipo === "AFP";
  const esOnp = tipo === "ONP";
  const persona = trabajador.persona;
  const nombre = nombreCompleto(persona);
  const fechaInicioLabor = trabajador.fecha_ingreso ? formatFechaPlanilla(trabajador.fecha_ingreso) : "";

  async function onSubmit(formData: FormData) {
    const afpNombre = String(formData.get("afp_nombre") ?? "").trim();
    const cuspp = String(formData.get("cuspp") ?? "").trim();
    const fechaAfiliacion = String(formData.get("fecha_tramite") ?? "").trim();
    const tieneDocumentoAlta = Boolean(fileAlta || documentoTramiteAfp?.storage_path);
    const afiliacionCompleta = Boolean(afpNombre && cuspp && fechaAfiliacion);
    if (tieneDocumentoAlta && !afiliacionCompleta) {
      pushToast("Complete el nombre de AFP, CUSPP y fecha de afiliación.", "error");
      return;
    }
    formData.set("tipo", "AFP");
    formData.set("tramite_estado", tieneDocumentoAlta || afiliacionCompleta ? "TRAMITADO" : "PENDIENTE");
    setPending(true);
    if (fileAlta) {
      if (!documentoTramiteAfp) {
        setPending(false);
        pushToast("No se pudo registrar el documento de alta AFP. Recargue la página.", "error");
        return;
      }
      const upload = await uploadDocumentoFile(
        trabajador.entidad_id,
        relacionId,
        documentoTramiteAfp.id,
        fileAlta,
        documentoTramiteAfp.storage_path,
      );
      if (upload.error || !upload.path) {
        setPending(false);
        pushToast(upload.error ?? "No se pudo subir el documento de alta AFP.", "error");
        return;
      }
      const savedFile = await setDocumentoArchivo(relacionId, documentoTramiteAfp.id, upload.path);
      if (savedFile.error) {
        setPending(false);
        pushToast(savedFile.error, "error");
        return;
      }
    }
    const result = await savePension(relacionId, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setFileAlta(null);
    pushToast("Sistema de pensión guardado.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <DocumentoPrevisualizacion
        titulo={TIPO_DOCUMENTO_LABEL.PENSIONES_FIRMADO}
        storagePath={documentoPension?.storage_path}
        vacio="Suba el sistema de pensiones en Documentos para verlo aquí."
      />

      {!tipo ? (
        <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
          En Documentos aún no se marcó AFP u ONP. El estudio no puede continuar el sistema de pensión hasta que la
          empresa lo indique.
        </p>
      ) : null}

      {esOnp ? (
        <section className={`${panelCardClass} space-y-2 p-5`}>
          <p className="text-sm font-medium">Sistema de pensión</p>
          <p className="text-sm">ONP</p>
          <p className="text-sm text-muted-foreground">
            Es ONP: no hay alta en AFP ni CUSPP. Puede seguir a T-Registro.
          </p>
        </section>
      ) : null}

      {esAfp ? (
        <>
          <section className={`${panelCardClass} space-y-3 p-5`}>
            <div>
              <p className="text-sm font-medium">Iniciar el trámite AFP</p>
              <p className="text-sm text-muted-foreground">
                Abra AFPNet, copie el DNI y los datos de abajo y péguelos en el alta. Si el alta ya está hecha, suba el
                documento más abajo.
              </p>
            </div>
            <EnlaceAfpnet afpNombre={pension?.afp_nombre} />
            <div className="grid gap-3 sm:grid-cols-2">
              <DatoAlta label="Empresa" value={entidad?.nombre ?? ""} />
              <DatoAlta label="RUC" value={entidad?.ruc ?? ""} />
              <DatoAlta label="DNI" value={persona.dni} />
              <DatoAlta label="Nombres y apellidos" value={nombre} />
              <DatoAlta
                label="Fecha de nacimiento"
                value={persona.fecha_nacimiento ? formatFechaPlanilla(persona.fecha_nacimiento) : ""}
              />
              <DatoAlta label="Tipo de vía" value={persona.tipo_via ?? ""} />
              <DatoAlta label="Nombre de avenida, calle o jirón" value={persona.via_nombre ?? ""} />
              <DatoAlta label="Número de casa" value={persona.via_numero ?? ""} />
              <DatoAlta label="Referencia" value={persona.referencia ?? ""} />
              <DatoAlta label="Distrito" value={persona.distrito ?? ""} />
              <DatoAlta label="Provincia" value={persona.provincia ?? ""} />
              <DatoAlta label="Región" value={persona.region ?? ""} />
              {!persona.tipo_via && !persona.via_nombre && persona.direccion ? (
                <DatoAlta label="Dirección (aún no partida)" value={persona.direccion} />
              ) : null}
              <DatoAlta label="Teléfono" value={persona.celular ?? ""} />
              <DatoAlta label="Correo" value={persona.correo ?? ""} />
              <DatoAlta label="Fecha de inicio de labor" value={fechaInicioLabor} />
            </div>
          </section>

          <form action={onSubmit} className="space-y-4">
            <DocumentoPrevisualizacion
              titulo={TIPO_DOCUMENTO_LABEL.TRAMITE_AFP}
              storagePath={fileAlta ? null : documentoTramiteAfp?.storage_path}
              file={fileAlta}
              vacio="O suba el documento de alta AFP y complete AFP, CUSPP y fecha de afiliación."
              extra={
                canWrite ? (
                  <FileInput
                    accept={DOCUMENTO_ACCEPT}
                    disabled={pending}
                    file={fileAlta}
                    buttonLabel={
                      fileAlta || documentoTramiteAfp?.storage_path ? "Cambiar documento de alta AFP" : "Subir documento de alta AFP"
                    }
                    emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                    onFileChange={setFileAlta}
                  />
                ) : null
              }
            />
            <FormSection
              title="Datos de afiliación AFP"
              hint="Nombre de AFP (Profuturo, Integra, Habitat o Prima), CUSPP y fecha de afiliación."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Nombre de AFP"
                  name="afp_nombre"
                  defaultValue={pension?.afp_nombre}
                  allowEmpty
                  disabled={!canWrite}
                  options={[
                    ...(pension?.afp_nombre && !(AFP_NOMBRES as readonly string[]).includes(pension.afp_nombre)
                      ? [{ value: pension.afp_nombre, label: pension.afp_nombre }]
                      : []),
                    ...AFP_NOMBRES.map((nombreAfp) => ({ value: nombreAfp, label: nombreAfp })),
                  ]}
                />
                <Field label="CUSPP" name="cuspp" defaultValue={pension?.cuspp} readOnly={!canWrite} />
                <DateField
                  label="Fecha de afiliación"
                  name="fecha_tramite"
                  defaultValue={pension?.fecha_tramite}
                  readOnly={!canWrite}
                />
              </div>
              {canWrite ? (
                <Button type="submit" disabled={pending}>
                  {pending ? "Guardando…" : "Guardar sistema de pensión"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Solo consulta.</p>
              )}
            </FormSection>
          </form>
        </>
      ) : null}

      <Link
        href={`/trabajadores/${relacionId}?tab=t-registro`}
        className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Ir a T-Registro
      </Link>
    </div>
  );
}
