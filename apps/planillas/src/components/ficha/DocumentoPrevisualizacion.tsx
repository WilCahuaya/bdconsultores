"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { BotonDescargarDocumento } from "@/components/ficha/DescargaTrabajador";
import { girarPdfGuardado } from "@/lib/upload-documento";
import { getSignedDocumentoUrl } from "@/lib/storage-url";

function archivoEsPdf(file: File | null, path: string | null): boolean {
  if (file) return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  return Boolean(path?.toLowerCase().endsWith(".pdf"));
}

function archivoEsImagen(file: File | null, path: string | null): boolean {
  if (file) {
    return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|hei[cf])$/i.test(file.name);
  }
  return Boolean(path && /\.(jpe?g|png|webp)$/i.test(path));
}

function BotonesGirarPdf({
  storagePath,
  onGuardado,
}: {
  storagePath: string;
  onGuardado: () => void;
}) {
  const { pushToast } = useToast();
  const router = useRouter();
  const [pending, setPending] = useState<"izq" | "der" | null>(null);

  async function girar(grados: 90 | -90) {
    setPending(grados === -90 ? "izq" : "der");
    const result = await girarPdfGuardado(storagePath, grados);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    onGuardado();
    router.refresh();
    pushToast("PDF girado y guardado.");
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={pending !== null} onClick={() => void girar(-90)}>
        {pending === "izq" ? "Girando…" : "Girar a la izquierda"}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending !== null} onClick={() => void girar(90)}>
        {pending === "der" ? "Girando…" : "Girar a la derecha"}
      </Button>
    </>
  );
}
function BotonPrevisualizacion({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      {visible ? "Ocultar previsualización" : "Ver previsualización"}
    </Button>
  );
}

function useVistaDocumento(
  titulo: string,
  storagePath: string | null | undefined,
  file: File | null,
  defaultVisible?: boolean,
  alto = "h-[min(72vh,44rem)]",
  marca = 0,
) {
  const hayArchivo = Boolean(file || storagePath);
  const [visible, setVisible] = useState(Boolean(defaultVisible));
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hayArchivo) setVisible(false);
  }, [hayArchivo]);

  useEffect(() => {
    if (file) setVisible(true);
  }, [file]);

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
  }, [storagePath, marca]);

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
  const esImagen = archivoEsImagen(file, storagePath ?? null);
  const vista = hayArchivo && visible ? (
    error && !src ? (
      <p className="text-sm text-muted-foreground">{error}</p>
    ) : !src ? (
      <p className="text-sm text-muted-foreground">Cargando vista previa…</p>
    ) : esPdf ? (
      <iframe title={titulo} src={src} className={`${alto} w-full rounded-md border bg-background`} />
    ) : esImagen ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={titulo} className={`${alto} w-full rounded-md border bg-muted object-contain`} />
    ) : (
      <p className="text-sm text-muted-foreground">Este archivo se guardará como PDF.</p>
    )
  ) : null;

  return { hayArchivo, visible, setVisible, vista };
}

export function VistaDocumentoGuardado({
  titulo,
  storagePath,
  compacto = false,
}: {
  titulo: string;
  storagePath: string;
  compacto?: boolean;
}) {
  const alto = compacto ? "h-[min(38vh,24rem)]" : "h-[min(72vh,44rem)]";
  const [marca, setMarca] = useState(0);
  const { vista } = useVistaDocumento(titulo, storagePath, null, true, alto, marca);
  const esPdf = archivoEsPdf(null, storagePath);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{titulo}</p>
        {esPdf ? <BotonesGirarPdf storagePath={storagePath} onGuardado={() => setMarca((valor) => valor + 1)} /> : null}
      </div>
      {vista}
    </div>
  );
}

export function MarcoPrevisualizacion({
  titulo,
  storagePath,
  file = null,
  children,
  nombreDescarga,
  sinBotonDescarga = false,
}: {
  titulo: string;
  storagePath: string | null | undefined;
  file?: File | null;
  children: ReactNode;
  nombreDescarga?: string | null;
  sinBotonDescarga?: boolean;
}) {
  const [marca, setMarca] = useState(0);
  const { hayArchivo, visible, setVisible, vista } = useVistaDocumento(titulo, storagePath, file, undefined, undefined, marca);
  const puedeGirar = Boolean(storagePath) && !file && archivoEsPdf(null, storagePath ?? null);

  return (
    <div className="space-y-3">
      {hayArchivo ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {storagePath && !sinBotonDescarga ? (
            <BotonDescargarDocumento titulo={titulo} storagePath={storagePath} nombreDescarga={nombreDescarga} />
          ) : null}
          {puedeGirar && storagePath ? (
            <BotonesGirarPdf storagePath={storagePath} onGuardado={() => setMarca((valor) => valor + 1)} />
          ) : null}
          <BotonPrevisualizacion visible={visible} onClick={() => setVisible((valor) => !valor)} />
        </div>
      ) : null}
      {vista ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-3">{children}</div>
          <div className="lg:sticky lg:top-4">{vista}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function DocumentoPrevisualizacion({
  titulo,
  storagePath,
  file = null,
  vacio = "Aún no hay escaneo en Documentos.",
  defaultVisible,
  extra,
  nombreDescarga,
  sinBotonDescarga = false,
}: {
  titulo: string;
  storagePath: string | null | undefined;
  file?: File | null;
  vacio?: string;
  defaultVisible?: boolean;
  extra?: ReactNode;
  nombreDescarga?: string | null;
  sinBotonDescarga?: boolean;
}) {
  const [marca, setMarca] = useState(0);
  const { hayArchivo, visible, setVisible, vista } = useVistaDocumento(
    titulo,
    storagePath,
    file,
    defaultVisible,
    undefined,
    marca,
  );
  const puedeGirar = Boolean(storagePath) && !file && archivoEsPdf(null, storagePath ?? null);

  return (
    <section className={`${panelCardClass} space-y-3 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{titulo}</p>
        {hayArchivo ? (
          <div className="flex flex-wrap items-center gap-2">
            {storagePath && !sinBotonDescarga ? (
              <BotonDescargarDocumento titulo={titulo} storagePath={storagePath} nombreDescarga={nombreDescarga} />
            ) : null}
            {puedeGirar && storagePath ? (
              <BotonesGirarPdf storagePath={storagePath} onGuardado={() => setMarca((valor) => valor + 1)} />
            ) : null}
            <BotonPrevisualizacion visible={visible} onClick={() => setVisible((valor) => !valor)} />
          </div>
        ) : null}
      </div>
      {!hayArchivo ? <p className="text-sm text-muted-foreground">{vacio}</p> : null}
      {vista && extra ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-3">{extra}</div>
          <div className="lg:sticky lg:top-4">{vista}</div>
        </div>
      ) : (
        <>
          {vista ? <div>{vista}</div> : null}
          {extra}
        </>
      )}
    </section>
  );
}
