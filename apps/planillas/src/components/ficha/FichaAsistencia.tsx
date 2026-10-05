"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { DocumentoFileInput } from "@/components/ficha/DocumentoFileInput";
import { panelCardClass } from "@inventario/ui/panel";
import { asegurarDocumentoAsistenciaMes } from "@/lib/actions/asistencias";
import { setDocumentoArchivo, type DocumentoRow } from "@/lib/actions/ficha";
import { descargarAsistenciaExcel } from "@/lib/descargar-asistencia-excel";
import { etiquetaMesAsistencia, mesActualLima, mesesLaboradosEnAnio } from "@/lib/horario-asistencia";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { EliminarDocumentoGuardado } from "@/components/ficha/ConfirmarEliminarArchivo";
import { AsistenciaNotaField } from "@/components/ficha/AsistenciaNotaField";
import { FeriadosMesPicker } from "@/components/ficha/FeriadosMesPicker";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";

function excelDelMes(documentos: DocumentoRow[], mes: string): boolean {
  return Boolean(documentos.find((d) => d.tipo === "ASISTENCIA" && d.observaciones === mes)?.storage_path);
}

export function FichaAsistencia({
  relacionId,
  entidadId,
  fechaIngreso,
  fechaCese,
  documentos,
  canWrite,
}: {
  relacionId: string;
  entidadId: string;
  fechaIngreso: string | null;
  fechaCese: string | null;
  documentos: DocumentoRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const mesHoy = mesActualLima();
  const anio = Number(mesHoy.slice(0, 4));
  const mesesAnio = mesesLaboradosEnAnio(anio, fechaIngreso, fechaCese);
  const mesesConExcel = mesesAnio.filter((item) => item <= mesHoy);
  const excelSubidos = mesesConExcel.filter((item) => excelDelMes(documentos, item)).length;
  const [mes, setMes] = useState(mesHoy);
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const documento = documentos.find((d) => d.tipo === "ASISTENCIA" && d.observaciones === mes) ?? null;

  function elegirMes(siguiente: string) {
    setMes(siguiente);
    setFile(null);
  }

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
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">Meses laborados en {anio}</h2>
          <p className="text-sm text-muted-foreground">
            {mesesConExcel.length > 0
              ? `Excel subidos: ${excelSubidos} de ${mesesConExcel.length}`
              : "Aún no hay meses con Excel por subir."}
          </p>
        </div>
        <div className={`${panelCardClass} overflow-x-auto p-0`}>
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Mes</th>
                <th className="px-4 py-2 font-medium">Excel</th>
              </tr>
            </thead>
            <tbody>
              {mesesAnio.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-muted-foreground" colSpan={2}>
                    Este trabajador no registra meses laborados en {anio}.
                  </td>
                </tr>
              ) : (
                mesesAnio.map((item) => {
                  const subido = excelDelMes(documentos, item);
                  const futuro = item > mesHoy;
                  const seleccionado = item === mes;
                  return (
                    <tr
                      key={item}
                      className={`border-b last:border-0 hover:bg-muted/30 ${seleccionado ? "bg-muted/40" : ""}`}
                    >
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => elegirMes(item)}
                          className="font-medium text-primary hover:underline"
                          aria-current={seleccionado ? "true" : undefined}
                        >
                          {etiquetaMesAsistencia(item)}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        {subido ? (
                          <span className="font-medium text-emerald-700">Subido</span>
                        ) : futuro ? (
                          <span className="text-muted-foreground">Aún no corresponde</span>
                        ) : (
                          <span className="text-amber-800">Pendiente</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className={`${panelCardClass} space-y-4 p-5`}>
        <div>
          <p className="text-sm font-medium">Asistencia del mes</p>
          <p className="text-sm text-muted-foreground">
            {canWrite
              ? "Descargue el Excel con las horas del contrato. Cuando lo devuelvan firmado, súbalo aquí."
              : "Consulta del horario y del PDF firmado de este mes."}
          </p>
        </div>
        <label className="block max-w-xs space-y-1.5">
          <span className="text-sm font-medium">Mes</span>
          <input
            type="month"
            value={mes}
            onChange={(event) => elegirMes(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          />
        </label>
        <FeriadosMesPicker key={`${entidadId}-${mes}`} entidadId={entidadId} mes={mes} canWrite={canWrite} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => void onDescargar()}>
            {pending ? "Preparando…" : `Descargar Excel · ${etiquetaMesAsistencia(mes)}`}
          </Button>
        </div>
      </section>
      <section className={`${panelCardClass} space-y-3 p-5`}>
        <div>
          <p className="text-sm font-medium">Observación · {etiquetaMesAsistencia(mes)}</p>
          <p className="text-sm text-muted-foreground">
            Anote si falta firma, está de vacaciones u otra novedad de este mes.
          </p>
          <p className="text-sm text-muted-foreground">
            {documento?.storage_path ? (
              <span className="font-medium text-emerald-700">PDF firmado: subido.</span>
            ) : (
              <span>PDF firmado: pendiente.</span>
            )}
          </p>
        </div>
        <AsistenciaNotaField
          relacionId={relacionId}
          mes={mes}
          nota={documento?.nota ?? null}
          canWrite={canWrite}
        />
      </section>
      <DocumentoPrevisualizacion
        titulo={`Horario firmado · ${etiquetaMesAsistencia(mes)}`}
        storagePath={file ? null : documento?.storage_path}
        file={file}
        vacio="Aún no suben el PDF de este mes."
        extra={
          canWrite ? (
            <div className="flex flex-wrap items-end gap-2">
              <DocumentoFileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={pending}
                file={file}
                buttonLabel={file || documento?.storage_path ? "Cambiar horario firmado" : "Subir horario firmado"}
                emptyLabel="PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
                onFileChange={setFile}
              />
              <Button type="button" disabled={pending || !file} onClick={() => void onSubir()}>
                {pending ? "Guardando…" : "Guardar PDF"}
              </Button>
              {documento?.storage_path ? (
                <EliminarDocumentoGuardado
                  relacionId={relacionId}
                  documentoId={documento.id}
                  descripcion={`¿Eliminar el horario firmado de ${etiquetaMesAsistencia(mes)}? Dejará de verse en esta ficha.`}
                  disabled={pending}
                />
              ) : null}
            </div>
          ) : null
        }
      />
    </div>
  );
}
