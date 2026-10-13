"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { DocumentoFileInput } from "@/components/ficha/DocumentoFileInput";
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
import { ApartadoDesplegable } from "@/components/ficha/ApartadoDesplegable";
import { DatoAlta } from "@/components/ficha/DatoAlta";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { EliminarDocumentoGuardado } from "@/components/ficha/ConfirmarEliminarArchivo";
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
  const [afpNombre, setAfpNombre] = useState(pension?.afp_nombre ?? "");
  const [cuspp, setCuspp] = useState(pension?.cuspp ?? "");
  const [fechaTramite, setFechaTramite] = useState(pension?.fecha_tramite ?? "");
  const tipo = pension?.tipo ?? "";
  const esAfp = tipo === "AFP";
  const esOnp = tipo === "ONP";
  const persona = trabajador.persona;
  const nombre = nombreCompleto(persona);
  const fechaInicioLabor = trabajador.fecha_ingreso ? formatFechaPlanilla(trabajador.fecha_ingreso) : "";

  useEffect(() => {
    setAfpNombre(pension?.afp_nombre ?? "");
    setCuspp(pension?.cuspp ?? "");
    setFechaTramite(pension?.fecha_tramite ?? "");
  }, [pension?.afp_nombre, pension?.cuspp, pension?.fecha_tramite]);

  async function onSubmit(formData: FormData) {
    const afpNombreGuardar = String(formData.get("afp_nombre") ?? "").trim();
    const cusppGuardar = String(formData.get("cuspp") ?? "").trim();
    const afiliacionCompleta = Boolean(afpNombreGuardar && cusppGuardar);
    if (!afiliacionCompleta) {
      pushToast("Indique el nombre de AFP y el CUSPP.", "error");
      return;
    }
    formData.set("tipo", "AFP");
    formData.set("tramite_estado", "TRAMITADO");
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
    setAfpNombre(afpNombreGuardar);
    setCuspp(cusppGuardar);
    setFechaTramite(String(formData.get("fecha_tramite") ?? "").trim());
    setFileAlta(null);
    pushToast("Sistema de pensión guardado. Siga con T-Registro.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!documentoPension?.storage_path ? (
        <p className="text-sm font-medium text-amber-900">Alerta: falta el documento de sistema de pensiones firmado.</p>
      ) : null}
      {esAfp ? null : (
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.PENSIONES_FIRMADO}
          storagePath={documentoPension?.storage_path}
          vacio="Súbalo en Documentos para verlo aquí."
        />
      )}

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
          <ApartadoDesplegable
            variante="interno"
            titulo="Datos para tramitar AFP"
            resumen="Abrir al copiar en AFPNet. Enlaces, datos y documento de pensiones firmado."
            defaultOpen={false}
          >
            <p className="text-sm text-muted-foreground">
              Abra AFPNet, copie el DNI y los datos de abajo y péguelos en el alta. El documento de alta es opcional: con
              el nombre de AFP y el CUSPP ya queda registrado.
            </p>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <section className="space-y-3">
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
              <DocumentoPrevisualizacion
                titulo={TIPO_DOCUMENTO_LABEL.PENSIONES_FIRMADO}
                storagePath={documentoPension?.storage_path}
                vacio="Súbalo en Documentos para verlo aquí."
              />
            </div>
          </ApartadoDesplegable>

          <form action={onSubmit} className="space-y-4">
            <DocumentoPrevisualizacion
              titulo={TIPO_DOCUMENTO_LABEL.TRAMITE_AFP}
              storagePath={fileAlta ? null : documentoTramiteAfp?.storage_path}
              file={fileAlta}
              vacio="El documento de alta AFP es opcional. Puede subirlo si lo tiene."
              extra={
                <div className="space-y-4">
                  {canWrite ? (
                    <DocumentoFileInput
                      accept={DOCUMENTO_ACCEPT}
                      disabled={pending}
                      file={fileAlta}
                      buttonLabel={
                        fileAlta || documentoTramiteAfp?.storage_path ? "Cambiar documento de alta AFP" : "Subir documento de alta AFP"
                      }
                      emptyLabel="PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
                      onFileChange={setFileAlta}
                    />
                  ) : null}
                  {canWrite && documentoTramiteAfp?.storage_path ? (
                    <EliminarDocumentoGuardado
                      relacionId={relacionId}
                      documentoId={documentoTramiteAfp.id}
                      descripcion="¿Eliminar el documento de alta AFP? Dejará de verse en esta ficha."
                      disabled={pending}
                    />
                  ) : null}
            <FormSection
              title="Datos de afiliación AFP"
              hint="Nombre de AFP (Profuturo, Integra, Habitat o Prima) y CUSPP. La fecha de afiliación es opcional."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Nombre de AFP"
                  name="afp_nombre"
                  value={afpNombre}
                  allowEmpty
                  disabled={!canWrite}
                  options={[
                    ...(afpNombre && !(AFP_NOMBRES as readonly string[]).includes(afpNombre)
                      ? [{ value: afpNombre, label: afpNombre }]
                      : []),
                    ...AFP_NOMBRES.map((nombreAfp) => ({ value: nombreAfp, label: nombreAfp })),
                  ]}
                  onChange={(event) => setAfpNombre(event.target.value)}
                />
                <Field
                  label="CUSPP"
                  name="cuspp"
                  value={cuspp}
                  readOnly={!canWrite}
                  onChange={(event) => setCuspp(event.target.value)}
                />
                <DateField
                  label="Fecha de afiliación"
                  name="fecha_tramite"
                  value={fechaTramite}
                  readOnly={!canWrite}
                  onChange={setFechaTramite}
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
                </div>
              }
            />
          </form>
        </>
      ) : null}

    </div>
  );
}
