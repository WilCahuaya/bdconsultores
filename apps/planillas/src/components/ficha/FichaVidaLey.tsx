"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import {
  generarVidaLey,
  marcarFacturaLoteNoEnviada,
  saveVidaLey,
  setDocumentoArchivo,
  setEstadoVidaLey,
  setVidaLeyLoteArchivo,
  type DocumentoRow,
  type VidaLeyLoteRow,
  type VidaLeyRow,
} from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import { Field, DateField } from "@/components/fields";
import { etiquetaEstadoVidaLey, TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { descargarVidaLeyWord } from "@/lib/descargar-vida-ley-word";
import { DocumentoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { uploadDocumentoFile, uploadVidaLeyLoteFile } from "@/lib/upload-documento";
import type { ArchivoVidaLeyLote } from "@/lib/documento-storage";

export function FichaVidaLey({
  relacionId,
  trabajador,
  vidaLey,
  documentoCertificado,
  lote,
  companerosLote,
  canWrite,
}: {
  relacionId: string;
  trabajador: TrabajadorListItem;
  vidaLey: VidaLeyRow | null;
  documentoCertificado: DocumentoRow | null;
  lote: VidaLeyLoteRow | null;
  companerosLote: string[];
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

  async function subirCertificado(file: File | null) {
    if (!file) return null;
    if (!documentoCertificado) return "No se pudo registrar el certificado. Recargue la página.";
    const upload = await uploadDocumentoFile(
      trabajador.entidad_id,
      relacionId,
      documentoCertificado.id,
      file,
      documentoCertificado.storage_path,
    );
    if (upload.error || !upload.path) {
      return upload.error ?? "No se pudo subir el certificado de seguro.";
    }
    const saved = await setDocumentoArchivo(relacionId, documentoCertificado.id, upload.path);
    return saved.error ?? null;
  }

  function loteParaArchivo(): { loteId: string } | { error: string } {
    if (lote?.id) return { loteId: lote.id };
    return { error: "Elabore el trámite de Vida Ley antes de guardar estos archivos." };
  }

  async function subirLote(
    file: File | null,
    tipo: ArchivoVidaLeyLote,
    previousPath: string | null,
    loteId: string,
    etiqueta: string,
  ) {
    if (!file) return null;
    const upload = await uploadVidaLeyLoteFile(trabajador.entidad_id, loteId, tipo, file, previousPath);
    if (upload.error || !upload.path) return upload.error ?? `No se pudo subir ${etiqueta}.`;
    const saved = await setVidaLeyLoteArchivo(relacionId, tipo, upload.path);
    return saved.error ?? null;
  }

  async function onGuardarRespuesta() {
    if (!fileCertificado && !fileConstancia && !fileFactura) {
      pushToast("Elija al menos un archivo para guardar.", "error");
      return;
    }
    setGuardandoDocs(true);
    const destino = fileConstancia || fileFactura ? loteParaArchivo() : null;
    if (destino && "error" in destino) {
      setGuardandoDocs(false);
      pushToast(destino.error, "error");
      return;
    }
    const loteId = destino && "loteId" in destino ? destino.loteId : lote?.id;
    if ((fileConstancia || fileFactura) && loteId) {
      const errorConstancia = await subirLote(
        fileConstancia,
        "constancia",
        lote?.constancia_storage_path ?? null,
        loteId,
        TIPO_DOCUMENTO_LABEL.VIDA_LEY_CONSTANCIA,
      );
      if (errorConstancia) {
        setGuardandoDocs(false);
        pushToast(errorConstancia, "error");
        return;
      }
      const errorFactura = await subirLote(
        fileFactura,
        "factura",
        lote?.factura_storage_path ?? null,
        loteId,
        TIPO_DOCUMENTO_LABEL.VIDA_LEY_FACTURA,
      );
      if (errorFactura) {
        setGuardandoDocs(false);
        pushToast(errorFactura, "error");
        return;
      }
    }
    const errorCertificado = await subirCertificado(fileCertificado);
    if (errorCertificado) {
      setGuardandoDocs(false);
      pushToast(errorCertificado, "error");
      return;
    }
    const hayConstancia = Boolean(fileConstancia || lote?.constancia_storage_path);
    if (hayConstancia) {
      const recepcionado = await setEstadoVidaLey(relacionId, "Recepcionado");
      if (recepcionado.error) {
        setGuardandoDocs(false);
        pushToast(recepcionado.error, "error");
        return;
      }
    }
    setFileCertificado(null);
    setFileConstancia(null);
    setFileFactura(null);
    setGuardandoDocs(false);
    pushToast(
      hayConstancia
        ? "Documentos del envío recepcionados."
        : "Archivo guardado. Falta la constancia de asegurados para pasar a Recepcionado.",
    );
    router.refresh();
  }

  async function onGuardarComprobante() {
    if (!fileComprobante && !lote?.comprobante_storage_path) {
      pushToast("Suba el comprobante de envío.", "error");
      return;
    }
    setGuardandoComprobante(true);
    if (fileComprobante) {
      const destino = loteParaArchivo();
      if ("error" in destino) {
        setGuardandoComprobante(false);
        pushToast(destino.error, "error");
        return;
      }
      const errorComprobante = await subirLote(
        fileComprobante,
        "comprobante",
        lote?.comprobante_storage_path ?? null,
        destino.loteId,
        TIPO_DOCUMENTO_LABEL.VIDA_LEY_COMPROBANTE,
      );
      if (errorComprobante) {
        setGuardandoComprobante(false);
        pushToast(errorComprobante, "error");
        return;
      }
    }
    const registrado = await setEstadoVidaLey(relacionId, "Registrado");
    if (registrado.error) {
      setGuardandoComprobante(false);
      pushToast(registrado.error, "error");
      return;
    }
    setFileComprobante(null);
    setGuardandoComprobante(false);
    pushToast(companerosLote.length > 0 ? "Vida Ley registrada para el envío." : "Vida Ley registrada.");
    router.refresh();
  }

  async function onNoEnviaronFactura() {
    setMarcandoFactura(true);
    const result = await marcarFacturaLoteNoEnviada(relacionId);
    setMarcandoFactura(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Factura marcada como no enviada para el envío.");
    router.refresh();
  }

  const ocupado = pending || generando || guardandoDocs || guardandoComprobante || marcandoFactura;
  const facturaNoEnviada = Boolean(lote?.factura_no_enviada) && !lote?.factura_storage_path && !fileFactura;
  const yaGenerado = Boolean(vidaLey?.estado);

  return (
    <div className="space-y-4">
      <section className={`${panelCardClass} space-y-3 p-5`}>
        <div>
          <p className="text-sm font-medium">Trámite para la aseguradora</p>
          <p className="text-sm text-muted-foreground">
            Se genera el Word con los datos de {trabajador.persona.nombres} y la empresa. Al generar por primera vez
            desde aquí, el envío queda solo con este trabajador. Para compartir archivos, elabore el grupo en Vida Ley.
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
            La constancia y la factura son del envío. El certificado es solo de este trabajador. La factura puede no
            llegar. Con la constancia guardada, el envío pasa a Recepcionado.
          </p>
          {companerosLote.length > 0 ? (
            <p className="text-sm text-muted-foreground">Comparte este envío con {companerosLote.join(", ")}.</p>
          ) : null}
        </div>
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY_CONSTANCIA}
          storagePath={fileConstancia ? null : lote?.constancia_storage_path}
          file={fileConstancia}
          vacio="Suba la constancia con la lista de asegurados."
          extra={
            canWrite ? (
              <FileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={ocupado}
                file={fileConstancia}
                buttonLabel={
                  fileConstancia || lote?.constancia_storage_path
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
          storagePath={fileFactura ? null : lote?.factura_storage_path}
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
                    fileFactura || lote?.factura_storage_path
                      ? "Cambiar factura electrónica"
                      : "Subir factura electrónica"
                  }
                  emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                  onFileChange={setFileFactura}
                />
                {!lote?.factura_no_enviada ? (
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
            Después de tramitar Vida Ley, suba el comprobante de envío. Es el mismo archivo para todo el lote. Al
            guardar, el envío pasa a Registrado.
          </p>
        </div>
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY_COMPROBANTE}
          storagePath={fileComprobante ? null : lote?.comprobante_storage_path}
          file={fileComprobante}
          vacio="Suba el comprobante de envío."
          extra={
            canWrite ? (
              <FileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={ocupado}
                file={fileComprobante}
                buttonLabel={
                  fileComprobante || lote?.comprobante_storage_path
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
