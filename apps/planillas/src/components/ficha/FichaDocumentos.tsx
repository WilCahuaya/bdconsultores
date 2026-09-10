"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { addDocumento, setDocumentoArchivo, type DocumentoRow } from "@/lib/actions/ficha";
import { DOCUMENTO_ACCEPT, nombreDescargaDocumento } from "@/lib/documento-storage";
import { ESTADO_DOCUMENTO_LABEL, TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import type { TipoDocumentoPlanilla } from "@inventario/types";
import { getSignedDocumentoUrl } from "@/lib/storage-url";
import { uploadDocumentoFile } from "@/lib/upload-documento";
import { Field, SelectField } from "@/components/fields";

export function FichaDocumentos({
  relacionId,
  entidadId,
  documentos,
  canWrite,
  tiposFiltro,
  permitirAgregar = true,
  hint,
}: {
  relacionId: string;
  entidadId: string;
  documentos: DocumentoRow[];
  canWrite: boolean;
  tiposFiltro?: TipoDocumentoPlanilla[];
  permitirAgregar?: boolean;
  hint?: string;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [nuevoArchivo, setNuevoArchivo] = useState<File | null>(null);
  const visibles = tiposFiltro ? documentos.filter((d) => tiposFiltro.includes(d.tipo)) : documentos;
  const [mostrarNuevo, setMostrarNuevo] = useState(visibles.length === 0);

  async function onSubmit(formData: FormData) {
    setPending(true);
    const created = await addDocumento(relacionId, formData);
    if (created.error || !created.documentoId) {
      setPending(false);
      pushToast(created.error ?? "No se pudo registrar el documento.", "error");
      return;
    }

    if (nuevoArchivo) {
      const uploadError = await adjuntarArchivo(created.documentoId, nuevoArchivo, null);
      if (uploadError) {
        setPending(false);
        pushToast(uploadError, "error");
        router.refresh();
        return;
      }
    }

    setNuevoArchivo(null);
    setMostrarNuevo(false);
    setPending(false);
    pushToast("Documento guardado.");
    router.refresh();
  }

  async function adjuntarArchivo(documentoId: string, file: File, previousPath: string | null) {
    const upload = await uploadDocumentoFile(entidadId, relacionId, documentoId, file, previousPath);
    if (upload.error || !upload.path) return upload.error ?? "No se pudo subir el archivo.";
    const saved = await setDocumentoArchivo(relacionId, documentoId, upload.path);
    return saved.error ?? null;
  }

  const tipoOptions = (tiposFiltro ?? (Object.keys(TIPO_DOCUMENTO_LABEL) as TipoDocumentoPlanilla[])).map(
    (value) => ({
      value,
      label: TIPO_DOCUMENTO_LABEL[value],
    }),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {hint ?? "Un archivo por documento (se puede reemplazar). PDF, JPG, PNG o WEBP. Máximo 10 MB."}
      </p>
      <ul className={`${panelCardClass} divide-y p-0`}>
        {visibles.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Aún no hay documentos en este paso.</li>
        ) : (
          visibles.map((d) => (
            <DocumentoItem
              key={d.id}
              documento={d}
              canWrite={canWrite}
              disabled={pending}
              onUpload={async (file) => {
                setPending(true);
                const uploadError = await adjuntarArchivo(d.id, file, d.storage_path);
                setPending(false);
                if (uploadError) {
                  pushToast(uploadError, "error");
                  return false;
                }
                pushToast("Archivo guardado.");
                router.refresh();
                return true;
              }}
            />
          ))
        )}
      </ul>
      {canWrite && permitirAgregar && !mostrarNuevo ? (
        <Button type="button" variant="outline" onClick={() => setMostrarNuevo(true)}>
          Registrar documento
        </Button>
      ) : null}
      {canWrite && permitirAgregar && mostrarNuevo ? (
        <form action={onSubmit} key={visibles.length} className={`${panelCardClass} space-y-4 p-5`}>
          <p className="text-sm font-medium">Registrar documento</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tipo"
              name="tipo"
              options={tipoOptions}
            />
            <SelectField
              label="Estado"
              name="estado"
              defaultValue="PENDIENTE"
              options={Object.entries(ESTADO_DOCUMENTO_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <Field label="Observaciones" name="observaciones" />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium">Archivo</span>
            <FileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending}
              file={nuevoArchivo}
              buttonLabel={nuevoArchivo ? "Cambiar archivo" : "Seleccionar PDF o imagen"}
              emptyLabel="Opcional. PDF, JPG, PNG o WEBP. Máximo 10 MB."
              onFileChange={setNuevoArchivo}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setNuevoArchivo(null);
                setMostrarNuevo(visibles.length === 0);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function DocumentoItem({
  documento,
  canWrite,
  disabled,
  onUpload,
}: {
  documento: DocumentoRow;
  canWrite: boolean;
  disabled: boolean;
  onUpload: (file: File) => Promise<boolean>;
}) {
  const [opening, setOpening] = useState<"ver" | "descargar" | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const tieneArchivo = Boolean(documento.storage_path);

  async function abrir(modo: "ver" | "descargar") {
    if (!documento.storage_path) return;
    setOpening(modo);
    setLinkError(null);
    const downloadName = nombreDescargaDocumento(TIPO_DOCUMENTO_LABEL[documento.tipo], documento.storage_path);
    const result = await getSignedDocumentoUrl(documento.storage_path, {
      download: modo === "descargar" ? downloadName : undefined,
    });
    setOpening(null);
    if (result.error || !result.url) {
      setLinkError(result.error ?? "No se pudo abrir el archivo.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function guardarPendiente() {
    if (!archivoPendiente) return;
    const ok = await onUpload(archivoPendiente);
    if (ok) setArchivoPendiente(null);
  }

  return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{TIPO_DOCUMENTO_LABEL[documento.tipo]}</span>
        <span className="text-muted-foreground">{ESTADO_DOCUMENTO_LABEL[documento.estado]}</span>
      </div>
      {documento.observaciones ? (
        <p className="text-muted-foreground">{documento.observaciones}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {tieneArchivo ? (
          <>
            <Button type="button" size="sm" variant="outline" disabled={opening !== null} onClick={() => void abrir("ver")}>
              {opening === "ver" ? "Abriendo…" : "Ver"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={opening !== null} onClick={() => void abrir("descargar")}>
              {opening === "descargar" ? "Preparando…" : "Descargar"}
            </Button>
          </>
        ) : archivoPendiente ? null : (
          <span className="text-muted-foreground">Sin archivo</span>
        )}
        {canWrite && archivoPendiente ? (
          <>
            <span className="text-muted-foreground">{archivoPendiente.name}</span>
            <Button type="button" size="sm" disabled={disabled} onClick={() => void guardarPendiente()}>
              {disabled ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setArchivoPendiente(null)}>
              Cancelar
            </Button>
          </>
        ) : canWrite ? (
          <label className="inline-flex">
            <input
              type="file"
              accept={DOCUMENTO_ACCEPT}
              disabled={disabled}
              className="sr-only"
              aria-label={tieneArchivo ? "Reemplazar archivo" : "Subir archivo"}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) setArchivoPendiente(file);
              }}
            />
            <span
              className={`inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent ${disabled ? "pointer-events-none opacity-50" : ""}`}
            >
              {tieneArchivo ? "Reemplazar" : "Subir archivo"}
            </span>
          </label>
        ) : null}
      </div>
      {linkError ? <p className="text-destructive">{linkError}</p> : null}
    </li>
  );
}
