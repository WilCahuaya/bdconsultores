import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import {
  requirePlanillasProfile,
  puedeCrearTrabajador,
  puedeCrearEntidad,
  puedeEscribirPlanillas,
} from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listFilasPendientesTrabajadores } from "@/lib/actions/pendientes";
import { MostrarBajasCheck } from "@/components/MostrarBajasCheck";
import { TrabajadoresPendientesTabla } from "@/components/TrabajadoresPendientesTabla";

export default async function PlanillasHomePage({
  searchParams,
}: {
  searchParams: { entidadId?: string; aviso?: string; bajas?: string };
}) {
  const profile = await requirePlanillasProfile();
  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const mostrarBajas = searchParams.bajas === "1";
  const todos = selectedId ? await listFilasPendientesTrabajadores(selectedId) : [];
  const trabajadores = mostrarBajas ? todos : todos.filter((t) => !t.cesada);
  const hayBajas = todos.some((t) => t.cesada);
  const canCreateTrabajador = puedeCrearTrabajador(profile);
  const canCreate = puedeCrearEntidad(profile);
  const esEstudio = puedeEscribirPlanillas(profile);
  const aviso = searchParams.aviso?.trim() || null;

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">Trabajadores</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hola, {profile.nombre}. El nombre abre la ficha. Cada pastilla abre ese pendiente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <>
                <Link
                  href="/empresas/nueva"
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                >
                  Nueva empresa
                </Link>
                {selectedId ? (
                  <Link
                    href={`/empresas/${selectedId}/editar`}
                    className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                  >
                    Editar empresa
                  </Link>
                ) : null}
              </>
            ) : null}
            {canCreateTrabajador && selectedId ? (
              <Link
                href={`/trabajadores/nuevo?entidadId=${selectedId}`}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Nuevo trabajador
              </Link>
            ) : null}
          </div>
        </div>

        {aviso ? (
          <p className={`${panelCardClass} p-4 text-sm text-foreground`}>{aviso}</p>
        ) : null}

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
              queryExtra={mostrarBajas ? "bajas=1" : undefined}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MostrarBajasCheck entidadId={selectedId} checked={mostrarBajas} />
              {hayBajas && !mostrarBajas ? (
                <p className="text-sm text-muted-foreground">Hay trabajadores de baja ocultos.</p>
              ) : null}
            </div>
            {trabajadores.length === 0 ? (
              <p className={`${panelCardClass} px-4 py-8 text-sm text-muted-foreground`}>
                {hayBajas && !mostrarBajas
                  ? "No hay trabajadores activos. Marque Mostrar bajas para ver a los cesados."
                  : "No hay trabajadores en esta empresa. El listado arranca en blanco."}
              </p>
            ) : (
              <TrabajadoresPendientesTabla filas={trabajadores} esEstudio={esEstudio} />
            )}
          </>
        )}
      </div>
    </PlanillasShell>
  );
}
