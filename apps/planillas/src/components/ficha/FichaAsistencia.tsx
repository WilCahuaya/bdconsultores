"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { DocumentoFileInput } from "@/components/ficha/DocumentoFileInput";
import { panelCardClass } from "@inventario/ui/panel";
import { asegurarDocumentoAsistenciaMes } from "@/lib/actions/asistencias";
import { setDocumentoArchivo, type DocumentoRow } from "@/lib/actions/ficha";
import { descargarAsistenciaExcel } from "@/lib/descargar-asistencia-excel";
import {
  diasVacacionesEnMes,
  esMesAsistencia,
  etiquetaMesAsistencia,
  formatoHorasTotales,
  MES_ABREV,
  mesActualLima,
  minutosHorarioMes,
  tramosDelDia,
  type RangoFecha,
} from "@/lib/horario-asistencia";
import { formatFechaPlanilla } from "@/lib/planillas-labels";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { EliminarDocumentoGuardado } from "@/components/ficha/ConfirmarEliminarArchivo";
import { AsistenciaNotaField } from "@/components/ficha/AsistenciaNotaField";
import { FeriadosMesPicker } from "@/components/ficha/FeriadosMesPicker";
import { useDescargaTrabajador } from "@/components/ficha/DescargaTrabajador";
import { contarPaginasPdf, pdfSoloPaginas } from "@/lib/convertir-a-pdf";
import { nombreBaseAsistencia } from "@/lib/nombre-archivo";
import { uploadDocumentoFile } from "@/lib/upload-documento";

