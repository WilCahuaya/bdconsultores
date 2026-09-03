"use client";

import { BdPortalShell } from "@inventario/ui/panel";
import { portalOrigin } from "@bd/config";
import { createClient } from "@/lib/supabase/client";

type EntidadInactivaBlockedViewProps = {
  reason: "inactive" | "missing";
  entidadNombre?: string | null;
};

export function EntidadInactivaBlockedView({
  reason,
  entidadNombre,
}: EntidadInactivaBlockedViewProps) {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `${portalOrigin()}/login`;
  }

  const title =
    reason === "inactive" ? "Entidad desactivada" : "Entidad no disponible";

  const message =
    reason === "inactive"
      ? entidadNombre
        ? `La entidad «${entidadNombre}» fue desactivada por el contador. No puede gestionar el inventario hasta que la reactiven.`
        : "Su entidad fue desactivada por el contador. No puede gestionar el inventario hasta que la reactiven."
      : "Su cuenta ya no está vinculada a una entidad activa. Contacte al contador para que la reactiven o le asignen acceso.";

  return (
    <BdPortalShell onExit={() => void handleLogout()} showBranding={false}>
      <div className="bd-portal-card space-y-4">
        <p className="bd-portal-section-label">Acceso restringido</p>
        <h2 className="bd-portal-entity-title text-2xl font-semibold leading-tight sm:text-[1.65rem]">
          {title}
        </h2>
        <p className="bd-portal-meta-line bd-portal-meta-line--muted text-sm leading-relaxed">
          {message}
        </p>
        <button type="button" onClick={() => void handleLogout()} className="bd-portal-menu-item">
          Cerrar sesión
        </button>
      </div>
    </BdPortalShell>
  );
}
