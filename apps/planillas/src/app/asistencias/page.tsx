import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { AsistenciasMesBar, DescargarAsistenciaTrabajador } from "@/components/ficha/AsistenciasMesBar";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEditarFichaLaboral } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import { listDocumentosAsistenciaMes } from "@/lib/actions/asistencias";
import { esMesAsistencia, etiquetaMesAsistencia, mesActualLima, trabajadorActivoEnMes } from "@/lib/horario-asistencia";
import { nombreCompleto } from "@/lib/planillas-labels";

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
  const [trabajadores, documentos] = selectedId
    ? await Promise.all([listTrabajadores(selectedId), listDocumentosAsistenciaMes(selectedId, mes)])
    : [[], []];
  const pdfPorRelacion = new Map(documentos.map((d) => [d.relacion_id, d]));
  const activos = trabajadores
    .filter((t) => trabajadorActivoEnMes(mes, t.fecha_ingreso, t.fecha_cese))
    .sort((a, b) => nombreCompleto(a.persona).localeCompare(nombreCompleto(b.persona), "es"));

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Asistencias</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Un Excel de la empresa (una hoja por persona) y un Excel por trabajador. Las horas salen del
            contrato. El PDF firmado se guarda en la ficha.
          </p>
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
            <EntidadSwitcher
              entidades={entidades}
              selectedId={selectedId}
              locked={esUsuarioEntidad(profile.rol)}
              hrefBase="/asistencias"
              queryExtra={`mes=${mes}`}
            />
            {selectedId ? (
              <AsistenciasMesBar key={`${selectedId}-${mes}`} entidadId={selectedId} mesInicial={mes} canWrite={canWrite} />
            ) : null}

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">{etiquetaMesAsistencia(mes)}</h2>
              <div className={`${panelCardClass} overflow-x-auto p-0`}>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">DNI</th>
                      <th className="px-4 py-2 font-medium">Nombre</th>
                      <th className="px-4 py-2 font-medium">PDF firmado</th>
                      {canWrite ? <th className="px-4 py-2 font-medium">Excel</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {activos.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-muted-foreground" colSpan={canWrite ? 4 : 3}>
                          No hay trabajadores activos en ese mes.
                        </td>
                      </tr>
                    ) : (
                      activos.map((trabajador) => {
                        const pdf = pdfPorRelacion.get(trabajador.id);
                        const subido = Boolean(pdf?.storage_path);
                        return (
                          <tr key={trabajador.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2 font-mono">{trabajador.persona.dni}</td>
                            <td className="px-4 py-2">
                              <Link
                                href={`/trabajadores/${trabajador.id}?tab=asistencia`}
                                className="font-medium text-primary hover:underline"
                              >
                                {nombreCompleto(trabajador.persona)}
                              </Link>
                            </td>
                            <td className="px-4 py-2">
                              {subido ? "Subido" : "Pendiente"}
                            </td>
                            {canWrite ? (
                              <td className="px-4 py-2">
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
