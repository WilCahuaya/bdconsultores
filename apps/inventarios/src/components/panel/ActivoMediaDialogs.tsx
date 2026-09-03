"use client";

import { useEffect, useState } from "react";
import { Button, Dialog } from "@inventario/ui";
import { getSignedStorageUrl } from "@/lib/storage-url";
import { IconDescargar } from "./activo-icons";
import { panelModalClass } from "./panel-ui";

function isImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(file.name)
  );
}

function isImagePath(path: string): boolean {
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(path);
}

interface PdfPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  path?: string | null;
  file?: File | null;
  titulo?: string;
}

export function PdfPreviewDialog({ open, onClose, path, file, titulo }: PdfPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const asImage = Boolean(file ? isImageFile(file) : path && isImagePath(path));

  useEffect(() => {
    if (!open || (!file && !path)) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      setError(null);
      setLoading(false);
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getSignedStorageUrl("comprobantes-activos", path!).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl(result.url ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, path, file]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titulo ?? "Comprobante de adquisición"}
      className="max-w-none"
      style={{ width: "95vw", height: "92vh", maxWidth: "95vw", maxHeight: "92vh" }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {loading && <p className="text-sm text-muted-foreground">Cargando documento…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {url && (
          <>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/20">
              {asImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={titulo ?? "Vista previa del comprobante"}
                  className="max-h-full max-w-full object-contain p-2"
                />
              ) : (
                <iframe
                  src={`${url}#view=FitH`}
                  title={titulo ?? "Vista previa del comprobante"}
                  className="h-full w-full"
                />
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <a href={url} download target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="secondary" className="gap-2">
                  <IconDescargar />
                  Descargar
                </Button>
              </a>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

interface FotoPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  path?: string | null;
  file?: File | null;
  titulo?: string;
}

export function FotoPreviewDialog({ open, onClose, path, file, titulo }: FotoPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || (!file && !path)) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      setError(null);
      setLoading(false);
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getSignedStorageUrl("fotos-activos", path!).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl(result.url ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, path, file]);

  return (
    <Dialog open={open} onClose={onClose} title={titulo ?? "Foto del activo"} className={panelModalClass}>
      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Cargando imagen…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {url && (
          <>
            <div className="flex justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/20 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={titulo ?? "Foto del activo"}
                className="max-h-[50vh] max-w-full object-contain sm:max-h-[60vh] lg:max-h-[65vh]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <a href={url} download target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="secondary" className="gap-2">
                  <IconDescargar />
                  Descargar
                </Button>
              </a>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
