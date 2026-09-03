import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ContadorDashboard } from "@/components/panel/ContadorDashboard";
import { listEntidades } from "@/lib/actions/entidades";
import { requireProfile } from "@/lib/auth/profile";

export default async function ContadorDashboardPage() {
  try {
    await requireProfile("CONTADOR");
  } catch {
    redirect("/login");
  }

  const entidades = await listEntidades();

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando dashboard…</p>}>
      <ContadorDashboard entidades={entidades.filter((e) => e.activo)} />
    </Suspense>
  );
}
