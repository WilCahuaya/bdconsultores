"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Entidad,
  ImportAmbienteErrorItem,
  ImportAmbientesResult,
  ImportProgress,
} from "@inventario/types";
import { IMPORT_PROGRESS_CHUNK_SIZE, toImportProgress } from "@inventario/types";
import { Button, Dialog, FileInput, ImportProgressBar, Label } from "@inventario/ui";
import { importAmbientes } from "@/lib/actions/import-ambientes";
import {
  downloadImportAmbientesErrores,
  downloadImportAmbientesPlantilla,
  parseImportAmbientesWorkbook,
} from "@/lib/import-ambientes-xlsx";
import { panelModalClass } from "./panel-ui";

interface AmbientesImportDialogProps {
  open: boolean;
  onClose: () => void;
  entidad: Entidad;
  onImported?: () => void;
}

export function AmbientesImportDialog({
  open,
  onClose,
  entidad,
  onImported,
}: AmbientesImportDialogProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportAmbientesResult | null>(null);
  const [templatePending, setTemplatePending] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPending(false);
      setProgress(null);
      setParseError(null);
      setActionError(null);
      setResult(null);
      setTemplatePending(false);
    }
  }, [open]);

  async function handleDownloadPlantilla() {
    setTemplatePending(true);
    setActionError(null);
    try {
      await downloadImportAmbientesPlantilla(entidad.nombre);
    } catch (err) {
      console.error(err);
      setActionError("No se pudo generar la plantilla.");
    } finally {
      setTemplatePending(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setPending(true);
    setProgress(null);
    setParseError(null);
    setActionError(null);
    setResult(null);

    try {
      const parsed = await parseImportAmbientesWorkbook(file);
      if (parsed.error) {
        setParseError(parsed.error);
        return;
      }

      const filas = parsed.filas;
      const total = filas.length;
      setProgress(toImportProgress(0, total));

      let importados = 0;
      let sedesCreadas = 0;
      let responsablesCreados = 0;
      const errores: ImportAmbienteErrorItem[] = [];

      for (let i = 0; i < filas.length; i += IMPORT_PROGRESS_CHUNK_SIZE) {
        const chunk = filas.slice(i, i + IMPORT_PROGRESS_CHUNK_SIZE);
        const response = await importAmbientes(entidad.id, chunk, { filaOffset: i });
        if (response.error) {
          setActionError(response.error);
          return;
        }
        if (response.data) {
          importados += response.data.importados;
          sedesCreadas += response.data.sedesCreadas;
          responsablesCreados += response.data.responsablesCreados;
          errores.push(...response.data.errores);
        }
        setProgress(toImportProgress(Math.min(i + chunk.length, total), total));
      }

      const aggregated: ImportAmbientesResult = {
        totalFilas: total,
        importados,
        sedesCreadas,
        responsablesCreados,
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
    if (!result?.errores.length) return;
    await downloadImportAmbientesErrores(entidad.nombre, result.errores);
  }

  const canImport = Boolean(file && !pending);
  const hasErrores = (result?.errores.length ?? 0) > 0;

  return (
    <Dialog open={open} onClose={onClose} title="Importar ambientes" className={panelModalClass}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Importe ambientes de <strong>{entidad.nombre}</strong> desde Excel. Por cada fila se crea
          el ambiente y, si no existen, la sucursal y el responsable. Use{" "}
          <strong>Principal</strong> para la sucursal por defecto de la entidad. El cargo del
          responsable se asigna automáticamente.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={templatePending || pending}
            onClick={() => void handleDownloadPlantilla()}
          >
            {templatePending ? "Generando…" : "Descargar plantilla"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="import_ambientes_archivo">Archivo Excel (.xlsx)</Label>
          <FileInput
            id="import_ambientes_archivo"
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
              Se importaron <strong>{result.importados}</strong> ambiente
              {result.importados === 1 ? "" : "s"} de <strong>{result.totalFilas}</strong> filas.
            </p>
            {(result.sedesCreadas > 0 || result.responsablesCreados > 0) && (
              <p className="text-muted-foreground">
                {result.sedesCreadas > 0 && (
                  <>
                    Sucursales nuevas: <strong>{result.sedesCreadas}</strong>
                    {result.responsablesCreados > 0 ? " · " : ""}
                  </>
                )}
                {result.responsablesCreados > 0 && (
                  <>
                    Responsables nuevos: <strong>{result.responsablesCreados}</strong>
                  </>
                )}
              </p>
            )}
            {hasErrores && (
              <p className="text-muted-foreground">
                {result.errores.length}{" "}
                {result.errores.length === 1 ? "fila no se importó" : "filas no se importaron"}.
              </p>
            )}
            {hasErrores && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleDownloadErrores()}
              >
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
