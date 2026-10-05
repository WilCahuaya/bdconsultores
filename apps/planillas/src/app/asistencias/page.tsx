import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { AsistenciasMesBar, DescargarAsistenciaTrabajador } from "@/components/ficha/AsistenciasMesBar";
import { AsistenciaMesEstado, type EstadoAsistenciaMes } from "@/components/ficha/AsistenciaMesEstado";
import { AsistenciaNotaField } from "@/components/ficha/AsistenciaNotaField";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEditarFichaLaboral } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import { listarFeriadosMes, listDocumentosAsistenciaAnio } from "@/lib/actions/asistencias";
import { esMesAsistencia, MES_ABREV, mesActualLima, trabajadorActivoEnMes } from "@/lib/horario-asistencia";
import { compareTrabajadoresPorNumero, formatNumeroTrabajador, nombreCompleto } from "@/lib/planillas-labels";

function mesesDelAnio(anio: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${anio}-${String(index + 1).padStart(2, "0")}`);
}

function estadoAsistenciaMes(
  mes: string,
  mesHoy: string,
  fechaIngreso: string | null,
  fechaCese: string | null,
  subido: boolean,
): EstadoAsistenciaMes {
  if (subido) return "subido";
  if (mes > mesHoy || !trabajadorActivoEnMes(mes, fechaIngreso, fechaCese)) return "no-aplica";
  return "falta";
}

export default async function AsistenciasPage({
  searchParams,
}: {
  searchParams: { entidadId?: string; mes?: string };
}) {
  const profile = await requirePlanillasProfile();
  const canCreate = puedeCrearEntidad(profile);
  const canWrite = puedeEditarFichaLaboral(profile);
  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const mes = searchParams.mes && esMesAsistencia(searchParams.mes) ? searchParams.mes : mesActualLima();
  const mesHoy = mesActualLima();
  const anio = Number(mes.slice(0, 4));
  const meses = mesesDelAnio(anio);
  const [trabajadores, documentos, feriados] = selectedId
    ? await Promise.all([
        listTrabajadores(selectedId),
        listDocumentosAsistenciaAnio(selectedId, anio),
        listarFeriadosMes(selectedId, mes),
      ])
    : [[], [], []];
  const subidoPorRelacion = new Map<string, Set<string>>();
  const notaPorRelacion = new Map<string, string | null>();
  for (const documento of documentos) {
    if (documento.storage_path) {
      const mesesSubidos = subidoPorRelacion.get(documento.relacion_id) ?? new Set<string>();
      mesesSubidos.add(documento.mes);
      subidoPorRelacion.set(documento.relacion_id, mesesSubidos);
    }
    if (documento.mes === mes) notaPorRelacion.set(documento.relacion_id, documento.nota);
  }
  const activos = trabajadores
    .filter((t) => meses.some((item) => trabajadorActivoEnMes(item, t.fecha_ingreso, t.fecha_cese)))
    .sort(compareTrabajadoresPorNumero);
  let subidos = 0;
  let corresponden = 0;
  for (const trabajador of activos) {
    for (const item of meses) {
      const estado = estadoAsistenciaMes(
        item,
        mesHoy,
        trabajador.fecha_ingreso,
        trabajador.fecha_cese,
        subidoPorRelacion.get(trabajador.id)?.has(item) ?? false,
      );
      if (estado === "no-aplica") continue;
      corresponden += 1;
      if (estado === "subido") subidos += 1;
    }
  }
  const columnas = 16 + (canWrite ? 1 : 0);

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Asistencias</h1>
          {entidades.length > 0 ? (
            <>
              <span className="text-muted-foreground" aria-hidden>
                &gt;
              </span>
              <EntidadSwitcher
                entidades={entidades}
                selectedId={selectedId}
                locked={esUsuarioEntidad(profile.rol)}
                hrefBase="/asistencias"
                queryExtra={`mes=${mes}`}
                inline
              />
            </>
          ) : null}
        </div>

        {entidades.length === 0 ? (
          <div className={`${panelCardClass} space-y-2 p-5 text-sm text-muted-foreground`}>
            <p>No hay empresas con Planillas activas.</p>
            {canCreate ? (
              <Link href="/empresas/nueva" className="font-medium text-primary hover:underline">
                Crear empresa
              </Link>
            ) : (
              <p>Pida al contador que cree la empresa o active Planillas en Inventarios.</p>
            )}
          </div>
        ) : (
          <>
            {selectedId ? (
              <AsistenciasMesBar
                key={`${selectedId}-${mes}`}
                entidadId={selectedId}
                mesInicial={mes}
                feriadosIniciales={feriados}
                canWrite={canWrite}
              />
            ) : null}

            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">{anio}</h2>
                <p className="text-sm text-muted-foreground">
                  {corresponden > 0 ? `Subidos: ${subidos} de ${corresponden}` : "Aún no hay meses que correspondan."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <AsistenciaMesEstado estado="subido" etiqueta="" decorativo />
                  Subido
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <AsistenciaMesEstado estado="falta" etiqueta="" decorativo />
                  Falta
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <AsistenciaMesEstado estado="no-aplica" etiqueta="" decorativo />
                  No aplica
                </span>
              </div>
              <div className={`${panelCardClass} overflow-x-auto p-0`}>
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nº</th>
                      <th className="px-3 py-2 font-medium">DNI</th>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      {meses.map((item) => (
                        <th
                          key={item}
                          className={`px-1 py-2 text-center text-[11px] font-medium ${item === mes ? "bg-primary/10 text-foreground" : ""}`}
                        >
                          {MES_ABREV[Number(item.slice(5, 7)) - 1]}
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium">Observación</th>
                      {canWrite ? <th className="px-3 py-2 font-medium">Excel</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {activos.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-muted-foreground" colSpan={columnas}>
                          No hay trabajadores activos en {anio}.
                        </td>
                      </tr>
                    ) : (
                      activos.map((trabajador) => {
                        const mesesSubidos = subidoPorRelacion.get(trabajador.id);
                        return (
                          <tr key={trabajador.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2 font-mono align-middle">{formatNumeroTrabajador(trabajador.numero) || "—"}</td>
                            <td className="px-3 py-2 font-mono align-middle">{trabajador.persona.dni}</td>
                            <td className="px-3 py-2 align-middle">
                              <Link
                                href={`/trabajadores/${trabajador.id}?tab=asistencia&mes=${mes}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {nombreCompleto(trabajador.persona)}
                              </Link>
                            </td>
                            {meses.map((item) => {
                              const estado = estadoAsistenciaMes(
                                item,
                                mesHoy,
                                trabajador.fecha_ingreso,
                                trabajador.fecha_cese,
                                mesesSubidos?.has(item) ?? false,
                              );
                              const etiqueta = `${MES_ABREV[Number(item.slice(5, 7)) - 1]} ${anio}`;
                              return (
                                <td
                                  key={item}
                                  className={`px-1 py-2 text-center align-middle ${item === mes ? "bg-primary/10" : ""}`}
                                >
                                  <Link
                                    href={`/trabajadores/${trabajador.id}?tab=asistencia&mes=${item}`}
                                    className="inline-flex rounded-full hover:opacity-80"
                                  >
                                    <AsistenciaMesEstado estado={estado} etiqueta={etiqueta} />
                                  </Link>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 align-middle">
                              <AsistenciaNotaField
                                relacionId={trabajador.id}
                                mes={mes}
                                nota={notaPorRelacion.get(trabajador.id) ?? null}
                                canWrite={canWrite && trabajador.estado !== "CESADA"}
                                compact
                              />
                            </td>
                            {canWrite ? (
                              <td className="px-3 py-2 align-middle">
                                <DescargarAsistenciaTrabajador relacionId={trabajador.id} mes={mes} />
                              </td>
                            ) : null}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </PlanillasShell>
  );
}
