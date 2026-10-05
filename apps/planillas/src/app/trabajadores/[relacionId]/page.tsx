import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { entidadEtiqueta } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { parseFichaTab } from "@/components/ficha/FichaTabs";
import { FichaResumen } from "@/components/ficha/FichaResumen";
import { FichaVidaLey } from "@/components/ficha/FichaVidaLey";
import { FichaAsistencia } from "@/components/ficha/FichaAsistencia";
import { FichaVacaciones } from "@/components/ficha/FichaVacaciones";
import {
  puedeEditarFichaLaboral,
  puedeEscribirPlanillas,
  requirePlanillasProfile,
} from "@/lib/auth/access";
import { getEntidadPlanillas } from "@/lib/actions/entidades";
import { getTrabajador, listTrabajadores } from "@/lib/actions/trabajadores";
import {
  contextoEnviosVidaLey,
  getComprobanteVidaLeyEmpresa,
  getVidaLey,
  getVidaLeyLote,
  listContratos,
  listDocumentos,
  asegurarDocumentosVidaLey,
} from "@/lib/actions/ficha";
import { listVacaciones } from "@/lib/actions/vacaciones";
import { anioActualLima, esPeriodoVacacion, resumenPeriodoVacacion } from "@/lib/vacaciones";
import { mesActualLima } from "@/lib/horario-asistencia";
import {
  HORIZONTE_VENCIMIENTO_DIAS,
  contratoConfirmado,
  contratoMasReciente,
  contratoTienePdfPropio,
  contratoVigente,
  documentosAltaFaltantes,
  enlaceProcesoOperativo,
  enlaceProcesoPendiente,
  hrefAltaTrabajador,
  flujoDesdeTrabajador,
  resolverSiguientePaso,
} from "@/lib/flujo-ficha";
import { EliminarTrabajadorButton } from "@/components/ficha/EliminarTrabajadorButton";
import { FichaRutaTrabajador } from "@/components/ficha/FichaRutaTrabajador";
import { PendientesFichaButton, type PendienteFicha } from "@/components/ficha/PendientesFichaButton";
import { ESTADO_RELACION_LABEL, ESTADO_VALIDACION_ALTA_LABEL, etiquetaTrabajador, nombreCompleto, TIPO_DOCUMENTO_LABEL } from "@/lib/planillas-labels";

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
    redirect(`/contratos/${params.relacionId}?paso=contratos`);
  }
  if (tabRaw === "pensiones" || tabRaw === "t-registro" || tabRaw === "alta") {
    redirect(`/contratos/${params.relacionId}?paso=alta`);
  }

  const flujo = flujoDesdeTrabajador(trabajador);
  const siguiente = resolverSiguientePaso(flujo, esEstudio);
  const contratoVig = contratoConfirmado(flujo.contratos) ?? contratoVigente(flujo.contratos);
  const tab = parseFichaTab(tabRaw, esEstudio);
  const periodoVacacion = esPeriodoVacacion(searchParams.periodo) ? Number(searchParams.periodo) : anioActualLima();
  const fichaCesada = trabajador.estado === "CESADA";
  const canEditFicha = puedeEditarFichaLaboral(profile) && !fichaCesada;
  if (esEstudio && tab === "vida-ley" && !fichaCesada) {
    await asegurarDocumentosVidaLey(params.relacionId);
  }
  const [documentos, vidaLey, lote, enviosCtx, comprobanteEmpresa, vacaciones, contratos, entidad, companeros] =
    await Promise.all([
    listDocumentos(params.relacionId),
    esEstudio && (!tab || tab === "vida-ley")
      ? getVidaLey(params.relacionId)
      : Promise.resolve(null),
    esEstudio && tab === "vida-ley" ? getVidaLeyLote(params.relacionId) : Promise.resolve(null),
    esEstudio && tab === "vida-ley"
      ? contextoEnviosVidaLey(trabajador.entidad_id)
      : Promise.resolve({ porRelacion: [], envios: [] }),
    esEstudio && tab === "vida-ley"
      ? getComprobanteVidaLeyEmpresa(trabajador.entidad_id)
      : Promise.resolve(null),
    !tab || tab === "vacaciones" ? listVacaciones(params.relacionId) : Promise.resolve([]),
    !tab ? listContratos(params.relacionId) : Promise.resolve([]),
    getEntidadPlanillas(trabajador.entidad_id),
    listTrabajadores(trabajador.entidad_id),
  ]);
  const opcionesTrabajador = companeros.map((item) => ({
    id: item.id,
    etiqueta: `${etiquetaTrabajador(item.persona, item.numero)}${item.estado === "CESADA" ? " · Baja" : ""}`,
  }));
  const queryFicha = new URLSearchParams();
  if (tab) queryFicha.set("tab", tab);
  if (searchParams.periodo) queryFicha.set("periodo", searchParams.periodo);
  const rutaProceso =
    tab === "vida-ley"
      ? { raiz: "Vida Ley", hrefRaiz: `/vida-ley?entidadId=${trabajador.entidad_id}` }
      : tab === "asistencia"
        ? { raiz: "Asistencias", hrefRaiz: `/asistencias?entidadId=${trabajador.entidad_id}` }
        : tab === "vacaciones"
          ? {
              raiz: "Vacaciones",
              hrefRaiz: `/vacaciones?entidadId=${trabajador.entidad_id}&periodo=${periodoVacacion}`,
            }
          : null;
  const resumenVac = resumenPeriodoVacacion(vacaciones, trabajador.fecha_ingreso, periodoVacacion);
  const mes = mesActualLima();
  const periodo = anioActualLima();
  const hoy = new Date().toISOString().slice(0, 10);
  const pendientes: PendienteFicha[] = [];
  const ultimoContrato = contratoMasReciente(flujo.contratos);
  const faltaContratoFirmado = !contratoTienePdfPropio(ultimoContrato, flujo.documentos);
  if (!fichaCesada) {
    const docsHref = hrefAltaTrabajador(params.relacionId, "documentos");
    for (const tipo of documentosAltaFaltantes(flujo)) {
      pendientes.push({ id: tipo, etiqueta: TIPO_DOCUMENTO_LABEL[tipo], href: docsHref });
    }
    if (faltaContratoFirmado) {
      pendientes.push({
        id: "CONTRATO_FIRMADO",
        etiqueta: "Falta contrato firmado",
        href: hrefAltaTrabajador(params.relacionId),
      });
    }
    if (siguiente.rol !== "alerta" && siguiente.paso !== "listo") {
      const enlace = enlaceProcesoPendiente(params.relacionId, siguiente);
      const yaAvisaFirmado =
        faltaContratoFirmado && enlace?.etiqueta === "Subir contrato firmado o solicitud de registro";
      if (enlace && !yaAvisaFirmado) {
        pendientes.push({ id: `paso-${siguiente.paso}`, etiqueta: enlace.etiqueta, href: enlace.href });
      }
    } else if (siguiente.paso === "listo") {
      const operativo = enlaceProcesoOperativo({
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
        contratoCerrado: contratoVig?.estado === "RECOGIDO" || contratoVig?.estado === "COMPLETO",
        vidaLey,
        pdfAsistenciaMes: documentos.some(
          (d) => d.tipo === "ASISTENCIA" && d.observaciones === mes && Boolean(d.storage_path),
        ),
        diasVacacionPeriodo: vacaciones.filter((row) => row.periodo === periodo).reduce((sum, row) => sum + row.dias, 0),
        mes,
        periodo,
        hoy,
        limite: plusDays(hoy, HORIZONTE_VENCIMIENTO_DIAS),
      });
      if (operativo) pendientes.push({ id: "operativo", etiqueta: operativo.etiqueta, href: operativo.href });
    }
  }

  return (
    <PlanillasShell profile={profile} entidadId={trabajador.entidad_id}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <FichaRutaTrabajador
              entidadId={trabajador.entidad_id}
              empresa={entidad ? entidadEtiqueta(entidad) : "Empresa"}
              trabajadores={opcionesTrabajador}
              relacionId={params.relacionId}
              query={queryFicha.toString()}
              raiz={rutaProceso?.raiz}
              hrefRaiz={rutaProceso?.hrefRaiz}
            />
            <div className="flex shrink-0 items-center gap-2">
              <PendientesFichaButton pendientes={pendientes} />
              {esEstudio ? (
                <EliminarTrabajadorButton
                  relacionId={params.relacionId}
                  entidadId={trabajador.entidad_id}
                  nombre={nombreCompleto(trabajador.persona)}
                />
              ) : null}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-xl font-bold text-primary sm:text-2xl">
              {etiquetaTrabajador(trabajador.persona, trabajador.numero)}
            </h1>
            {tab ? (
              <Link
                href={`/trabajadores/${params.relacionId}`}
                title="Ver ficha"
                aria-label="Ver ficha"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-primary hover:bg-accent"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </Link>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            DNI {trabajador.persona.dni} · {ESTADO_RELACION_LABEL[trabajador.estado]}
            {trabajador.cargo ? ` · ${trabajador.cargo}` : ""}
            {` · ${ESTADO_VALIDACION_ALTA_LABEL[trabajador.validacion]}`}
          </p>
        </div>
        {fichaCesada ? (
          <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
            Esta ficha está de baja. Puede consultar todos sus datos.
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
            vidaLey={vidaLey}
            mostrarVidaLey={esEstudio}
            vidaLeyHref={`/trabajadores/${params.relacionId}?tab=vida-ley`}
          />
        ) : null}
        {esEstudio && tab === "vida-ley" ? (
          <FichaVidaLey
            relacionId={params.relacionId}
            trabajador={trabajador}
            vidaLey={vidaLey}
            documentoCertificado={documentos.find((d) => d.tipo === "VIDA_LEY") ?? null}
            lote={lote}
            companerosEnvio={companeros
              .filter((item) => item.id !== params.relacionId)
              .map((item) => ({
                relacionId: item.id,
                etiqueta: `${etiquetaTrabajador(item.persona, item.numero)}${item.estado === "CESADA" ? " · Baja" : ""}`,
                enEsteEnvio: Boolean(
                  lote && enviosCtx.porRelacion.some((row) => row.relacionId === item.id && row.loteId === lote.id),
                ),
                cesada: item.estado === "CESADA",
                otroEnvio: enviosCtx.porRelacion.some(
                  (row) =>
                    row.relacionId === item.id &&
                    Boolean(row.loteId) &&
                    row.loteId !== lote?.id &&
                    enviosCtx.envios.some((envio) => envio.loteId === row.loteId),
                ),
              }))
              .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"))}
            enviosExistentes={enviosCtx.envios
              .map((envio, index) => ({ ...envio, numero: index + 1 }))
              .filter((envio) => envio.loteId !== lote?.id)
              .map((envio) => {
                const nombres = envio.relacionIds
                  .map((id) => companeros.find((item) => item.id === id))
                  .filter((item): item is (typeof companeros)[number] => Boolean(item))
                  .map(
                    (item) =>
                      `${etiquetaTrabajador(item.persona, item.numero)}${item.estado === "CESADA" ? " · Baja" : ""}`,
                  );
                const quienes = nombres.slice(0, 3).join(", ");
                const resto = nombres.length > 3 ? ` y ${nombres.length - 3} más` : "";
                const archivos = [envio.constancia ? "constancia" : "", envio.factura ? "factura" : "sin factura"]
                  .filter(Boolean)
                  .join(", ");
                return {
                  loteId: envio.loteId,
                  etiqueta: `Grupo ${envio.numero}: ${quienes || "sin nombres"}${resto} · ${archivos}`,
                };
              })}
            comprobanteEmpresa={comprobanteEmpresa}
            canWrite={esEstudio && !fichaCesada}
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