export function FichaAsistencia({
  relacionId,
  entidadId,
  documentos,
  canWrite,
  mesInicial,
  horario,
  fechaIngreso,
  fechaCese,
  vacaciones = [],
}: {
  relacionId: string;
  entidadId: string;
  documentos: DocumentoRow[];
  canWrite: boolean;
  mesInicial?: string;
  horario: string | null;
  fechaIngreso: string | null;
  fechaCese: string | null;
  vacaciones?: RangoFecha[];
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const mesHoy = mesActualLima();
  const [mes, setMes] = useState(mesInicial && esMesAsistencia(mesInicial) ? mesInicial : mesHoy);
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileVista, setFileVista] = useState<File | null>(null);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [paginas, setPaginas] = useState<number[]>([]);
  const [feriados, setFeriados] = useState<string[]>([]);

  useEffect(() => {
    setFeriados([]);
  }, [mes]);
  const documento = documentos.find((d) => d.tipo === "ASISTENCIA" && d.observaciones === mes) ?? null;
  const mesesConDocumento = new Set(
    documentos
      .filter((item) => item.tipo === "ASISTENCIA" && Boolean(item.storage_path) && esMesAsistencia(item.observaciones ?? ""))
      .map((item) => item.observaciones as string),
  );
  const anio = Number(mes.slice(0, 4));
  const ficha = useDescargaTrabajador();
  const nombrePdf = ficha
    ? nombreBaseAsistencia({
        numero: ficha.numero,
        nombres: ficha.nombres,
        apellidoPaterno: ficha.apellidoPaterno,
        mes,
      })
    : null;

  function elegirMes(siguiente: string) {
    setMes(siguiente);
    setFile(null);
    setFileVista(null);
    setTotalPaginas(0);
    setPaginas([]);
  }

  function esPdf(archivo: File): boolean {
    return archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
  }

  function onArchivo(siguiente: File | null) {
    if (siguiente && !esPdf(siguiente)) {
      pushToast("El horario firmado debe ser un PDF.", "error");
      return;
    }
    setFile(siguiente);
  }

  useEffect(() => {
    if (!file) {
      setTotalPaginas(0);
      setPaginas([]);
      setFileVista(null);
      return;
    }
    let cancel = false;
    setFileVista(file);
    void contarPaginasPdf(file)
      .then((total) => {
        if (cancel) return;
        setTotalPaginas(total);
        setPaginas(Array.from({ length: total }, (_, indice) => indice));
      })
      .catch(() => {
        if (!cancel) pushToast("No se pudo leer el PDF.", "error");
      });
    return () => {
      cancel = true;
    };
  }, [file, pushToast]);

  useEffect(() => {
    if (!file || totalPaginas < 2) return;
    if (paginas.length === 0) {
      setFileVista(null);
      return;
    }
    if (paginas.length === totalPaginas) {
      setFileVista(file);
      return;
    }
    let cancel = false;
    void pdfSoloPaginas(file, paginas)
      .then((recortado) => {
        if (!cancel) setFileVista(recortado);
      })
      .catch(() => {
        if (!cancel) pushToast("No se pudieron armar las páginas elegidas.", "error");
      });
    return () => {
      cancel = true;
    };
  }, [file, paginas, totalPaginas, pushToast]);

  function alternarPagina(indice: number) {
    setPaginas((actual) =>
      actual.includes(indice) ? actual.filter((item) => item !== indice) : [...actual, indice].sort((a, b) => a - b),
    );
  }

  function cambiarAnio(delta: number) {
    const mesNumero = mes.slice(5, 7);
    elegirMes(`${anio + delta}-${mesNumero}`);
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
    if (!file || !fileVista) {
      pushToast(paginas.length === 0 ? "Elija al menos una página del PDF." : "Elija el PDF del horario firmado.", "error");
      return;
    }
    setPending(true);
    const asegurado = await asegurarDocumentoAsistenciaMes(relacionId, mes);
    if (asegurado.error || !asegurado.documentoId) {
      setPending(false);
      pushToast(asegurado.error ?? "No se pudo registrar el mes.", "error");
      return;
    }
    const upload = await uploadDocumentoFile(
      entidadId,
      relacionId,
      asegurado.documentoId,
      fileVista,
      documento?.storage_path,
    );
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
    setFileVista(null);
    setTotalPaginas(0);
    setPaginas([]);
    pushToast("Horario de asistencia guardado.");
    router.refresh();
  }

  const horarioSumable = !horario?.trim() || tramosDelDia(horario, "LUNES") !== null;
  const minutosMes = horarioSumable
    ? minutosHorarioMes({ mes, horario, fechaIngreso, fechaCese, feriados, vacaciones })
    : null;
  const diasVacaciones = diasVacacionesEnMes(mes, vacaciones);

  return (
    <div className="space-y-4">
      <section className={`${panelCardClass} space-y-4 p-5`}>
        <div>
          <p className="text-sm font-medium">Asistencia del mes</p>
          <p className="text-sm text-muted-foreground">
            {canWrite
              ? "Descargue el Excel con las horas del contrato. Cuando lo devuelvan firmado, súbalo aquí."
              : "Consulta del horario y del PDF firmado de este mes."}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-sm hover:bg-accent"
              aria-label="Año anterior"
              onClick={() => cambiarAnio(-1)}
            >
              ‹
            </button>
            <span className="min-w-12 text-center text-sm font-medium">{anio}</span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-sm hover:bg-accent"
              aria-label="Año siguiente"
              onClick={() => cambiarAnio(1)}
            >
              ›
            </button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Mes">
            {MES_ABREV.map((abrev, index) => {
              const item = `${anio}-${String(index + 1).padStart(2, "0")}`;
              const seleccionado = item === mes;
              const conDocumento = mesesConDocumento.has(item);
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={seleccionado}
                  title={
                    conDocumento
                      ? `${etiquetaMesAsistencia(item)} · con documento`
                      : etiquetaMesAsistencia(item)
                  }
                  onClick={() => elegirMes(item)}
                  className={`inline-flex h-9 min-w-12 items-center justify-center rounded-md px-3 text-sm font-medium ${
                    seleccionado
                      ? `bg-primary text-primary-foreground${conDocumento ? " ring-2 ring-emerald-500 ring-offset-2" : ""}`
                      : conDocumento
                        ? "bg-emerald-100 text-emerald-900"
                        : "border border-input bg-background hover:bg-accent"
                  }`}
                >
                  {abrev}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            El mes elegido va en color principal. El verde indica que ya hay horario firmado.
          </p>
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-medium">Horario</p>
          <p className="text-muted-foreground">{horario?.trim() || "Sin horario en el puesto."}</p>
          <p>
            Horas del mes:{" "}
            <span className="font-medium">
              {minutosMes == null
                ? "no se pueden sumar (el horario está en texto libre)"
                : formatoHorasTotales(minutosMes)}
            </span>
          </p>
          <p className="text-muted-foreground">
            {diasVacaciones.length === 0
              ? "Sin días de vacaciones en este mes."
              : `Vacaciones (${diasVacaciones.length} ${diasVacaciones.length === 1 ? "día" : "días"}, no suman horas): ${diasVacaciones.map((iso) => formatFechaPlanilla(iso)).join(", ")}.`}
          </p>
        </div>
        <FeriadosMesPicker
          key={`${entidadId}-${mes}`}
          entidadId={entidadId}
          mes={mes}
          canWrite={canWrite}
          onChange={setFeriados}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => void onDescargar()}>
            {pending ? "Preparando…" : `Descargar Excel · ${etiquetaMesAsistencia(mes)}`}
          </Button>
        </div>
      </section>
      <DocumentoPrevisualizacion
        key={mes}
        titulo={`Horario firmado · ${etiquetaMesAsistencia(mes)}`}
        nombreDescarga={nombrePdf}
        storagePath={file ? null : documento?.storage_path}
        file={fileVista}
        defaultVisible={Boolean(documento?.storage_path)}
        vacio="Aún no suben el PDF de este mes."
        extra={
          <div className="space-y-4">
            <div className="space-y-2">
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
              <AsistenciaNotaField
                relacionId={relacionId}
                mes={mes}
                nota={documento?.nota ?? null}
                canWrite={canWrite}
              />
            </div>
            {canWrite ? (
              <div className="space-y-3">
                <DocumentoFileInput
                  accept="application/pdf,.pdf"
                  disabled={pending}
                  file={file}
                  buttonLabel={file || documento?.storage_path ? "Cambiar horario firmado" : "Subir horario firmado"}
                  emptyLabel="PDF. Máximo 10 MB. Si tiene varias páginas, elija cuáles guardar."
                  onFileChange={onArchivo}
                />
                {totalPaginas > 1 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Páginas a guardar</p>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Páginas del PDF">
                      {Array.from({ length: totalPaginas }, (_, indice) => {
                        const activa = paginas.includes(indice);
                        return (
                          <button
                            key={indice}
                            type="button"
                            aria-pressed={activa}
                            disabled={pending}
                            onClick={() => alternarPagina(indice)}
                            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium ${
                              activa
                                ? "bg-primary text-primary-foreground"
                                : "border border-input bg-background text-muted-foreground"
                            }`}
                          >
                            {indice + 1}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {paginas.length === 0
                        ? "Ninguna página seleccionada."
                        : `${paginas.length} de ${totalPaginas} páginas. La previsualización muestra solo las elegidas.`}
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-end gap-2">
                <Button type="button" disabled={pending || !file || (totalPaginas > 1 && paginas.length === 0)} onClick={() => void onSubir()}>
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
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
