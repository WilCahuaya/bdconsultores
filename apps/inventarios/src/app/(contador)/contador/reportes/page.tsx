import { redirect } from "next/navigation";
import { ReportesPanel } from "@/components/panel/ReportesPanel";
import { PanelPageHeader } from "@/components/panel/panel-ui";
import { getEntidadesParaReportes } from "@/lib/actions/reportes";
import { requireProfile } from "@/lib/auth/profile";

export default async function ContadorReportesPage() {
  let profile;
  try {
    profile = await requireProfile("CONTADOR");
  } catch {
    redirect("/login");
  }

  const entidades = await getEntidadesParaReportes();

  return (
    <div className="space-y-6">
      <PanelPageHeader
        title="Reportes"
        subtitle="Inventarios, actas y bajas en PDF y Excel con membrete B&D"
      />
      <ReportesPanel
        entidades={entidades}
        usuarioNombre={profile.nombre}
        usuarioEmail={profile.email}
      />
    </div>
  );
}
