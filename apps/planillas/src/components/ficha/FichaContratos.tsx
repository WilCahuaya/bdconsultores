"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { webAppById } from "@bd/config";
import { Button, ConfirmDialog, useToast } from "@inventario/ui";
import { EditIcon, panelCardClass } from "@inventario/ui/panel";
import {
  asegurarFirmadoContrato,
  confirmarContratoFirmado,
  eliminarContratoGenerado,
  generarContratoParaFirma,
  marcarContratoPresentadoMtpe,
  marcarContratoRecogido,
  type ContratoRow,
  type DocumentoRow,
} from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import { MarcasDocumentoContrato } from "@/components/ficha/VersionesContratoButton";
import { ESTADO_CONTRATO_LABEL, JORNADA_LABEL, cargoCanonico, formatFechaPlanilla, formatRemuneracion, montoAsignacionFamiliar, opcionesCargo, remuneracionBruta } from "@/lib/planillas-labels";
import { descargarContratoWord } from "@/lib/descargar-contrato-word";
import { nombreBaseContrato } from "@/lib/nombre-archivo";
import { Field, DateField, FormSection, SelectField } from "@/components/fields";
import { HorarioLaboralField } from "@/components/ficha/HorarioLaboralField";
import { HorarioContratoVista } from "@/components/ficha/HorarioContratoVista";
import { FichaDocumentos } from "@/components/ficha/FichaDocumentos";
import { VistaDocumentoGuardado } from "@/components/ficha/DocumentoPrevisualizacion";
import { SolicitudRegistroContrato } from "@/components/ficha/SolicitudRegistroContrato";
import type { ContratoEnlazable, SolicitudRegistroVista } from "@/lib/actions/solicitudes-registro";
import {
  ETIQUETA_FALTA_CONTRATO_FIRMADO_VALIDADO,
  faltaContratoFirmadoUltimoValidado,
  etiquetaDocumentosSubidos,
} from "@/lib/flujo-ficha";

function abrirVistaPrevia(relacionId: string, contratoId: string) {
  window.open(
    `${webAppById("planillas").basePath}/trabajadores/${relacionId}/contrato?contratoId=${contratoId}`,
    "_blank",
  );
}

function documentoDeContrato(contrato: ContratoRow, documentos: DocumentoRow[]): DocumentoRow | null {
  if (!contrato.documento_id) return null;
  return documentos.find((d) => d.id === contrato.documento_id) ?? null;
}

function contratoTienePdf(contrato: ContratoRow, documentos: DocumentoRow[]): boolean {
  const doc = documentoDeContrato(contrato, documentos);
  return Boolean(doc?.storage_path && doc.estado === "SI");
}

function solicitudDeContrato(contrato: ContratoRow, solicitudes: SolicitudRegistroVista[]): SolicitudRegistroVista | null {
  if (!contrato.solicitud_registro_id) return null;
  return solicitudes.find((item) => item.id === contrato.solicitud_registro_id) ?? null;
}

function contratoTieneSolicitud(contrato: ContratoRow, solicitudes: SolicitudRegistroVista[]): boolean {
  return Boolean(solicitudDeContrato(contrato, solicitudes)?.storage_path);
}

function AccionIconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

function IconWord({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h7.5L19 8v12.5a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 3.5V8H19" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 13h7M8.5 16.5h5" />
    </svg>
  );
}

function IconRespaldo({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V8m0 0l-3 3m3-3 3 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 16.5V18a2 2 0 002 2h10a2 2 0 002-2v-1.5" />
    </svg>
  );
}

