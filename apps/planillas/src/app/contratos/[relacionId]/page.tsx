import Link from "next/link";
import { notFound } from "next/navigation";
import { entidadEtiqueta } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { FichaRutaTrabajador } from "@/components/ficha/FichaRutaTrabajador";
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
import { getTrabajador, listTrabajadores } from "@/lib/actions/trabajadores";
import { listAdendas } from "@/lib/actions/adendas";
import {
  asegurarDocumentoTrAlta,
  asegurarDocumentoTrBaja,
  asegurarDocumentoTramiteAfp,
  asegurarDocumentosAlta,
  getPension,
  listContratos,
  listDocumentos,
  listTRegistro,
} from "@/lib/actions/ficha";
import { contextoSolicitudesRegistro } from "@/lib/actions/solicitudes-registro";
import { listHijosAsignacion } from "@/lib/actions/hijos-asignacion";
import {
  estadoPasosAlta,
  faltasPorPaso,
  flujoDesdeTrabajador,
  parseContratoPaso,
  pasoAltaInicial,
} from "@/lib/flujo-ficha";
import { ESTADO_RELACION_LABEL, ESTADO_VALIDACION_ALTA_LABEL, etiquetaTrabajador } from "@/lib/planillas-labels";

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
      asegurarDocumentoTrBaja(params.relacionId),
    ]);
  }
  const [contratos, documentos, adendas, pension, tRegistro, entidad, solicitudesCtx, hijosAsignacion, companeros] =
    await Promise.all([
      listContratos(params.relacionId),
      listDocumentos(params.relacionId),
      paso === "contratos" ? listAdendas(params.relacionId) : Promise.resolve([]),
      paso === "documentos" || paso === "alta" ? getPension(params.relacionId) : Promise.resolve(null),
      paso === "alta" ? listTRegistro(params.relacionId) : Promise.resolve([]),
      getEntidadPlanillas(trabajador.entidad_id),
      paso === "contratos"
        ? contextoSolicitudesRegistro(trabajador.entidad_id)
        : Promise.resolve({ solicitudes: [], enlazables: [] }),
      paso === "documentos" ? listHijosAsignacion(params.relacionId) : Promise.resolve([]),
      listTrabajadores(trabajador.entidad_id),
    ]);
  const opcionesTrabajador = companeros.map((item) => ({
    id: item.id,
    etiqueta: `${etiquetaTrabajador(item.persona, item.numero)}${item.estado === "CESADA" ? " · Baja" : ""}`,
  }));

  return (
    <PlanillasShell profile={profile} entidadId={trabajador.entidad_id}>
      <div className="ficha-proceso-page">
        <div className="shrink-0 space-y-3 pb-4">
          <div className="flex items-center gap-2">
            <h1 className="sr-only">{etiquetaTrabajador(trabajador.persona, trabajador.numero)}</h1>
            <FichaRutaTrabajador
              entidadId={trabajador.entidad_id}
              empresa={entidad ? entidadEtiqueta(entidad) : "Empresa"}
              trabajadores={opcionesTrabajador}
              relacionId={params.relacionId}
              raiz="Contrato"
              hrefRaiz={`/contratos?entidadId=${trabajador.entidad_id}`}
              destinoPrefijo="/contratos/"
              destinoSufijo={`?paso=${paso}`}
            />
            <p className="hidden min-w-0 max-w-[46%] truncate text-xs text-muted-foreground lg:block">
              DNI {trabajador.persona.dni} · {ESTADO_RELACION_LABEL[trabajador.estado]}
              {trabajador.cargo ? ` · ${trabajador.cargo}` : ""}
              {` · ${ESTADO_VALIDACION_ALTA_LABEL[trabajador.validacion]}`}
            </p>
            <Link
              href={`/trabajadores/${params.relacionId}`}
              title="Ver ficha"
              aria-label="Ver ficha"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-primary hover:bg-accent"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Link>
          </div>
          <p className="truncate text-xs leading-4 text-muted-foreground lg:hidden">
            DNI {trabajador.persona.dni} · {ESTADO_RELACION_LABEL[trabajador.estado]}
            {trabajador.cargo ? ` · ${trabajador.cargo}` : ""}
            {` · ${ESTADO_VALIDACION_ALTA_LABEL[trabajador.validacion]}`}
          </p>
          {fichaCesada ? (
            <p className={`${panelCardClass} px-3 py-1.5 text-xs text-muted-foreground`}>
              Esta ficha está de baja. Puede ver los datos y documentos; no se editan.
            </p>
          ) : null}
          {porValidar ? (
            <div className={`${panelCardClass} flex flex-wrap items-center justify-between gap-2 px-3 py-1.5`}>
              <p className="text-xs text-foreground">
                {esEstudio
                  ? "Alta pendiente de validación. Revise el contrato y acepte el alta cuando corresponda."
                  : "Alta pendiente de validación. Complete el contrato; el estudio aceptará el alta."}
              </p>
              {puedeValidarAlta(profile) ? (
                <AceptarAltaButton relacionId={params.relacionId} />
              ) : (
                <p className="text-xs text-muted-foreground">El contador o el asistente deben aceptar este alta.</p>
              )}
            </div>
          ) : null}
          <AltaPasosNav tab={paso} completados={completados} faltas={faltas} relacionId={params.relacionId} />
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-2">
        {paso === "documentos" ? (
          <FichaAltaDocumentos
            relacionId={params.relacionId}
            entidadId={trabajador.entidad_id}
            trabajador={trabajador}
            documentos={documentos}
            pension={pension}
            hijos={hijosAsignacion}
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
              solicitudes={solicitudesCtx.solicitudes}
              enlazables={solicitudesCtx.enlazables}
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
              documentoTrBaja={documentos.find((d) => d.tipo === "TR_BAJA") ?? null}
              canWrite={esEstudio && !fichaCesada}
            />
          </div>
        ) : null}
        </div>
      </div>
    </PlanillasShell>
  );
}
