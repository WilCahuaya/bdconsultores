import type { PanelNavSection } from "@inventario/ui/panel";

export type DesktopMainNav =
  | "portal"
  | "dashboard"
  | "entidades"
  | "espacios"
  | "inventario"
  | "catalogo"
  | "usuarios"
  | "reportes";

export function desktopNavSections(preregistrados = 0): PanelNavSection[] {
  return [
    {
      items: [
        { href: "portal", label: "Portal", icon: "portal" },
        { href: "dashboard", label: "Dashboard", icon: "dashboard" },
      ],
    },
    {
      label: "Operación",
      items: [
        {
          href: "inventario",
          label: "Inventario",
          icon: "inventory",
          badge: preregistrados > 0 ? preregistrados : undefined,
          badgeTitle: "Preregistrados pendientes",
        },
        { href: "entidades", label: "Entidades", icon: "entities" },
        { href: "espacios", label: "Espacios", icon: "spaces" },
        { href: "reportes", label: "Reportes", icon: "reports" },
      ],
    },
    {
      label: "Configuración",
      items: [
        { href: "catalogo", label: "Catálogo de bienes", icon: "assets" },
        { href: "usuarios", label: "Usuarios", icon: "users" },
      ],
    },
  ];
}

export function isDesktopMainNav(value: string): value is DesktopMainNav {
  return (
    value === "portal" ||
    value === "dashboard" ||
    value === "entidades" ||
    value === "espacios" ||
    value === "inventario" ||
    value === "catalogo" ||
    value === "usuarios" ||
    value === "reportes"
  );
}
