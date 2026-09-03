import type { User } from "@supabase/supabase-js";
import { sendUserInvitation, syncAdminProfile, type InviteMode } from "@inventario/auth-invite";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/auth/site-origin";

export async function inviteEntidadAdmin(
  entidadId: string,
  email: string,
  nombre: string,
  entidadNombre?: string,
  options?: { mode?: InviteMode },
) {
  const admin = createAdminClient();
  if (!admin) {
    return {
      success: true,
      invited: false,
      warning:
        "Entidad guardada. Configure SUPABASE_SERVICE_ROLE_KEY para enviar la invitación por correo; el admin podrá ingresar con Google usando ese correo.",
    };
  }

  return sendUserInvitation(admin, {
    email,
    nombre,
    rol: "ADMIN_ENTIDAD",
    entidadId,
    entidadNombre,
    mode: options?.mode ?? "invite",
    redirectTo: `${siteOrigin()}/auth/callback`,
  });
}

export async function provisionProfileFromEntidad(user: User) {
  const email = user.email?.trim().toLowerCase() ?? null;
  if (!email) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  const { data: existing } = await admin
    .from("profiles")
    .select("id, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (existing?.activo) return existing;

  const { data: entidad } = await admin
    .from("entidades")
    .select("id, admin_nombre, admin_email")
    .eq("activo", true)
    .ilike("admin_email", email)
    .maybeSingle();

  if (!entidad) return null;

  const nombre =
    entidad.admin_nombre?.trim() ||
    (typeof user.user_metadata?.nombre === "string" ? user.user_metadata.nombre : null) ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ||
    email;

  const result = await syncAdminProfile(admin, user.id, {
    email,
    nombre,
    entidadId: entidad.id,
  });
  if (result.error) return null;

  return admin
    .from("profiles")
    .select("rol, activo")
    .eq("id", user.id)
    .maybeSingle()
    .then((r) => r.data);
}
