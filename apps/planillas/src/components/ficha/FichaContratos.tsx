"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { webAppById } from "@bd/config";
import { Button, ConfirmDialog, useToast } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import {
  confirmarContratoFirmado,
  eliminarContratoGenerado,
  generarContratoParaFirma,
  marcarContratoRecogido,
  type ContratoRow,
  type DocumentoRow,
} from "@/lib/actions/ficha";
import type { TrabajadorListItem } from "@/lib/actions/trabajadores";
import { ESTADO_CONTRATO_LABEL, JORNADA_LABEL, cargoCanonico, formatFechaPlanilla, formatRemuneracion, opcionesCargo } from "@/lib/planillas-labels";
import { descargarContratoWord } from "@/lib/descargar-contrato-word";
import { Field, DateField, FormSection, SelectField } from "@/components/fields";
import { HorarioLaboralField } from "@/components/ficha/HorarioLaboralField";
import { FichaDocumentos } from "@/components/ficha/FichaDocumentos";

function abrirVistaPrevia(relacionId: string, contratoId: string) {
  window.open(
    `${webAppById("planillas").basePath}/trabajadores/${relacionId}/contrato?contratoId=${contratoId}`,
    "_blank",
  );
}

export function FichaContratos({
  relacionId,
  entidadId,
  trabajador,
  contratos,
  documentos,
  canWrite,
  canMarcarRecogido,
}: {
  relacionId: string;
  entidadId: string;
  trabajador: TrabajadorListItem;
  contratos: ContratoRow[];
  documentos: DocumentoRow[];
  canWrite: boolean;
  canMarcarRecogido: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const abierto = contratos.find(
    (c) => c.estado !== "RECOGIDO" && c.estado !== "BAJA" && c.estado !== "COMPLETO",
  );
  const [pending, setPending] = useState<"generar" | "editar" | "confirmar" | string | null>(null);
  const [mostrarGenerar, setMostrarGenerar] = useState(contratos.length === 0);
  const [editando, setEditando] = useState<ContratoRow | null>(null);
  const [eliminando, setEliminando] = useState<ContratoRow | null>(null);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(!abierto?.datos_confirmados);
  const tieneFirmado = documentos.some((d) => d.tipo === "CONTRATO_FIRMADO" && Boolean(d.storage_path) && d.estado === "SI");
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
    setEliminando(null);
    if (contratos.length <= 1) setMostrarGenerar(true);
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
    setMostrarConfirmar(false);
    pushToast("Contrato guardado.");
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
    pushToast("Contrato marcado como recogido.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Al generar se descarga el Word con cargo, funciones, fechas de ese contrato, sueldo, horario y tipo. Eso no
        cambia la fecha de ingreso a la empresa. Los datos del contrato se guardan cuando sube el PDF firmado y los
        confirma (puede corregirlos si el papel salió distinto). Puede haber varios contratos durante la estadía.
      </p>

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => {
            setEditando(null);
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
            hint="Estos datos van al documento. Al confirmar el firmado se actualizan cargo, horario y jornada. La fecha de ingreso a la empresa no cambia."
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

      {abierto ? (
        <FormSection
          title="Contrato firmado"
          hint="Suba el PDF. Luego revise los datos generados; si el papel cambió algo, corríjalo aquí y guarde."
        >
          <FichaDocumentos
            relacionId={relacionId}
            entidadId={entidadId}
            documentos={documentos}
            canWrite={canWrite}
            tiposFiltro={["CONTRATO_FIRMADO"]}
            permitirAgregar={!documentos.some((d) => d.tipo === "CONTRATO_FIRMADO")}
            hint="PDF firmado. Hasta confirmar, no se actualizan cargo, horario ni jornada. La fecha de ingreso a la empresa no cambia."
          />
          {canWrite && tieneFirmado ? (
            mostrarConfirmar ? (
              <form action={(formData) => void onConfirmar(abierto.id, formData)} className="space-y-4">
                <p className="text-sm font-medium">Datos a guardar (del generado; se pueden cambiar)</p>
                <DatosContratoFields
                  key={`conf-${abierto.id}-${abierto.horario}-${abierto.remuneracion}`}
                  trabajador={trabajador}
                  contrato={abierto}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={pending === "confirmar"}>
                    {pending === "confirmar" ? "Guardando…" : "Confirmar y guardar contrato"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending === "confirmar"}
                    onClick={() => setMostrarConfirmar(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <Button type="button" variant="outline" onClick={() => setMostrarConfirmar(true)}>
                Confirmar datos del firmado
              </Button>
            )
          ) : canWrite ? (
            <p className="text-sm text-muted-foreground">Cuando suba el firmado podrá confirmar y guardar los datos.</p>
          ) : null}
        </FormSection>
      ) : null}

      <div className={`${panelCardClass} overflow-x-auto p-0`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Versión</th>
              <th className="px-4 py-2 font-medium">Inicio contrato</th>
              <th className="px-4 py-2 font-medium">Cese contrato</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Remuneración</th>
              <th className="px-4 py-2 font-medium">Guardado</th>
              <th className="px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  Aún no hay contratos. Genere el Word para firmar.
                </td>
              </tr>
            ) : (
              contratos.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{c.version}</td>
                  <td className="px-4 py-2">{formatFechaPlanilla(c.fecha_inicio)}</td>
                  <td className="px-4 py-2">{formatFechaPlanilla(c.fecha_fin)}</td>
                  <td className="px-4 py-2">{ESTADO_CONTRATO_LABEL[c.estado]}</td>
                  <td className="px-4 py-2">{formatRemuneracion(c.remuneracion)}</td>
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
                      {canWrite && c.estado !== "RECOGIDO" && c.estado !== "COMPLETO" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setMostrarGenerar(false);
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
                          disabled={pending === c.id || !tieneFirmado}
                          onClick={() => void onRecoger(c.id)}
                        >
                          {pending === c.id ? "Guardando…" : "Marcar recogido"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
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
        defaultValue={contrato?.fecha_inicio ?? trabajador.fecha_ingreso}
      />
      <DateField label="Fecha de cese de contrato" name="fecha_fin" defaultValue={contrato?.fecha_fin ?? ""} />
      <Field
        label="Remuneración"
        name="remuneracion"
        type="number"
        defaultValue={contrato?.remuneracion ?? trabajador.remuneracion ?? ""}
      />
      <HorarioLaboralField jornada={jornada} defaultValue={contrato?.horario ?? trabajador.horario} />
    </div>
  );
}
