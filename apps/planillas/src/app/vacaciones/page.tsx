import Link from "next/link";
import { esUsuarioEntidad } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EntidadSwitcher } from "@/components/EntidadSwitcher";
import { PlanillasVistaBajas } from "@/components/PlanillasVistaBajas";
import { requirePlanillasProfile, puedeCrearEntidad, puedeEditarFichaLaboral } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import { listVacacionesEmpresa, type VacacionRow } from "@/lib/actions/vacaciones";
import {
  anioActualLima,
  esPeriodoVacacion,
  resumenPeriodoVacacion,
  situacionTomaVacaciones,
  type SituacionTomaVacaciones,
} from "@/lib/vacaciones";
import { compareTrabajadoresPorNumero, formatFechaPlanilla, formatNumeroTrabajador, nombreCompleto } from "@/lib/planillas-labels";

function etiquetaSalida(indice: number): string {
  return `${indice + 1}.ª salida y retorno`;
}

function textoSalida(row: Pick<VacacionRow, "fecha_inicio" | "fecha_fin"> | undefined): string {
  if (!row) return "—";
  return `${formatFechaPlanilla(row.fecha_inicio)} – ${formatFechaPlanilla(row.fecha_fin)}`;
}

const TOMA_LABEL: Record<SituacionTomaVacaciones, string> = {
  ninguno: "Sin días tomados",
  proceso: "En proceso",
  tomado: "Ya tomados",
};

const TOMA_CLASS: Record<SituacionTomaVacaciones, string> = {
  ninguno: "bg-muted/70 text-muted-foreground",
  proceso: "bg-amber-100 text-amber-950 dark:bg-amber-900/70 dark:text-amber-50",
  tomado: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-50",
};

export default async function VacacionesPage({
  searchParams,
}: {
  searchParams: { entidadId?: string; periodo?: string; bajas?: string };
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
  const mostrarBajas = searchParams.bajas === "1";
  const [trabajadores, registros] = selectedId
    ? await Promise.all([listTrabajadores(selectedId), listVacacionesEmpresa(selectedId, periodo)])
    : [[], []];
  const porRelacion = new Map<string, typeof registros>();
  for (const row of registros) {
    const lista = porRelacion.get(row.relacion_id) ?? [];
    lista.push(row);
    porRelacion.set(row.relacion_id, lista);
  }
  const todas = trabajadores
    .map((t) => {
      const resumen = resumenPeriodoVacacion(porRelacion.get(t.id) ?? [], t.fecha_ingreso, periodo, t.jornada);
      const salidas = [...resumen.registros].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
      return { trabajador: t, resumen, salidas };
    })
    .sort((a, b) => compareTrabajadoresPorNumero(a.trabajador, b.trabajador));
  const filas = todas.filter((f) =>
    mostrarBajas ? f.trabajador.estado === "CESADA" : f.trabajador.estado !== "CESADA",
  );
  const hayBajas = todas.some((f) => f.trabajador.estado === "CESADA");
  const columnasSalida = Math.max(1, ...filas.map((f) => f.salidas.length), 1);
  const pendientes = filas.filter((f) => f.resumen.derecho && f.resumen.saldo > 0).length;
  const queryExtraParts = [`periodo=${periodo}`, mostrarBajas ? "bajas=1" : null].filter(Boolean);
  const queryExtra = queryExtraParts.join("&");
  const hrefPeriodo = (anio: number) => {
    const params = new URLSearchParams({ entidadId: selectedId, periodo: String(anio) });
    if (mostrarBajas) params.set("bajas", "1");
    return `/vacaciones?${params.toString()}`;
  };

  return (
    <PlanillasShell profile={profile} entidadId={selectedId || undefined}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Vacaciones</h1>
          {entidades.length > 0 ? (
            <>
              <span className="text-muted-foreground" aria-hidden>
                &gt;
              </span>
              <EntidadSwitcher
                entidades={entidades}
                selectedId={selectedId}
                locked={esUsuarioEntidad(profile.rol)}
                hrefBase="/vacaciones"
                queryExtra={queryExtra}
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
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link href={hrefPeriodo(periodo - 1)} className="text-primary hover:underline">
                  {periodo - 1}
                </Link>
                <h2 className="text-sm font-medium text-foreground">
                  {mostrarBajas ? "Bajas · " : ""}Periodo {periodo}
                </h2>
                <Link href={hrefPeriodo(periodo + 1)} className="text-primary hover:underline">
                  {periodo + 1}
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PlanillasVistaBajas entidadId={selectedId} checked={mostrarBajas} hrefBase="/vacaciones" />
                {hayBajas && !mostrarBajas ? (
                  <span className="text-sm text-muted-foreground">Hay trabajadores de baja ocultos.</span>
                ) : null}
                {(["ninguno", "proceso", "tomado"] as const).map((situacion) => (
                  <span
                    key={situacion}
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${TOMA_CLASS[situacion]}`}
                  >
                    {TOMA_LABEL[situacion]}
                  </span>
                ))}
                <p className="text-sm text-muted-foreground">
                  Con saldo: {pendientes} de {filas.length}
                </p>
              </div>
            </div>
            <div className={`${panelCardClass} panel-scroll-table overflow-x-auto p-0`}>
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Número</th>
                    <th className="px-4 py-2 font-medium">DNI</th>
                    <th className="px-4 py-2 font-medium">Nombres</th>
                    {Array.from({ length: columnasSalida }, (_, indice) => (
                      <th key={indice} className="px-4 py-2 font-medium whitespace-nowrap">
                        {etiquetaSalida(indice)}
                      </th>
                    ))}
                    <th className="px-4 py-2 font-medium">Tomados</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-muted-foreground" colSpan={4 + columnasSalida}>
                        {todas.length === 0
                          ? "No hay trabajadores en esta empresa."
                          : mostrarBajas
                            ? "No hay bajas."
                            : hayBajas
                              ? "No hay trabajadores activos. Marque Mostrar bajas para ver a los cesados."
                              : "No hay trabajadores en esta empresa."}
                      </td>
                    </tr>
                  ) : (
                    filas.map(({ trabajador, resumen, salidas }) => {
                      const situacion = situacionTomaVacaciones(salidas, resumen.diasCorrespondientes);
                      return (
                      <tr key={trabajador.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono">{formatNumeroTrabajador(trabajador.numero) || "—"}</td>
                        <td className="px-4 py-2 font-mono">{trabajador.persona.dni}</td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/trabajadores/${trabajador.id}?tab=vacaciones&periodo=${periodo}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {nombreCompleto(trabajador.persona)}
                            {trabajador.estado === "CESADA" ? " · Baja" : ""}
                          </Link>
                        </td>
                        {Array.from({ length: columnasSalida }, (_, indice) => (
                          <td key={indice} className="px-4 py-2 whitespace-nowrap">
                            {textoSalida(salidas[indice])}
                          </td>
                        ))}
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            title={TOMA_LABEL[situacion]}
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${TOMA_CLASS[situacion]}`}
                          >
                            {resumen.diasTomados} de {resumen.diasCorrespondientes}
                          </span>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {canWrite ? (
              <p className="text-sm text-muted-foreground">
                Entre a la ficha de un trabajador activo para registrar el goce (fechas, días y el documento de respaldo firmado). En una ficha de baja el periodo se consulta.
              </p>
            ) : null}
          </>
        )}
      </div>
    </PlanillasShell>
  );
}
