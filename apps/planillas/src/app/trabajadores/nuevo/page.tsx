import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanillasShell } from "@/components/PlanillasShell";
import { NuevoTrabajadorForm } from "@/components/NuevoTrabajadorForm";
import { puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";

export default async function NuevoTrabajadorPage({
  searchParams,
}: {
  searchParams: { entidadId?: string };
}) {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) redirect("/");

  const entidades = await listEntidadesPlanillas();
  const defaultEntidadId =
    searchParams.entidadId && entidades.some((e) => e.id === searchParams.entidadId)
      ? searchParams.entidadId
      : entidades[0]?.id ?? "";

  return (
    <PlanillasShell profile={profile} entidadId={defaultEntidadId || undefined}>
      <div className="space-y-6">
        <div>
          <Link href={defaultEntidadId ? `/?entidadId=${defaultEntidadId}` : "/"} className="text-sm text-primary hover:underline">
            ← Trabajadores
          </Link>
          <h1 className="mt-2 text-xl font-bold text-primary sm:text-2xl">Nuevo trabajador</h1>
        </div>
        {entidades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay empresas activas.</p>
        ) : (
          <NuevoTrabajadorForm entidades={entidades} defaultEntidadId={defaultEntidadId} />
        )}
      </div>
    </PlanillasShell>
  );
}
