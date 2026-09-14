import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { FichaFlujoNav, parseFichaTab } from "@/components/ficha/FichaTabs";
import { FichaPersonaForm, FichaPuestoForm } from "@/components/ficha/FichaDatosForm";
import { FichaAltaDocumentos } from "@/components/ficha/FichaAltaDocumentos";
import { FichaPensiones } from "@/components/ficha/FichaPensiones";
import { FichaTRegistro } from "@/components/ficha/FichaTRegistro";
import { FichaVidaLey } from "@/components/ficha/FichaVidaLey";
import { FichaAsistencia } from "@/components/ficha/FichaAsistencia";
import { FichaVacaciones } from "@/components/ficha/FichaVacaciones";
import { AceptarAltaButton } from "@/components/ficha/AceptarAltaButton";
import {
  puedeEditarFichaLaboral,
  puedeEscribirPlanillas,
  puedeValidarAlta,
  requirePlanillasProfile,
} from "@/lib/auth/access";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { getTrabajador } from "@/lib/actions/trabajadores";
import { getPension, getVidaLey, listDocumentos, listTRegistro, asegurarDocumentosAlta, asegurarDocumentoTramiteAfp, asegurarDocumentoTrAlta, asegurarDocumentosVidaLey } from "@/lib/actions/ficha";
import { listVacaciones } from "@/lib/actions/vacaciones";
import { anioActualLima, esPeriodoVacacion, resumenPeriodoVacacion } from "@/lib/vacaciones";
import {
  claseBadgePaso,
  estadoPasosAlta,
  flujoDesdeTrabajador,
  hrefPasoTrabajador,
  resolverSiguientePaso,
} from "@/lib/flujo-ficha";
import { ESTADO_RELACION_LABEL, ESTADO_VALIDACION_ALTA_LABEL, nombreCompleto } from "@/lib/planillas-labels";

