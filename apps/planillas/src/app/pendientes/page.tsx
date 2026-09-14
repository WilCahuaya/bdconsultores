import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEscribirPlanillas } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listControlEmpresa } from "@/lib/actions/pendientes";
import { listTrabajadoresVidaLeyPendienteRecepcion } from "@/lib/actions/ficha";
import { GenerarVidaLeyGrupoButton } from "@/components/ficha/GenerarVidaLeyGrupoButton";
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
                    href={`/trabajadores/${item.relacionId}?tab=${item.tab}`}
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
  const [control, vidaLeyPendientes] = selectedId
    ? await Promise.all([
        listControlEmpresa(selectedId),
        esEstudio ? listTrabajadoresVidaLeyPendienteRecepcion(selectedId) : Promise.resolve([]),
      ])
    : [{ contratos: [], vidaLey: [], asistencia: [], vacaciones: [] }, []];
  const total =
    control.contratos.length +
    control.vidaLey.length +
    control.asistencia.length +
    control.vacaciones.length;

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Pendientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control por empresa: contratos, Vida Ley, asistencia y vacaciones.
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
              hrefBase="/pendientes"
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <a href="#contratos" className={`${panelCardClass} p-4 hover:bg-muted/30`}>
                <p className="text-xs text-muted-foreground">Contratos</p>
                <p className="mt-1 text-2xl font-semibold text-primary">{control.contratos.length}</p>
              </a>
              {esEstudio ? (
                <a href="#vida-ley" className={`${panelCardClass} p-4 hover:bg-muted/30`}>
                  <p className="text-xs text-muted-foreground">Vida Ley</p>
                  <p className="mt-1 text-2xl font-semibold text-primary">{control.vidaLey.length}</p>
                </a>
              ) : null}
              <a href="#asistencia" className={`${panelCardClass} p-4 hover:bg-muted/30`}>
                <p className="text-xs text-muted-foreground">Asistencia</p>
                <p className="mt-1 text-2xl font-semibold text-primary">{control.asistencia.length}</p>
              </a>
              <a href="#vacaciones" className={`${panelCardClass} p-4 hover:bg-muted/30`}>
                <p className="text-xs text-muted-foreground">Vacaciones</p>
                <p className="mt-1 text-2xl font-semibold text-primary">{control.vacaciones.length}</p>
              </a>
            </div>

            {total === 0 ? (
              <p className={`${panelCardClass} p-4 text-sm text-muted-foreground`}>
                No hay pendientes de control en esta empresa.
              </p>
            ) : null}

            <section id="contratos" className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">Generación de documentos de contrato</h2>
              <ApartadoTabla items={control.contratos} vacio="No hay contratos pendientes en esta empresa." />
            </section>

            {esEstudio ? (
              <section id="vida-ley" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-foreground">Vida Ley</h2>
                  {selectedId ? (
                    <GenerarVidaLeyGrupoButton entidadId={selectedId} cantidad={vidaLeyPendientes.length} />
                  ) : null}
                </div>
                <ApartadoTabla items={control.vidaLey} vacio="No hay trámites de Vida Ley pendientes en esta empresa." />
              </section>
            ) : null}

            <section id="asistencia" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">Asistencia</h2>
                {selectedId ? (
                  <Link href={`/asistencias?entidadId=${selectedId}`} className="text-sm font-medium text-primary hover:underline">
                    Ver mes
                  </Link>
                ) : null}
              </div>
              <ApartadoTabla items={control.asistencia} vacio="Todos los activos de este mes ya subieron el PDF firmado." />
            </section>

            <section id="vacaciones" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">Vacaciones</h2>
                {selectedId ? (
                  <Link href={`/vacaciones?entidadId=${selectedId}`} className="text-sm font-medium text-primary hover:underline">
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