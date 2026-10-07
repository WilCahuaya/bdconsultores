"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import { DocumentoFileInput } from "@/components/ficha/DocumentoFileInput";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { EliminarDocumentoGuardado } from "@/components/ficha/ConfirmarEliminarArchivo";
import type { TipoDocumentoPlanilla } from "@inventario/types";
import { darDeBajaTrabajador, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { addDocumento, setDocumentoArchivo, type DocumentoRow } from "@/lib/actions/ficha";
import { TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";
import { documentoCargado } from "@/lib/flujo-ficha";
import { DateField, SelectField } from "@/components/fields";

type MotivoBaja = "CARTA_RENUNCIA" | "TERMINO_CONTRATO";

export function DarDeBajaControl({
  trabajador,
  documentoCarta = null,
  documentoTrBaja = null,
}: {
  trabajador: TrabajadorListItem;
  documentoCarta?: DocumentoRow | null;
  documentoTrBaja?: DocumentoRow | null;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fechaCese, setFechaCese] = useState("");
  const [motivo, setMotivo] = useState<MotivoBaja>("CARTA_RENUNCIA");
  const [observacion, setObservacion] = useState("");
  const [bajaAfp, setBajaAfp] = useState(false);
  const [archivoCarta, setArchivoCarta] = useState<File | null>(null);
  const [archivoTrBaja, setArchivoTrBaja] = useState<File | null>(null);

  const yaHayCarta = Boolean(documentoCarta?.storage_path) || documentoCargado(trabajador.documentos, "CARTA_RENUNCIA");
  const yaHayTrBaja = Boolean(documentoTrBaja?.storage_path) || documentoCargado(trabajador.documentos, "TR_BAJA");
  const esCarta = motivo === "CARTA_RENUNCIA";
  const listoCarta = !esCarta || yaHayCarta || Boolean(archivoCarta);
  const listoTrBaja = yaHayTrBaja || Boolean(archivoTrBaja);
  const puedeDarDeBaja = Boolean(fechaCese.trim()) && listoCarta && listoTrBaja && bajaAfp;

  async function subirDocumento(
    tipo: TipoDocumentoPlanilla,
    file: File,
    existente: DocumentoRow | null,
  ): Promise<string | null> {
    let documentoId = existente?.id ?? null;
    if (!documentoId) {
      const data = new FormData();
      data.set("tipo", tipo);
      data.set("estado", "PENDIENTE");
      const created = await addDocumento(trabajador.id, data);
      if (created.error || !created.documentoId) {
        return created.error ?? "No se pudo registrar el documento de baja.";
      }
      documentoId = created.documentoId;
    }
    const upload = await uploadDocumentoFile(
      trabajador.entidad_id,
      trabajador.id,
      documentoId,
      file,
      existente?.storage_path,
    );
    if (upload.error || !upload.path) {
      return upload.error ?? "No se pudo subir el documento de baja.";
    }
    const savedFile = await setDocumentoArchivo(trabajador.id, documentoId, upload.path);
    return savedFile.error ?? null;
  }

  async function onBaja() {
    if (!puedeDarDeBaja) return;
    setPending(true);
    if (esCarta && archivoCarta) {
      const errorCarta = await subirDocumento("CARTA_RENUNCIA", archivoCarta, documentoCarta);
      if (errorCarta) {
        setPending(false);
        pushToast(errorCarta, "error");
        return;
      }
    }
    if (archivoTrBaja) {
      const errorTr = await subirDocumento("TR_BAJA", archivoTrBaja, documentoTrBaja);
      if (errorTr) {
        setPending(false);
        pushToast(errorTr, "error");
        return;
      }
    }
    const form = new FormData();
    form.set("fecha_cese", fechaCese);
    form.set("tipo_baja", motivo);
    form.set("observacion_baja", observacion.trim());
    form.set("baja_afp", "true");
    const result = await darDeBajaTrabajador(trabajador.id, form);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setConfirmOpen(false);
    setArchivoCarta(null);
    setArchivoTrBaja(null);
    setObservacion("");
    setBajaAfp(false);
    pushToast("Trabajador dado de baja.");
    router.refresh();
  }

  return (
    <section className={`${panelCardClass} space-y-5 p-5`}>
      <div>
        <h3 className="text-sm font-medium text-foreground">Dar de baja</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete el formulario con previsualización. El botón se habilita al marcar la baja de AFP. El modal solo confirma
          el cese.
        </p>
      </div>

      <SelectField
        label="Motivo de baja"
        name="tipo_baja"
        value={motivo}
        options={[
          { value: "CARTA_RENUNCIA", label: TIPO_DOCUMENTO_LABEL.CARTA_RENUNCIA },
          { value: "TERMINO_CONTRATO", label: TIPO_DOCUMENTO_LABEL.TERMINO_CONTRATO },
        ]}
        onChange={(event) => {
          setMotivo(event.target.value as MotivoBaja);
          setArchivoCarta(null);
        }}
      />

      {esCarta ? (
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.CARTA_RENUNCIA}
          storagePath={archivoCarta ? null : documentoCarta?.storage_path}
          file={archivoCarta}
          vacio="Suba la carta de renuncia."
          extra={
            <div className="space-y-3">
              <DocumentoFileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={pending}
                file={archivoCarta}
                buttonLabel={
                  archivoCarta || documentoCarta?.storage_path
                    ? "Cambiar carta de renuncia"
                    : "Subir carta de renuncia"
                }
                emptyLabel="Obligatorio. PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
                onFileChange={setArchivoCarta}
              />
              {documentoCarta?.storage_path ? (
                <EliminarDocumentoGuardado
                  relacionId={trabajador.id}
                  documentoId={documentoCarta.id}
                  descripcion="¿Eliminar la carta de renuncia?"
                  disabled={pending}
                />
              ) : null}
            </div>
          }
        />
      ) : null}

      <DateField
        label={esCarta ? "Fecha de último día de trabajo (fecha de baja)" : "Fecha de baja"}
        name="fecha_cese"
        value={fechaCese}
        onChange={setFechaCese}
        hint={esCarta ? "Es el último día trabajado; queda como fecha de cese." : undefined}
      />

      <DocumentoPrevisualizacion
        titulo={TIPO_DOCUMENTO_LABEL.TR_BAJA}
        storagePath={archivoTrBaja ? null : documentoTrBaja?.storage_path}
        file={archivoTrBaja}
        vacio="Suba la baja de T-Registro."
        extra={
          <div className="space-y-3">
            <DocumentoFileInput
              accept={DOCUMENTO_ACCEPT}
              disabled={pending}
              file={archivoTrBaja}
              buttonLabel={
                archivoTrBaja || documentoTrBaja?.storage_path
                  ? "Cambiar baja de T-Registro"
                  : "Subir baja de T-Registro"
              }
              emptyLabel="Obligatorio. PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
              onFileChange={setArchivoTrBaja}
            />
            {documentoTrBaja?.storage_path ? (
              <EliminarDocumentoGuardado
                relacionId={trabajador.id}
                documentoId={documentoTrBaja.id}
                descripcion="¿Eliminar la baja de T-Registro?"
                disabled={pending}
              />
            ) : null}
          </div>
        }
      />

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">Observación</span>
        <textarea
          name="observacion_baja"
          value={observacion}
          onChange={(event) => setObservacion(event.target.value)}
          disabled={pending}
          rows={3}
          maxLength={1000}
          placeholder="Opcional"
          className="flex min-h-[2.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="baja_afp"
          className="h-4 w-4 rounded border-input"
          checked={bajaAfp}
          disabled={pending}
          onChange={(event) => setBajaAfp(event.target.checked)}
        />
        Se dio de baja de AFP
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="destructive"
          disabled={!puedeDarDeBaja || pending}
          onClick={() => setConfirmOpen(true)}
        >
          Dar de baja
        </Button>
        {!puedeDarDeBaja ? (
          <p className="text-xs text-muted-foreground">
            Falta completar:{" "}
            {[
              !fechaCese.trim() ? "fecha de baja" : null,
              esCarta && !listoCarta ? "carta de renuncia" : null,
              !listoTrBaja ? "T-Registro baja" : null,
              !bajaAfp ? "marcar baja AFP" : null,
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (pending) return;
          setConfirmOpen(false);
        }}
        title="Confirmar baja"
        description="La ficha pasará a cesada y soltará el número. ¿Confirma dar de baja a este trabajador?"
        confirmLabel="Sí, dar de baja"
        confirmVariant="destructive"
        pending={pending}
        onConfirm={() => void onBaja()}
      />
    </section>
  );
}