export default async function FichaTrabajadorPage({
  params,
  searchParams,
}: {
  params: { relacionId: string };
  searchParams: { tab?: string; periodo?: string };
}) {
  const profile = await requirePlanillasProfile();
  const trabajador = await getTrabajador(params.relacionId);
  if (!trabajador) notFound();

  const esEstudio = puedeEscribirPlanillas(profile);
  const flujo = flujoDesdeTrabajador(trabajador);
  const completados = estadoPasosAlta(flujo);
  const siguiente = resolverSiguientePaso(flujo, esEstudio);
  const tab = searchParams.tab ? parseFichaTab(searchParams.tab, esEstudio) : siguiente.tab;
  if (tab === "contratos") redirect(`/contratos/${params.relacionId}`);
  const periodoVacacion = esPeriodoVacacion(searchParams.periodo) ? Number(searchParams.periodo) : anioActualLima();
  const canEditFicha = puedeEditarFichaLaboral(profile);
  const canWriteTramite = esEstudio;
  const porValidar = trabajador.validacion === "PENDIENTE";
  if (tab === "documentos" && canEditFicha) {
    await asegurarDocumentosAlta(params.relacionId);
  }
  if (esEstudio && tab === "pensiones") {
    await asegurarDocumentoTramiteAfp(params.relacionId);
  }
  if (esEstudio && tab === "t-registro") {
    await asegurarDocumentoTrAlta(params.relacionId);
  }
  if (esEstudio && tab === "vida-ley") {
    await asegurarDocumentosVidaLey(params.relacionId);
  }
  const [documentos, pension, vidaLey, tRegistro, entidad, vacaciones] = await Promise.all([
    listDocumentos(params.relacionId),
    tab === "pensiones" || tab === "documentos" || tab === "t-registro"
      ? getPension(params.relacionId)
      : Promise.resolve(null),
    tab === "vida-ley" ? getVidaLey(params.relacionId) : Promise.resolve(null),
    tab === "t-registro" ? listTRegistro(params.relacionId) : Promise.resolve([]),
    tab === "pensiones" ? getEntidadPlanillas(trabajador.entidad_id) : Promise.resolve(null),
    tab === "vacaciones" ? listVacaciones(params.relacionId) : Promise.resolve([]),
  ]);
  const resumenVac = resumenPeriodoVacacion(vacaciones, trabajador.fecha_ingreso, periodoVacacion);
  const continuar =
    siguiente.paso !== "listo" && siguiente.tab !== tab
      ? { href: hrefPasoTrabajador(params.relacionId, siguiente.tab), etiqueta: siguiente.etiqueta }
      : null;

  return (
    <PlanillasShell profile={profile} entidadId={trabajador.entidad_id}>
      <div className="space-y-6">
        <div>
          <Link href={`/?entidadId=${trabajador.entidad_id}`} className="text-sm text-primary hover:underline">
            ← Trabajadores
          </Link>
          <h1 className="mt-2 text-xl font-bold text-primary sm:text-2xl">{nombreCompleto(trabajador.persona)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DNI {trabajador.persona.dni} · {ESTADO_RELACION_LABEL[trabajador.estado]}
            {trabajador.cargo ? ` · ${trabajador.cargo}` : ""}
            {` · ${ESTADO_VALIDACION_ALTA_LABEL[trabajador.validacion]}`}
          </p>
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
                ? "Alta pendiente de validación. Revise documentos y contrato, y acepte el alta cuando corresponda."
                : "Alta pendiente de validación. Complete documentos y contrato; el estudio aceptará el alta."}
            </p>
            {puedeValidarAlta(profile) ? <AceptarAltaButton relacionId={params.relacionId} /> : (
              <p className="text-sm text-muted-foreground">El contador o el asistente deben aceptar este alta.</p>
            )}
          </div>
        ) : null}
        <FichaFlujoNav
          relacionId={params.relacionId}
          tab={tab}
          completados={completados}
          esEstudio={esEstudio}
        />
        {tab === "persona" ? <FichaPersonaForm trabajador={trabajador} canWrite={canEditFicha} /> : null}
        {tab === "puesto" ? <FichaPuestoForm trabajador={trabajador} canWrite={canEditFicha} /> : null}
        {tab === "documentos" ? (
          <FichaAltaDocumentos
            relacionId={params.relacionId}
            entidadId={trabajador.entidad_id}
            trabajador={trabajador}
            documentos={documentos}
            pension={pension}
            canWrite={canEditFicha}
          />
        ) : null}
        {esEstudio && tab === "pensiones" ? (
          <FichaPensiones
            relacionId={params.relacionId}
            pension={pension}
            trabajador={trabajador}
            entidad={entidad}
            documentoPension={documentos.find((d) => d.tipo === "PENSIONES_FIRMADO") ?? null}
            documentoTramiteAfp={documentos.find((d) => d.tipo === "TRAMITE_AFP") ?? null}
            canWrite={canWriteTramite}
          />
        ) : null}
        {esEstudio && tab === "t-registro" ? (
          <FichaTRegistro
            relacionId={params.relacionId}
            items={tRegistro}
            pension={pension}
            trabajador={trabajador}
            documentoDni={documentos.find((d) => d.tipo === "DNI") ?? null}
            documentoFicha={documentos.find((d) => d.tipo === "FICHA_DATOS") ?? null}
            documentoTrAlta={documentos.find((d) => d.tipo === "TR_ALTA") ?? null}
            canWrite={canWriteTramite}
          />
        ) : null}
        {esEstudio && tab === "vida-ley" ? (
          <FichaVidaLey
            relacionId={params.relacionId}
            trabajador={trabajador}
            vidaLey={vidaLey}
            documentoCertificado={documentos.find((d) => d.tipo === "VIDA_LEY") ?? null}
            documentoConstancia={documentos.find((d) => d.tipo === "VIDA_LEY_CONSTANCIA") ?? null}
            documentoFactura={documentos.find((d) => d.tipo === "VIDA_LEY_FACTURA") ?? null}
            documentoComprobante={documentos.find((d) => d.tipo === "VIDA_LEY_COMPROBANTE") ?? null}
            canWrite={canWriteTramite}
          />
        ) : null}
        {tab === "asistencia" ? (
          <FichaAsistencia
            relacionId={params.relacionId}
            entidadId={trabajador.entidad_id}
            documentos={documentos}
            canWrite={canEditFicha}
          />
        ) : null}
        {tab === "vacaciones" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                href={`/trabajadores/${params.relacionId}?tab=vacaciones&periodo=${periodoVacacion - 1}`}
                className="text-primary hover:underline"
              >
                {periodoVacacion - 1}
              </Link>
              <span className="font-medium text-foreground">{periodoVacacion}</span>
              <Link
                href={`/trabajadores/${params.relacionId}?tab=vacaciones&periodo=${periodoVacacion + 1}`}
                className="text-primary hover:underline"
              >
                {periodoVacacion + 1}
              </Link>
            </div>
            <FichaVacaciones
              relacionId={params.relacionId}
              periodo={periodoVacacion}
              derecho={resumenVac.derecho}
              diasTomados={resumenVac.diasTomados}
              saldo={resumenVac.saldo}
              registros={resumenVac.registros}
              canWrite={canEditFicha}
            />
          </div>
        ) : null}
        {continuar ? (
          <Link
            href={continuar.href}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Continuar: {continuar.etiqueta}
          </Link>
        ) : null}
      </div>
    </PlanillasShell>
  );
}
