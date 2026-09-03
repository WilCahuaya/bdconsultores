import { redirect } from "next/navigation";
import { ReportesPanel } from "@/components/panel/ReportesPanel";
import { PanelPageHeader } from "@/components/panel/panel-ui";
import { getEntidadesParaReportes } from "@/lib/actions/reportes";
import { requireProfile } from "@/lib/auth/profile";

export default async function AdminReportesPage() {
  let profile;
  try {
    profile = await requireProfile("ADMIN_ENTIDAD");
  } catch {
    redirect("/login");
  }

  const entidades = await getEntidadesParaReportes();

  return (
    <div className="space-y-6">
      <PanelPageHeader
        title="Reportes"
        subtitle="Fichas e inventarios físicos de su entidad, y reporte de bajas, en PDF o Excel"
      />
      <ReportesPanel
        entidades={entidades}
        usuarioNombre={profile.nombre}
        usuarioEmail={profile.email}
        esAdmin
      />
    </div>
  );
}