function IconVer({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEliminar({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0h8l-.8-2.4A1 1 0 0014.2 4H9.8a1 1 0 00-.96.7L8 7z" />
    </svg>
  );
}

function IconRecogido({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconMtpe({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4 4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
    </svg>
  );
}

function nombrePdfContrato(trabajador: TrabajadorListItem, contrato: ContratoRow | null): string | null {
  const jornada = contrato?.jornada ?? trabajador.jornada;
  const cargo = contrato?.cargo ?? trabajador.cargo;
  const fecha = contrato?.fecha_inicio ?? trabajador.fecha_ingreso;
  if ((jornada !== "TIEMPO_COMPLETO" && jornada !== "TIEMPO_PARCIAL") || !cargo || !fecha) return null;
  return nombreBaseContrato({
    numero: trabajador.numero,
    jornada,
    cargo,
    nombres: trabajador.persona.nombres,
    apellidoPaterno: trabajador.persona.apellido_paterno,
    fecha,
  });
}

export function FichaContratos({
  relacionId,
  entidadId,
  trabajador,
  contratos,
  documentos,
  solicitudes,
  enlazables,
  canWrite,
  canMarcarRecogido,
}: {
  relacionId: string;
  entidadId: string;
  trabajador: TrabajadorListItem;
  contratos: ContratoRow[];
  documentos: DocumentoRow[];
  solicitudes: SolicitudRegistroVista[];
  enlazables: ContratoEnlazable[];
  canWrite: boolean;
  canMarcarRecogido: boolean;
}) {
  const descarga = {
    numero: trabajador.numero,
    nombres: trabajador.persona.nombres,
    apellidoPaterno: trabajador.persona.apellido_paterno,
    nombreBase: (documento: DocumentoRow) => {
      if (documento.tipo !== "CONTRATO_FIRMADO") return null;
      const ligado = contratos.find((c) => c.documento_id === documento.id) ?? null;
      return nombrePdfContrato(trabajador, ligado);
    },
  };
  const router = useRouter();
  const { pushToast } = useToast();
  const abierto = contratos.find(
    (c) => c.estado !== "RECOGIDO" && c.estado !== "BAJA" && c.estado !== "COMPLETO",
  );
  const [pending, setPending] = useState<"generar" | "editar" | "confirmar" | string | null>(null);
  const [mostrarGenerar, setMostrarGenerar] = useState(false);
  const [editando, setEditando] = useState<ContratoRow | null>(null);
  const [eliminando, setEliminando] = useState<ContratoRow | null>(null);
  const [validandoDatos, setValidandoDatos] = useState<FormData | null>(null);
  const [firmandoId, setFirmandoId] = useState<string | null>(null);
  const [vistaFirmandoId, setVistaFirmandoId] = useState<string | null>(null);
  const [vistaRespaldo, setVistaRespaldo] = useState<"contrato" | "solicitud">("contrato");
  const firmando = contratos.find((c) => c.id === firmandoId) ?? null;
  const pdfFirmando = firmando ? documentoDeContrato(firmando, documentos) : null;
  const tienePdfFirmando = firmando ? contratoTienePdf(firmando, documentos) : false;
  const tieneSolicitudFirmando = firmando ? contratoTieneSolicitud(firmando, solicitudes) : false;
  const tieneRespaldoFirmando = tienePdfFirmando || tieneSolicitudFirmando;
  const rutaContratoFirmado = tienePdfFirmando ? pdfFirmando?.storage_path ?? null : null;
  const rutaSolicitudFirmando = firmando ? solicitudDeContrato(firmando, solicitudes)?.storage_path ?? null : null;
  const verRespaldos = Boolean(
    firmando && vistaFirmandoId === firmando.id && (rutaContratoFirmado || rutaSolicitudFirmando),
  );
  const ambosRespaldos = Boolean(rutaContratoFirmado && rutaSolicitudFirmando);
  const mostrarContratoVista =
    verRespaldos && Boolean(rutaContratoFirmado) && (!ambosRespaldos || vistaRespaldo === "contrato");
  const mostrarSolicitudVista =
    verRespaldos && Boolean(rutaSolicitudFirmando) && (!ambosRespaldos || vistaRespaldo === "solicitud");
  const base = abierto ?? contratos.find((c) => c.datos_confirmados) ?? null;

  async function onGenerar(formData: FormData) {
    setPending("generar");
    const result = await generarContratoParaFirma(relacionId, formData);
    setPending(null);
    if (result.error || !result.contratoId) {
      pushToast(result.error ?? "No se pudo generar el contrato.", "error");
      return;
    }
    setMostrarGenerar(false);
    setFirmandoId(null);
    pushToast("Contrato generado.");
    router.refresh();
    const descarga = await descargarContratoWord(relacionId, result.contratoId);
    if (descarga.error) pushToast(descarga.error, "error");
  }

  async function onEditar(formData: FormData) {
    if (!editando) return;
    setPending("editar");
    const result = await generarContratoParaFirma(relacionId, formData, editando.id);
    setPending(null);
    if (result.error || !result.contratoId) {
      pushToast(result.error ?? "No se pudo guardar el contrato.", "error");
      return;
    }
    setEditando(null);
    setFirmandoId(null);
    pushToast("Contrato actualizado.");
    router.refresh();
    const descarga = await descargarContratoWord(relacionId, result.contratoId);
    if (descarga.error) pushToast(descarga.error, "error");
  }

  async function onEliminar() {
    if (!eliminando) return;
    setPending(`del-${eliminando.id}`);
    const result = await eliminarContratoGenerado(relacionId, eliminando.id);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    if (editando?.id === eliminando.id) setEditando(null);
    if (firmandoId === eliminando.id) setFirmandoId(null);
    setEliminando(null);
    pushToast("Contrato eliminado.");
    router.refresh();
  }

  async function onDescargar(contratoId: string) {
    setPending(`word-${contratoId}`);
    const descarga = await descargarContratoWord(relacionId, contratoId);
    setPending(null);
    if (descarga.error) pushToast(descarga.error, "error");
  }

  async function onConfirmar(contratoId: string, formData: FormData) {
    setPending("confirmar");
    const result = await confirmarContratoFirmado(relacionId, contratoId, formData);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    setValidandoDatos(null);
    setFirmandoId(null);
    pushToast("Contrato validado. El proceso del contrato terminó.");
    router.refresh();
  }

  function pedirValidacion(formData: FormData) {
    if (!firmando) return;
    if (firmando.estado === "RECOGIDO" || firmando.estado === "COMPLETO" || firmando.estado === "BAJA") {
      pushToast("Este contrato ya está cerrado. No se puede validar.", "error");
      return;
    }
    if (firmando.datos_confirmados) {
      pushToast("Este contrato ya está validado.", "error");
      return;
    }
    if (firmando.estado !== "PRESENTADO_MTPE") {
      pushToast("Presente el contrato al MTPE antes de validarlo.", "error");
      return;
    }
    if (!tieneRespaldoFirmando) {
      pushToast("Suba el contrato firmado o una solicitud de registro para poder validar.", "error");
      return;
    }
    setValidandoDatos(formData);
  }

  async function onSubirFirmado(contrato: ContratoRow) {
    setMostrarGenerar(false);
    setEditando(null);
    setValidandoDatos(null);
    if (!contrato.documento_id && contrato.estado !== "BAJA") {
      setPending(`firm-${contrato.id}`);
      const result = await asegurarFirmadoContrato(relacionId, contrato.id);
      setPending(null);
      if (result.error) {
        pushToast(result.error, "error");
        return;
      }
      router.refresh();
    }
    setFirmandoId(contrato.id);
  }

  async function onPresentarMtpe(contratoId: string) {
    setPending(`mtpe-${contratoId}`);
    const result = await marcarContratoPresentadoMtpe(relacionId, contratoId);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Contrato marcado como presentado al MTPE. Suba el documento firmado.");
    router.refresh();
  }

  async function onRecoger(contratoId: string) {
    setPending(contratoId);
    const result = await marcarContratoRecogido(relacionId, contratoId);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Contrato cerrado. Siga con el alta AFP y T-Registro.");
    router.push(`/contratos/${relacionId}?paso=alta`);
  }

  const faltaFirmadoValidado = faltaContratoFirmadoUltimoValidado(
    contratos.map((c) => ({
      estado: c.estado,
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
      remuneracion: c.remuneracion,
      es_vigente: c.es_vigente,
      version: c.version,
      datos_confirmados: c.datos_confirmados,
      documento_id: c.documento_id,
      solicitud_registro_id: c.solicitud_registro_id,
      solicitud_storage_path: solicitudDeContrato(c, solicitudes)?.storage_path ?? null,
    })),
    documentos,
  );

  return (
    <div className="space-y-4">
      {faltaFirmadoValidado ? (
        <p className={`${panelCardClass} border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50`}>
          {ETIQUETA_FALTA_CONTRATO_FIRMADO_VALIDADO}. Use «Subir firmado» en la versión validada.
        </p>
      ) : null}
      {canWrite ? <p className="text-sm text-muted-foreground">Generar abre una versión nueva.</p> : null}

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => {
            setEditando(null);
            setFirmandoId(null);
            setMostrarGenerar((v) => !v);
          }}>
            {mostrarGenerar ? "Ocultar formulario" : "Generar contrato"}
          </Button>
          {abierto ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pending === `word-${abierto.id}`}
                onClick={() => void onDescargar(abierto.id)}
              >
                {pending === `word-${abierto.id}` ? "Descargando…" : "Descargar Word"}
              </Button>
              <Button type="button" variant="outline" onClick={() => abrirVistaPrevia(relacionId, abierto.id)}>
                Vista previa
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {canWrite && mostrarGenerar && !editando ? (
        <form action={onGenerar}>
          <FormSection
            title="Generar contrato"
            hint="Crea una versión nueva, aunque la anterior no tenga respaldo ni esté recogida. Estos datos van solo a este documento. Al confirmar, cargo, horario y jornada pasan al puesto solo si esta versión es la más reciente firmada. La fecha de inicio pasa a la fecha de ingreso solo si este es el primer contrato o solicitud firmado."
          >
            <DatosContratoFields
              key={`gen-${base?.id ?? "nuevo"}-${base?.horario ?? ""}`}
              trabajador={trabajador}
              contrato={base}
            />
            <Button type="submit" disabled={pending === "generar"}>
              {pending === "generar" ? "Generando…" : "Generar Word"}
            </Button>
          </FormSection>
        </form>
      ) : null}

      {canWrite && editando ? (
        <form action={onEditar}>
          <FormSection
            title={`Editar contrato (versión ${editando.version})`}
            hint="Se vuelve a armar el Word. Si ya estaba confirmado, hay que volver a confirmar el firmado."
          >
            <DatosContratoFields
              key={`edit-${editando.id}-${editando.horario}-${editando.remuneracion}`}
              trabajador={trabajador}
              contrato={editando}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending === "editar"}>
                {pending === "editar" ? "Guardando…" : "Guardar y descargar Word"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
            </div>
          </FormSection>
        </form>
      ) : null}

      {firmando ? (
        <FormSection
          title={`Respaldo del contrato · versión ${firmando.version}`}
          hint={
            firmando.datos_confirmados
              ? "El contrato ya está validado. Si después encuentra el PDF firmado o la solicitud, súbalo aquí. Los datos guardados no cambian."
              : "Suba el PDF firmado, la solicitud de registro, o ambos. Revise los datos del contrato y valídelo. El ingreso a la empresa no cambia."
          }
        >
          <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/40">
            <FichaDocumentos
              relacionId={relacionId}
              entidadId={entidadId}
              documentos={pdfFirmando ? [pdfFirmando] : []}
              canWrite={canWrite && firmando.estado !== "BAJA"}
              tiposFiltro={["CONTRATO_FIRMADO"]}
              permitirAgregar={false}
              hint={`PDF firmado de la versión ${firmando.version}.`}
              descarga={descarga}
            />
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
            <SolicitudRegistroContrato
              relacionId={relacionId}
              entidadId={entidadId}
              contratoId={firmando.id}
              canWrite={canWrite}
              cerrado={firmando.estado === "BAJA"}
              solicitud={solicitudDeContrato(firmando, solicitudes)}
              solicitudes={solicitudes}
              enlazables={enlazables}
            />
          </div>
          {canWrite &&
          !firmando.datos_confirmados &&
          firmando.estado !== "BAJA" &&
          firmando.estado !== "RECOGIDO" &&
          firmando.estado !== "COMPLETO" ? (
            <form
              action={(formData) => pedirValidacion(formData)}
              className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Datos del contrato</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Revise o corrija estos datos. Con el respaldo subido podrá validar el contrato.
                  </p>
                </div>
                {rutaContratoFirmado || rutaSolicitudFirmando ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {verRespaldos && ambosRespaldos ? (
                      <select
                        className="flex h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={vistaRespaldo}
                        onChange={(event) => setVistaRespaldo(event.target.value as "contrato" | "solicitud")}
                        aria-label="Documento a previsualizar"
                      >
                        <option value="contrato">Contrato firmado</option>
                        <option value="solicitud">Solicitud</option>
                      </select>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (verRespaldos) {
                          setVistaFirmandoId(null);
                          return;
                        }
                        setVistaRespaldo(rutaContratoFirmado ? "contrato" : "solicitud");
                        setVistaFirmandoId(firmando.id);
                      }}
                    >
                      {verRespaldos
                        ? "Ocultar previsualización"
                        : ambosRespaldos
                          ? "Ver documento"
                          : "Ver previsualización"}
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className={verRespaldos ? "grid items-start gap-4 lg:grid-cols-2" : "space-y-4"}>
                <div className="space-y-4">
                  <DatosContratoFields
                    key={`conf-${firmando.id}-${firmando.horario}-${firmando.remuneracion}`}
                    trabajador={trabajador}
                    contrato={firmando}
                  />
                  {firmando.estado !== "PRESENTADO_MTPE" ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Primero marque el contrato como presentado al MTPE. Después suba el firmado y valídelo.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setValidandoDatos(null);
                          setFirmandoId(null);
                        }}
                      >
                        Cerrar
                      </Button>
                    </>
                  ) : tieneRespaldoFirmando ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={pending === "confirmar"}>
                          {pending === "confirmar" ? "Validando…" : "Validar contrato"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={pending === "confirmar"}
                          onClick={() => {
                            setValidandoDatos(null);
                            setFirmandoId(null);
                          }}
                        >
                          Cerrar
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Al validar se le pedirá confirmar. El proceso del contrato termina al validar.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Suba el contrato firmado o una solicitud de registro para poder validar.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setValidandoDatos(null);
                          setFirmandoId(null);
                        }}
                      >
                        Cerrar
                      </Button>
                    </>
                  )}
                </div>
                {verRespaldos ? (
                  <div className="space-y-4 lg:sticky lg:top-4">
                    {mostrarContratoVista && rutaContratoFirmado ? (
                      <VistaDocumentoGuardado titulo="Contrato firmado" storagePath={rutaContratoFirmado} />
                    ) : null}
                    {mostrarSolicitudVista && rutaSolicitudFirmando ? (
                      <VistaDocumentoGuardado titulo="Solicitud de registro" storagePath={rutaSolicitudFirmando} />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </form>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setValidandoDatos(null);
                setFirmandoId(null);
              }}
            >
              Cerrar
            </Button>
          )}
        </FormSection>
      ) : null}

      {contratos.length === 0 ? (
        <FormSection
          title="Contrato firmado"
          hint="Si solo tiene el PDF vigente y no va a generar Word, súbalo aquí."
        >
          <FichaDocumentos
            relacionId={relacionId}
            entidadId={entidadId}
            documentos={documentos}
            canWrite={canWrite}
            tiposFiltro={["CONTRATO_FIRMADO"]}
            permitirAgregar={!documentos.some((d) => d.tipo === "CONTRATO_FIRMADO")}
            hint="PDF firmado. El ingreso a la empresa no cambia."
            descarga={descarga}
          />
        </FormSection>
      ) : null}

      <div className={`${panelCardClass} overflow-x-auto p-0`}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Versión</th>
              <th className="px-3 py-2 font-medium">Inicio contrato</th>
              <th className="px-3 py-2 font-medium">Fin contrato</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Remuneración</th>
              <th className="px-3 py-2 font-medium">Rem. bruta</th>
              <th className="px-3 py-2 font-medium">Documento</th>
              <th className="px-3 py-2 font-medium">Validado</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={9}>
                  {canWrite
                    ? "Aún no hay contratos registrados. Puede dejarlo así, subir solo el firmado vigente o generar un Word."
                    : "Aún no hay contratos registrados."}
                </td>
              </tr>
            ) : (
              contratos.map((c) => {
              const conPdf = contratoTienePdf(c, documentos);
              const conSolicitud = contratoTieneSolicitud(c, solicitudes);
              const conRespaldo = conPdf || conSolicitud;
              const cerrado = c.estado === "RECOGIDO" || c.estado === "COMPLETO" || c.estado === "BAJA";
              const elaborado = c.estado === "ELABORADO" || c.estado === "PENDIENTE_DOCS";
              const presentado = c.estado === "PRESENTADO_MTPE";
              const puedeEditarEliminar = canWrite && !cerrado;
              const puedePresentarMtpe = canWrite && elaborado && !c.datos_confirmados;
              // Tras presentar al MTPE (o si ya hay archivo en elaborado): subir / validar.
              const puedeSubirRespaldo =
                canWrite && c.estado !== "BAJA" && (presentado || cerrado || (elaborado && conRespaldo) || c.datos_confirmados);
              const puedeValidar = puedeEditarEliminar && !c.datos_confirmados && conRespaldo && presentado;
              const puedeMarcar =
                canMarcarRecogido &&
                c.datos_confirmados &&
                (c.estado === "ELABORADO" || c.estado === "PRESENTADO_MTPE" || c.estado === "PENDIENTE_DOCS");
              const etiquetaRespaldo = !conRespaldo
                ? "Subir respaldo"
                : puedeValidar
                  ? "Validar contrato"
                  : c.datos_confirmados && (!conPdf || !conSolicitud)
                    ? "Agregar respaldo"
                    : "Ver respaldo";
              const iconoRespaldo =
                !conRespaldo || (c.datos_confirmados && (!conPdf || !conSolicitud)) ? (
                  <IconRespaldo />
                ) : puedeValidar ? (
                  <IconRecogido />
                ) : (
                  <IconVer />
                );
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{c.version}</td>
                  <td className="px-3 py-2">{formatFechaPlanilla(c.fecha_inicio)}</td>
                  <td className="px-3 py-2">{formatFechaPlanilla(c.fecha_fin)}</td>
                  <td className="px-3 py-2">{ESTADO_CONTRATO_LABEL[c.estado]}</td>
                  <td className="px-3 py-2">{formatRemuneracion(c.remuneracion)}</td>
                  <td className="px-3 py-2">
                    {formatRemuneracion(remuneracionBruta(c.remuneracion, trabajador.recibe_asignacion_familiar))}
                  </td>
                  <td className="px-3 py-2">
                    {conPdf || conSolicitud ? <MarcasDocumentoContrato pdf={conPdf} solicitud={conSolicitud} /> : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {c.datos_confirmados ? (
                      <span className="inline-flex text-emerald-700" title="Validado" aria-label="Validado">
                        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-nowrap items-center gap-1">
                      <AccionIconButton
                        label={pending === `word-${c.id}` ? "Descargando…" : "Descargar Word"}
                        disabled={pending === `word-${c.id}`}
                        onClick={() => void onDescargar(c.id)}
                      >
                        <IconWord />
                      </AccionIconButton>
                      {puedePresentarMtpe ? (
                        <AccionIconButton
                          label={pending === `mtpe-${c.id}` ? "Guardando…" : "Presentar al MTPE"}
                          disabled={pending === `mtpe-${c.id}`}
                          onClick={() => void onPresentarMtpe(c.id)}
                        >
                          <IconMtpe />
                        </AccionIconButton>
                      ) : null}
                      {puedeSubirRespaldo || conRespaldo ? (
                        <AccionIconButton
                          label={pending === `firm-${c.id}` ? "Preparando…" : etiquetaRespaldo}
                          disabled={pending === `firm-${c.id}`}
                          className={
                            puedeValidar
                              ? "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800"
                              : undefined
                          }
                          onClick={() => void onSubirFirmado(c)}
                        >
                          {iconoRespaldo}
                        </AccionIconButton>
                      ) : null}
                      {puedeEditarEliminar ? (
                        <>
                          <AccionIconButton
                            label="Editar"
                            onClick={() => {
                              setMostrarGenerar(false);
                              setFirmandoId(null);
                              setValidandoDatos(null);
                              setEditando(c);
                            }}
                          >
                            <EditIcon />
                          </AccionIconButton>
                          <AccionIconButton
                            label={pending === `del-${c.id}` ? "Eliminando…" : "Eliminar"}
                            disabled={pending === `del-${c.id}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setEliminando(c)}
                          >
                            <IconEliminar />
                          </AccionIconButton>
                        </>
                      ) : null}
                      {puedeMarcar ? (
                        <AccionIconButton
                          label={pending === c.id ? "Guardando…" : "Cerrar contrato"}
                          disabled={pending === c.id || !conRespaldo}
                          className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800"
                          onClick={() => void onRecoger(c.id)}
                        >
                          <IconRecogido />
                        </AccionIconButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(eliminando)}
        onClose={() => {
          if (pending?.startsWith("del-")) return;
          setEliminando(null);
        }}
        title="Eliminar contrato generado"
        description={
          eliminando
            ? `¿Eliminar la versión ${eliminando.version} del historial? Dejará de aparecer y podrá generar otro.`
            : undefined
        }
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        pending={Boolean(eliminando && pending === `del-${eliminando.id}`)}
        onConfirm={() => void onEliminar()}
      />
      <ConfirmDialog
        open={Boolean(validandoDatos && firmando)}
        onClose={() => {
          if (pending === "confirmar") return;
          setValidandoDatos(null);
        }}
        title="Validar contrato"
        description="¿Está seguro de que desea validar? Revise el resumen antes de continuar. El proceso del contrato terminará."
        confirmLabel="Sí, validar"
        pending={pending === "confirmar"}
        onConfirm={() => {
          if (!firmando || !validandoDatos) return;
          void onConfirmar(firmando.id, validandoDatos);
        }}
      >
        {validandoDatos && firmando ? (
          <ResumenValidacionContrato
            formData={validandoDatos}
            version={firmando.version}
            tienePdf={tienePdfFirmando}
            tieneSolicitud={tieneSolicitudFirmando}
            recibeAsignacion={trabajador.recibe_asignacion_familiar}
          />
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function ResumenValidacionContrato({
  formData,
  version,
  tienePdf,
  tieneSolicitud,
  recibeAsignacion,
}: {
  formData: FormData;
  version: number;
  tienePdf: boolean;
  tieneSolicitud: boolean;
  recibeAsignacion: boolean | null;
}) {
  const cargo = String(formData.get("cargo") ?? "").trim();
  const jornada = String(formData.get("jornada") ?? "").trim();
  const fechaInicio = String(formData.get("fecha_inicio") ?? "").trim();
  const fechaFin = String(formData.get("fecha_fin") ?? "").trim();
  const remuneracionRaw = String(formData.get("remuneracion") ?? "").trim();
  const horario = String(formData.get("horario") ?? "").trim();
  const remNum = Number(remuneracionRaw);
  const remValida = remuneracionRaw !== "" && Number.isFinite(remNum);
  const asignacion = montoAsignacionFamiliar(recibeAsignacion);
  const bruta = remValida ? remuneracionBruta(remNum, recibeAsignacion) : null;
  const documentos = etiquetaDocumentosSubidos(tienePdf, tieneSolicitud);
  const filas: { label: string; value: ReactNode }[] = [
    { label: "Versión", value: String(version) },
    { label: "Cargo", value: cargo || "—" },
    {
      label: "Tipo de contrato",
      value:
        jornada === "TIEMPO_COMPLETO" || jornada === "TIEMPO_PARCIAL" ? JORNADA_LABEL[jornada] : jornada || "—",
    },
    { label: "Inicio", value: formatFechaPlanilla(fechaInicio || null) },
    { label: "Fin", value: formatFechaPlanilla(fechaFin || null) },
    { label: "Remuneración", value: remValida ? formatRemuneracion(remNum) : remuneracionRaw || "—" },
    {
      label: "Asignación familiar",
      value:
        recibeAsignacion === true
          ? formatRemuneracion(asignacion)
          : recibeAsignacion === false
            ? "No corresponde"
            : "—",
    },
    { label: "Remuneración bruta", value: bruta == null ? "—" : formatRemuneracion(bruta) },
    { label: "Horario", value: <HorarioContratoVista value={horario || null} className="text-sm text-foreground" /> },
    { label: "Documento", value: documentos ?? "—" },
  ];

  return (
    <dl className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border/70 bg-muted/30 p-3 text-sm">
      {filas.map((fila) => (
        <div key={fila.label} className="grid gap-0.5 sm:grid-cols-[8.5rem_1fr] sm:gap-2">
          <dt className="text-muted-foreground">{fila.label}</dt>
          <dd className="min-w-0 font-medium text-foreground">{fila.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DatosContratoFields({
  trabajador,
  contrato,
}: {
  trabajador: TrabajadorListItem;
  contrato: ContratoRow | null;
}) {
  const [jornada, setJornada] = useState(contrato?.jornada ?? trabajador.jornada ?? "");
  const [remuneracion, setRemuneracion] = useState(
    String(contrato?.remuneracion ?? trabajador.remuneracion ?? ""),
  );
  const remNum = Number(remuneracion);
  const remValida = remuneracion.trim() !== "" && Number.isFinite(remNum);
  const asignacion = montoAsignacionFamiliar(trabajador.recibe_asignacion_familiar);
  const bruta = remValida ? remuneracionBruta(remNum, trabajador.recibe_asignacion_familiar) : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Cargo"
        name="cargo"
        defaultValue={cargoCanonico(contrato?.cargo ?? trabajador.cargo) ?? contrato?.cargo ?? trabajador.cargo}
        allowEmpty
        options={opcionesCargo(contrato?.cargo ?? trabajador.cargo)}
      />
      <SelectField
        label="Tipo de contrato"
        name="jornada"
        value={jornada}
        allowEmpty
        options={Object.entries(JORNADA_LABEL).map(([value, label]) => ({ value, label }))}
        onChange={(event) => setJornada(event.target.value)}
      />
      <DateField
        label="Fecha de inicio de contrato"
        name="fecha_inicio"
        defaultValue={contrato?.fecha_inicio ?? ""}
        hint="De este documento. Puede diferir del ingreso a la empresa."
      />
      <DateField
        label="Fecha de fin de contrato"
        name="fecha_fin"
        defaultValue={contrato?.fecha_fin ?? ""}
        hint="De este documento, no de la estadía en la empresa."
      />
      <Field
        label="Remuneración"
        name="remuneracion"
        type="number"
        value={remuneracion}
        onChange={(event) => setRemuneracion(event.target.value)}
      />
      <Field
        label="Asignación familiar"
        name="asignacion_familiar_vista"
        readOnly
        value={
          trabajador.recibe_asignacion_familiar === true
            ? formatRemuneracion(asignacion)
            : trabajador.recibe_asignacion_familiar === false
              ? "No corresponde"
              : "Indíquelo en la ficha"
        }
      />
      <Field
        label="Remuneración bruta"
        name="remuneracion_bruta_vista"
        readOnly
        value={bruta == null ? "" : formatRemuneracion(bruta)}
      />
      <HorarioLaboralField jornada={jornada} defaultValue={contrato?.horario ?? trabajador.horario} />
    </div>
  );
}
