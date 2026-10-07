"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@inventario/ui";
import { DocumentoFileInput } from "@/components/ficha/DocumentoFileInput";
import { panelCardClass } from "@inventario/ui/panel";
import {
  compartirEnvioVidaLey,
  descartarGrupoVidaLeyVacio,
  generarVidaLey,
  marcarFacturaLoteNoEnviada,
  quitarDeEnvioVidaLey,
  saveVidaLey,
  setCantidadComprobanteVidaLeyEmpresa,
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
import { etiquetaEstadoVidaLey, etiquetaTrabajador, TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";
import { descargarVidaLeyWord } from "@/lib/descargar-vida-ley-word";
import { DocumentoPrevisualizacion, MarcoPrevisualizacion } from "@/components/ficha/DocumentoPrevisualizacion";
import { SelectorPaginasPdf, type EstadoPaginasCertificado } from "@/components/ficha/SelectorPaginasPdf";
import {
  EliminarArchivoVidaLey,
  EliminarComprobanteEmpresa,
  EliminarDocumentoGuardado,
} from "@/components/ficha/ConfirmarEliminarArchivo";
import { DOCUMENTO_ACCEPT } from "@/lib/documento-storage";
import { recortarPaginasPdf } from "@/lib/recortar-pdf";
import { uploadDocumentoFile, uploadVidaLeyComprobanteEmpresa, uploadVidaLeyLoteFile } from "@/lib/upload-documento";
import type { ArchivoVidaLeyLote } from "@/lib/documento-storage";

export type CompaneroEnvioVidaLey = {
  relacionId: string;
  etiqueta: string;
  enEsteEnvio: boolean;
  otroEnvio: boolean;
  cesada: boolean;
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
  cantidadComprobante,
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
  cantidadComprobante: number | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [guardandoComprobante, setGuardandoComprobante] = useState(false);
  const [marcandoFactura, setMarcandoFactura] = useState(false);
  const [fileCertificado, setFileCertificado] = useState<File | null>(null);
  const [fileComprobante, setFileComprobante] = useState<File | null>(null);
  const [cantidadTexto, setCantidadTexto] = useState(cantidadComprobante != null ? String(cantidadComprobante) : "");
  const [envioElegido, setEnvioElegido] = useState("");
  const [usandoEnvio, setUsandoEnvio] = useState(false);
  const [guardandoCertificado, setGuardandoCertificado] = useState(false);
  const [archivoCertificadoId, setArchivoCertificadoId] = useState(0);
  const [estadoPaginas, setEstadoPaginas] = useState<EstadoPaginasCertificado>({ tipo: "completo" });
  const onEstadoPaginas = useCallback((estado: EstadoPaginasCertificado) => {
    setEstadoPaginas(estado);
  }, []);

  useEffect(() => {
    setCantidadTexto(cantidadComprobante != null ? String(cantidadComprobante) : "");
  }, [cantidadComprobante]);

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

  async function onGuardarCertificado() {
    if (!fileCertificado) {
      pushToast("Elija el certificado de este trabajador.", "error");
      return;
    }
    if (estadoPaginas.tipo === "leyendo") return;
    if (estadoPaginas.tipo === "elegir" && estadoPaginas.elegidas.length === 0) {
      pushToast("Marque las páginas de este trabajador.", "error");
      return;
    }
    setGuardandoCertificado(true);
    let archivo = fileCertificado;
    if (estadoPaginas.tipo === "elegir") {
      const recorte = await recortarPaginasPdf(fileCertificado, estadoPaginas.elegidas);
      if (recorte.error || !recorte.file) {
        setGuardandoCertificado(false);
        pushToast(recorte.error ?? "No se pudieron separar las páginas.", "error");
        return;
      }
      archivo = recorte.file;
    }
    const errorCertificado = await subirCertificado(archivo);
    setGuardandoCertificado(false);
    if (errorCertificado) {
      pushToast(errorCertificado, "error");
      return;
    }
    setFileCertificado(null);
    setEstadoPaginas({ tipo: "completo" });
    pushToast("Certificado de seguro guardado.");
    router.refresh();
  }

  async function onGuardarComprobante() {
    const cantidad = Number(cantidadTexto.trim());
    if (!/^\d+$/.test(cantidadTexto.trim()) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 9999) {
      pushToast("Indique cuántos trabajadores abarca el comprobante.", "error");
      return;
    }
    if (!fileComprobante && !comprobanteEmpresa) {
      pushToast("Suba el comprobante de envío.", "error");
      return;
    }
    setGuardandoComprobante(true);
    if (!fileComprobante) {
      const saved = await setCantidadComprobanteVidaLeyEmpresa(relacionId, cantidad);
      setGuardandoComprobante(false);
      if (saved.error) {
        pushToast(saved.error, "error");
        return;
      }
      pushToast("Cantidad de trabajadores del comprobante guardada.");
      router.refresh();
      return;
    }
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
    const saved = await setComprobanteVidaLeyEmpresa(relacionId, upload.path, cantidad);
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
    pending || generando || guardandoCertificado || guardandoComprobante || marcandoFactura || usandoEnvio;
  const cantidadIngresada = /^\d+$/.test(cantidadTexto.trim()) ? Number(cantidadTexto.trim()) : null;
  const cantidadCambio =
    cantidadIngresada != null &&
    cantidadIngresada >= 1 &&
    cantidadIngresada <= 9999 &&
    cantidadIngresada !== cantidadComprobante;
  const facturaNoEnviada = Boolean(lote?.factura_no_enviada) && !lote?.factura_storage_path;
  const yaGenerado = Boolean(vidaLey?.estado);
  const laVen = [
    `${etiquetaTrabajador(trabajador.persona, trabajador.numero)}${trabajador.estado === "CESADA" ? " · Baja" : ""}`,
    ...companerosEnvio.filter((item) => item.enEsteEnvio).map((item) => item.etiqueta),
  ];
  const paraAgregar = companerosEnvio.filter((item) => !item.enEsteEnvio);

  return (
    <div className="space-y-4">
      <section className={`${panelCardClass} space-y-3 p-5`}>
        <div>
          <p className="text-sm font-medium">Trámite para la aseguradora</p>
          <p className="text-sm text-muted-foreground">
            {canWrite
              ? `Se genera el Word con los datos de ${trabajador.persona.nombres} y la empresa. El grupo de constancia y factura se crea al subir el documento.`
              : "Consulta del trámite de este trabajador."}
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
            El grupo se crea al subir la constancia o la factura. Quienes se marcan en esa subida lo comparten. El certificado es solo de este trabajador.
          </p>
        </div>
        {canWrite && enviosExistentes.length > 0 && !lote?.constancia_storage_path && !lote?.factura_storage_path ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Usar un grupo que ya tiene constancia o factura</span>
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
              {usandoEnvio ? "Aplicando…" : "Usar en este trabajador"}
            </Button>
          </div>
        ) : null}
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <ArchivoCompartidoVidaLey
            relacionId={relacionId}
            entidadId={trabajador.entidad_id}
            titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY_CONSTANCIA}
            ayuda="Si el documento incluye a varias personas, súbalo una vez y márquelas, incluidas las que ya están de baja: cada una lo ve en su ficha."
            storagePath={lote?.constancia_storage_path ?? null}
            tipo="constancia"
            laVen={laVen}
            canWrite={canWrite}
            paraAgregar={paraAgregar}
            mostrarQuitar={Boolean(lote)}
            permitirAgregar
            ocupadoExterno={ocupado}
            vacio="Esta ficha no tiene constancia de asegurados."
            notaReemplazo="El reemplazo se ve en todos los que comparten esta constancia."
            alGuardar={async () => {
              const recepcionado = await setEstadoVidaLey(relacionId, "Recepcionado");
              return recepcionado.error ?? null;
            }}
          />
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <DocumentoPrevisualizacion
            titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY}
            storagePath={fileCertificado ? null : documentoCertificado?.storage_path}
            file={
              !fileCertificado
                ? null
                : estadoPaginas.tipo === "elegir" && estadoPaginas.mostrandoRecorte && estadoPaginas.recorte
                  ? estadoPaginas.recorte
                  : estadoPaginas.tipo === "elegir" && estadoPaginas.vistaPagina
                    ? estadoPaginas.vistaPagina
                    : fileCertificado
            }
            vacio="Suba el certificado de seguro Vida Ley de este trabajador."
            extra={
              canWrite ? (
                <div className="space-y-3">
                  <DocumentoFileInput
                    accept={DOCUMENTO_ACCEPT}
                    disabled={ocupado}
                    file={fileCertificado}
                    buttonLabel={
                      fileCertificado || documentoCertificado?.storage_path
                        ? "Cambiar certificado de seguro"
                        : "Subir certificado de seguro"
                    }
                    emptyLabel="PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB. Si trae varios certificados, marque las páginas de este trabajador."
                    onFileChange={(file) => {
                      setFileCertificado(file);
                      setArchivoCertificadoId((actual) => actual + 1);
                      setEstadoPaginas(
                        file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
                          ? { tipo: "leyendo" }
                          : { tipo: "completo" },
                      );
                    }}
                  />
                  {fileCertificado ? (
                    <SelectorPaginasPdf
                      key={archivoCertificadoId}
                      file={fileCertificado}
                      disabled={ocupado}
                      onEstado={onEstadoPaginas}
                    />
                  ) : null}
                  <div className="flex flex-wrap items-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        ocupado ||
                        !fileCertificado ||
                        estadoPaginas.tipo === "leyendo" ||
                        (estadoPaginas.tipo === "elegir" && estadoPaginas.elegidas.length === 0)
                      }
                      onClick={() => void onGuardarCertificado()}
                    >
                      {guardandoCertificado
                        ? "Guardando…"
                        : estadoPaginas.tipo === "elegir"
                          ? "Guardar páginas elegidas"
                          : "Guardar certificado"}
                    </Button>
                    {documentoCertificado?.storage_path ? (
                      <EliminarDocumentoGuardado
                        relacionId={relacionId}
                        documentoId={documentoCertificado.id}
                        descripcion="¿Eliminar el certificado de seguro de este trabajador?"
                        disabled={ocupado}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null
            }
          />
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <ArchivoCompartidoVidaLey
            relacionId={relacionId}
            entidadId={trabajador.entidad_id}
            titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY_FACTURA}
            ayuda="La factura es del mismo grupo que la constancia. Si no la mandan, puede dejarlo así."
            storagePath={lote?.factura_storage_path ?? null}
            tipo="factura"
            laVen={laVen}
            canWrite={canWrite}
            paraAgregar={paraAgregar}
            mostrarQuitar={Boolean(lote) && !lote?.constancia_storage_path}
            permitirAgregar={!lote?.constancia_storage_path}
            ocupadoExterno={ocupado}
            vacio="Esta ficha no tiene factura."
            sinArchivo={facturaNoEnviada}
            notaReemplazo="El reemplazo se ve en todos los que comparten esta factura."
            extra={
              canWrite && lote && !lote.factura_storage_path && !lote.factura_no_enviada ? (
                <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => void onNoEnviaronFactura()}>
                  {marcandoFactura ? "Guardando…" : "No enviaron factura"}
                </Button>
              ) : null
            }
          />
        </div>
      </section>
      <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Comprobante de envío de la empresa</p>
          <p className="text-sm text-muted-foreground">
            {canWrite
              ? "Hay un solo comprobante para la empresa. Indique cuántos trabajadores abarca. Al sustituirlo, el archivo anterior se reemplaza."
              : "Comprobante de envío de la empresa, en consulta."}
          </p>
          {!canWrite && cantidadComprobante != null ? (
            <p className="text-sm text-foreground">Abarca {cantidadComprobante} trabajadores.</p>
          ) : null}
        </div>
        <DocumentoPrevisualizacion
          titulo={TIPO_DOCUMENTO_LABEL.VIDA_LEY_COMPROBANTE}
          storagePath={fileComprobante ? null : comprobanteEmpresa}
          file={fileComprobante}
          vacio="Suba el comprobante de envío de la empresa."
          extra={
            canWrite ? (
              <div className="space-y-3">
                <Field
                  label="Trabajadores que abarca"
                  name="cantidad_trabajadores_comprobante"
                  type="number"
                  inputMode="numeric"
                  value={cantidadTexto}
                  placeholder="Cantidad"
                  onChange={(event) => setCantidadTexto(event.target.value)}
                />
                <DocumentoFileInput
                  accept={DOCUMENTO_ACCEPT}
                  disabled={ocupado}
                  file={fileComprobante}
                  buttonLabel={
                    fileComprobante || comprobanteEmpresa
                      ? "Sustituir comprobante de envío"
                      : "Subir comprobante de envío"
                  }
                  emptyLabel="PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
                  onFileChange={setFileComprobante}
                />
              </div>
            ) : null
          }
        />
        {canWrite && comprobanteEmpresa ? (
          <EliminarComprobanteEmpresa relacionId={relacionId} disabled={ocupado} />
        ) : null}
        {canWrite ? (
          <Button
            type="button"
            disabled={ocupado || (!fileComprobante && !(comprobanteEmpresa && cantidadCambio))}
            onClick={() => void onGuardarComprobante()}
          >
            {guardandoComprobante
              ? "Guardando…"
              : fileComprobante
                ? comprobanteEmpresa
                  ? "Sustituir comprobante de la empresa"
                  : "Guardar comprobante de la empresa"
                : "Guardar cantidad"}
          </Button>
        ) : null}
      </section>
    </div>
  );
}

