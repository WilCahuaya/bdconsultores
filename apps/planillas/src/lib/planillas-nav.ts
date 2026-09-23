import type { PanelNavSection } from "@inventario/ui/panel";

function withEntidad(path: string, entidadId?: string) {
  if (!entidadId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}entidadId=${entidadId}`;
}

export function planillasNavSections(opts: {
  entidadId?: string;
  esEstudio?: boolean;
}): PanelNavSection[] {
  const { entidadId, esEstudio } = opts;
  const tramites: PanelNavSection["items"] = [
    { href: withEntidad("/contratos", entidadId), label: "Contratos", icon: "assets" },
  ];
  if (esEstudio) {
    tramites.push({ href: withEntidad("/vida-ley", entidadId), label: "Vida Ley", icon: "inventory" });
  }
  tramites.push(
    { href: withEntidad("/asistencias", entidadId), label: "Asistencias", icon: "dashboard" },
    { href: withEntidad("/vacaciones", entidadId), label: "Vacaciones", icon: "reports" },
  );

  const expediente: PanelNavSection["items"] = [
    { href: withEntidad("/", entidadId), label: "Trabajadores", icon: "users" },
    { href: withEntidad("/pendientes", entidadId), label: "Pendientes", icon: "pending" },
  ];
  if (esEstudio) {
    expediente.splice(1, 0, { href: "/tablero", label: "Tablero", icon: "dashboard" });
  }

  return [
    {
      label: "Expediente",
      items: expediente,
    },
    {
      label: "Trámites",
      items: tramites,
    },
  ];
}

export function matchPlanillasNavPath(pathname: string, href: string): boolean {
  const path = href.split("?")[0] || "/";
  if (path === "/") {
    return pathname === "/" || pathname.startsWith("/trabajadores") || pathname.startsWith("/empresas");
  }
  if (path === "/tablero") {
    return pathname === "/tablero" || pathname.startsWith("/tablero/");
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function planillasHomeHref(entidadId?: string) {
  return withEntidad("/", entidadId);
}
