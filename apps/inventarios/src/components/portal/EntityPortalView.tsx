"use client";

import Link from "next/link";
import {
  MODULE_PLANILLAS,
  entidadUsaInventarios,
  entidadUsaPlanillas,
  type Entidad,
  type RolUsuario,
} from "@inventario/types";
import {
  BdPortalShell,
  EntityPortalMenu,
  type EntityPortalMenuItem,
} from "@inventario/ui/panel";
import { portalOrigin, webAppById } from "@bd/config";
import { createClient } from "@/lib/supabase/client";

interface EntityPortalViewProps {
  entidad: Pick<Entidad, "id" | "nombre" | "ruc" | "direccion" | "usa_inventarios" | "usa_planillas">;
  rol: RolUsuario;
  gestionHref: string;
  cambiarEntidadHref?: string;
}

export function EntityPortalView({
  entidad,
  rol,
  gestionHref,
  cambiarEntidadHref,
}: EntityPortalViewProps) {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `${portalOrigin()}/login`;
  }

  const muestraInventarios = entidadUsaInventarios(entidad) && rol === "ADMIN_ENTIDAD";
  const muestraPlanillas = entidadUsaPlanillas(entidad);
  const items: EntityPortalMenuItem[] = [];

  if (muestraInventarios) {
    items.push({
      id: "inventarios",
      label: "Gestión de Inventarios",
      href: gestionHref,
      highlight: true,
    });
  }
  if (muestraPlanillas) {
    items.push({
      id: "planillas",
      label: MODULE_PLANILLAS,
      href: `${portalOrigin()}${webAppById("planillas").basePath}`,
      highlight: !muestraInventarios,
    });
  }
  items.push(
    { id: "financieros", label: "Estado Financieros", disabled: true },
    { id: "archivo", label: "Archivo Permanente", disabled: true },
  );

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
