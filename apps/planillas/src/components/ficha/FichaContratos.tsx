"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { webAppById } from "@bd/config";
import { Button, ConfirmDialog, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import {
  asegurarFirmadoContrato,
  confirmarContratoFirmado,
  eliminarContratoGenerado,
  generarContratoParaFirma,
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
import { FichaDocumentos } from "@/components/ficha/FichaDocumentos";
import { VistaDocumentoGuardado } from "@/components/ficha/DocumentoPrevisualizacion";
import { SolicitudRegistroContrato } from "@/components/ficha/SolicitudRegistroContrato";
import type { ContratoEnlazable, SolicitudRegistroVista } from "@/lib/actions/solicitudes-registro";

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
  const [firmandoId, setFirmandoId] = useState<string | null>(null);
  const [vistaFirmandoId, setVistaFirmandoId] = useState<string | null>(null);
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
    setFirmandoId(null);
    pushToast("Contrato guardado.");
    router.refresh();
  }

  async function onSubirFirmado(contrato: ContratoRow) {
    setMostrarGenerar(false);
    setEditando(null);
    if (!contrato.documento_id) {
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

  async function onRecoger(contratoId: string) {
    setPending(contratoId);
    const result = await marcarContratoRecogido(relacionId, contratoId);
    setPending(null);
    if (result.error) {
      pushToast(result.error, "error");
      return;
    }
    pushToast("Contrato marcado como recogido. Siga con el alta AFP y T-Registro.");
    router.push(`/contratos/${relacionId}?paso=alta`);
  }

  return (
    <div className="space-y-4">
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
              ? "El contrato ya está guardado. Si después encuentra el PDF firmado o la solicitud, súbalo aquí. Los datos guardados no cambian."
              : "Suba el PDF firmado, enlace una solicitud de registro, o ambos. Aquí confirma los datos de este contrato. El ingreso a la empresa no cambia."
          }
        >
          <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
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
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <SolicitudRegistroContrato
              relacionId={relacionId}
              entidadId={entidadId}
              contratoId={firmando.id}
              numero={trabajador.numero}
              nombres={trabajador.persona.nombres}
              apellidoPaterno={trabajador.persona.apellido_paterno}
              canWrite={canWrite}
              cerrado={firmando.estado === "BAJA"}
              solicitud={solicitudDeContrato(firmando, solicitudes)}
              solicitudes={solicitudes}
              enlazables={enlazables}
            />
          </div>
          {canWrite && !firmando.datos_confirmados && firmando.estado !== "BAJA" ? (
            <form action={(formData) => void onConfirmar(firmando.id, formData)} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Datos a guardar (del generado; se pueden cambiar)</p>
                {rutaContratoFirmado || rutaSolicitudFirmando ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setVistaFirmandoId(verRespaldos ? null : firmando.id)}
                  >
                    {verRespaldos ? "Ocultar previsualización" : ambosRespaldos ? "Ver contrato y solicitud" : "Ver previsualización"}
                  </Button>
                ) : null}
              </div>
              <div className={verRespaldos ? "grid items-start gap-4 lg:grid-cols-2" : "space-y-4"}>
                <div className="space-y-4">
                  <DatosContratoFields
                    key={`conf-${firmando.id}-${firmando.horario}-${firmando.remuneracion}`}
                    trabajador={trabajador}
                    contrato={firmando}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={pending === "confirmar" || !tieneRespaldoFirmando}>
                      {pending === "confirmar" ? "Guardando…" : "Confirmar y guardar contrato"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending === "confirmar"}
                      onClick={() => setFirmandoId(null)}
                    >
                      Cerrar
                    </Button>
                  </div>
                  {tieneRespaldoFirmando ? null : (
                    <p className="text-sm text-muted-foreground">
                      Suba el contrato firmado o una solicitud de registro para poder confirmar.
                    </p>
                  )}
                </div>
                {verRespaldos ? (
                  <div className="space-y-4 lg:sticky lg:top-4">
                    {rutaContratoFirmado ? (
                      <VistaDocumentoGuardado
                        titulo="Contrato firmado"
                        storagePath={rutaContratoFirmado}
                        compacto={ambosRespaldos}
                      />
                    ) : null}
                    {rutaSolicitudFirmando ? (
                      <VistaDocumentoGuardado
                        titulo="Solicitud de registro"
                        storagePath={rutaSolicitudFirmando}
                        compacto={ambosRespaldos}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" onClick={() => setFirmandoId(null)}>
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
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Versión</th>
              <th className="px-4 py-2 font-medium">Inicio contrato</th>
              <th className="px-4 py-2 font-medium">Fin contrato</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Remuneración</th>
              <th className="px-4 py-2 font-medium">Rem. bruta</th>
              <th className="px-4 py-2 font-medium">Documento</th>
              <th className="px-4 py-2 font-medium">Guardado</th>
              <th className="px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
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
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{c.version}</td>
                  <td className="px-4 py-2">{formatFechaPlanilla(c.fecha_inicio)}</td>
                  <td className="px-4 py-2">{formatFechaPlanilla(c.fecha_fin)}</td>
                  <td className="px-4 py-2">{ESTADO_CONTRATO_LABEL[c.estado]}</td>
                  <td className="px-4 py-2">{formatRemuneracion(c.remuneracion)}</td>
                  <td className="px-4 py-2">
                    {formatRemuneracion(remuneracionBruta(c.remuneracion, trabajador.recibe_asignacion_familiar))}
                  </td>
                  <td className="px-4 py-2">
                    {conPdf || conSolicitud ? <MarcasDocumentoContrato pdf={conPdf} solicitud={conSolicitud} /> : "—"}
                  </td>
                  <td className="px-4 py-2">{c.datos_confirmados ? "Sí" : "No"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending === `word-${c.id}`}
                        onClick={() => void onDescargar(c.id)}
                      >
                        {pending === `word-${c.id}` ? "…" : "Word"}
                      </Button>
                      {canWrite || conRespaldo ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending === `firm-${c.id}`}
                          onClick={() => void onSubirFirmado(c)}
                        >
                          {pending === `firm-${c.id}`
                            ? "…"
                            : !conRespaldo
                              ? "Subir respaldo"
                              : c.datos_confirmados && (!conPdf || !conSolicitud)
                                ? "Agregar respaldo"
                                : "Ver respaldo"}
                        </Button>
                      ) : null}
                      {canWrite && !cerrado ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setMostrarGenerar(false);
                              setFirmandoId(null);
                              setEditando(c);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending === `del-${c.id}`}
                            onClick={() => setEliminando(c)}
                          >
                            Eliminar
                          </Button>
                        </>
                      ) : null}
                      {canMarcarRecogido && c.estado === "ELABORADO" && c.datos_confirmados ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending === c.id || !conRespaldo}
                          onClick={() => void onRecoger(c.id)}
                        >
                          {pending === c.id ? "Guardando…" : "Marcar recogido"}
                        </Button>
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
    </div>
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
