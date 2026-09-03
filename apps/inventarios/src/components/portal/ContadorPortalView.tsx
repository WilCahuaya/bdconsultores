"use client";

import {
  contadorGestionInventariosPath,
  displayContadorNombre,
} from "@inventario/types";
import {
  BdPortalShell,
  EntityPortalMenu,
  type EntityPortalMenuItem,
} from "@inventario/ui/panel";
import { portalOrigin } from "@bd/config";
import { createClient } from "@/lib/supabase/client";

interface ContadorPortalViewProps {
  nombre: string;
  email: string;
}

export function ContadorPortalView({ nombre, email }: ContadorPortalViewProps) {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `${portalOrigin()}/login`;
  }

  const items: EntityPortalMenuItem[] = [
    { id: "financieros", label: "Estado Financieros", disabled: true },
    {
      id: "inventarios",
      label: "Gestión de Inventarios",
      href: contadorGestionInventariosPath(),
      highlight: true,
    },
    { id: "archivo", label: "Archivo Permanente", disabled: true },
    { id: "otros", label: "Otros", disabled: true },
  ];

  return (
    <BdPortalShell onExit={() => void handleLogout()} showBranding={false}>
      <EntityPortalMenu
        entidadNombre={displayContadorNombre(nombre, email)}
        subtitleLines={[email]}
        titleVariant="person"
        items={items}
      />
    </BdPortalShell>
  );
}
