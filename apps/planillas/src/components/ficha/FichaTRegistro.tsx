"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { DocumentoFileInput } from "@/components/ficha/DocumentoFileInput";
import { panelCardClass } from "@inventario/ui/panel";
import {
  addTRegistro,
  setDocumentoArchivo,
  updateFechaTRegistroAlta,
  type DocumentoRow,
  type PensionRow,
  type TRegistroRow,
} from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import {
  TIPO_DOCUMENTO_LABEL,
  TIPO_T_REGISTRO_LABEL,
  TREGISTRO_URL,
  codigoOcupacionTRegistro,
  etiquetaCodigoOcupacion,
  formatFechaPlanilla,
  LEYENDA_CODIGO_OCUPACION,
  ASIGNACION_FAMILIAR_SOLES,
  montoAsignacionFamiliar,
  remuneracionBruta,
} from "@/lib/planillas-labels";
import { DateField } from "@/components/fields";
import { DatoAlta } from "@/components/ficha/DatoAlta";
import { DarDeBajaControl } from "@/components/ficha/DarDeBajaControl";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { EliminarDocumentoGuardado } from "@/components/ficha/ConfirmarEliminarArchivo";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";

function tipoAfpCopia(pension: PensionRow | null): string {
  if (!pension?.tipo) return "";
  if (pension.tipo === "ONP") return "ONP";
  return pension.afp_nombre?.trim() ?? "";
}

function remuneracionCopia(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return value.toFixed(2);
}

