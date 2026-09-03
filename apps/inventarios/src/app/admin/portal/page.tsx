import { redirect } from "next/navigation";
import { EntityPortalView } from "@/components/portal/EntityPortalView";
import { EntidadInactivaBlockedView } from "@/components/portal/EntidadInactivaBlockedView";
import { resolveAdminEntidadAccess } from "@/lib/auth/admin-entidad-access";

export default async function AdminPortalPage() {
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

  return (
    <EntityPortalView entidad={access.entidad} gestionHref="/admin/inventario" />
  );
}
