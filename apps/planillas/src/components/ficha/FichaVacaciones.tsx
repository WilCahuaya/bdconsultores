"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { addVacacion, crearDocumentoVacacion, deleteVacacion, type VacacionRow } from "@/lib/actions/vacaciones";
import { setDocumentoArchivo, type DocumentoRow } from "@/lib/actions/ficha";
import { DateField, Field, SelectField } from "@/components/fields";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { formatFechaPlanilla, TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { uploadDocumentoFile } from "@/lib/upload-documento";
import {
  DIAS_VACACIONES_ANUALES,
  ESTADO_VACACION,
  ESTADO_VACACION_LABEL,
} from "@/lib/vacaciones";

export function FichaVacaciones({
  relacionId,
  entidadId,
  periodo,
  derecho,
  diasTomados,
  saldo,
  registros,
  documentos,
  canWrite,
}: {
  relacionId: string;
  entidadId: string;
  periodo: number;
  derecho: boolean;
  diasTomados: number;
  saldo: number;
  registros: VacacionRow[];
  documentos: DocumentoRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [viendo, setViendo] = useState<VacacionRow | null>(null);
  const [eliminando, setEliminando] = useState<VacacionRow | null>(null);

  function documentoDe(item: VacacionRow) {
    return documentos.find((d) => d.id === item.documento_id) ?? null;
  }

  async function onSubmit(formData: FormData) {
    if (!file) {
      pushToast("Suba el documento de respaldo firmado para guardar.", "error");
      return;
    }
    setPending(true);
    const creado = await crearDocumentoVacacion(relacionId);
    if (creado.error || !creado.documentoId) {
      setPending(false);
      pushToast(creado.error ?? "No se pudo registrar el documento.", "error");
      return;
    }
    const upload = await uploadDocumentoFile(entidadId, relacionId, creado.documentoId, file);
    if (upload.error || !upload.path) {
      setPending(false);
      pushToast(upload.error ?? "No se pudo subir el archivo.", "error");
      return;
    }
    const saved = await setDocumentoArchivo(relacionId, creado.documentoId, upload.path);
    if (saved.error) {
      setPending(false);
      pushToast(saved.error, "error");
      return;
    }
    formData.set("documento_id", creado.documentoId);
    const result = await addVacacion(relacionId, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setFile(null);
    setFormKey((key) => key + 1);
    pushToast("Vacaciones registradas.");
    router.refresh();
  }

  async function onEliminar() {
    if (!eliminando) return;
    setPending(true);
    const result = await deleteVacacion(relacionId, eliminando.id);
    setPending(false);
    setEliminando(null);
    setViendo(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Registro de vacaciones eliminado.");
    router.refresh();
  }

  const visto = viendo ? documentoDe(viendo) : null;

  return (
    <div className="space-y-4">
      <section className={`${panelCardClass} space-y-2 p-5`}>
        <p className="text-sm font-medium">Periodo {periodo}</p>
        {derecho ? (
          <p className="text-sm text-muted-foreground">
            {DIAS_VACACIONES_ANUALES} días correspondientes · {diasTomados} registrados · saldo {saldo}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no genera derecho (un año de servicio). Puede registrar un goce si ya lo tomó.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Cada goce requiere la solicitud o constancia firmada. Sin ese respaldo no se puede guardar.
        </p>
      </section>

      <ul className={`${panelCardClass} divide-y p-0`}>
        {registros.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Sin vacaciones registradas en este periodo.</li>
        ) : (
          registros.map((item) => {
            const doc = documentoDe(item);
            const conRespaldo = Boolean(doc?.storage_path);
            return (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {formatFechaPlanilla(item.fecha_inicio)} – {formatFechaPlanilla(item.fecha_fin)} · {item.dias}{" "}
                  día{item.dias === 1 ? "" : "s"} · {ESTADO_VACACION_LABEL[item.estado]}
                  {item.observaciones ? ` · ${item.observaciones}` : ""}
                  {conRespaldo ? (
                    <span className="ml-1 font-medium text-emerald-700">· Respaldo firmado</span>
                  ) : (
                    <span className="ml-1 text-amber-800">· Sin respaldo</span>
                  )}
                </span>
                <span className="flex flex-wrap gap-2">
                  {conRespaldo ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setViendo(viendo?.id === item.id ? null : item)}
                    >
                      {viendo?.id === item.id ? "Ocultar" : "Ver respaldo"}
                    </Button>
                  ) : null}
                  {canWrite ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setEliminando(item)}>
                      Quitar
                    </Button>
                  ) : null}
                </span>
              </li>
            );
          })
        )}
      </ul>

      {visto?.storage_path ? (
        <DocumentoPrevisualizacion
          titulo={`${TIPO_DOCUMENTO_LABEL.VACACIONES_FIRMADO} · ${formatFechaPlanilla(viendo?.fecha_inicio ?? "")} – ${formatFechaPlanilla(viendo?.fecha_fin ?? "")}`}
          storagePath={visto.storage_path}
          defaultVisible
          vacio="Este goce no tiene respaldo firmado."
        />
      ) : null}

      {canWrite ? (
        <form key={formKey} action={onSubmit} className={`${panelCardClass} space-y-4 p-5`}>
          <p className="text-sm font-medium">Registrar goce</p>
          <input type="hidden" name="periodo" value={String(periodo)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Fecha de inicio" name="fecha_inicio" required />
            <DateField label="Fecha de fin" name="fecha_fin" required />
            <Field label="Días" name="dias" inputMode="numeric" placeholder="Se calcula si lo deja vacío" />
            <SelectField
              label="Estado"
              name="estado"
              defaultValue="PROGRAMADO"
              options={ESTADO_VACACION.map((value) => ({
                value,
                label: ESTADO_VACACION_LABEL[value],
              }))}
            />
            <Field label="Observaciones" name="observaciones" />
          </div>
          <DocumentoPrevisualizacion
            titulo={TIPO_DOCUMENTO_LABEL.VACACIONES_FIRMADO}
            storagePath={null}
            file={file}
            vacio="Adjunte la solicitud o constancia firmada para poder guardar."
            extra={
              <div className="flex flex-wrap items-end gap-2">
                <FileInput
                  accept={DOCUMENTO_ACCEPT}
                  disabled={pending}
                  file={file}
                  buttonLabel={file ? "Cambiar respaldo firmado" : "Subir respaldo firmado"}
                  emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                  onFileChange={setFile}
                />
              </div>
            }
          />
          <Button type="submit" disabled={pending || !file}>
            {pending ? "Guardando…" : "Agregar"}
          </Button>
        </form>
      ) : null}

      <ConfirmDialog
        open={Boolean(eliminando)}
        title="Quitar este goce"
        description="Se elimina el registro de vacaciones y su documento de respaldo. No afecta el contrato."
        confirmLabel="Quitar"
        pending={pending}
        onClose={() => setEliminando(null)}
        onConfirm={() => void onEliminar()}
      />
    </div>
  );
}
