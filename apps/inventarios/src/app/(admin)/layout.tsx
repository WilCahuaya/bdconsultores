import { redirect } from "next/navigation";
import { PanelLayout } from "@/components/panel/PanelLayout";
import { EntidadInactivaBlockedView } from "@/components/portal/EntidadInactivaBlockedView";
import { getAmbientePreregistro } from "@/lib/actions/ubicacion";
import { resolveAdminEntidadAccess } from "@/lib/auth/admin-entidad-access";
import { adminNavSections, getAdminPreregistradoCount } from "@/lib/panel-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await resolveAdminEntidadAccess();

  if (access.status === "unauth") redirect("/login");

  if (access.status === "inactive") {
    return (
      <EntidadInactivaBlockedView
        reason="inactive"
        entidadNombre={access.entidad.nombre}
      />
    );
  }

  if (access.status === "missing") {
    return <EntidadInactivaBlockedView reason="missing" />;
  }

  const { profile, entidad } = access;
  const [preregistrados, preregistroAmbiente] = await Promise.all([
    getAdminPreregistradoCount(),
    getAmbientePreregistro(entidad.id),
  ]);

  return (
    <PanelLayout
      panelLabel="Panel entidad"
      homeHref="/admin/portal"
      sections={adminNavSections(
        preregistrados,
        preregistroAmbiente ? `/admin/ambientes/${preregistroAmbiente.id}` : undefined,
      )}
      user={{ nombre: profile.nombre, email: profile.email }}
      realtimeEntidadId={entidad.id}
    >
      {children}
    </PanelLayout>
  );
}
