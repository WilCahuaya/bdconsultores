"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, useToast } from "@inventario/ui";
import { DocumentoFileInput } from "@/components/ficha/DocumentoFileInput";
import type { TipoDocumentoPlanilla } from "@inventario/types";
import { darDeBajaTrabajador, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { addDocumento, setDocumentoArchivo } from "@/lib/actions/ficha";
import { TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";
import { documentoCargado } from "@/lib/flujo-ficha";
import { DateField, SelectField } from "@/components/fields";

type MotivoBaja = "CARTA_RENUNCIA" | "TERMINO_CONTRATO";

export function DarDeBajaControl({
  trabajador,
  compact = false,
}: {
  trabajador: TrabajadorListItem;
  compact?: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fechaCese, setFechaCese] = useState("");
  const [motivo, setMotivo] = useState<MotivoBaja>("CARTA_RENUNCIA");
  const [observacion, setObservacion] = useState("");
  const [bajaAfp, setBajaAfp] = useState(false);
  const [archivoCarta, setArchivoCarta] = useState<File | null>(null);
  const [archivoTrBaja, setArchivoTrBaja] = useState<File | null>(null);
  const yaHayCarta = documentoCargado(trabajador.documentos, "CARTA_RENUNCIA");
  const yaHayTrBaja = documentoCargado(trabajador.documentos, "TR_BAJA");
  const esCarta = motivo === "CARTA_RENUNCIA";
  const listoTrBaja = yaHayTrBaja || Boolean(archivoTrBaja);

  async function subirDocumento(tipo: TipoDocumentoPlanilla, file: File): Promise<string | null> {
    const data = new FormData();
    data.set("tipo", tipo);
    data.set("estado", "PENDIENTE");
    const created = await addDocumento(trabajador.id, data);
    if (created.error || !created.documentoId) {
      return created.error ?? "No se pudo registrar el documento de baja.";
    }
    const upload = await uploadDocumentoFile(trabajador.entidad_id, trabajador.id, created.documentoId, file);
    if (upload.error || !upload.path) {
      return upload.error ?? "No se pudo subir el documento de baja.";
    }
    const savedFile = await setDocumentoArchivo(trabajador.id, created.documentoId, upload.path);
    return savedFile.error ?? null;
  }

  function resetDialog() {
    setArchivoCarta(null);
    setArchivoTrBaja(null);
    setObservacion("");
    setBajaAfp(false);
  }

  async function onBaja() {
    if (!fechaCese.trim()) return;
    if (!listoTrBaja) {
      pushToast("Suba el documento de T-Registro baja.", "error");
      return;
    }
    setPending(true);
    if (esCarta && archivoCarta) {
      const errorCarta = await subirDocumento("CARTA_RENUNCIA", archivoCarta);
      if (errorCarta) {
        setPending(false);
        pushToast(errorCarta, "error");
        return;
      }
    }
    if (archivoTrBaja) {
      const errorTr = await subirDocumento("TR_BAJA", archivoTrBaja);
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
    if (bajaAfp) form.set("baja_afp", "true");
    const result = await darDeBajaTrabajador(trabajador.id, form);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setOpen(false);
    resetDialog();
    pushToast("Trabajador dado de baja.");
    router.refresh();
  }

  return (
    <div className={compact ? "shrink-0" : "space-y-2"}>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Dar de baja
      </Button>
      {compact ? null : (
        <p className="text-sm text-muted-foreground">
          Solo cuando deja la empresa. El fin de un contrato no es un cese.
        </p>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => {
          if (pending) return;
          setOpen(false);
        }}
        title="Dar de baja"
        description="La ficha pasa a cesada y suelta el número. La baja de T-Registro es obligatoria."
        confirmLabel="Dar de baja"
        confirmVariant="destructive"
        pending={pending}
        confirmDisabled={!fechaCese.trim() || !listoTrBaja}
        onConfirm={() => void onBaja()}
      >
        <DateField label="Fecha de baja" name="fecha_cese" value={fechaCese} onChange={setFechaCese} />
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
          <DocumentoFileInput
            accept={DOCUMENTO_ACCEPT}
            disabled={pending}
            file={archivoCarta}
            buttonLabel={archivoCarta ? "Cambiar carta de renuncia" : "Subir carta de renuncia"}
            emptyLabel={
              yaHayCarta
                ? "Ya hay carta de renuncia. Puede subir otra o dejar la que está. Opcional."
                : "Opcional. PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
            }
            onFileChange={setArchivoCarta}
          />
        ) : null}
        <DocumentoFileInput
          accept={DOCUMENTO_ACCEPT}
          disabled={pending}
          file={archivoTrBaja}
          buttonLabel={archivoTrBaja ? "Cambiar T-Registro baja" : "Subir T-Registro baja"}
          emptyLabel={
            yaHayTrBaja
              ? "Ya hay T-Registro baja. Puede subir otro o usar el que está. Obligatorio."
              : "Obligatorio. Constancia de baja en T-Registro. PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
          }
          onFileChange={setArchivoTrBaja}
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
            placeholder="Nota sobre el cese (opcional)"
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
      </ConfirmDialog>
    </div>
  );
}
