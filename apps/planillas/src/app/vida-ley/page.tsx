import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { GenerarVidaLeyGrupoButton } from "@/components/ficha/GenerarVidaLeyGrupoButton";
import { SinEmpresasPlanillas } from "@/components/ProcesoResumenCard";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEscribirPlanillas } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listVidaLeyEmpresa } from "@/lib/actions/ficha";
import { documentoCargado, HORIZONTE_VENCIMIENTO_DIAS } from "@/lib/flujo-ficha";
import {
  ETAPA_VIDA_LEY_FILTRO_LABEL,
  etiquetaEstadoVidaLey,
  compareTrabajadoresPorNumero,
  formatFechaPlanilla,
  formatNumeroTrabajador,
  nombreCompleto,
  parseEtapaVidaLeyFiltro,
  resolverEtapaVidaLey,
  vidaLeyPendienteRecepcion,
  type EtapaVidaLeyId,
} from "@/lib/planillas-labels";

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function hrefVidaLey(entidadId: string, etapa?: string) {
  const query = new URLSearchParams({ entidadId });
  if (etapa && etapa !== "todos") query.set("etapa", etapa);
  return `/vida-ley?${query.toString()}`;
}

function altaVidaLey(estado?: string | null): boolean {
  const value = estado?.trim();
  return value === "Registrado" || value === "Tramitado";
}

function Marca({ listo, etiqueta }: { listo: boolean; etiqueta: string }) {
  if (!listo) {
    return (
      <span className="text-amber-800" aria-label={`Falta ${etiqueta}`}>
        Falta
      </span>
    );
  }
  return (
    <span className="inline-flex text-emerald-700" title="Listo" aria-label={`${etiqueta} listo`}>
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function claseEtapaVidaLey(id: EtapaVidaLeyId) {
  if (id === "registrado") return "bg-emerald-100 text-emerald-950";
  if (id === "vence" || id === "recepcionado") return "bg-amber-100 text-amber-950";
  return "bg-sky-100 text-sky-950";
}

export default async function VidaLeyPage({
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
  const filtro = parseEtapaVidaLeyFiltro(searchParams.etapa);
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = plusDays(hoy, HORIZONTE_VENCIMIENTO_DIAS);
  const items = esEstudio && selectedId ? await listVidaLeyEmpresa(selectedId) : [];
  const filas = items
    .map((item) => ({
      ...item,
      etapa: resolverEtapaVidaLey(item.registro, { hoy, limite }),
    }))
    .sort((a, b) => {
      if (a.etapa.pendiente !== b.etapa.pendiente) return a.etapa.pendiente ? -1 : 1;
      return compareTrabajadoresPorNumero(a.trabajador, b.trabajador);
    });
  const visibles =
    filtro === "todos"
      ? filas
      : filtro === "pendientes"
        ? filas.filter((fila) => fila.etapa.pendiente)
        : filas.filter((fila) => fila.etapa.id === filtro);
  const cantidadGrupo = filas.filter((fila) => vidaLeyPendienteRecepcion(fila.registro?.estado)).length;

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-primary sm:text-2xl">Vida Ley</h1>
            {entidades.length > 0 ? (
              <>
                <span className="text-muted-foreground" aria-hidden>
                  &gt;
                </span>
                <EntidadSwitcher
                  entidades={entidades}
                  selectedId={selectedId}
                  locked={esUsuarioEntidad(profile.rol)}
                  hrefBase="/vida-ley"
                  queryExtra={filtro === "todos" ? undefined : `etapa=${filtro}`}
                  inline
                />
              </>
            ) : null}
          </div>
          {esEstudio && selectedId ? (
            <div className="flex max-w-xl flex-col items-end gap-2">
              <GenerarVidaLeyGrupoButton entidadId={selectedId} cantidad={cantidadGrupo} />
              <p className="text-right text-sm text-muted-foreground">
                Los trabajadores de este envío comparten la constancia, la factura y el comprobante. El certificado se
                sube en cada ficha. Quienes ya tenían un envío no se mueven.
              </p>
            </div>
          ) : null}
        </div>

        {entidades.length === 0 ? (
          <SinEmpresasPlanillas canCreate={canCreate} />
        ) : !esEstudio ? (
          <p className={`${panelCardClass} p-5 text-sm text-muted-foreground`}>
            Vida Ley lo gestiona el estudio. En la ficha del trabajador puede seguir el contrato, la asistencia y las
            vacaciones.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">
                {filtro === "todos" ? "Todos los trámites" : ETAPA_VIDA_LEY_FILTRO_LABEL[filtro]}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <p className="text-muted-foreground">
                  {visibles.length} de {filas.length}
                </p>
                {filtro !== "todos" ? (
                  <Link href={hrefVidaLey(selectedId)} className="text-primary hover:underline">
                    Ver todos
                  </Link>
                ) : null}
              </div>
            </div>

            <div className={`${panelCardClass} overflow-x-auto p-0`}>
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Nº</th>
                    <th className="px-4 py-2 font-medium">DNI</th>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Paso</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium">Certificado</th>
                    <th className="px-4 py-2 font-medium">Alta</th>
                    <th className="px-4 py-2 font-medium">Póliza</th>
                    <th className="px-4 py-2 font-medium">Inicio</th>
                    <th className="px-4 py-2 font-medium">Fin</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-muted-foreground" colSpan={10}>
                        {filas.length === 0
                          ? "No hay trabajadores con alta validada en esta empresa."
                          : "No hay trámites en este paso."}
                      </td>
                    </tr>
                  ) : (
                    visibles.map(({ trabajador, registro, etapa }) => (
                      <tr key={trabajador.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono">{formatNumeroTrabajador(trabajador.numero) || "—"}</td>
                        <td className="px-4 py-2 font-mono">{trabajador.persona.dni}</td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/trabajadores/${trabajador.id}?tab=vida-ley`}
                            className="font-medium text-primary hover:underline"
                          >
                            {nombreCompleto(trabajador.persona)}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${claseEtapaVidaLey(etapa.id)}`}
                          >
                            {etapa.etiqueta}
                          </span>
                        </td>
                        <td className="px-4 py-2">{etiquetaEstadoVidaLey(registro?.estado)}</td>
                        <td className="px-4 py-2">
                          <Marca
                            listo={documentoCargado(trabajador.documentos, "VIDA_LEY")}
                            etiqueta="certificado"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Marca listo={altaVidaLey(registro?.estado)} etiqueta="alta" />
                        </td>
                        <td className="px-4 py-2 font-mono">{registro?.numero_poliza?.trim() || "—"}</td>
                        <td className="px-4 py-2">{formatFechaPlanilla(registro?.fecha_inicio)}</td>
                        <td className="px-4 py-2">{formatFechaPlanilla(registro?.fecha_fin)}</td>
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
