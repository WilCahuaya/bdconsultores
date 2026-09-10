import Link from "next/link";
import { notFound } from "next/navigation";
import { webAppById } from "@bd/config";
import { PrintButton } from "@/components/ficha/PrintButton";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { listContratos } from "@/lib/actions/ficha";
import { getTrabajador } from "@/lib/actions/trabajadores";
import { requirePlanillasProfile } from "@/lib/auth/access";
import { cargoCanonico, funcionesDeCargo } from "@/lib/cargos-funciones";
import { HorarioContratoVista } from "@/components/ficha/HorarioContratoVista";
import {
  JORNADA_LABEL,
  formatFechaPlanilla,
  formatRemuneracion,
  nombreCompleto,
} from "@/lib/planillas-labels";

export default async function ContratoDocumentoPage({
  params,
  searchParams,
}: {
  params: { relacionId: string };
  searchParams: { contratoId?: string };
}) {
  await requirePlanillasProfile();
  const trabajador = await getTrabajador(params.relacionId);
  if (!trabajador) notFound();
  const [entidad, contratos] = await Promise.all([
    getEntidadPlanillas(trabajador.entidad_id),
    listContratos(params.relacionId),
  ]);
  if (!entidad) notFound();
  const contrato =
    (searchParams.contratoId ? contratos.find((c) => c.id === searchParams.contratoId) : null) ??
    contratos.find((c) => !c.datos_confirmados && c.estado === "ELABORADO") ??
    contratos.find((c) => c.es_vigente) ??
    contratos[0];
  if (!contrato) notFound();

  const persona = nombreCompleto(trabajador.persona);
  const cargo = contrato.cargo ?? trabajador.cargo;
  const cargoNombre = cargoCanonico(cargo) ?? cargo;
  const funciones = funcionesDeCargo(cargo);
  const jornada = contrato.jornada ?? trabajador.jornada;
  const horario = contrato.horario ?? trabajador.horario;
  const wordHref = `${webAppById("planillas").basePath}/api/contratos/${params.relacionId}/word?contratoId=${contrato.id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-8 bg-background p-8 text-foreground print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/trabajadores/${params.relacionId}?tab=contratos`} className="text-sm text-primary hover:underline">
          ← Volver a la ficha
        </Link>
        <div className="flex gap-4">
          <a href={wordHref} className="text-sm text-primary hover:underline">
            Descargar Word
          </a>
          <PrintButton />
        </div>
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
        <p>Cargo: {cargoNombre ?? "—"}</p>
        <p>Jornada: {jornada ? JORNADA_LABEL[jornada] : "—"}</p>
        <div>
          <p>Jornada y horario</p>
          <HorarioContratoVista className="mt-1" value={horario} />
        </div>
        <p>Inicio de contrato: {formatFechaPlanilla(contrato.fecha_inicio)}</p>
        <p>Fin de contrato: {formatFechaPlanilla(contrato.fecha_fin)}</p>
        <p>Remuneración: {formatRemuneracion(contrato.remuneracion)}</p>
      </section>
      {funciones.length > 0 ? (
        <section className="space-y-2 text-sm">
          <h2 className="text-base font-medium">Funciones</h2>
          <ol className="list-decimal space-y-1 pl-5">
            {funciones.map((fn) => (
              <li key={fn}>{fn}</li>
            ))}
          </ol>
        </section>
      ) : null}
      <p className="text-xs text-muted-foreground print:hidden">
        El documento para firmar es el Word. Esta vista es solo una referencia. Haga firmar el Word (o su PDF) y súbalo
        en el paso Contrato.
      </p>
    </div>
  );
}
