"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { webAppById } from "@bd/config";
import { Button } from "@inventario/ui";
import { panelCardClass } from "@inventario/ui/panel";
import {
  addContrato,
  generarDocumentoContrato,
  marcarContratoRecogido,
  type ContratoRow,
} from "@/lib/actions/ficha";
import { ESTADO_CONTRATO_LABEL, formatFechaPlanilla, formatRemuneracion } from "@/lib/planillas-labels";
import { Field, DateField, FormSection } from "@/components/fields";

export function FichaContratos({
  relacionId,
  contratos,
  canWrite,
  canMarcarRecogido,
  tieneContratoFirmado,
}: {
  relacionId: string;
  contratos: ContratoRow[];
  canWrite: boolean;
  canMarcarRecogido: boolean;
  tieneContratoFirmado: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accionId, setAccionId] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await addContrato(relacionId, formData);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function onGenerar(contratoId: string) {
    setAccionId(contratoId);
    setError(null);
    const result = await generarDocumentoContrato(relacionId, contratoId);
    setAccionId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    window.open(`${webAppById("planillas").basePath}/trabajadores/${relacionId}/contrato`, "_blank");
  }

  async function onRecoger(contratoId: string) {
    setAccionId(contratoId);
    setError(null);
    const result = await marcarContratoRecogido(relacionId, contratoId);
    setAccionId(null);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Al generar el documento el contrato pasa a Elaborado. El trabajador firma y se sube el PDF en Documentos. Solo el
        contador o el asistente, al revisarlo, lo marcan Recogido.
      </p>
      <div className={`${panelCardClass} overflow-x-auto p-0`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Versión</th>
              <th className="px-4 py-2 font-medium">Inicio</th>
              <th className="px-4 py-2 font-medium">Fin</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Remuneración</th>
              <th className="px-4 py-2 font-medium">Vigente</th>
              <th className="px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  Aún no hay contratos.
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
                  <td className="px-4 py-2">{c.es_vigente ? "Sí" : "No"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {canWrite && (c.estado === "PENDIENTE_DOCS" || c.estado === "ELABORADO") ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={accionId === c.id}
                          onClick={() => void onGenerar(c.id)}
                        >
                          {accionId === c.id ? "Generando…" : "Generar documento"}
                        </Button>
                      ) : null}
                      {canMarcarRecogido && c.estado === "ELABORADO" ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={accionId === c.id || !tieneContratoFirmado}
                          onClick={() => void onRecoger(c.id)}
                          title={
                            tieneContratoFirmado
                              ? "Marcar como recogido tras revisar el PDF firmado"
                              : "Falta el PDF firmado en Documentos"
                          }
                        >
                          Marcar recogido
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
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {canWrite ? (
        <form action={onSubmit} key={contratos.length}>
          <FormSection title="Nueva versión" hint="Queda pendiente hasta generar el documento. Jornada y horario están en el puesto.">
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField label="Inicio" name="fecha_inicio" />
              <DateField label="Fin" name="fecha_fin" />
              <Field label="Remuneración" name="remuneracion" type="number" />
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" name="es_vigente" defaultChecked />
                Marcar como vigente
              </label>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar contrato"}
            </Button>
          </FormSection>
        </form>
      ) : null}
    </div>
  );
}
