"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@inventario/ui";
import { nombreDescargaDocumento } from "@/lib/documento-storage";
import { getSignedDocumentoUrl } from "@/lib/storage-url";

export type DescargaTrabajador = {
  numero: number | null;
  nombres: string;
  apellidoPaterno: string | null;
};

const DescargaTrabajadorContext = createContext<DescargaTrabajador | null>(null);

export function DescargaTrabajadorProvider({
  value,
  children,
}: {
  value: DescargaTrabajador;
  children: ReactNode;
}) {
  return <DescargaTrabajadorContext.Provider value={value}>{children}</DescargaTrabajadorContext.Provider>;
}

export function useDescargaTrabajador(): DescargaTrabajador | null {
  return useContext(DescargaTrabajadorContext);
}

export function nombreConNumeroTrabajador(
  titulo: string,
  storagePath: string,
  override?: string | null,
  trabajador?: DescargaTrabajador | null,
): string {
  const ext = storagePath.split(".").pop()?.toLowerCase() || "pdf";
  const base = override?.trim();
  if (base) return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
  return nombreDescargaDocumento(titulo, storagePath, trabajador ?? undefined);
}

export function BotonDescargarDocumento({
  titulo,
  storagePath,
  nombreDescarga,
}: {
  titulo: string;
  storagePath: string;
  nombreDescarga?: string | null;
}) {
  const trabajador = useDescargaTrabajador();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nombre = nombreConNumeroTrabajador(titulo, storagePath, nombreDescarga, trabajador);

  async function descargar() {
    setOpening(true);
    setError(null);
    const result = await getSignedDocumentoUrl(storagePath, { download: nombre });
    setOpening(false);
    if (result.error || !result.url) {
      setError(result.error ?? "No se pudo descargar.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={opening} onClick={() => void descargar()}>
        {opening ? "Preparando…" : "Descargar"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
