"use client";

import { useRef, useState } from "react";
import { ACTIVO_COMPROBANTE_ACCEPT, ACTIVO_FOTO_ACCEPT } from "@inventario/types";
import { Button, FileInput } from "@inventario/ui";
import { updateActivoPaths } from "@/lib/actions/activos";
import { uploadActivoFile } from "@/lib/upload-activo-file";

interface ActivoUploadProps {
  activoId: string;
  entidadId: string;
  fotoPath?: string | null;
  comprobantePath?: string | null;
  compact?: boolean;
}

export function ActivoUpload({
  activoId,
  entidadId,
  fotoPath,
  comprobantePath,
  compact = false,
}: ActivoUploadProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentFotoPath, setCurrentFotoPath] = useState(fotoPath ?? null);
  const [currentComprobantePath, setCurrentComprobantePath] = useState(comprobantePath ?? null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const comprobanteRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, kind: "foto" | "comprobante") {
    setLoading(true);
    setStatus(null);

    const previousPath = kind === "foto" ? currentFotoPath : currentComprobantePath;
    const upload = await uploadActivoFile(entidadId, activoId, file, kind, previousPath);

    if (upload.error || !upload.path) {
      setLoading(false);
      setStatus(upload.error ?? "No se pudo subir el archivo");
      return;
    }

    const update = await updateActivoPaths(activoId, {
      ...(kind === "foto" ? { foto_path: upload.path } : { comprobante_path: upload.path }),
    });

    if (!update.error) {
      if (kind === "foto") setCurrentFotoPath(upload.path);
      else setCurrentComprobantePath(upload.path);
    }

    setLoading(false);
    setStatus(update.error ?? null);
  }

  if (compact) {
    return (
      <div className="flex min-w-[108px] flex-col gap-1">
        <input
          ref={fotoRef}
          type="file"
          accept={ACTIVO_FOTO_ACCEPT}
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file, "foto");
            e.target.value = "";
          }}
        />
        <input
          ref={comprobanteRef}
          type="file"
          accept={ACTIVO_COMPROBANTE_ACCEPT}
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file, "comprobante");
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant={currentFotoPath ? "secondary" : "outline"}
          className="h-7 px-2 text-[10px]"
          disabled={loading}
          onClick={() => fotoRef.current?.click()}
        >
          {currentFotoPath ? "Cambiar foto" : "Foto"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={currentComprobantePath ? "secondary" : "outline"}
          className="h-7 px-2 text-[10px]"
          disabled={loading}
          onClick={() => comprobanteRef.current?.click()}
        >
          {currentComprobantePath ? "Cambiar CP" : "Comprobante"}
        </Button>
        {loading && <span className="text-[10px] text-muted-foreground">Subiendo…</span>}
        {status && <span className="text-[10px] text-destructive">{status}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1">
        <span className="text-sm font-medium">Foto</span>
        <FileInput
          accept={ACTIVO_FOTO_ACCEPT}
          disabled={loading}
          buttonLabel={currentFotoPath ? "Cambiar foto" : "Seleccionar foto"}
          emptyLabel="Sin foto adjunta"
          hint={
            currentFotoPath
              ? `Actual: ${currentFotoPath.split("/").pop()}. Elija otra imagen para reemplazarla.`
              : "Formatos: JPG, PNG, WebP, GIF, BMP, HEIC, AVIF, TIFF."
          }
          onFileChange={(file) => {
            if (file) void uploadFile(file, "foto");
          }}
        />
      </div>
      <div className="space-y-1">
        <span className="text-sm font-medium">Comprobante PDF</span>
        <FileInput
          accept={ACTIVO_COMPROBANTE_ACCEPT}
          disabled={loading}
          buttonLabel={currentComprobantePath ? "Cambiar archivo" : "Seleccionar PDF"}
          emptyLabel="Sin archivo adjunto"
          hint={
            currentComprobantePath
              ? `Actual: ${currentComprobantePath.split("/").pop()}`
              : undefined
          }
          onFileChange={(file) => {
            if (file) void uploadFile(file, "comprobante");
          }}
        />
      </div>
      {status && <p className="text-xs text-destructive">{status}</p>}
      {loading && (
        <Button type="button" variant="secondary" size="sm" disabled>
          Subiendo…
        </Button>
      )}
    </div>
  );
}
