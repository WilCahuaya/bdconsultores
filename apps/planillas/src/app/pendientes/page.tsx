import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { ProcesoResumenCard, SinEmpresasPlanillas } from "@/components/ProcesoResumenCard";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEscribirPlanillas } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listControlEmpresa } from "@/lib/actions/pendientes";
import { hrefPasoTrabajador } from "@/lib/flujo-ficha";
import type { PendienteItem } from "@/lib/planillas-labels";

function ApartadoTabla({
  items,
  vacio,
}: {
  items: PendienteItem[];
  vacio: string;
}) {
  return (
    <div className={`${panelCardClass} overflow-x-auto p-0`}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">DNI</th>
            <th className="px-4 py-2 font-medium">Nombre</th>
            <th className="px-4 py-2 font-medium">Pendiente</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-muted-foreground" colSpan={3}>
                {vacio}
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 font-mono">{item.dni}</td>
                <td className="px-4 py-2">
                  <Link
                    href={hrefPasoTrabajador(item.relacionId, item.tab)}
                    className="font-medium text-primary hover:underline"
                  >
                    {item.nombre}
                  </Link>
                </td>
                <td className="px-4 py-2">{item.detalle}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function PendientesPage({
  searchParams,
}: {
  searchParams: { entidadId?: string };
}) {
  const profile = await requirePlanillasProfile();
  const canCreate = puedeCrearEntidad(profile);
  const esEstudio = puedeEscribirPlanillas(profile);
  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const control = selectedId
    ? await listControlEmpresa(selectedId)
    : { contratos: [], vidaLey: [], asistencia: [], vacaciones: [] };
  const total =
    control.contratos.length +
    control.vidaLey.length +
    control.asistencia.length +
    control.vacaciones.length;
  const q = selectedId ? `?entidadId=${selectedId}` : "";

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Pendientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tablero de los cuatro procesos: contratos, Vida Ley, asistencias y vacaciones. El detalle se trabaja en
            cada apartado.
          </p>
        </div>

        {entidades.length === 0 ? (
          <SinEmpresasPlanillas canCreate={canCreate} />
        ) : (
          <>
            <EntidadSwitcher
              entidades={entidades}
              selectedId={selectedId}
              locked={esUsuarioEntidad(profile.rol)}
              hrefBase="/pendientes"
            />

            <div className={`grid gap-3 sm:grid-cols-2 ${esEstudio ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              <ProcesoResumenCard
                href={`/contratos${q}`}
                titulo="Contratos"
                cantidad={control.contratos.length}
                hint="Ver proceso"
              />
              {esEstudio ? (
                <ProcesoResumenCard
                  href={`/vida-ley${q}`}
                  titulo="Vida Ley"
                  cantidad={control.vidaLey.length}
                  hint="Ver proceso"
                />
              ) : null}
              <ProcesoResumenCard
                href={`/asistencias${q}`}
                titulo="Asistencias"
                cantidad={control.asistencia.length}
                hint="Ver mes"
              />
              <ProcesoResumenCard
                href={`/vacaciones${q}`}
                titulo="Vacaciones"
                cantidad={control.vacaciones.length}
                hint="Ver periodo"
              />
            </div>

            {total === 0 ? (
              <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
                No hay pendientes de control en esta empresa.
              </p>
            ) : null}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">Contratos</h2>
                {selectedId ? (
                  <Link href={`/contratos${q}`} className="text-sm font-medium text-primary hover:underline">
                    Ver proceso
                  </Link>
                ) : null}
              </div>
              <ApartadoTabla items={control.contratos} vacio="No hay contratos pendientes en esta empresa." />
            </section>

            {esEstudio ? (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-foreground">Vida Ley</h2>
                  {selectedId ? (
                    <Link href={`/vida-ley${q}`} className="text-sm font-medium text-primary hover:underline">
                      Ver proceso
                    </Link>
                  ) : null}
                </div>
                <ApartadoTabla items={control.vidaLey} vacio="No hay trámites de Vida Ley pendientes en esta empresa." />
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">Asistencias</h2>
                {selectedId ? (
                  <Link href={`/asistencias${q}`} className="text-sm font-medium text-primary hover:underline">
                    Ver mes
                  </Link>
                ) : null}
              </div>
              <ApartadoTabla items={control.asistencia} vacio="Todos los activos de este mes ya subieron el PDF firmado." />
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">Vacaciones</h2>
                {selectedId ? (
                  <Link href={`/vacaciones${q}`} className="text-sm font-medium text-primary hover:underline">
                    Ver periodo
                  </Link>
                ) : null}
              </div>
              <ApartadoTabla items={control.vacaciones} vacio="No hay saldos de vacaciones pendientes en este periodo." />
            </section>
          </>
        )}
      </div>
    </PlanillasShell>
  );
}
