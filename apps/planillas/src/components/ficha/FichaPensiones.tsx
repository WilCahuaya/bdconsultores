"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import type { Entidad, TipoPension } from "@inventario/types";
import { savePension, setDocumentoArchivo, type DocumentoRow, type PensionRow } from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import {
  AFPNET_URL,
  AFP_NOMBRES,
  TIPO_DOCUMENTO_LABEL,
  TIPO_PENSION_LABEL,
  TRAMITE_PENSION_LABEL,
  formatFechaPlanilla,
  nombreCompleto,
  urlPortalAfp,
} from "@/lib/planillas-labels";
import { Field, DateField, SelectField, FormSection } from "@/components/fields";
import { DatoAlta } from "@/components/ficha/DatoAlta";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";

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
  const [fileTramite, setFileTramite] = useState<File | null>(null);
  const [tipo, setTipo] = useState<TipoPension | "">(pension?.tipo ?? "");
  const esAfp = tipo === "AFP";
  const esOnp = tipo === "ONP";
  const tramitado = esAfp && pension?.tramite_estado === "TRAMITADO";
  const persona = trabajador.persona;
  const nombre = nombreCompleto(persona);
  const fechaInicioLabor = trabajador.fecha_ingreso ? formatFechaPlanilla(trabajador.fecha_ingreso) : "";

  async function onSubmit(formData: FormData) {
    if (esAfp && fileTramite) {
      formData.set("tramite_estado", "TRAMITADO");
    }
    const afpNombre = String(formData.get("afp_nombre") ?? "").trim();
    const cuspp = String(formData.get("cuspp") ?? "").trim();
    const fechaTramite = String(formData.get("fecha_tramite") ?? "").trim();
    const estado = String(formData.get("tramite_estado") ?? "");
    if (esAfp && (fileTramite || estado === "TRAMITADO")) {
      if (!afpNombre || !cuspp || !fechaTramite) {
        pushToast("Revise la constancia y complete AFP, CUSPP y fecha de trámite.", "error");
        return;
      }
    }
    setPending(true);
    if (esAfp && fileTramite) {
      if (!documentoTramiteAfp) {
        setPending(false);
        pushToast("No se pudo registrar la constancia. Recargue la página.", "error");
        return;
      }
      const upload = await uploadDocumentoFile(
        trabajador.entidad_id,
        relacionId,
        documentoTramiteAfp.id,
        fileTramite,
        documentoTramiteAfp.storage_path,
      );
      if (upload.error || !upload.path) {
        setPending(false);
        pushToast(upload.error ?? "No se pudo subir la constancia AFP.", "error");
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
    setFileTramite(null);
    pushToast(esAfp ? "Trámite AFP guardado." : "Pensiones guardadas.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <DocumentoPrevisualizacion
        titulo={TIPO_DOCUMENTO_LABEL.PENSIONES_FIRMADO}
        storagePath={documentoPension?.storage_path}
        vacio="Suba el sistema de pensiones en Documentos para verlo aquí."
      />
      {esOnp ? null : (
        <section className={`${panelCardClass} space-y-3 p-5`}>
          <div>
            <p className="text-sm font-medium">Portal AFPNet</p>
            <p className="text-sm text-muted-foreground">
              Planillas no entra sola. Abra AFPNet, copie el DNI y los datos de abajo y péguelos en el alta.
            </p>
          </div>
          <EnlaceAfpnet afpNombre={pension?.afp_nombre} />
          <DatoAlta label="DNI" value={persona.dni} />
        </section>
      )}

      <ol className="grid gap-2 sm:grid-cols-3">
        <li className={`${panelCardClass} p-4 text-sm`}>
          <p className="text-xs text-muted-foreground">1. Tipo</p>
          <p className="mt-1 font-medium">{tipo ? TIPO_PENSION_LABEL[tipo] : "Márquelo en Documentos"}</p>
        </li>
        <li className={`${panelCardClass} p-4 text-sm`}>
          <p className="text-xs text-muted-foreground">2. Alta AFP</p>
          <p className="mt-1 font-medium">
            {esOnp ? "No aplica" : tramitado ? "Tramitado" : esAfp ? "Pendiente en AFPNet" : "—"}
          </p>
        </li>
        <li className={`${panelCardClass} p-4 text-sm`}>
          <p className="text-xs text-muted-foreground">3. T-Registro</p>
          <p className="mt-1 font-medium">
            {esOnp || tramitado ? "Ya puede registrarse" : "Después del alta AFP"}
          </p>
        </li>
      </ol>

      {!tipo ? (
        <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
          En Documentos aún no se marcó AFP u ONP. El estudio no puede tramitar el alta hasta que la empresa lo indique.
        </p>
      ) : null}

      {esAfp ? (
        <section className={`${panelCardClass} space-y-4 p-5`}>
          <div>
            <p className="text-sm font-medium">Datos para pegar en AFPNet</p>
            <p className="text-sm text-muted-foreground">
              DNI, tipo de vía, nombre, número, distrito, provincia, región, teléfono, correo e inicio de labor. La dirección queda así: Av. Grau 123 - El Tambo - Huancayo - Junín.
            </p>
          </div>
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
          <EnlaceAfpnet afpNombre={pension?.afp_nombre} />
        </section>
      ) : null}

      {esOnp ? (
        <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
          Es ONP: no hay alta en AFP. Puede seguir a T-Registro.
        </p>
      ) : null}

      <form action={onSubmit} className="space-y-4">
        {esAfp ? (
          <DocumentoPrevisualizacion
            titulo={TIPO_DOCUMENTO_LABEL.TRAMITE_AFP}
            storagePath={fileTramite ? null : documentoTramiteAfp?.storage_path}
            file={fileTramite}
            vacio="Suba la constancia del trámite AFP. Al guardarla, confirme AFP, CUSPP y fecha."
            extra={
              canWrite ? (
                <FileInput
                  accept={DOCUMENTO_ACCEPT}
                  disabled={pending}
                  file={fileTramite}
                  buttonLabel={fileTramite || documentoTramiteAfp?.storage_path ? "Cambiar constancia AFP" : "Subir constancia AFP"}
                  emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                  onFileChange={setFileTramite}
                />
              ) : null
            }
          />
        ) : null}
        <FormSection
          title={esAfp ? "Confirmar datos del trámite AFP" : "AFP / ONP"}
          hint={
            esAfp
              ? "Vea la constancia, afirme AFP, CUSPP y fecha, y márquelo tramitado. Si sube el PDF, queda tramitado."
              : "El tipo se marca en Documentos. Si cambia aquí, quede alineado con el expediente."
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Sistema"
              name="tipo"
              value={tipo}
              allowEmpty
              disabled={!canWrite}
              options={Object.entries(TIPO_PENSION_LABEL).map(([value, label]) => ({ value, label }))}
              onChange={(event) => setTipo(event.target.value as TipoPension | "")}
            />
            {esAfp ? (
              <>
                <SelectField
                  label="AFP"
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
                <SelectField
                  label="Trámite AFP"
                  name="tramite_estado"
                  defaultValue={pension?.tramite_estado ?? "PENDIENTE"}
                  disabled={!canWrite}
                  options={Object.entries(TRAMITE_PENSION_LABEL)
                    .filter(([value]) => value !== "NO_APLICA")
                    .map(([value, label]) => ({ value, label }))}
                />
                <DateField label="Fecha de trámite" name="fecha_tramite" defaultValue={pension?.fecha_tramite} readOnly={!canWrite} />
              </>
            ) : (
              <input type="hidden" name="tramite_estado" value="NO_APLICA" />
            )}
          </div>
          {canWrite ? (
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : esAfp ? "Guardar constancia y datos AFP" : "Guardar"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Solo consulta.</p>
          )}
        </FormSection>
      </form>

      {esOnp || tramitado ? (
        <Link
          href={`/trabajadores/${relacionId}?tab=t-registro`}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Continuar a T-Registro
        </Link>
      ) : null}
    </div>
  );
}
