import type { Entidad, Profile } from "@inventario/types";
import { getEntidad } from "@/lib/actions/entidades";
import { getProfile } from "@/lib/auth/profile";

export type AdminEntidadAccess =
  | { status: "ok"; profile: Profile; entidad: Entidad }
  | { status: "inactive"; profile: Profile; entidad: Entidad }
  | { status: "missing"; profile: Profile }
  | { status: "unauth" };

/** Resuelve si el admin de entidad puede operar (entidad activa). */
export async function resolveAdminEntidadAccess(): Promise<AdminEntidadAccess> {
  const profile = await getProfile();
  if (!profile || profile.rol !== "ADMIN_ENTIDAD") return { status: "unauth" };

  if (!profile.entidad_id) return { status: "missing", profile };

  const entidad = await getEntidad(profile.entidad_id);
  if (!entidad) return { status: "missing", profile };
  if (!entidad.activo) return { status: "inactive", profile, entidad };

  return { status: "ok", profile, entidad };
}
