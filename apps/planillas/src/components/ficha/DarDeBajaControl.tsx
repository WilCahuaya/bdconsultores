"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, FileInput, useToast } from "@inventario/ui";
import { TIPOS_DOCUMENTO_BAJA, type TipoDocumentoPlanilla } from "@inventario/types";
import { darDeBajaTrabajador, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { addDocumento, setDocumentoArchivo } from "@/lib/actions/ficha";
import { TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";
import { documentoCargado } from "@/lib/flujo-ficha";
import { DateField, SelectField } from "@/components/fields";

export function DarDeBajaControl({
  trabajador,
}: {
  trabajador: TrabajadorListItem;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fechaCese, setFechaCese] = useState("");
  const [tipoBaja, setTipoBaja] = useState<TipoDocumentoPlanilla>("CARTA_RENUNCIA");
  const [archivoBaja, setArchivoBaja] = useState<File | null>(null);
  const [archivoTrBaja, setArchivoTrBaja] = useState<File | null>(null);
  const yaHaySustentoBaja = TIPOS_DOCUMENTO_BAJA.some((tipo) => documentoCargado(trabajador.documentos, tipo));
  const yaHayTrBaja = documentoCargado(trabajador.documentos, "TR_BAJA");

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
    if (!yaHaySustentoBaja && !archivoBaja) {
      pushToast("Suba la carta de renuncia o el término de contrato.", "error");
      return;
    }
    if (!yaHayTrBaja && !archivoTrBaja) {
      pushToast("Suba el documento de T-Registro baja.", "error");
      return;
    }
    setPending(true);
    if (archivoBaja) {
      const errorSustento = await subirDocumento(tipoBaja, archivoBaja);
      if (errorSustento) {
        setPending(false);
        pushToast(errorSustento, "error");
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
    const result = await darDeBajaTrabajador(trabajador.id, form);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setOpen(false);
    setArchivoBaja(null);
    setArchivoTrBaja(null);
    pushToast("Trabajador dado de baja.");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Dar de baja
      </Button>
      <p className="text-sm text-muted-foreground">
        Solo cuando deja la empresa. El fin de un contrato no es un cese.
      </p>
      <ConfirmDialog
        open={open}
        onClose={() => {
          if (pending) return;
          setOpen(false);
        }}
        title="Dar de baja"
        description="La ficha pasa a cesada. La fecha de cese es de la empresa, no del fin de un contrato. Hace falta la carta de renuncia o el término de contrato, y el documento de T-Registro baja."
        confirmLabel="Dar de baja"
        confirmVariant="destructive"
        pending={pending}
        confirmDisabled={!fechaCese.trim() || (!yaHaySustentoBaja && !archivoBaja) || (!yaHayTrBaja && !archivoTrBaja)}
        onConfirm={() => void onBaja()}
      >
        <DateField label="Fecha de cese en la empresa" name="fecha_cese" value={fechaCese} onChange={setFechaCese} />
        <SelectField
          label="Documento de baja"
          name="tipo_baja"
          value={tipoBaja}
          options={TIPOS_DOCUMENTO_BAJA.map((tipo) => ({ value: tipo, label: TIPO_DOCUMENTO_LABEL[tipo] }))}
          onChange={(event) => setTipoBaja(event.target.value as TipoDocumentoPlanilla)}
        />
        <FileInput
          accept={DOCUMENTO_ACCEPT}
          disabled={pending}
          file={archivoBaja}
          buttonLabel={archivoBaja ? "Cambiar archivo" : "Subir documento"}
          emptyLabel={
            yaHaySustentoBaja
              ? "Ya hay un documento de baja. Puede subir otro o usar el que está."
              : "PDF, JPG, PNG o WEBP. Máximo 10 MB."
          }
          onFileChange={setArchivoBaja}
        />
        <FileInput
          accept={DOCUMENTO_ACCEPT}
          disabled={pending}
          file={archivoTrBaja}
          buttonLabel={archivoTrBaja ? "Cambiar T-Registro baja" : "Subir T-Registro baja"}
          emptyLabel={
            yaHayTrBaja
              ? "Ya hay T-Registro baja. Puede subir otro o usar el que está."
              : "Constancia de baja en T-Registro. PDF, JPG, PNG o WEBP. Máximo 10 MB."
          }
          onFileChange={setArchivoTrBaja}
        />
      </ConfirmDialog>
    </div>
  );
}
