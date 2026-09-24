"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, FileInput, useToast } from "@inventario/ui";
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
  const [archivo, setArchivo] = useState<File | null>(null);
  const yaHayCarta = documentoCargado(trabajador.documentos, "CARTA_RENUNCIA");
  const yaHayTrBaja = documentoCargado(trabajador.documentos, "TR_BAJA");
  const esCarta = motivo === "CARTA_RENUNCIA";
  const tipoArchivo: TipoDocumentoPlanilla = esCarta ? "CARTA_RENUNCIA" : "TR_BAJA";
  const yaHayArchivo = esCarta ? yaHayCarta : yaHayTrBaja;
  const listoArchivo = yaHayArchivo || Boolean(archivo);

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

  async function onBaja() {
    if (!fechaCese.trim()) return;
    if (!listoArchivo) {
      pushToast(
        esCarta ? "Suba la carta de renuncia." : "Suba el documento de T-Registro baja.",
        "error",
      );
      return;
    }
    setPending(true);
    if (archivo) {
      const errorArchivo = await subirDocumento(tipoArchivo, archivo);
      if (errorArchivo) {
        setPending(false);
        pushToast(errorArchivo, "error");
        return;
      }
    }
    const form = new FormData();
    form.set("fecha_cese", fechaCese);
    form.set("tipo_baja", motivo);
    const result = await darDeBajaTrabajador(trabajador.id, form);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setOpen(false);
    setArchivo(null);
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
        description={
          esCarta
            ? "La ficha pasa a cesada. Con carta de renuncia solo se sube ese documento."
            : "La ficha pasa a cesada. En término de contrato solo se sube la baja de T-Registro."
        }
        confirmLabel="Dar de baja"
        confirmVariant="destructive"
        pending={pending}
        confirmDisabled={!fechaCese.trim() || !listoArchivo}
        onConfirm={() => void onBaja()}
      >
        <DateField label="Fecha de cese en la empresa" name="fecha_cese" value={fechaCese} onChange={setFechaCese} />
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
            setArchivo(null);
          }}
        />
        <FileInput
          accept={DOCUMENTO_ACCEPT}
          disabled={pending}
          file={archivo}
          buttonLabel={
            archivo
              ? "Cambiar archivo"
              : esCarta
                ? "Subir carta de renuncia"
                : "Subir T-Registro baja"
          }
          emptyLabel={
            yaHayArchivo
              ? esCarta
                ? "Ya hay carta de renuncia. Puede subir otra o usar la que está."
                : "Ya hay T-Registro baja. Puede subir otro o usar el que está."
              : esCarta
                ? "Solo este archivo. PDF, JPG, PNG o WEBP. Máximo 10 MB."
                : "Solo la constancia de baja en T-Registro. PDF, JPG, PNG o WEBP. Máximo 10 MB."
          }
          onFileChange={setArchivo}
        />
      </ConfirmDialog>
    </div>
  );
}
