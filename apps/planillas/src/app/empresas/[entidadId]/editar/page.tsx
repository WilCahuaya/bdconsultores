import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EmpresaForm } from "@/components/EmpresaForm";
import { puedeCrearEntidad, requirePlanillasProfile } from "@/lib/auth/access";
import { getEntidadPlanillas } from "@/lib/actions/entidades";

export default async function EditarEmpresaPage({
  params,
}: {
  params: { entidadId: string };
}) {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearEntidad(profile)) redirect("/");

  const entidad = await getEntidadPlanillas(params.entidadId);
  if (!entidad?.activo) notFound();

  return (
    <PlanillasShell profile={profile} entidadId={entidad.id}>
      <div className="space-y-6">
        <div>
          <Link href={`/?entidadId=${entidad.id}`} className="text-sm text-primary hover:underline">
            ← Trabajadores
          </Link>
          <h1 className="mt-2 text-xl font-bold text-primary sm:text-2xl">Editar empresa</h1>
          <p className="mt-1 text-sm text-muted-foreground">{entidad.nombre}</p>
        </div>
        <EmpresaForm entidad={entidad} />
      </div>
    </PlanillasShell>
  );
}
