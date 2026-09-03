"use client";

import { useEffect, useState } from "react";
import {
  formatComprobanteSerieInput,
  formatFechaInputDDMMYYYY,
  validarFechaDDMMYYYY,
} from "@inventario/types";
import { Button, Dialog, FechaDdMmYyyyInput, Input, Label } from "@inventario/ui";

export type ComprobanteFacturaDatos = {
  serie: string;
  fecha: string;
  monto: string;
};

interface ComprobanteSerieDialogProps {
  open: boolean;
  file?: File | null;
  /** Ruta en storage si no hay File local (edición / PDF ya guardado). */
  path?: string | null;
  fileName?: string;
  initialSerie?: string;
  initialFecha?: string;
  initialMonto?: string;
  confirmLabel?: string;
  loadPathUrl?: (path: string) => Promise<{ url?: string; error?: string }>;
  onConfirm: (datos: ComprobanteFacturaDatos) => void;
  onCancel: () => void;
}

function isImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(file.name)
  );
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isImagePath(path: string): boolean {
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(path);
}

export function ComprobanteSerieDialog({
  open,
  file,
  path,
  fileName,
  initialSerie = "",
  initialFecha = "",
  initialMonto = "",
  confirmLabel = "Confirmar",
  loadPathUrl,
  onConfirm,
  onCancel,
}: ComprobanteSerieDialogProps) {
  const [serie, setSerie] = useState(initialSerie);
  const [fecha, setFecha] = useState(initialFecha);
  const [monto, setMonto] = useState(initialMonto);
  const [fechaError, setFechaError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const displayName = file?.name ?? fileName ?? (path ? path.split("/").pop() : undefined);
  const asImage = Boolean(file ? isImageFile(file) : path && isImagePath(path));
  const asPdf = Boolean(file ? isPdfFile(file) : path && !asImage);

  useEffect(() => {
    if (!open) return;
    setSerie(initialSerie);
    setFecha(initialFecha);
    setMonto(initialMonto);
    setFechaError(null);
  }, [open, initialSerie, initialFecha, initialMonto]);

  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    if (file && (asPdf || asImage)) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setPreviewError(null);
      setPreviewLoading(false);
      return () => {
        URL.revokeObjectURL(url);
        setPreviewUrl(null);
      };
    }

    if (path && loadPathUrl) {
      let cancelled = false;
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewUrl(null);
      void loadPathUrl(path).then((result) => {
        if (cancelled) return;
        setPreviewLoading(false);
        if (result.error) {
          setPreviewError(result.error);
          return;
        }
        setPreviewUrl(result.url ?? null);
      });
      return () => {
        cancelled = true;
      };
    }

    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, [open, file, path, loadPathUrl, asPdf, asImage]);

  function handleConfirm() {
    const trimmedSerie = serie.trim();
    if (!trimmedSerie) return;

    const fechaTrim = fecha.trim();
    if (fechaTrim) {
      const error = validarFechaDDMMYYYY(fechaTrim);
      if (error) {
        setFechaError(error);
        return;
      }
    }

    onConfirm({
      serie: formatComprobanteSerieInput(trimmedSerie),
      fecha: fechaTrim ? formatFechaInputDDMMYYYY(fechaTrim) : "",
      monto: monto.trim(),
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Datos del comprobante"
      description={
        displayName
          ? `Revise el PDF y edite los datos de «${displayName}».`
          : "Revise el PDF y edite serie, fecha y monto."
      }
      className="max-w-none"
      style={{ width: "95vw", height: "92vh", maxWidth: "95vw", maxHeight: "92vh" }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {previewLoading && (
            <p className="text-sm text-muted-foreground">Cargando documento…</p>
          )}
          {previewError && <p className="text-sm text-destructive">{previewError}</p>}
          {previewUrl ? (
            <div className="flex min-h-[45vh] flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 lg:min-h-0">
              {asImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={displayName ?? "Vista previa del comprobante"}
                  className="max-h-full max-w-full object-contain p-2"
                />
              ) : (
                <iframe
                  title={`Vista previa de ${displayName ?? "comprobante"}`}
                  src={`${previewUrl}#view=FitH`}
                  className="h-full w-full"
                />
              )}
            </div>
          ) : (
            !previewLoading &&
            !previewError && (
              <div className="flex min-h-[45vh] flex-1 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground lg:min-h-0">
                Sin vista previa
              </div>
            )
          )}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72 xl:w-80">
          <div className="space-y-2">
            <Label htmlFor="comprobante_serie_dialog">Serie</Label>
            <Input
              id="comprobante_serie_dialog"
              value={serie}
              onChange={(e) => setSerie(formatComprobanteSerieInput(e.target.value))}
              placeholder="Ej. F/E001 - 0007"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comprobante_fecha_dialog">Fecha</Label>
            <FechaDdMmYyyyInput
              id="comprobante_fecha_dialog"
              value={fecha}
              onChange={(next) => {
                setFecha(next);
                if (fechaError) setFechaError(null);
              }}
              onBlur={() => {
                if (fecha.trim()) setFechaError(validarFechaDDMMYYYY(fecha));
              }}
              aria-invalid={Boolean(fechaError)}
            />
            {fechaError && <p className="text-xs text-destructive">{fechaError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="comprobante_monto_dialog">Monto (S/)</Label>
            <Input
              id="comprobante_monto_dialog"
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Fecha y monto se aplican al formulario del activo.
          </p>
          <div className="mt-auto flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end lg:flex-col-reverse lg:justify-start">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={!serie.trim()}>
              {confirmLabel}
            </Button>
          </div>
        </aside>
      </div>
    </Dialog>
  );
}
