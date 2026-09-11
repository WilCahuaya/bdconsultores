"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { asegurarDocumentoAsistenciaMes } from "@/lib/actions/asistencias";
import { setDocumentoArchivo, type DocumentoRow } from "@/lib/actions/ficha";
import { descargarAsistenciaExcel } from "@/lib/descargar-asistencia-excel";
import { etiquetaMesAsistencia, mesActualLima } from "@/lib/horario-asistencia";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";

export function FichaAsistencia({
  relacionId,
  entidadId,
  documentos,
  canWrite,
}: {
  relacionId: string;
  entidadId: string;
  documentos: DocumentoRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [mes, setMes] = useState(mesActualLima());
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const documento = documentos.find((d) => d.tipo === "ASISTENCIA" && d.observaciones === mes) ?? null;

  async function onDescargar() {
    setPending(true);
    const result = await descargarAsistenciaExcel({ mes, relacionId });
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Excel de asistencia descargado.");
  }

  async function onSubir() {
    if (!file) {
      pushToast("Elija el PDF o la foto del horario firmado.", "error");
      return;
    }
    setPending(true);
    const asegurado = await asegurarDocumentoAsistenciaMes(relacionId, mes);
    if (asegurado.error || !asegurado.documentoId) {
      setPending(false);
      pushToast(asegurado.error ?? "No se pudo registrar el mes.", "error");
      return;
    }
    const upload = await uploadDocumentoFile(entidadId, relacionId, asegurado.documentoId, file, documento?.storage_path);
    if (upload.error || !upload.path) {
      setPending(false);
      pushToast(upload.error ?? "No se pudo subir el archivo.", "error");
      return;
    }
    const saved = await setDocumentoArchivo(relacionId, asegurado.documentoId, upload.path);
    setPending(false);
    if (saved.error) {
      pushToast(saved.error, "error");
      return;
    }
    setFile(null);
    pushToast("Horario de asistencia guardado.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className={`${panelCardClass} space-y-4 p-5`}>
        <div>
          <p className="text-sm font-medium">Asistencia del mes</p>
          <p className="text-sm text-muted-foreground">
            Descargue el Excel con las horas del contrato. Cuando lo devuelvan firmado, súbalo aquí.
          </p>
        </div>
        <label className="block max-w-xs space-y-1.5">
          <span className="text-sm font-medium">Mes</span>
          <input
            type="month"
            value={mes}
            onChange={(event) => {
              setMes(event.target.value);
              setFile(null);
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          />
        </label>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => void onDescargar()}>
              {pending ? "Preparando…" : `Descargar Excel · ${etiquetaMesAsistencia(mes)}`}
            </Button>
          </div>
        ) : null}
      </section>
      <DocumentoPrevisualizacion
        titulo={`Horario firmado · ${etiquetaMesAsistencia(mes)}`}
        storagePath={file ? null : documento?.storage_path}
        file={file}
        vacio="Aún no suben el PDF de este mes."
        extra={
          canWrite ? (
            <div className="flex flex-wrap items-end gap-2">
              <FileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={pending}
                file={file}
                buttonLabel={file || documento?.storage_path ? "Cambiar horario firmado" : "Subir horario firmado"}
                emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                onFileChange={setFile}
              />
              <Button type="button" disabled={pending || !file} onClick={() => void onSubir()}>
                {pending ? "Guardando…" : "Guardar PDF"}
              </Button>
            </div>
          ) : null
        }
      />
    </div>
  );
}
