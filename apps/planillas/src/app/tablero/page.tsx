import { redirect } from "next/navigation";
import { PlanillasShell } from "@/components/PlanillasShell";
import { TableroMandoTabla } from "@/components/tablero/TableroMandoTabla";
import { requirePlanillasProfile, puedeEscribirPlanillas } from "@/lib/auth/access";
import { listTableroMando } from "@/lib/actions/tablero";
import { esMesAsistencia, mesActualLima } from "@/lib/horario-asistencia";

export default async function TableroPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) redirect("/");

  const mes = searchParams.mes && esMesAsistencia(searchParams.mes) ? searchParams.mes : mesActualLima();
  const tablero = await listTableroMando(mes);

  return (
    <PlanillasShell profile={profile}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-primary sm:text-2xl">Tablero de mando</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control mensual del estudio: una fila por empresa. Números donde hay cantidad, sí/no en Sunafil, DRT y
            planillas.
          </p>
        </div>
        <TableroMandoTabla mes={tablero.mes} filas={tablero.filas} />
      </div>
    </PlanillasShell>
  );
}
