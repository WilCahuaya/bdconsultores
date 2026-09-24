import Link from "next/link";
import { notFound } from "next/navigation";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { AltaPasosNav } from "@/components/ficha/FichaTabs";
import { FichaAltaDocumentos } from "@/components/ficha/FichaAltaDocumentos";
import { FichaPersonaForm, FichaPuestoForm } from "@/components/ficha/FichaDatosForm";
import { FichaContratos } from "@/components/ficha/FichaContratos";
import { FichaAdendas } from "@/components/ficha/FichaAdendas";
import { FichaPensiones } from "@/components/ficha/FichaPensiones";
import { FichaTRegistro } from "@/components/ficha/FichaTRegistro";
import { AceptarAltaButton } from "@/components/ficha/AceptarAltaButton";
import {
  puedeEditarFichaLaboral,
  puedeEscribirPlanillas,
  puedeMarcarContratoRecogido,
  puedeValidarAlta,
  requirePlanillasProfile,
} from "@/lib/auth/access";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { getTrabajador } from "@/lib/actions/trabajadores";
import { listAdendas } from "@/lib/actions/adendas";
import {
  asegurarDocumentoTrAlta,
  asegurarDocumentoTramiteAfp,
  asegurarDocumentosAlta,
  getPension,
  listContratos,
  listDocumentos,
  listTRegistro,
} from "@/lib/actions/ficha";
import {
  estadoPasosAlta,
  faltasPorPaso,
  flujoDesdeTrabajador,
  parseContratoPaso,
  pasoAltaInicial,
} from "@/lib/flujo-ficha";
import { ESTADO_RELACION_LABEL, ESTADO_VALIDACION_ALTA_LABEL, nombreCompleto } from "@/lib/planillas-labels";

export default async function ContratoProcesoPage({
  params,
  searchParams,
}: {
  params: { relacionId: string };
  searchParams: { paso?: string };
}) {
  const profile = await requirePlanillasProfile();
  const trabajador = await getTrabajador(params.relacionId);
  if (!trabajador) notFound();

  const esEstudio = puedeEscribirPlanillas(profile);
  const flujo = flujoDesdeTrabajador(trabajador);
  const faltas = faltasPorPaso(flujo);
  const completados = estadoPasosAlta(flujo);
  const fichaCesada = trabajador.estado === "CESADA";
  const canEditFicha = puedeEditarFichaLaboral(profile) && !fichaCesada;
  const porValidar = trabajador.validacion === "PENDIENTE" && !fichaCesada;
  const paso = searchParams.paso ? parseContratoPaso(searchParams.paso) : pasoAltaInicial(completados);
  if (paso === "documentos" && canEditFicha) {
    await asegurarDocumentosAlta(params.relacionId);
  }
  if (paso === "alta" && esEstudio && !fichaCesada) {
    await Promise.all([
      asegurarDocumentoTramiteAfp(params.relacionId),
      asegurarDocumentoTrAlta(params.relacionId),
    ]);
  }
  const [contratos, documentos, adendas, pension, tRegistro, entidad] = await Promise.all([
    listContratos(params.relacionId),
    listDocumentos(params.relacionId),
    paso === "contratos" ? listAdendas(params.relacionId) : Promise.resolve([]),
    paso === "documentos" || paso === "alta" ? getPension(params.relacionId) : Promise.resolve(null),
    paso === "alta" ? listTRegistro(params.relacionId) : Promise.resolve([]),
    paso === "alta" ? getEntidadPlanillas(trabajador.entidad_id) : Promise.resolve(null),
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
            href={`/trabajadores/${params.relacionId}`}
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            Ver ficha
          </Link>
        </div>
        {fichaCesada ? (
          <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
            Esta ficha está de baja. Puede ver los datos y documentos; no se editan.
          </p>
        ) : null}
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
        <AltaPasosNav tab={paso} completados={completados} faltas={faltas} relacionId={params.relacionId} />
        {paso === "documentos" ? (
          <FichaAltaDocumentos
            relacionId={params.relacionId}
            entidadId={trabajador.entidad_id}
            trabajador={trabajador}
            documentos={documentos}
            pension={pension}
            canWrite={canEditFicha}
          />
        ) : null}
        {paso === "persona" ? <FichaPersonaForm trabajador={trabajador} canWrite={canEditFicha} /> : null}
        {paso === "puesto" ? <FichaPuestoForm trabajador={trabajador} canWrite={canEditFicha} /> : null}
        {paso === "contratos" ? (
          <>
            <FichaContratos
              relacionId={params.relacionId}
              entidadId={trabajador.entidad_id}
              trabajador={trabajador}
              contratos={contratos}
              documentos={documentos}
              canWrite={canEditFicha}
              canMarcarRecogido={puedeMarcarContratoRecogido(profile) && !fichaCesada}
            />
            <FichaAdendas
              relacionId={params.relacionId}
              entidadId={trabajador.entidad_id}
              trabajador={trabajador}
              contratos={contratos}
              adendas={adendas}
              canWrite={canEditFicha}
              canMarcarRecogido={puedeMarcarContratoRecogido(profile) && !fichaCesada}
            />
          </>
        ) : null}
        {paso === "alta" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              El estudio da de alta AFP y T-Registro aquí, en Contratos. Si es ONP, no hay alta AFP. Después se
              registra el alta en T-Registro.
            </p>
            <FichaPensiones
              relacionId={params.relacionId}
              pension={pension}
              trabajador={trabajador}
              entidad={entidad}
              documentoPension={documentos.find((d) => d.tipo === "PENSIONES_FIRMADO") ?? null}
              documentoTramiteAfp={documentos.find((d) => d.tipo === "TRAMITE_AFP") ?? null}
              canWrite={esEstudio && !fichaCesada}
            />
            <FichaTRegistro
              relacionId={params.relacionId}
              items={tRegistro}
              pension={pension}
              trabajador={trabajador}
              documentoDni={documentos.find((d) => d.tipo === "DNI") ?? null}
              documentoFicha={documentos.find((d) => d.tipo === "FICHA_DATOS") ?? null}
              documentoTrAlta={documentos.find((d) => d.tipo === "TR_ALTA") ?? null}
              canWrite={esEstudio && !fichaCesada}
            />
          </div>
        ) : null}
      </div>
    </PlanillasShell>
  );
}
