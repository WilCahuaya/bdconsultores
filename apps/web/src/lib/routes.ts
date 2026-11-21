/** Rutas públicas — accesibles sin sesión */
export const PUBLIC_PATHS = [
  "/",
  "/nosotros",
  "/servicios",
  "/clientes",
  "/blog",
  "/contacto",
] as const;

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth")
  );
}

export const PUBLIC_NAV = [
  { href: "/", label: "Inicio" },
  { href: "/servicios", label: "Servicios" },
  { href: "/contacto", label: "Contacto" },
] as const;
