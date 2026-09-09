"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { webAppById } from "@bd/config";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import {
  confirmarContratoFirmado,
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"generar" | "confirmar" | string | null>(null);
  const [mostrarGenerar, setMostrarGenerar] = useState(contratos.length === 0);

  const abierto = contratos.find(
    (c) => c.estado !== "RECOGIDO" && c.estado !== "BAJA" && c.estado !== "COMPLETO",
  );
  const tieneFirmado = documentos.some((d) => d.tipo === "CONTRATO_FIRMADO" && Boolean(d.storage_path) && d.estado === "SI");
  const base = abierto ?? contratos.find((c) => c.datos_confirmados) ?? null;

  async function onGenerar(formData: FormData) {
    setPending("generar");
    setError(null);
    const result = await generarContratoParaFirma(relacionId, formData);
    setPending(null);
    if (result.error || !result.contratoId) {
      setError(result.error ?? "No se pudo generar el contrato.");
      return;
    }
    setMostrarGenerar(false);
    router.refresh();
    const descarga = await descargarContratoWord(relacionId, result.contratoId);
    if (descarga.error) setError(descarga.error);
  }

  async function onDescargar(contratoId: string) {
    setPending(`word-${contratoId}`);
    setError(null);
    const descarga = await descargarContratoWord(relacionId, contratoId);
    setPending(null);
    if (descarga.error) setError(descarga.error);
  }

  async function onConfirmar(contratoId: string, formData: FormData) {
    setPending("confirmar");
    setError(null);
    const result = await confirmarContratoFirmado(relacionId, contratoId, formData);
    setPending(null);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function onRecoger(contratoId: string) {
    setPending(contratoId);
    setError(null);
    const result = await marcarContratoRecogido(relacionId, contratoId);
    setPending(null);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Al generar se descarga el Word con cargo, funciones, fechas, sueldo, horario y tipo. Eso no cambia la ficha. Los
        datos se guardan cuando sube el PDF firmado y los confirma (puede corregirlos si el papel salió distinto).
      </p>

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setMostrarGenerar((v) => !v)}>
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

      {canWrite && mostrarGenerar ? (
        <form action={onGenerar}>
          <FormSection
            title="Generar contrato"
            hint="Estos datos son solo para el documento. La ficha no cambia hasta confirmar el firmado."
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
            hint="PDF firmado. Hasta confirmar, no se actualiza el puesto ni queda como contrato vigente."
          />
          {canWrite && tieneFirmado ? (
            <form action={(formData) => void onConfirmar(abierto.id, formData)} className="space-y-4">
              <p className="text-sm font-medium">Datos a guardar (del generado; se pueden cambiar)</p>
              <DatosContratoFields
                key={`conf-${abierto.id}-${abierto.horario}-${abierto.remuneracion}`}
                trabajador={trabajador}
                contrato={abierto}
              />
              <Button type="submit" disabled={pending === "confirmar"}>
                {pending === "confirmar" ? "Guardando…" : "Confirmar y guardar contrato"}
              </Button>
            </form>
          ) : canWrite ? (
            <p className="text-sm text-muted-foreground">Cuando suba el firmado podrá confirmar y guardar los datos.</p>
          ) : null}
        </FormSection>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className={`${panelCardClass} overflow-x-auto p-0`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Versión</th>
              <th className="px-4 py-2 font-medium">Inicio</th>
              <th className="px-4 py-2 font-medium">Fin</th>
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
      <DateField label="Fecha de inicio" name="fecha_inicio" defaultValue={contrato?.fecha_inicio ?? trabajador.fecha_ingreso} />
      <DateField label="Fecha de cese" name="fecha_fin" defaultValue={contrato?.fecha_fin ?? trabajador.fecha_cese} />
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
