import type { Profile } from "@inventario/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resendInvitacionUsuario as resendInvitacionAuth } from "@/lib/auth/contador-invite";

export interface ResendInvitacionUsuarioResult {
  error?: string;
  success?: boolean;
  invited?: boolean;
  message?: string | null;
}

export async function resendInvitacionUsuarioById(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResendInvitacionUsuarioResult> {
  const { data: row, error } = await supabase
    .from("profiles")
    .select("*, entidades(nombre)")
    .eq("id", userId)
    .maybeSingle();

  if (error || !row) return { error: "Usuario no encontrado." };

  const { entidades, ...profile } = row as Profile & {
    entidades: { nombre: string } | null;
  };

  if (profile.rol !== "CONTADOR" && profile.rol !== "ADMIN_ENTIDAD") {
    return { error: "Rol de usuario no admitido para invitación." };
  }

  const result = await resendInvitacionAuth({
    email: profile.email,
    nombre: profile.nombre,
    rol: profile.rol,
    entidadId: profile.entidad_id,
    entidadNombre: entidades?.nombre ?? null,
  });

  if (result.error) return { error: result.error };

  return {
    success: true,
    invited: result.invited,
    message: result.message ?? result.warning ?? null,
  };
}
