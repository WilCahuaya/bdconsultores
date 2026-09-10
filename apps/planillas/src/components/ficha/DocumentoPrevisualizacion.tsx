"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { getSignedDocumentoUrl } from "@/lib/storage-url";

function archivoEsPdf(file: File | null, path: string | null): boolean {
  if (file) return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  return Boolean(path?.toLowerCase().endsWith(".pdf"));
}

export function DocumentoPrevisualizacion({
  titulo,
  storagePath,
  file = null,
  vacio = "Aún no hay escaneo en Documentos.",
  defaultVisible,
  extra,
}: {
  titulo: string;
  storagePath: string | null | undefined;
  file?: File | null;
  vacio?: string;
  defaultVisible?: boolean;
  extra?: ReactNode;
}) {
  const hayArchivo = Boolean(file || storagePath);
  const [visible, setVisible] = useState(defaultVisible ?? hayArchivo);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVisible(defaultVisible ?? hayArchivo);
  }, [hayArchivo, defaultVisible]);

  useEffect(() => {
    if (!file) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setRemoteUrl(null);
    setError(null);
  }, [storagePath]);

  useEffect(() => {
    if (!visible || file || !storagePath || remoteUrl) return;
    let cancelled = false;
    void getSignedDocumentoUrl(storagePath).then((result) => {
      if (cancelled) return;
      if (result.url) {
        setRemoteUrl(result.url);
        setError(null);
        return;
      }
      setError(result.error ?? "No se pudo abrir el documento.");
    });
    return () => {
      cancelled = true;
    };
  }, [visible, file, storagePath, remoteUrl]);

  const src = localUrl ?? remoteUrl;
  const esPdf = archivoEsPdf(file, storagePath ?? null);

  return (
    <section className={`${panelCardClass} space-y-3 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{titulo}</p>
        {hayArchivo ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setVisible((v) => !v)}>
            {visible ? "Ocultar previsualización" : "Ver previsualización"}
          </Button>
        ) : null}
      </div>
      {!hayArchivo ? <p className="text-sm text-muted-foreground">{vacio}</p> : null}
      {hayArchivo && visible ? (
        error && !src ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : !src ? (
          <p className="text-sm text-muted-foreground">Cargando vista previa…</p>
        ) : esPdf ? (
          <iframe title={titulo} src={src} className="h-[min(72vh,44rem)] w-full rounded-md border bg-background" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={titulo} className="h-[min(72vh,44rem)] w-full rounded-md border bg-muted object-contain" />
        )
      ) : null}
      {extra}
    </section>
  );
}
