import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanillasShell } from "@/components/PlanillasShell";
import { EmpresaForm } from "@/components/EmpresaForm";
import { puedeCrearEntidad, requirePlanillasProfile } from "@/lib/auth/access";

export default async function NuevaEmpresaPage() {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearEntidad(profile)) redirect("/");

  return (
    <PlanillasShell profile={profile}>
      <div className="space-y-6">
        <div>
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Trabajadores
          </Link>
          <h1 className="mt-2 text-xl font-bold text-primary sm:text-2xl">Nueva empresa</h1>
        </div>
        <EmpresaForm />
      </div>
    </PlanillasShell>
  );
}
