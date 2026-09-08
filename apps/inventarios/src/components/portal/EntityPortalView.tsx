"use client";

import Link from "next/link";
import { MODULE_PLANILLAS, type Entidad } from "@inventario/types";
import {
  BdPortalShell,
  EntityPortalMenu,
  type EntityPortalMenuItem,
} from "@inventario/ui/panel";
import { portalOrigin, webAppById } from "@bd/config";
import { createClient } from "@/lib/supabase/client";

interface EntityPortalViewProps {
  entidad: Pick<Entidad, "id" | "nombre" | "ruc" | "direccion">;
  gestionHref: string;
  cambiarEntidadHref?: string;
}

export function EntityPortalView({
  entidad,
  gestionHref,
  cambiarEntidadHref,
}: EntityPortalViewProps) {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `${portalOrigin()}/login`;
  }

  const items: EntityPortalMenuItem[] = [
    {
      id: "inventarios",
      label: "Gestión de Inventarios",
      href: gestionHref,
      highlight: true,
    },
    {
      id: "planillas",
      label: MODULE_PLANILLAS,
      href: `${portalOrigin()}${webAppById("planillas").basePath}`,
    },
    { id: "financieros", label: "Estado Financieros", disabled: true },
    { id: "archivo", label: "Archivo Permanente", disabled: true },
  ];

  return (
    <BdPortalShell onExit={() => void handleLogout()} showBranding={false}>
      <EntityPortalMenu
        sectionLabel="Entidad"
        entidadNombre={entidad.nombre}
        entidadRuc={entidad.ruc}
        entidadDireccion={entidad.direccion}
        items={items}
        extraActions={
          cambiarEntidadHref ? (
            <div className="pt-1">
              <Link href={cambiarEntidadHref} className="bd-portal-link">
                Cambiar entidad
              </Link>
            </div>
          ) : undefined
        }
      />
    </BdPortalShell>
  );
}
