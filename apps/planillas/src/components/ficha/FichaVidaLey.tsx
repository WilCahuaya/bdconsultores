"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileInput, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import {
  compartirEnvioVidaLey,
  generarVidaLey,
  nuevoGrupoVidaLey,
  marcarFacturaLoteNoEnviada,
  saveVidaLey,
  setComprobanteVidaLeyEmpresa,
  setDocumentoArchivo,
  setEstadoVidaLey,
  setVidaLeyLoteArchivo,
  usarEnvioVidaLey,
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
import { uploadDocumentoFile, uploadVidaLeyComprobanteEmpresa, uploadVidaLeyLoteFile } from "@/lib/upload-documento";
import type { ArchivoVidaLeyLote } from "@/lib/documento-storage";

export type CompaneroEnvioVidaLey = {
  relacionId: string;
  etiqueta: string;
  enEsteEnvio: boolean;
  otroEnvio: boolean;
};

export type EnvioVidaLeyExistente = {
  loteId: string;
  etiqueta: string;
};

export function FichaVidaLey({
  relacionId,
  trabajador,
  vidaLey,
  documentoCertificado,
  lote,
  companerosEnvio,
  enviosExistentes,
  comprobanteEmpresa,
  canWrite,
}: {
  relacionId: string;
  trabajador: TrabajadorListItem;
  vidaLey: VidaLeyRow | null;
  documentoCertificado: DocumentoRow | null;
  lote: VidaLeyLoteRow | null;
  companerosEnvio: CompaneroEnvioVidaLey[];
  enviosExistentes: EnvioVidaLeyExistente[];
  comprobanteEmpresa: string | null;
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
  const miembros = companerosEnvio
    .filter((item) => item.enEsteEnvio)
    .map((item) => item.relacionId)
    .join("|");
  const [marcados, setMarcados] = useState(() =>
    companerosEnvio.filter((item) => item.enEsteEnvio).map((item) => item.relacionId),
  );
  const [miembrosPrev, setMiembrosPrev] = useState(miembros);
  if (miembros !== miembrosPrev) {
    setMiembrosPrev(miembros);
    setMarcados(companerosEnvio.filter((item) => item.enEsteEnvio).map((item) => item.relacionId));
  }
  const [envioElegido, setEnvioElegido] = useState("");
  const [compartiendo, setCompartiendo] = useState(false);
  const [usandoEnvio, setUsandoEnvio] = useState(false);
  const [creandoGrupo, setCreandoGrupo] = useState(false);

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

  function toggleMarcado(id: string) {
    setMarcados((actual) => (actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]));
  }

  async function aplicarCompartidos(): Promise<string | null> {
    const result = await compartirEnvioVidaLey(relacionId, marcados);
    if (result.error || !result.loteId) {
      pushToast(result.error ?? "No se pudo compartir el envío.", "error");
      return null;
    }
    return result.loteId;
  }

  async function onCompartir() {
    setCompartiendo(true);
    const loteId = await aplicarCompartidos();
    setCompartiendo(false);
    if (!loteId) return;
    pushToast(
      marcados.length > 0
        ? "La constancia y la factura quedan para los trabajadores marcados."
        : "Este grupo queda solo para este trabajador.",
    );
    router.refresh();
  }

  async function onUsarEnvio() {
    if (!envioElegido) return;
    setUsandoEnvio(true);
    const result = await usarEnvioVidaLey(relacionId, envioElegido);
    setUsandoEnvio(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Este trabajador usa la constancia y la factura de ese grupo.");
    router.refresh();
  }

  async function onNuevoGrupo() {
    setCreandoGrupo(true);
    const result = await nuevoGrupoVidaLey(relacionId);
    setCreandoGrupo(false);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Grupo nuevo. Marque quién comparte su constancia y su factura.");
    router.refresh();
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
    let loteId = lote?.id ?? null;
    if (fileConstancia || fileFactura) {
      loteId = await aplicarCompartidos();
      if (!loteId) {
        setGuardandoDocs(false);
        return;
      }
    }
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
    if (!fileComprobante) {
      pushToast(
        comprobanteEmpresa ? "Elija el comprobante nuevo para sustituir el de la empresa." : "Suba el comprobante de envío.",
        "error",
      );
      return;
    }
    setGuardandoComprobante(true);
    const upload = await uploadVidaLeyComprobanteEmpresa(
      trabajador.entidad_id,
      fileComprobante,
      comprobanteEmpresa,
    );
    if (upload.error || !upload.path) {
      setGuardandoComprobante(false);
      pushToast(upload.error ?? "No se pudo subir el comprobante de envío.", "error");
      return;
    }
    const saved = await setComprobanteVidaLeyEmpresa(relacionId, upload.path);
    setGuardandoComprobante(false);
    if (saved.error) {
      pushToast(saved.error, "error");
      return;
    }
    setFileComprobante(null);
    pushToast("Comprobante de la empresa sustituido. Cubre a todos los trabajadores.");
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

  const ocupado =
    pending ||
    generando ||
    guardandoDocs ||
    guardandoComprobante ||
    marcandoFactura ||
    compartiendo ||
    usandoEnvio ||
    creandoGrupo;
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
            Una empresa puede tener varios grupos. Cada grupo comparte su constancia y, si la mandan, su factura. Esos
            archivos se suben una vez por grupo. El certificado es solo de este trabajador. Con la constancia guardada,
            el grupo pasa a Recepcionado.
          </p>
          {canWrite && enviosExistentes.length > 0 ? (
            <div className="space-y-2 pt-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Entrar a un grupo que ya tiene constancia y factura</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={envioElegido}
                  onChange={(event) => setEnvioElegido(event.target.value)}
                >
                  <option value="">Elegir grupo…</option>
                  {enviosExistentes.map((envio) => (
                    <option key={envio.loteId} value={envio.loteId}>
                      {envio.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" size="sm" disabled={ocupado || !envioElegido} onClick={() => void onUsarEnvio()}>
                {usandoEnvio ? "Aplicando…" : "Entrar a este grupo"}
              </Button>
            </div>
          ) : null}
          {canWrite ? (
            <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => void onNuevoGrupo()}>
              {creandoGrupo ? "Creando…" : "Crear otro grupo"}
            </Button>
          ) : null}
          {canWrite && companerosEnvio.some((item) => item.enEsteEnvio || !item.otroEnvio) ? (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium">Miembros de este grupo</p>
              <p className="text-sm text-muted-foreground">
                Marque a quienes entran en este grupo. Los demás grupos siguen con sus propios archivos.
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
                {companerosEnvio
                  .filter((item) => item.enEsteEnvio || !item.otroEnvio)
                  .map((item) => (
                  <li key={item.relacionId}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={marcados.includes(item.relacionId)}
                        disabled={ocupado}
                        onChange={() => toggleMarcado(item.relacionId)}
                      />
                      <span>{item.etiqueta}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => void onCompartir()}>
                {compartiendo ? "Guardando…" : "Guardar quién comparte"}
              </Button>
            </div>
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
          <p className="text-sm font-medium">Comprobante de envío de la empresa</p>
          <p className="text-sm text-muted-foreground">
            Hay un solo comprobante para todos los trabajadores. Cuando se da de alta a alguien, súbalo de nuevo: el
            archivo anterior se sustituye y el nuevo cubre a toda la empresa.
          </p>
        </div>
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY_COMPROBANTE}
          storagePath={fileComprobante ? null : comprobanteEmpresa}
          file={fileComprobante}
          vacio="Suba el comprobante de envío de la empresa."
          extra={
            canWrite ? (
              <FileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={ocupado}
                file={fileComprobante}
                buttonLabel={
                  fileComprobante || comprobanteEmpresa
                    ? "Sustituir comprobante de envío"
                    : "Subir comprobante de envío"
                }
                emptyLabel="PDF, JPG, PNG o WEBP. Máximo 10 MB."
                onFileChange={setFileComprobante}
              />
            ) : null
          }
        />
        {canWrite ? (
          <Button type="button" disabled={ocupado || !fileComprobante} onClick={() => void onGuardarComprobante()}>
            {guardandoComprobante
              ? "Guardando…"
              : comprobanteEmpresa
                ? "Sustituir comprobante de la empresa"
                : "Guardar comprobante de la empresa"}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
