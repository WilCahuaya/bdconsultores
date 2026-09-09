import { redirect } from "next/navigation";
import { EntityPortalView } from "@/components/portal/EntityPortalView";
import { EntidadInactivaBlockedView } from "@/components/portal/EntidadInactivaBlockedView";
import { resolveEntidadPortalAccess } from "@/lib/auth/admin-entidad-access";
import { portalLoginHref } from "@/lib/auth/profile";

export default async function AdminPortalPage() {
  const access = await resolveEntidadPortalAccess();

  if (access.status === "unauth") redirect(portalLoginHref());

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
    <EntityPortalView
      entidad={access.entidad}
      rol={access.profile.rol}
      gestionHref="/admin/inventario"
    />
  );
}
