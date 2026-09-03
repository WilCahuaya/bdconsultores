import { redirect } from "next/navigation";
import { CatalogoPanel } from "@/components/panel/CatalogoPanel";
import { PanelPageHeader } from "@/components/panel/panel-ui";
import { requireProfile } from "@/lib/auth/profile";

export default async function ContadorCatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; codigo?: string }>;
}) {
  try {
    await requireProfile("CONTADOR");
  } catch {
    redirect("/login");
  }

  const params = await searchParams;

  return (
    <div className="space-y-6">
      <PanelPageHeader
        title="Catálogo"
        subtitle="Administre el catálogo propio (cuenta de orden) y consulte el catálogo nacional oficial."
      />
      <CatalogoPanel initialDenominacion={params.q ?? ""} />
    </div>
  );
}
