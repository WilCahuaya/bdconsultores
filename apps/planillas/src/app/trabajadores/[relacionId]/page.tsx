import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { ProcesoDesdeFichaHeader, parseFichaTab } from "@/components/ficha/FichaTabs";
import { FichaResumen } from "@/components/ficha/FichaResumen";
import { FichaPensiones } from "@/components/ficha/FichaPensiones";
import { FichaTRegistro } from "@/components/ficha/FichaTRegistro";
import { FichaVidaLey } from "@/components/ficha/FichaVidaLey";
import { FichaAsistencia } from "@/components/ficha/FichaAsistencia";
import { FichaVacaciones } from "@/components/ficha/FichaVacaciones";
import {
  puedeEditarFichaLaboral,
  puedeEscribirPlanillas,
  requirePlanillasProfile,
} from "@/lib/auth/access";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { getTrabajador } from "@/lib/actions/trabajadores";
import {
  getPension,
  getVidaLey,
  listContratos,
  listDocumentos,
  listTRegistro,
  asegurarDocumentoTramiteAfp,
  asegurarDocumentoTrAlta,
  asegurarDocumentosVidaLey,
} from "@/lib/actions/ficha";
import { listVacaciones } from "@/lib/actions/vacaciones";
import { anioActualLima, esPeriodoVacacion, resumenPeriodoVacacion } from "@/lib/vacaciones";
import { mesActualLima } from "@/lib/horario-asistencia";
import {
  HORIZONTE_VENCIMIENTO_DIAS,
  enlaceProcesoOperativo,
  enlaceProcesoPendiente,
  flujoDesdeTrabajador,
  resolverSiguientePaso,
} from "@/lib/flujo-ficha";
import { ESTADO_RELACION_LABEL, ESTADO_VALIDACION_ALTA_LABEL, nombreCompleto } from "@/lib/planillas-labels";

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
  const tabRaw = searchParams.tab;
  if (tabRaw === "documentos" || tabRaw === "persona" || tabRaw === "puesto") {
    redirect(`/contratos/${params.relacionId}?paso=${tabRaw}`);
  }
  if (tabRaw === "contratos" || tabRaw === "firma") {
    redirect(`/contratos/${params.relacionId}`);
  }

  const flujo = flujoDesdeTrabajador(trabajador);
  const siguiente = resolverSiguientePaso(flujo, esEstudio);
  const tab = parseFichaTab(tabRaw, esEstudio);
  const periodoVacacion = esPeriodoVacacion(searchParams.periodo) ? Number(searchParams.periodo) : anioActualLima();
  const canEditFicha = puedeEditarFichaLaboral(profile);
  const canWriteTramite = esEstudio;
  if (esEstudio && tab === "pensiones") {
    await asegurarDocumentoTramiteAfp(params.relacionId);
  }
  if (esEstudio && tab === "t-registro") {
    await asegurarDocumentoTrAlta(params.relacionId);
  }
  if (esEstudio && tab === "vida-ley") {
    await asegurarDocumentosVidaLey(params.relacionId);
  }
  const [documentos, pension, vidaLey, tRegistro, entidad, vacaciones, contratos] = await Promise.all([
    listDocumentos(params.relacionId),
    tab === "pensiones" || tab === "t-registro" ? getPension(params.relacionId) : Promise.resolve(null),
    esEstudio && (tab === "vida-ley" || !tab)
      ? getVidaLey(params.relacionId)
      : Promise.resolve(null),
    tab === "t-registro" ? listTRegistro(params.relacionId) : Promise.resolve([]),
    tab === "pensiones" ? getEntidadPlanillas(trabajador.entidad_id) : Promise.resolve(null),
    !tab || tab === "vacaciones" ? listVacaciones(params.relacionId) : Promise.resolve([]),
    !tab ? listContratos(params.relacionId) : Promise.resolve([]),
  ]);
  const resumenVac = resumenPeriodoVacacion(vacaciones, trabajador.fecha_ingreso, periodoVacacion);
  const mes = mesActualLima();
  const periodo = anioActualLima();
  const hoy = new Date().toISOString().slice(0, 10);
  const proceso =
    enlaceProcesoPendiente(params.relacionId, siguiente) ??
    (!tab
      ? enlaceProcesoOperativo({
          entidadId: trabajador.entidad_id,
          relacionId: params.relacionId,
          esEstudio,
          estado: trabajador.estado,
          validacion: trabajador.validacion,
          fechaIngreso: trabajador.fecha_ingreso,
          fechaCese: trabajador.fecha_cese,
          pension: trabajador.pension,
          tRegistro: trabajador.tRegistro,
          documentos: trabajador.documentos,
          vidaLey,
          pdfAsistenciaMes: documentos.some(
            (d) => d.tipo === "ASISTENCIA" && d.observaciones === mes && Boolean(d.storage_path),
          ),
          diasVacacionPeriodo: vacaciones.filter((row) => row.periodo === periodo).reduce((sum, row) => sum + row.dias, 0),
          mes,
          periodo,
          hoy,
          limite: plusDays(hoy, HORIZONTE_VENCIMIENTO_DIAS),
        })
      : null);

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
        {tab ? (
          <ProcesoDesdeFichaHeader
            relacionId={params.relacionId}
            entidadId={trabajador.entidad_id}
            tab={tab}
          />
        ) : proceso ? (
          <p className={`${panelCardClass} flex flex-wrap items-center gap-2 p-4 text-sm`}>
            <span className="text-muted-foreground">Proceso pendiente</span>
            <Link href={proceso.href} className="font-medium text-primary hover:underline">
              {proceso.etiqueta}
            </Link>
          </p>
        ) : null}
        {!tab ? (
          <FichaResumen
            relacionId={params.relacionId}
            entidadId={trabajador.entidad_id}
            trabajador={trabajador}
            contratos={contratos}
            documentos={documentos}
            vacaciones={vacaciones}
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
              entidadId={trabajador.entidad_id}
              periodo={periodoVacacion}
              derecho={resumenVac.derecho}
              diasTomados={resumenVac.diasTomados}
              saldo={resumenVac.saldo}
              registros={resumenVac.registros}
              documentos={documentos}
              canWrite={canEditFicha}
            />
          </div>
        ) : null}
      </div>
    </PlanillasShell>
  );
}
