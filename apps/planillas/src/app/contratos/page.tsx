import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { SinEmpresasPlanillas } from "@/components/ProcesoResumenCard";
import { MarcasDocumentoContrato, VersionesContratoButton, type VersionContratoLista } from "@/components/ficha/VersionesContratoButton";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEscribirPlanillas } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import {
  claseTonoEstadoContrato,
  contratoMasReciente,
  documentoCargado,
  estadoVisibleContrato,
  ETAPA_CONTRATO_FILTRO_LABEL,
  faltasPorPaso,
  flujoDesdeTrabajador,
  hrefPasoTrabajador,
  HORIZONTE_VENCIMIENTO_DIAS,
  parseEtapaContratoFiltro,
  pensionAltaLista,
  resolverEtapaContrato,
  tRegistroAltaLista,
} from "@/lib/flujo-ficha";
import { compareTrabajadoresPorNumero, formatFechaPlanilla, formatNumeroTrabajador, nombreCompleto } from "@/lib/planillas-labels";

function Marca({ listo }: { listo: boolean }) {
  if (!listo) return <span className="text-amber-800">Falta</span>;
  return (
    <span className="inline-flex text-emerald-700" title="Listo" aria-label="Listo">
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function hrefContratos(entidadId: string, etapa?: string) {
  const query = new URLSearchParams({ entidadId });
  if (etapa && etapa !== "todos") query.set("etapa", etapa);
  return `/contratos?${query.toString()}`;
}

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: { entidadId?: string; etapa?: string };
}) {
  const profile = await requirePlanillasProfile();
  const canCreate = puedeCrearEntidad(profile);
  const esEstudio = puedeEscribirPlanillas(profile);
  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const filtro = parseEtapaContratoFiltro(searchParams.etapa);
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = plusDays(hoy, HORIZONTE_VENCIMIENTO_DIAS);
  const trabajadores = selectedId ? await listTrabajadores(selectedId) : [];
  const filas = trabajadores
    .map((trabajador) => {
      const flujo = flujoDesdeTrabajador(trabajador);
      const faltas = faltasPorPaso(flujo);
      const ultimo = contratoMasReciente(flujo.contratos);
      const alta = tRegistroAltaLista(flujo);
      const versiones: VersionContratoLista[] = flujo.contratos
        .filter((contrato) => contrato.estado !== "BAJA")
        .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
        .map((contrato, index) => {
          const visible = estadoVisibleContrato(contrato, flujo.documentos, alta && index === 0);
          return {
            version: contrato.version ?? 0,
            fechas: `${formatFechaPlanilla(contrato.fecha_inicio)} – ${formatFechaPlanilla(contrato.fecha_fin)}`,
            estado: visible.etiqueta,
            pdf: visible.pdf,
            solicitud: visible.solicitud,
            tono: visible.tono,
            vigente: contrato.es_vigente,
          };
        });
      return {
        trabajador,
        flujo,
        faltas,
        ultimo,
        versiones,
        etapa: resolverEtapaContrato(trabajador, esEstudio, { hoy, limite }),
      };
    })
    .sort((a, b) => compareTrabajadoresPorNumero(a.trabajador, b.trabajador));
  const visibles =
    filtro === "todos"
      ? filas
      : filtro === "pendientes"
        ? filas.filter((fila) => fila.etapa.pendiente)
        : filas.filter((fila) => fila.etapa.id === filtro);

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Contrato</h1>
          {entidades.length > 0 ? (
            <>
              <span className="text-muted-foreground" aria-hidden>
                &gt;
              </span>
              <EntidadSwitcher
                entidades={entidades}
                selectedId={selectedId}
                locked={esUsuarioEntidad(profile.rol)}
                hrefBase="/contratos"
                queryExtra={filtro === "todos" ? undefined : `etapa=${filtro}`}
                inline
              />
            </>
          ) : null}
        </div>

        {entidades.length === 0 ? (
          <SinEmpresasPlanillas canCreate={canCreate} />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">
                {filtro === "todos" ? "Todos los contratos" : ETAPA_CONTRATO_FILTRO_LABEL[filtro]}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <p className="text-muted-foreground">
                  {visibles.length} de {filas.length}
                </p>
                {filtro !== "todos" ? (
                  <Link href={hrefContratos(selectedId)} className="text-primary hover:underline">
                    Ver todos
                  </Link>
                ) : null}
              </div>
            </div>

            <div className={`${panelCardClass} overflow-x-auto p-0`}>
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nº</th>
                    <th className="px-3 py-2 font-medium">DNI</th>
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Doc. DNI</th>
                    <th className="px-3 py-2 font-medium">Ficha</th>
                    <th className="px-3 py-2 font-medium">Pensiones</th>
                    <th className="px-3 py-2 font-medium">Persona</th>
                    <th className="px-3 py-2 font-medium">Puesto</th>
                    <th className="px-3 py-2 font-medium">Contrato</th>
                    <th className="px-3 py-2 font-medium">AFP</th>
                    <th className="px-3 py-2 font-medium">T-Registro</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-muted-foreground" colSpan={12}>
                        {filas.length === 0
                          ? "No hay trabajadores en esta empresa."
                          : "No hay contratos en este paso."}
                      </td>
                    </tr>
                  ) : (
                    visibles.map(({ trabajador, flujo, faltas, ultimo, versiones, etapa }) => (
                      <tr key={trabajador.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono">{formatNumeroTrabajador(trabajador.numero) || "—"}</td>
                        <td className="px-3 py-2 font-mono">{trabajador.persona.dni}</td>
                        <td className="px-3 py-2">
                          <Link
                            href={hrefPasoTrabajador(trabajador.id, etapa.tab)}
                            className="font-medium text-primary hover:underline"
                          >
                            {nombreCompleto(trabajador.persona)}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <Marca listo={documentoCargado(flujo.documentos, "DNI")} />
                        </td>
                        <td className="px-3 py-2">
                          <Marca listo={documentoCargado(flujo.documentos, "FICHA_DATOS")} />
                        </td>
                        <td className="px-3 py-2">
                          <Marca listo={documentoCargado(flujo.documentos, "PENSIONES_FIRMADO")} />
                        </td>
                        <td className="px-3 py-2">
                          <Marca listo={faltas.persona.length === 0} />
                        </td>
                        <td className="px-3 py-2">
                          <Marca listo={faltas.puesto.length === 0} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {ultimo?.fecha_inicio || ultimo?.fecha_fin ? (
                            <span className="inline-flex items-center gap-1.5">
                              <VersionesContratoButton versiones={versiones} />
                              {formatFechaPlanilla(ultimo.fecha_inicio)} – {formatFechaPlanilla(ultimo.fecha_fin)}
                            </span>
                          ) : (
                            <span className="text-amber-800">Falta</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Marca listo={pensionAltaLista(flujo)} />
                        </td>
                        <td className="px-3 py-2">
                          <Marca listo={tRegistroAltaLista(flujo)} />
                        </td>
                        <td className="px-3 py-2">
                          {versiones[0] ? (
                            <div className="space-y-1">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${claseTonoEstadoContrato(versiones[0].tono)}`}
                              >
                                {versiones[0].estado}
                              </span>
                              <MarcasDocumentoContrato pdf={versiones[0].pdf} solicitud={versiones[0].solicitud} />
                            </div>
                          ) : (
                            "Falta"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PlanillasShell>
  );
}
