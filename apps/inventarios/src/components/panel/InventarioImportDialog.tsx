"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Entidad,
  ImportActivoErrorItem,
  ImportActivosResult,
  ImportProgress,
} from "@inventario/types";
import { IMPORT_PROGRESS_CHUNK_SIZE, MAX_IMPORT_ACTIVOS_FILAS, toImportProgress } from "@inventario/types";
import { Button, Dialog, FileInput, ImportProgressBar, Label, Select } from "@inventario/ui";
import { getImportActivosUbicaciones, importActivos } from "@/lib/actions/import-activos";
import {
  downloadImportActivosErrores,
  downloadImportActivosPlantilla,
  parseImportActivosWorkbook,
} from "@/lib/import-activos-xlsx";
import { panelModalClass } from "./panel-ui";

interface InventarioImportDialogProps {
  open: boolean;
  onClose: () => void;
  entidades: Entidad[];
  fixedEntidad?: Entidad | null;
  onImported?: () => void;
}

export function InventarioImportDialog({
  open,
  onClose,
  entidades,
  fixedEntidad = null,
  onImported,
}: InventarioImportDialogProps) {
  const router = useRouter();
  const [entidadId, setEntidadId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportActivosResult | null>(null);
  const [templatePending, setTemplatePending] = useState(false);

  const entidad = fixedEntidad ?? entidades.find((e) => e.id === entidadId);
  const resolvedEntidadId = fixedEntidad?.id ?? entidadId;

  useEffect(() => {
    if (!open) {
      setEntidadId("");
      setFile(null);
      setPending(false);
      setProgress(null);
      setParseError(null);
      setActionError(null);
      setResult(null);
      setTemplatePending(false);
      return;
    }
    if (fixedEntidad) {
      setEntidadId(fixedEntidad.id);
    }
  }, [open, fixedEntidad]);

  async function handleDownloadPlantilla() {
    if (!resolvedEntidadId || !entidad) return;
    setTemplatePending(true);
    setActionError(null);
    try {
      const ubicaciones = await getImportActivosUbicaciones(resolvedEntidadId);
      if (ubicaciones.length === 0) {
        setActionError("La entidad no tiene ambientes activos.");
        return;
      }
      await downloadImportActivosPlantilla(entidad.nombre, ubicaciones);
    } catch (err) {
      console.error(err);
      setActionError("No se pudo generar la plantilla.");
    } finally {
      setTemplatePending(false);
    }
  }

  async function handleImport() {
    if (!resolvedEntidadId || !file) return;
    setPending(true);
    setProgress(null);
    setParseError(null);
    setActionError(null);
    setResult(null);

    try {
      const parsed = await parseImportActivosWorkbook(file);
      if (parsed.error) {
        setParseError(parsed.error);
        return;
      }

      const filas = parsed.filas;
      const total = filas.length;
      setProgress(toImportProgress(0, total));

      let importados = 0;
      const errores: ImportActivoErrorItem[] = [];

      for (let i = 0; i < filas.length; i += IMPORT_PROGRESS_CHUNK_SIZE) {
        const chunk = filas.slice(i, i + IMPORT_PROGRESS_CHUNK_SIZE);
        const response = await importActivos(resolvedEntidadId, chunk, { filaOffset: i });
        if (response.error) {
          setActionError(response.error);
          return;
        }
        if (response.data) {
          importados += response.data.importados;
          errores.push(...response.data.errores);
        }
        setProgress(toImportProgress(Math.min(i + chunk.length, total), total));
      }

      const aggregated: ImportActivosResult = {
        totalFilas: total,
        importados,
        errores,
      };
      setResult(aggregated);
      if (importados > 0) {
        onImported?.();
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setActionError("No se pudo completar la importación.");
    } finally {
      setPending(false);
      setProgress(null);
    }
  }

  async function handleDownloadErrores() {
    if (!entidad || !result?.errores.length) return;
    await downloadImportActivosErrores(entidad.nombre, result.errores);
  }

  const anioPreregistro = new Date().getFullYear();

  const canImport = Boolean(resolvedEntidadId && file && !pending);
  const hasErrores = (result?.errores.length ?? 0) > 0;

  return (
    <Dialog open={open} onClose={onClose} title="Importar activos" className={panelModalClass}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {fixedEntidad ? (
            <>
              Importe activos de <strong>{fixedEntidad.nombre}</strong> desde Excel. Al registrar, el
              correlativo y código de barras se asignan automáticamente. En columna Ambiente use
              «preregistro» o «Adquisicion {anioPreregistro}» para preregistrar sin código.
              Máximo {MAX_IMPORT_ACTIVOS_FILAS} filas por archivo.
            </>
          ) : (
            <>
              Importe activos de una entidad desde Excel. Al registrar, el correlativo y código de
              barras se asignan automáticamente. En Ambiente use un local físico o «preregistro» /
              «Adquisicion {anioPreregistro}» para preregistrar. Máximo{" "}
              {MAX_IMPORT_ACTIVOS_FILAS} filas por archivo.
            </>
          )}
        </p>

        {!fixedEntidad && (
          <div className="space-y-2">
            <Label htmlFor="import_entidad">Entidad</Label>
            <Select
              id="import_entidad"
              value={entidadId}
              onChange={setEntidadId}
              options={[
                { value: "", label: "Seleccione entidad…" },
                ...entidades.map((e) => ({ value: e.id, label: e.nombre })),
              ]}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!resolvedEntidadId || templatePending || pending}
            onClick={() => void handleDownloadPlantilla()}
          >
            {templatePending ? "Generando…" : "Descargar plantilla"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="import_archivo">Archivo Excel (.xlsx)</Label>
          <FileInput
            id="import_archivo"
            variant="dropzone"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            buttonLabel="Seleccionar Excel"
            dropzoneLabel="Arrastre el archivo Excel aquí"
            dropzoneHint="Solo archivos .xlsx"
            file={file}
            onFileChange={(f) => {
              setFile(f);
              setParseError(null);
              setResult(null);
            }}
          />
        </div>

        {pending && progress && <ImportProgressBar progress={progress} />}

        {parseError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {parseError}
          </p>
        )}

        {actionError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionError}
          </p>
        )}

        {result && (
          <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            <p>
              Se importaron <strong>{result.importados}</strong> de{" "}
              <strong>{result.totalFilas}</strong> filas.
            </p>
            {hasErrores && (
              <p className="text-muted-foreground">
                {result.errores.length}{" "}
                {result.errores.length === 1 ? "fila no se importó" : "filas no se importaron"}.
                Corríjalas y vuelva a importar el archivo de errores.
              </p>
            )}
            {hasErrores && (
              <Button type="button" size="sm" variant="outline" onClick={() => void handleDownloadErrores()}>
                Descargar Excel de errores
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/40 pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          {!result && (
            <Button type="button" size="sm" disabled={!canImport} onClick={() => void handleImport()}>
              {pending ? `Importando… ${progress?.percent ?? 0}%` : "Importar"}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
