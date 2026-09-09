import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { requirePlanillasProfile, puedeCrearEntidad } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listPendientes } from "@/lib/actions/pendientes";
import {
  PENDIENTE_TIPOS,
  PENDIENTE_TIPO_LABEL,
  parsePendienteTipo,
  type PendienteTipo,
} from "@/lib/planillas-labels";

function countByTipo(items: { tipo: PendienteTipo }[]) {
  const counts = Object.fromEntries(PENDIENTE_TIPOS.map((tipo) => [tipo, 0])) as Record<PendienteTipo, number>;
  for (const item of items) counts[item.tipo] += 1;
  return counts;
}

export default async function PendientesPage({
  searchParams,
}: {
  searchParams: { entidadId?: string; tipo?: string };
}) {
  const profile = await requirePlanillasProfile();
  const canCreate = puedeCrearEntidad(profile);
  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const filtro = parsePendienteTipo(searchParams.tipo);
  const pendientes = selectedId ? await listPendientes(selectedId) : [];
  const visibles = filtro === "todos" ? pendientes : pendientes.filter((p) => p.tipo === filtro);
  const counts = countByTipo(pendientes);

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Pendientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contratos, documentos por subir y altas por validar. AFP, T-Registro y Vida Ley aparecen después de aceptar el
            alta.
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

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {PENDIENTE_TIPOS.map((tipo) => {
                const active = filtro === tipo;
                return (
                  <Link
                    key={tipo}
                    href={`/pendientes?entidadId=${selectedId}&tipo=${tipo}`}
                    className={`${panelCardClass} p-3 ${active ? "ring-2 ring-primary" : ""}`}
                  >
                    <p className="text-xs text-muted-foreground">{PENDIENTE_TIPO_LABEL[tipo]}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{counts[tipo]}</p>
                  </Link>
                );
              })}
            </div>

            {filtro !== "todos" ? (
              <Link href={`/pendientes?entidadId=${selectedId}`} className="text-sm text-primary hover:underline">
                Ver todos
              </Link>
            ) : null}

            <div className={`${panelCardClass} overflow-x-auto p-0`}>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">DNI</th>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-muted-foreground" colSpan={4}>
                        {pendientes.length === 0
                          ? "No hay pendientes en esta empresa."
                          : "No hay pendientes de este tipo."}
                      </td>
                    </tr>
                  ) : (
                    visibles.map((item) => (
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
                        <td className="px-4 py-2">{PENDIENTE_TIPO_LABEL[item.tipo]}</td>
                        <td className="px-4 py-2">{item.detalle}</td>
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
