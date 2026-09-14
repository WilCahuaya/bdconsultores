import Link from "next/link";
import { notFound } from "next/navigation";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { AltaPasosNav } from "@/components/ficha/FichaTabs";
import { FichaContratos } from "@/components/ficha/FichaContratos";
import { AceptarAltaButton } from "@/components/ficha/AceptarAltaButton";
import {
  puedeEditarFichaLaboral,
  puedeEscribirPlanillas,
  puedeMarcarContratoRecogido,
  puedeValidarAlta,
  requirePlanillasProfile,
} from "@/lib/auth/access";
import { getTrabajador } from "@/lib/actions/trabajadores";
import { listContratos, listDocumentos } from "@/lib/actions/ficha";
import { claseBadgePaso, estadoPasosAlta, flujoDesdeTrabajador, resolverSiguientePaso } from "@/lib/flujo-ficha";
import { ESTADO_RELACION_LABEL, ESTADO_VALIDACION_ALTA_LABEL, nombreCompleto } from "@/lib/planillas-labels";

export default async function ContratoProcesoPage({
  params,
}: {
  params: { relacionId: string };
}) {
  const profile = await requirePlanillasProfile();
  const trabajador = await getTrabajador(params.relacionId);
  if (!trabajador) notFound();

  const esEstudio = puedeEscribirPlanillas(profile);
  const flujo = flujoDesdeTrabajador(trabajador);
  const completados = estadoPasosAlta(flujo);
  const siguiente = resolverSiguientePaso(flujo, esEstudio);
  const canEditFicha = puedeEditarFichaLaboral(profile);
  const porValidar = trabajador.validacion === "PENDIENTE";
  const [contratos, documentos] = await Promise.all([
    listContratos(params.relacionId),
    listDocumentos(params.relacionId),
  ]);

  return (
    <PlanillasShell profile={profile} entidadId={trabajador.entidad_id}>
      <div className="space-y-6">
        <div>
          <Link
            href={`/contratos?entidadId=${trabajador.entidad_id}`}
            className="text-sm text-primary hover:underline"
          >
            ← Contratos
          </Link>
          <h1 className="mt-2 text-xl font-bold text-primary sm:text-2xl">{nombreCompleto(trabajador.persona)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DNI {trabajador.persona.dni} · {ESTADO_RELACION_LABEL[trabajador.estado]}
            {trabajador.cargo ? ` · ${trabajador.cargo}` : ""}
            {` · ${ESTADO_VALIDACION_ALTA_LABEL[trabajador.validacion]}`}
          </p>
          <Link
            href={`/trabajadores/${params.relacionId}?tab=documentos`}
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            Ver ficha
          </Link>
        </div>
        <p className={`${panelCardClass} flex flex-wrap items-center gap-2 p-4 text-sm`}>
          <span className="text-muted-foreground">Siguiente paso</span>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${claseBadgePaso(siguiente.rol)}`}>
            {siguiente.etiqueta}
          </span>
        </p>
        {porValidar ? (
          <div className={`${panelCardClass} space-y-3 p-5`}>
            <p className="text-sm text-foreground">
              {esEstudio
                ? "Alta pendiente de validación. Revise el contrato y acepte el alta cuando corresponda."
                : "Alta pendiente de validación. Complete el contrato; el estudio aceptará el alta."}
            </p>
            {puedeValidarAlta(profile) ? (
              <AceptarAltaButton relacionId={params.relacionId} />
            ) : (
              <p className="text-sm text-muted-foreground">El contador o el asistente deben aceptar este alta.</p>
            )}
          </div>
        ) : null}
        <AltaPasosNav tab="contratos" completados={completados} relacionId={params.relacionId} />
        {!completados.documentos || !completados.persona || !completados.puesto ? (
          <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
            Falta completar el alta (documentos, persona o puesto) para generar el contrato.{" "}
            <Link
              href={`/trabajadores/${params.relacionId}?tab=${
                !completados.documentos ? "documentos" : !completados.persona ? "persona" : "puesto"
              }`}
              className="font-medium text-primary hover:underline"
            >
              Ir a la ficha
            </Link>
          </p>
        ) : null}
        <FichaContratos
          relacionId={params.relacionId}
          entidadId={trabajador.entidad_id}
          trabajador={trabajador}
          contratos={contratos}
          documentos={documentos}
          canWrite={canEditFicha}
          canMarcarRecogido={puedeMarcarContratoRecogido(profile)}
        />
      </div>
    </PlanillasShell>
  );
}
