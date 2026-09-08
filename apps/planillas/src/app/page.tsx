import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { requirePlanillasProfile, puedeEscribirPlanillas } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import {
  CLASIFICACION_LABEL,
  ESTADO_RELACION_LABEL,
  JORNADA_LABEL,
  nombreCompleto,
} from "@/lib/planillas-labels";

export default async function PlanillasHomePage({
  searchParams,
}: {
  searchParams: { entidadId?: string };
}) {
  const profile = await requirePlanillasProfile();
  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const trabajadores = selectedId ? await listTrabajadores(selectedId) : [];
  const canWrite = puedeEscribirPlanillas(profile);

  return (
    <PlanillasShell profile={profile}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">Trabajadores</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hola, {profile.nombre}. Ficha laboral por empresa: datos, contratos, documentos, AFP, T-Registro y Vida Ley.
            </p>
          </div>
          {canWrite && selectedId ? (
            <Link
              href={`/trabajadores/nuevo?entidadId=${selectedId}`}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Nuevo trabajador
            </Link>
          ) : null}
        </div>

        {entidades.length === 0 ? (
          <div className={`${panelCardClass} p-5 text-sm text-muted-foreground`}>
            No hay empresas activas. Primero créelas en Inventarios.
          </div>
        ) : (
          <>
            <EntidadSwitcher
              entidades={entidades}
              selectedId={selectedId}
              locked={esUsuarioEntidad(profile.rol)}
            />
            <div className={`${panelCardClass} overflow-x-auto p-0`}>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">DNI</th>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Cargo</th>
                    <th className="px-4 py-2 font-medium">Clasificación</th>
                    <th className="px-4 py-2 font-medium">Jornada</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {trabajadores.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-muted-foreground" colSpan={6}>
                        No hay trabajadores en esta empresa. El listado arranca en blanco.
                      </td>
                    </tr>
                  ) : (
                    trabajadores.map((t) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono">{t.persona.dni}</td>
                        <td className="px-4 py-2">
                          <Link href={`/trabajadores/${t.id}`} className="font-medium text-primary hover:underline">
                            {nombreCompleto(t.persona)}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{t.cargo ?? "—"}</td>
                        <td className="px-4 py-2">
                          {t.clasificacion ? CLASIFICACION_LABEL[t.clasificacion] : "—"}
                        </td>
                        <td className="px-4 py-2">{t.jornada ? JORNADA_LABEL[t.jornada] : "—"}</td>
                        <td className="px-4 py-2">{ESTADO_RELACION_LABEL[t.estado]}</td>
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
