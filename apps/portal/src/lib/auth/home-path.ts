import { webAppById } from "@bd/config";
import { inventarioHomePathForRole, type RolUsuario } from "@inventario/types";

/** Tras el login: portal de módulos (Inventarios, Estados financieros, etc.). */
export function portalHomePathForRole(rol: RolUsuario): string {
  return `${webAppById("inventarios").basePath}${inventarioHomePathForRole(rol)}`;
}