export function FichaTRegistro({
  relacionId,
  items,
  pension,
  trabajador,
  documentoDni,
  documentoFicha,
  documentoTrAlta,
  documentoTrBaja,
  documentoCartaRenuncia,
  canWrite,
  canWriteTrBaja = canWrite,
}: {
  relacionId: string;
  items: TRegistroRow[];
  pension: PensionRow | null;
  trabajador: TrabajadorListItem;
  documentoDni: DocumentoRow | null;
  documentoFicha: DocumentoRow | null;
  documentoTrAlta: DocumentoRow | null;
  documentoTrBaja: DocumentoRow | null;
  documentoCartaRenuncia?: DocumentoRow | null;
  canWrite: boolean;
  canWriteTrBaja?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pendingAlta, setPendingAlta] = useState(false);
  const [fileAlta, setFileAlta] = useState<File | null>(null);
  const persona = trabajador.persona;
  const codigoOcupacion = codigoOcupacionTRegistro(trabajador.cargo);
  const yaAlta = items.some((item) => item.tipo === "ALTA" && item.realizado);

  async function guardarAlta(formData: FormData) {
    if (!yaAlta && !fileAlta && !documentoTrAlta?.storage_path) {
      pushToast("Suba el alta de T-Registro.", "error");
      return;
    }
    setPendingAlta(true);
    if (fileAlta) {
      if (!documentoTrAlta) {
        setPendingAlta(false);
        pushToast("No se pudo registrar el alta. Recargue la página.", "error");
        return;
      }
      const upload = await uploadDocumentoFile(
        trabajador.entidad_id,
        relacionId,
        documentoTrAlta.id,
        fileAlta,
        documentoTrAlta.storage_path,
      );
      if (upload.error || !upload.path) {
        setPendingAlta(false);
        pushToast(upload.error ?? "No se pudo subir el alta de T-Registro.", "error");
        return;
      }
      const savedFile = await setDocumentoArchivo(relacionId, documentoTrAlta.id, upload.path);
      if (savedFile.error) {
        setPendingAlta(false);
        pushToast(savedFile.error, "error");
        return;
      }
    }
    if (!yaAlta) {
      formData.set("tipo", "ALTA");
      formData.set("realizado", "on");
      const result = await addTRegistro(relacionId, formData);
      if (result.error) {
        setPendingAlta(false);
        pushToast(result.error, "error");
        return;
      }
    } else {
      const result = await updateFechaTRegistroAlta(relacionId, formData);
      if (result.error) {
        setPendingAlta(false);
        pushToast(result.error, "error");
        return;
      }
    }
    setFileAlta(null);
    setPendingAlta(false);
    pushToast("Alta de T-Registro guardada.");
    router.refresh();
  }

  return (
    <div id="t-registro" className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className={`${panelCardClass} space-y-4 p-5`}>
        <div>
          <p className="text-sm font-medium">Datos para pegar en T-Registro</p>
          <p className="text-sm text-muted-foreground">
            Planillas no entra sola. Abra SUNAT, copie estos datos y péguelos en el alta. La remuneración bruta es la remuneración más S/ {ASIGNACION_FAMILIAR_SOLES} si tiene asignación familiar.
          </p>
        </div>
        <a
          href={TREGISTRO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Abrir T-Registro
        </a>
        <div className="grid gap-3 sm:grid-cols-2">
          <DatoAlta label="DNI" value={persona.dni} />
          <DatoAlta
            label="Fecha de nacimiento"
            value={persona.fecha_nacimiento ? formatFechaPlanilla(persona.fecha_nacimiento) : ""}
          />
          <DatoAlta label="Número de teléfono" value={persona.celular ?? ""} />
          <DatoAlta label="Correo" value={persona.correo ?? ""} />
          <DatoAlta
            label="Fecha de inicio del trabajador"
            value={trabajador.fecha_ingreso ? formatFechaPlanilla(trabajador.fecha_ingreso) : ""}
          />
          <DatoAlta label={etiquetaCodigoOcupacion(trabajador.cargo)} value={codigoOcupacion} />
          <DatoAlta label="Remuneración" value={remuneracionCopia(trabajador.remuneracion)} />
          <DatoAlta
            label="Asignación familiar"
            value={trabajador.recibe_asignacion_familiar === true ? remuneracionCopia(montoAsignacionFamiliar(true)) : ""}
          />
          <DatoAlta
            label="Remuneración bruta"
            value={remuneracionCopia(remuneracionBruta(trabajador.remuneracion, trabajador.recibe_asignacion_familiar))}
          />
          <DatoAlta label="Tipo de AFP" value={tipoAfpCopia(pension)} />
          <DatoAlta label="CUSPP" value={pension?.cuspp?.trim() ?? ""} />
        </div>
        <p className="text-xs text-muted-foreground">
          {LEYENDA_CODIGO_OCUPACION.map((item) => `${item.corto} ${item.codigo}`).join(" · ")}
        </p>
      </section>
      <div className="space-y-4">
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.DNI}
          storagePath={documentoDni?.storage_path}
          vacio="Suba el DNI en Documentos para verlo aquí."
        />
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.FICHA_DATOS}
          storagePath={documentoFicha?.storage_path}
          vacio="Suba la ficha en Documentos para verla aquí."
        />
      </div>
      </div>

      <form action={guardarAlta} className="space-y-4">
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.TR_ALTA}
          storagePath={fileAlta ? null : documentoTrAlta?.storage_path}
          file={fileAlta}
          vacio="Suba el alta de T-Registro cuando lo tenga en SUNAT."
          extra={
            canWrite ? (
              <div className="space-y-4">
                <DocumentoFileInput
                  accept={DOCUMENTO_ACCEPT}
                  disabled={pendingAlta}
                  file={fileAlta}
                  buttonLabel={
                    fileAlta || documentoTrAlta?.storage_path ? "Cambiar alta de T-Registro" : "Subir alta de T-Registro"
                  }
                  emptyLabel="PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
                  onFileChange={setFileAlta}
                />
                {documentoTrAlta?.storage_path ? (
                  <EliminarDocumentoGuardado
                    relacionId={relacionId}
                    documentoId={documentoTrAlta.id}
                    descripcion="¿Eliminar el alta de T-Registro? Dejará de verse en esta ficha."
                    disabled={pendingAlta}
                  />
                ) : null}
                <DateField
                  label="Fecha de alta"
                  name="fecha"
                  defaultValue={items.find((item) => item.tipo === "ALTA")?.fecha ?? trabajador.fecha_ingreso}
                  readOnly={pendingAlta}
                  hint={yaAlta ? "Puede corregir la fecha y guardar de nuevo." : undefined}
                />
                <Button type="submit" disabled={pendingAlta}>
                  {pendingAlta ? "Guardando…" : yaAlta ? "Guardar fecha de alta" : "Guardar alta de T-Registro"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Solo consulta.</p>
            )
          }
        />
      </form>

      {canWriteTrBaja || canWrite ? (
        <DarDeBajaControl
          trabajador={trabajador}
          documentoCarta={documentoCartaRenuncia ?? null}
          documentoTrBaja={documentoTrBaja}
        />
      ) : null}

      <ul className={`${panelCardClass} divide-y p-0`}>
        {items.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Sin altas ni bajas registradas.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {TIPO_T_REGISTRO_LABEL[item.tipo]}
                {item.fecha ? ` · ${formatFechaPlanilla(item.fecha)}` : ""}
              </span>
              <span className="text-muted-foreground">{item.realizado ? "Realizado" : "Pendiente"}</span>
            </li>
          ))
        )}
      </ul>
      {yaAlta ? (
        <Link
          href={`/trabajadores/${relacionId}`}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Ver ficha
        </Link>
      ) : null}
    </div>
  );
}
