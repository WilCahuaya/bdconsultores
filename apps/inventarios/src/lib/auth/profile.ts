import type { Profile, RolUsuario } from "@inventario/types";
import { homePathForRole, inventarioHomePathForRole } from "@inventario/types";
import { portalOrigin } from "@bd/config";
import { createClient } from "@/lib/supabase/server";

export function portalLoginHref(): string {
  return `${portalOrigin()}/login`;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .eq("activo", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}

export async function requireProfile(requiredRole?: RolUsuario): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) {
    throw new Error("NO_PROFILE");
  }
  if (requiredRole && profile.rol !== requiredRole) {
    throw new Error("FORBIDDEN");
  }
  return profile;
}

export { homePathForRole, inventarioHomePathForRole };
