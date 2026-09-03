import type { PanelNavSection } from "@/components/panel/panel-nav-icons";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import { adminPortalPath, contadorPortalHomePath } from "@inventario/types";

export function contadorNavSections(preregistrados = 0): PanelNavSection[] {
  return [
    {
      items: [
        { href: contadorPortalHomePath(), label: "Portal", icon: "portal" },
        { href: "/contador", label: "Dashboard", icon: "dashboard" },
      ],
    },
    {
      label: "Operación",
      items: [
        {
          href: "/contador/inventario",
          label: "Inventario",
          icon: "inventory",
          badge: preregistrados > 0 ? preregistrados : undefined,
          badgeTitle: "Preregistrados pendientes",
        },
        { href: "/contador/entidades", label: "Entidades", icon: "entities" },
        { href: "/contador/reportes", label: "Reportes", icon: "reports" },
      ],
    },
    {
      label: "Configuración",
      items: [
        { href: "/contador/catalogo", label: "Catálogo de bienes", icon: "assets" },
        { href: "/contador/usuarios", label: "Usuarios", icon: "users" },
      ],
    },
  ];
}

export function adminNavSections(
  preregistrados = 0,
  preregistroAmbienteHref?: string,
): PanelNavSection[] {
  return [
    {
      items: [{ href: adminPortalPath(), label: "Portal", icon: "portal" }],
    },
    {
      label: "Operación",
      items: [
        {
          href: preregistroAmbienteHref ?? "/admin/inventario?estado=PREREGISTRADO",
          label: preregistroAmbienteHref ? "Preregistros" : "Inventario global",
          icon: "inventory",
          badge: preregistrados > 0 ? preregistrados : undefined,
          badgeTitle: "Preregistros pendientes de validación",
        },
        ...(preregistroAmbienteHref
          ? [
              {
                href: "/admin/inventario",
                label: "Inventario global",
                icon: "inventory" as const,
              },
            ]
          : []),
        {
          href: "/admin/activos",
          label: "Ambientes",
          icon: "entities",
        },
        { href: "/admin/reportes", label: "Reportes", icon: "reports" },
      ],
    },
  ];
}

export async function getContadorPreregistradoCount(): Promise<number> {
  const profile = await getProfile();
  if (!profile || profile.rol !== "CONTADOR") return 0;

  const supabase = await createClient();
  const { count } = await supabase
    .from("activos")
    .select("*", { count: "exact", head: true })
    .eq("estado_registro", "PREREGISTRADO");

  return count ?? 0;
}

export async function getAdminPreregistradoCount(): Promise<number> {
  const profile = await getProfile();
  if (!profile || profile.rol !== "ADMIN_ENTIDAD" || !profile.entidad_id) return 0;

  const supabase = await createClient();
  const { count } = await supabase
    .from("activos")
    .select("*", { count: "exact", head: true })
    .eq("entidad_id", profile.entidad_id)
    .eq("estado_registro", "PREREGISTRADO");

  return count ?? 0;
}
