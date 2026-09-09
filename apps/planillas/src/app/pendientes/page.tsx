import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEscribirPlanillas } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listPendientes } from "@/lib/actions/pendientes";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import { claseBadgePaso, flujoDesdeTrabajador, resolverSiguientePaso } from "@/lib/flujo-ficha";
import { PENDIENTE_TIPO_LABEL, nombreCompleto } from "@/lib/planillas-labels";

const TIPOS_TRAMITE = new Set(["afp", "t-registro", "vida-ley", "vencimiento"]);

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
  const [trabajadores, pendientes] = selectedId
    ? await Promise.all([listTrabajadores(selectedId), listPendientes(selectedId)])
    : [[], []];
  const bandeja = trabajadores
    .map((t) => ({
      trabajador: t,
      siguiente: resolverSiguientePaso(flujoDesdeTrabajador(t), esEstudio),
    }))
    .filter(({ siguiente }) => (esEstudio ? siguiente.rol !== "hecho" : siguiente.rol === "empresa"));
  const tramites = esEstudio ? pendientes.filter((p) => TIPOS_TRAMITE.has(p.tipo)) : [];

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Pendientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {esEstudio
              ? "Bandeja de altas por validar o recoger. AFP, T-Registro y Vida Ley van aparte, en Trámites."
              : "Documentos, contrato y firma que aún le tocan a la empresa."}
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

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">Bandeja</h2>
              <div className={`${panelCardClass} overflow-x-auto p-0`}>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">DNI</th>
                      <th className="px-4 py-2 font-medium">Nombre</th>
                      <th className="px-4 py-2 font-medium">Siguiente paso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandeja.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-muted-foreground" colSpan={3}>
                          No hay altas pendientes en esta empresa.
                        </td>
                      </tr>
                    ) : (
                      bandeja.map(({ trabajador, siguiente }) => (
                        <tr key={trabajador.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2 font-mono">{trabajador.persona.dni}</td>
                          <td className="px-4 py-2">
                            <Link
                              href={`/trabajadores/${trabajador.id}?tab=${siguiente.tab}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {nombreCompleto(trabajador.persona)}
                            </Link>
                          </td>
                          <td className="px-4 py-2">
                            <Link href={`/trabajadores/${trabajador.id}?tab=${siguiente.tab}`}>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${claseBadgePaso(siguiente.rol)}`}
                              >
                                {siguiente.etiqueta}
                              </span>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {esEstudio ? (
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-foreground">Trámites</h2>
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
                      {tramites.length === 0 ? (
                        <tr>
                          <td className="px-4 py-8 text-muted-foreground" colSpan={4}>
                            No hay trámites pendientes en esta empresa.
                          </td>
                        </tr>
                      ) : (
                        tramites.map((item) => (
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
              </section>
            ) : null}
          </>
        )}
      </div>
    </PlanillasShell>
  );
}
