"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import {
  generarVidaLey,
  marcarDocumentoNoAplica,
  saveVidaLey,
  setDocumentoArchivo,
  setEstadoVidaLey,
  type DocumentoRow,
  type VidaLeyRow,
} from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import { Field, DateField } from "@/components/fields";
import { etiquetaEstadoVidaLey, TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { descargarVidaLeyWord } from "@/lib/descargar-vida-ley-word";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile } from "@/lib/upload-documento";

export function FichaVidaLey({
  relacionId,
  trabajador,
  vidaLey,
  documentoCertificado,
  documentoConstancia,
  documentoFactura,
  documentoComprobante,
  canWrite,
}: {
  relacionId: string;
  trabajador: TrabajadorListItem;
  vidaLey: VidaLeyRow | null;
  documentoCertificado: DocumentoRow | null;
  documentoConstancia: DocumentoRow | null;
  documentoFactura: DocumentoRow | null;
  documentoComprobante: DocumentoRow | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [guardandoDocs, setGuardandoDocs] = useState(false);
  const [guardandoComprobante, setGuardandoComprobante] = useState(false);
  const [marcandoFactura, setMarcandoFactura] = useState(false);
  const [fileCertificado, setFileCertificado] = useState<File | null>(null);
  const [fileConstancia, setFileConstancia] = useState<File | null>(null);
  const [fileFactura, setFileFactura] = useState<File | null>(null);
  const [fileComprobante, setFileComprobante] = useState<File | null>(null);

  async function onGenerar() {
    setGenerando(true);
    const result = await generarVidaLey(relacionId);
    if (result.error) {
      setGenerando(false);
      pushToast(result.error, "error");
      return;
    }
    const descarga = await descargarVidaLeyWord({ relacionId });
    setGenerando(false);
    if (descarga.error) {
      pushToast(descarga.error, "error");
      return;
    }
    pushToast("Trámite Vida Ley elaborado.");
    router.refresh();
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    const result = await saveVidaLey(relacionId, formData);
    setPending(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Datos de Vida Ley guardados.");
    router.refresh();
  }

  async function subirAdjunto(file: File | null, documento: DocumentoRow | null, etiqueta: string) {
    if (!file) return null;
    if (!documento) return `No se pudo registrar ${etiqueta}. Recargue la página.`;
    const upload = await uploadDocumentoFile(
      trabajador.entidad_id,
      relacionId,
      documento.id,
      file,
      documento.storage_path,
    );
    if (upload.error || !upload.path) {
      return upload.error ?? `No se pudo subir ${etiqueta}.`;
    }
    const saved = await setDocumentoArchivo(relacionId, documento.id, upload.path);
    return saved.error ?? null;
  }

  async function onGuardarRespuesta() {
    if (!fileCertificado && !fileConstancia && !fileFactura) {
      pushToast("Elija al menos un archivo para guardar.", "error");
      return;
    }
    setGuardandoDocs(true);
    const errorConstancia = await subirAdjunto(
      fileConstancia,
      documentoConstancia,
      TIPO_DOCUMENTO_LABEL.VIDA_LEY_CONSTANCIA,
    );
    if (errorConstancia) {
      setGuardandoDocs(false);
      pushToast(errorConstancia, "error");
      return;
    }
    const errorCertificado = await subirAdjunto(
      fileCertificado,
      documentoCertificado,
      TIPO_DOCUMENTO_LABEL.VIDA_LEY,
    );
    if (errorCertificado) {
      setGuardandoDocs(false);
      pushToast(errorCertificado, "error");
      return;
    }
    const errorFactura = await subirAdjunto(fileFactura, documentoFactura, TIPO_DOCUMENTO_LABEL.VIDA_LEY_FACTURA);
    if (errorFactura) {
      setGuardandoDocs(false);
      pushToast(errorFactura, "error");
      return;
    }
    const recepcionado = await setEstadoVidaLey(relacionId, "Recepcionado");
    if (recepcionado.error) {
      setGuardandoDocs(false);
      pushToast(recepcionado.error, "error");
      return;
    }
    setFileCertificado(null);
    setFileConstancia(null);
    setFileFactura(null);
    setGuardandoDocs(false);
    pushToast("Documentos recepcionados.");
    router.refresh();
  }

  async function onGuardarComprobante() {
    if (!fileComprobante && !documentoComprobante?.storage_path) {
      pushToast("Suba el comprobante de envío.", "error");
      return;
    }
    setGuardandoComprobante(true);
    const errorComprobante = await subirAdjunto(
      fileComprobante,
      documentoComprobante,
      TIPO_DOCUMENTO_LABEL.VIDA_LEY_COMPROBANTE,
    );
    if (errorComprobante) {
      setGuardandoComprobante(false);
      pushToast(errorComprobante, "error");
      return;
    }
    const registrado = await setEstadoVidaLey(relacionId, "Registrado");
    if (registrado.error) {
      setGuardandoComprobante(false);
      pushToast(registrado.error, "error");
      return;
    }
    setFileComprobante(null);
    setGuardandoComprobante(false);
    pushToast("Vida Ley registrada.");
    router.refresh();
  }

  async function onNoEnviaronFactura() {
    if (!documentoFactura) {
      pushToast("No se pudo registrar la factura. Recargue la página.", "error");
      return;
    }
    setMarcandoFactura(true);
    const result = await marcarDocumentoNoAplica(relacionId, documentoFactura.id);
    setMarcandoFactura(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Factura marcada como no enviada.");
    router.refresh();
  }

  const ocupado = pending || generando || guardandoDocs || guardandoComprobante || marcandoFactura;
  const facturaNoEnviada = documentoFactura?.estado === "NA" && !documentoFactura.storage_path && !fileFactura;
  const yaGenerado = Boolean(vidaLey?.estado);

  return (
    <div className="space-y-4">
      <section className={`${panelCardClass} space-y-3 p-5`}>
        <div>
          <p className="text-sm font-medium">Trámite para la aseguradora</p>
          <p className="text-sm text-muted-foreground">
            Se genera el Word con los datos de {trabajador.persona.nombres} y la empresa. Al generar, el estado pasa a
            Elaborado.
          </p>
        </div>
        {canWrite ? (
          <Button type="button" disabled={ocupado} onClick={() => void onGenerar()}>
            {generando ? "Generando…" : yaGenerado ? "Descargar Word" : "Generar Word"}
          </Button>
        ) : null}
      </section>
      <form action={onSubmit} className={`${panelCardClass} space-y-4 p-5`}>
        <p className="text-sm">
          <span className="text-muted-foreground">Estado: </span>
          <span className="font-medium">{etiquetaEstadoVidaLey(vidaLey?.estado)}</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Póliza" name="numero_poliza" defaultValue={vidaLey?.numero_poliza} readOnly={!canWrite} />
          <DateField
            label="Inicio del seguro"
            name="fecha_inicio"
            defaultValue={vidaLey?.fecha_inicio}
            readOnly={!canWrite}
          />
          <DateField
            label="Fin del seguro"
            name="fecha_fin"
            defaultValue={vidaLey?.fecha_fin}
            readOnly={!canWrite}
          />
        </div>
        {canWrite ? (
          <Button type="submit" disabled={ocupado}>
            {pending ? "Guardando…" : "Guardar datos de Vida Ley"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Solo consulta.</p>
        )}
      </form>
      <section className="space-y-4">
        <div className={`${panelCardClass} space-y-1 p-5`}>
          <p className="text-sm font-medium">Respuesta de la aseguradora</p>
          <p className="text-sm text-muted-foreground">
            Guarde la constancia de asegurados, el certificado de este trabajador y, si llega, la factura electrónica. Al
            guardar, el estado pasa a Recepcionado.
          </p>
        </div>
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY_CONSTANCIA}
          storagePath={fileConstancia ? null : documentoConstancia?.storage_path}
          file={fileConstancia}
          vacio="Suba la constancia con la lista de asegurados."
          extra={
            canWrite ? (
              <FileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={ocupado}
                file={fileConstancia}
                buttonLabel={
                  fileConstancia || documentoConstancia?.storage_path
                    ? "Cambiar constancia de asegurados"
                    : "Subir constancia de asegurados"
                }
                emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                onFileChange={setFileConstancia}
              />
            ) : null
          }
        />
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY}
          storagePath={fileCertificado ? null : documentoCertificado?.storage_path}
          file={fileCertificado}
          vacio="Suba el certificado de seguro Vida Ley de este trabajador."
          extra={
            canWrite ? (
              <FileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={ocupado}
                file={fileCertificado}
                buttonLabel={
                  fileCertificado || documentoCertificado?.storage_path
                    ? "Cambiar certificado de seguro"
                    : "Subir certificado de seguro"
                }
                emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                onFileChange={setFileCertificado}
              />
            ) : null
          }
        />
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY_FACTURA}
          storagePath={fileFactura ? null : documentoFactura?.storage_path}
          file={fileFactura}
          vacio={
            facturaNoEnviada
              ? "Marcaste que no enviaron factura. Si llega después, súbala aquí."
              : "Suba la factura electrónica si la enviaron."
          }
          extra={
            canWrite ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <FileInput
                  accept={DOCUMENTO_ACCEPT}
                  disabled={ocupado}
                  file={fileFactura}
                  buttonLabel={
                    fileFactura || documentoFactura?.storage_path
                      ? "Cambiar factura electrónica"
                      : "Subir factura electrónica"
                  }
                  emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                  onFileChange={setFileFactura}
                />
                {documentoFactura && documentoFactura.estado !== "NA" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={ocupado}
                    onClick={() => void onNoEnviaronFactura()}
                  >
                    {marcandoFactura ? "Guardando…" : "No enviaron factura"}
                  </Button>
                ) : null}
              </div>
            ) : null
          }
        />
        {canWrite ? (
          <Button type="button" disabled={ocupado} onClick={() => void onGuardarRespuesta()}>
            {guardandoDocs ? "Guardando…" : "Guardar documentos de la aseguradora"}
          </Button>
        ) : null}
      </section>
      <section className="space-y-4">
        <div className={`${panelCardClass} space-y-1 p-5`}>
          <p className="text-sm font-medium">Registro de Vida Ley</p>
          <p className="text-sm text-muted-foreground">
            Después de tramitar Vida Ley, suba el comprobante de envío. Al guardar, el estado pasa a Registrado.
          </p>
        </div>
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY_COMPROBANTE}
          storagePath={fileComprobante ? null : documentoComprobante?.storage_path}
          file={fileComprobante}
          vacio="Suba el comprobante de envío."
          extra={
            canWrite ? (
              <FileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={ocupado}
                file={fileComprobante}
                buttonLabel={
                  fileComprobante || documentoComprobante?.storage_path
                    ? "Cambiar comprobante de envío"
                    : "Subir comprobante de envío"
                }
                emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                onFileChange={setFileComprobante}
              />
            ) : null
          }
        />
        {canWrite ? (
          <Button type="button" disabled={ocupado} onClick={() => void onGuardarComprobante()}>
            {guardandoComprobante ? "Guardando…" : "Guardar comprobante de envío"}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
