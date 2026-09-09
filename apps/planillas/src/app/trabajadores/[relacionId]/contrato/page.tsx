import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ficha/PrintButton";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { listContratos } from "@/lib/actions/ficha";
import { getTrabajador } from "@/lib/actions/trabajadores";
import { requirePlanillasProfile } from "@/lib/auth/access";
import { formatHorarioContrato } from "@/lib/horario-laboral";
import {
  JORNADA_LABEL,
  formatFechaPlanilla,
  formatRemuneracion,
  nombreCompleto,
} from "@/lib/planillas-labels";

export default async function ContratoDocumentoPage({ params }: { params: { relacionId: string } }) {
  await requirePlanillasProfile();
  const trabajador = await getTrabajador(params.relacionId);
  if (!trabajador) notFound();
  const [entidad, contratos] = await Promise.all([
    getEntidadPlanillas(trabajador.entidad_id),
    listContratos(params.relacionId),
  ]);
  if (!entidad) notFound();
  const contrato = contratos.find((c) => c.es_vigente) ?? contratos[0];
  if (!contrato) notFound();

  const persona = nombreCompleto(trabajador.persona);

  return (
    <div className="mx-auto max-w-3xl space-y-8 bg-background p-8 text-foreground print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/trabajadores/${params.relacionId}?tab=contratos`} className="text-sm text-primary hover:underline">
          ← Volver a la ficha
        </Link>
        <PrintButton />
      </div>
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-primary">Contrato de trabajo</p>
      <section className="space-y-2 text-sm">
        <h2 className="text-base font-medium">Empresa</h2>
        <p>{entidad.nombre}</p>
        {entidad.ruc ? <p>RUC {entidad.ruc}</p> : null}
        {entidad.direccion ? <p>{entidad.direccion}</p> : null}
        {entidad.representante_legal_nombre ? (
          <p>
            Representante legal: {entidad.representante_legal_nombre}
            {entidad.representante_legal_dni ? ` · DNI ${entidad.representante_legal_dni}` : ""}
            {entidad.representante_legal_cargo ? ` · ${entidad.representante_legal_cargo}` : ""}
          </p>
        ) : null}
      </section>
      <section className="space-y-2 text-sm">
        <h2 className="text-base font-medium">Trabajador</h2>
        <p>{persona}</p>
        <p>DNI {trabajador.persona.dni}</p>
        {trabajador.persona.direccion ? <p>{trabajador.persona.direccion}</p> : null}
      </section>
      <section className="space-y-2 text-sm">
        <h2 className="text-base font-medium">Puesto y contrato</h2>
        <p>Cargo: {trabajador.cargo ?? "—"}</p>
        <p>Jornada: {trabajador.jornada ? JORNADA_LABEL[trabajador.jornada] : "—"}</p>
        <div>
          <p>Jornada y horario</p>
          <div className="whitespace-pre-line">{formatHorarioContrato(trabajador.horario)}</div>
        </div>
        <p>Inicio: {formatFechaPlanilla(contrato.fecha_inicio)}</p>
        <p>Fin: {formatFechaPlanilla(contrato.fecha_fin)}</p>
        <p>Remuneración: {formatRemuneracion(contrato.remuneracion)}</p>
      </section>
      <p className="text-xs text-muted-foreground print:hidden">
        Documento generado para firma. El Word con plantilla legal se agregará después. Imprima o guarde en PDF, haga
        firmar y suba el archivo en Documentos (Contrato firmado).
      </p>
    </div>
  );
}
