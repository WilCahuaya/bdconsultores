import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEditarFichaLaboral } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import { listVacacionesEmpresa } from "@/lib/actions/vacaciones";
import { anioActualLima, esPeriodoVacacion, resumenPeriodoVacacion } from "@/lib/vacaciones";
import { nombreCompleto } from "@/lib/planillas-labels";

export default async function VacacionesPage({
  searchParams,
}: {
  searchParams: { entidadId?: string; periodo?: string };
}) {
  const profile = await requirePlanillasProfile();
  const canCreate = puedeCrearEntidad(profile);
  const canWrite = puedeEditarFichaLaboral(profile);
  const entidades = await listEntidadesPlanillas();
  const selectedId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";
  const periodo = esPeriodoVacacion(searchParams.periodo) ? Number(searchParams.periodo) : anioActualLima();
  const [trabajadores, registros] = selectedId
    ? await Promise.all([listTrabajadores(selectedId), listVacacionesEmpresa(selectedId, periodo)])
    : [[], []];
  const porRelacion = new Map<string, typeof registros>();
  for (const row of registros) {
    const lista = porRelacion.get(row.relacion_id) ?? [];
    lista.push(row);
    porRelacion.set(row.relacion_id, lista);
  }
  const filas = trabajadores
    .filter((t) => t.estado === "ACTIVA")
    .map((t) => ({
      trabajador: t,
      resumen: resumenPeriodoVacacion(porRelacion.get(t.id) ?? [], t.fecha_ingreso, periodo),
    }))
    .sort((a, b) => {
      if (a.resumen.derecho !== b.resumen.derecho) return a.resumen.derecho ? -1 : 1;
      if (a.resumen.saldo !== b.resumen.saldo) return b.resumen.saldo - a.resumen.saldo;
      return nombreCompleto(a.trabajador.persona).localeCompare(nombreCompleto(b.trabajador.persona), "es");
    });
  const pendientes = filas.filter((f) => f.resumen.derecho && f.resumen.saldo > 0).length;

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Vacaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            30 días por año de servicio. Controle el goce del periodo y registre las fechas en Vacaciones.
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
              hrefBase="/vacaciones"
              queryExtra={`periodo=${periodo}`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link
                  href={`/vacaciones?entidadId=${selectedId}&periodo=${periodo - 1}`}
                  className="text-primary hover:underline"
                >
                  {periodo - 1}
                </Link>
                <h2 className="text-sm font-medium text-foreground">Periodo {periodo}</h2>
                <Link
                  href={`/vacaciones?entidadId=${selectedId}&periodo=${periodo + 1}`}
                  className="text-primary hover:underline"
                >
                  {periodo + 1}
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                Con saldo: {pendientes} de {filas.length}
              </p>
            </div>
            <div className={`${panelCardClass} overflow-x-auto p-0`}>
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">DNI</th>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Derecho</th>
                    <th className="px-4 py-2 font-medium">Tomados</th>
                    <th className="px-4 py-2 font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-muted-foreground" colSpan={5}>
                        No hay trabajadores activos en esta empresa.
                      </td>
                    </tr>
                  ) : (
                    filas.map(({ trabajador, resumen }) => (
                      <tr key={trabajador.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono">{trabajador.persona.dni}</td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/trabajadores/${trabajador.id}?tab=vacaciones&periodo=${periodo}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {nombreCompleto(trabajador.persona)}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          {resumen.derecho ? resumen.diasCorrespondientes : "Aún no"}
                        </td>
                        <td className="px-4 py-2">{resumen.diasTomados}</td>
                        <td className="px-4 py-2">
                          {resumen.derecho ? (
                            resumen.saldo > 0 ? (
                              <span className="text-amber-800">{resumen.saldo}</span>
                            ) : (
                              <span className="font-medium text-emerald-700">{resumen.saldo}</span>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {canWrite ? (
              <p className="text-sm text-muted-foreground">
                Entre al trámite de la persona para registrar el goce (fechas, días y si está programado o ya gozado).
              </p>
            ) : null}
          </>
        )}
      </div>
    </PlanillasShell>
  );
}
