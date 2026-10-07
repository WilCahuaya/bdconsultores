import { redirect } from "next/navigation";
import { EntidadesPanel } from "@/components/panel/EntidadesPanel";
import { listEntidades } from "@/lib/actions/entidades";
import { requirePersonalEstudio } from "@/lib/auth/profile";

export default async function ContadorEntidadesPage() {
  try {
    await requirePersonalEstudio();
  } catch {
    redirect("/login");
  }

  const entidades = await listEntidades();
  return <EntidadesPanel entidades={entidades} />;
}