function ArchivoCompartidoVidaLey({
  relacionId,
  entidadId,
  titulo,
  ayuda,
  storagePath,
  tipo,
  laVen,
  canWrite,
  paraAgregar,
  mostrarQuitar,
  permitirAgregar,
  ocupadoExterno,
  vacio,
  sinArchivo = false,
  notaReemplazo,
  alGuardar,
  extra,
}: {
  relacionId: string;
  entidadId: string;
  titulo: string;
  ayuda: string;
  storagePath: string | null;
  tipo: ArchivoVidaLeyLote;
  laVen: string[];
  canWrite: boolean;
  paraAgregar: CompaneroEnvioVidaLey[];
  mostrarQuitar: boolean;
  permitirAgregar: boolean;
  ocupadoExterno: boolean;
  vacio: string;
  sinArchivo?: boolean;
  notaReemplazo: string;
  alGuardar?: () => Promise<string | null>;
  extra?: ReactNode;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [reemplazo, setReemplazo] = useState<File | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [buscarArchivo, setBuscarArchivo] = useState(false);
  const ocupado = ocupadoExterno || pending !== null;

  function toggle(id: string) {
    setMarcados((actual) => (actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]));
  }

  async function guardarArchivo(file: File, previousPath: string | null, ids: string[]) {
    const grupo = await compartirEnvioVidaLey(relacionId, ids, { soloAgregar: true, crearAlSubir: !previousPath });
    if (grupo.error || !grupo.loteId) return grupo.error ?? "No se pudo armar el grupo.";
    const upload = await uploadVidaLeyLoteFile(entidadId, grupo.loteId, tipo, file, previousPath);
    if (upload.error || !upload.path) {
      if (grupo.creado) await descartarGrupoVidaLeyVacio(relacionId, grupo.loteId);
      return upload.error ?? "No se pudo subir el archivo.";
    }
    const saved = await setVidaLeyLoteArchivo(relacionId, tipo, upload.path);
    if (saved.error) {
      if (grupo.creado) await descartarGrupoVidaLeyVacio(relacionId, grupo.loteId);
      return saved.error;
    }
    if (alGuardar) {
      const extraError = await alGuardar();
      if (extraError) return extraError;
    }
    return null;
  }

  async function onSubir() {
    if (!archivo) {
      pushToast("Seleccione el archivo.", "error");
      return;
    }
    setPending("subir");
    const error = await guardarArchivo(archivo, storagePath, marcados);
    setPending(null);
    if (error) {
      pushToast(error, "error");
      return;
    }
    setArchivo(null);
    setMarcados([]);
    pushToast("Archivo guardado. Quienes lo comparten ya pueden verlo.");
    router.refresh();
  }

  async function onReemplazar() {
    if (!reemplazo || !storagePath) return;
    setPending("reemplazar");
    const error = await guardarArchivo(reemplazo, storagePath, []);
    setPending(null);
    if (error) {
      pushToast(error, "error");
      return;
    }
    setReemplazo(null);
    pushToast("Archivo actualizado para todos los que comparten este grupo.");
    router.refresh();
  }

  async function onAgregar() {
    if (marcados.length === 0) return;
    setPending("agregar");
    const result = await compartirEnvioVidaLey(relacionId, marcados, { soloAgregar: true });
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setMarcados([]);
    pushToast("Trabajadores agregados. Ya ven este archivo.");
    router.refresh();
  }

  async function onQuitar() {
    setPending("quitar");
    const result = await quitarDeEnvioVidaLey(relacionId);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Este trabajador ya no usa ese grupo.");
    router.refresh();
  }

  const archivoVista = reemplazo ?? archivo;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">{titulo}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{ayuda}</p>
      </div>
      <MarcoPrevisualizacion titulo={titulo} storagePath={archivoVista ? null : storagePath} file={archivoVista}>
      {storagePath ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground">La ven: {laVen.join(", ")}.</p>
          <div className="flex flex-wrap gap-2">
            {canWrite && mostrarQuitar ? (
              <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => void onQuitar()}>
                {pending === "quitar" ? "Quitando…" : "Quitar de este grupo"}
              </Button>
            ) : null}
            {canWrite ? (
              <EliminarArchivoVidaLey
                relacionId={relacionId}
                tipo={tipo}
                descripcion={
                  tipo === "constancia"
                    ? "¿Eliminar la constancia de asegurados? Deja de verse para todos los que comparten este grupo."
                    : "¿Eliminar la factura? Deja de verse para todos los que comparten este grupo."
                }
                disabled={ocupado}
              />
            ) : null}
          </div>
          {canWrite ? (
            <div className="space-y-2">
              <DocumentoFileInput
                accept={DOCUMENTO_ACCEPT}
                disabled={ocupado}
                file={reemplazo}
                buttonLabel={reemplazo ? "Cambiar archivo" : "Reemplazar archivo"}
                emptyLabel={notaReemplazo}
                onFileChange={setReemplazo}
              />
              {reemplazo ? (
                <Button type="button" size="sm" disabled={ocupado} onClick={() => void onReemplazar()}>
                  {pending === "reemplazar" ? "Guardando…" : "Guardar reemplazo"}
                </Button>
              ) : null}
            </div>
          ) : null}
          {canWrite && permitirAgregar && paraAgregar.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Agregar trabajadores a este grupo</p>
              <ListaCompaneros items={paraAgregar} marcados={marcados} disabled={ocupado} onToggle={toggle} />
              <Button type="button" size="sm" disabled={ocupado || marcados.length === 0} onClick={() => void onAgregar()}>
                {pending === "agregar" ? "Agregando…" : "Agregar"}
              </Button>
            </div>
          ) : null}
          {extra}
        </div>
      ) : sinArchivo && !buscarArchivo ? (
        <p className="text-sm text-muted-foreground">
          No hay factura.
          {canWrite ? (
            <>
              {" "}
              Si ya lo encontraste,{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-2"
                onClick={() => setBuscarArchivo(true)}
              >
                pulsa aquí
              </button>
              .
            </>
          ) : null}
        </p>
      ) : canWrite ? (
        <div className="space-y-3">
          <DocumentoFileInput
            accept={DOCUMENTO_ACCEPT}
            disabled={ocupado}
            file={archivo}
            buttonLabel={archivo ? "Cambiar archivo" : "Seleccionar PDF o imagen"}
            emptyLabel="PDF, Word, Excel o imagen. Se guarda como PDF. Máximo 10 MB."
            onFileChange={setArchivo}
          />
          {permitirAgregar && paraAgregar.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Este trabajador queda incluido. Marque a quién más cubre el documento, incluidas las bajas.
              </p>
              <ListaCompaneros items={paraAgregar} marcados={marcados} disabled={ocupado} onToggle={toggle} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={ocupado || !archivo} onClick={() => void onSubir()}>
              {pending === "subir" ? "Subiendo…" : "Subir"}
            </Button>
            {extra}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{vacio}</p>
      )}
      </MarcoPrevisualizacion>
    </div>
  );
}

function ListaCompaneros({
  items,
  marcados,
  disabled,
  onToggle,
}: {
  items: CompaneroEnvioVidaLey[];
  marcados: string[];
  disabled: boolean;
  onToggle: (relacionId: string) => void;
}) {
  return (
    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
      {items.map((item) => (
        <li key={item.relacionId}>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={marcados.includes(item.relacionId)}
              disabled={disabled}
              onChange={() => onToggle(item.relacionId)}
            />
            <span>
              {item.etiqueta}
              {item.otroEnvio ? " · ya está en otro grupo" : ""}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
