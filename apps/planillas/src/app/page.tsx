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
import { listTrabajadores } from "@/lib/actions/trabajadores";
import { listPendientes } from "@/lib/actions/pendientes";
import { claseBadgePaso, flujoDesdeTrabajador, resolverSiguientePaso } from "@/lib/flujo-ficha";
import { nombreCompleto } from "@/lib/planillas-labels";

const TIPOS_TRAMITE = new Set(["afp", "t-registro", "vida-ley", "vencimiento"]);

export default async function PlanillasHomePage({
  searchParams,
}: {
  searchParams: { entidadId?: string; aviso?: string };
}) {
  const profile = await requirePlanillasProfile();
  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const [trabajadores, pendientes] =
    selectedId
      ? await Promise.all([listTrabajadores(selectedId), listPendientes(selectedId)])
      : [[], []];
  const canCreateTrabajador = puedeCrearTrabajador(profile);
  const canCreate = puedeCrearEntidad(profile);
  const esEstudio = puedeEscribirPlanillas(profile);
  const aviso = searchParams.aviso?.trim() || null;
  const pendientesVisibles = esEstudio
    ? pendientes
    : pendientes.filter((p) => !TIPOS_TRAMITE.has(p.tipo) && p.tipo !== "validacion");

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">Trabajadores</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hola, {profile.nombre}. El clic entra al siguiente paso de cada ficha.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <Link
                href="/empresas/nueva"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
              >
                Nueva empresa
              </Link>
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
            />
            {pendientesVisibles.length > 0 ? (
              <Link
                href={`/pendientes?entidadId=${selectedId}`}
                className={`${panelCardClass} block p-4 text-sm hover:bg-muted/30`}
              >
                Hay <span className="font-semibold text-primary">{pendientesVisibles.length}</span> pendientes en
                esta empresa.
              </Link>
            ) : null}
            <div className={`${panelCardClass} overflow-x-auto p-0`}>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">DNI</th>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Cargo</th>
                    <th className="px-4 py-2 font-medium">Siguiente paso</th>
                  </tr>
                </thead>
                <tbody>
                  {trabajadores.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-muted-foreground" colSpan={4}>
                        No hay trabajadores en esta empresa. El listado arranca en blanco.
                      </td>
                    </tr>
                  ) : (
                    trabajadores.map((t) => {
                      const siguiente = resolverSiguientePaso(flujoDesdeTrabajador(t), esEstudio);
                      return (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2 font-mono">{t.persona.dni}</td>
                          <td className="px-4 py-2">
                            <Link
                              href={`/trabajadores/${t.id}?tab=${siguiente.tab}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {nombreCompleto(t.persona)}
                            </Link>
                          </td>
                          <td className="px-4 py-2">{t.cargo ?? "—"}</td>
                          <td className="px-4 py-2">
                            <Link href={`/trabajadores/${t.id}?tab=${siguiente.tab}`}>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${claseBadgePaso(siguiente.rol)}`}
                              >
                                {siguiente.etiqueta}
                              </span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
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
