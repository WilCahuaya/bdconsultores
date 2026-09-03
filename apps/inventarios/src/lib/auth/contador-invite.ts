import type { User } from "@supabase/supabase-js";
import { sendUserInvitation, syncContadorProfile, type InviteMode } from "@inventario/auth-invite";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/auth/site-origin";

export async function inviteContador(
  email: string,
  nombre: string,
  options?: { mode?: InviteMode },
) {
  const admin = createAdminClient();
  if (!admin) {
    return {
      success: true,
      invited: false,
      warning:
        "Configure SUPABASE_SERVICE_ROLE_KEY para enviar la invitación por correo; el contador podrá ingresar con Google usando ese correo.",
    };
  }

  return sendUserInvitation(admin, {
    email,
    nombre,
    rol: "CONTADOR",
    mode: options?.mode ?? "invite",
    redirectTo: `${siteOrigin()}/auth/callback`,
  });
}

export async function resendInvitacionUsuario(input: {
  email: string;
  nombre: string;
  rol: "CONTADOR" | "ADMIN_ENTIDAD";
  entidadId?: string | null;
  entidadNombre?: string | null;
}) {
  const admin = createAdminClient();
  if (!admin) {
    return {
      success: true,
      invited: false,
      warning:
        "Configure SUPABASE_SERVICE_ROLE_KEY para enviar la invitación por correo.",
    };
  }

  return sendUserInvitation(admin, {
    email: input.email,
    nombre: input.nombre,
    rol: input.rol,
    entidadId: input.entidadId,
    entidadNombre: input.entidadNombre,
    mode: "resend",
    redirectTo: `${siteOrigin()}/auth/callback`,
  });
}

export async function provisionProfileFromContador(user: User) {
  const rol = user.user_metadata?.rol;
  if (rol !== "CONTADOR") return null;

  const email = user.email ? user.email.trim().toLowerCase() : null;
  if (!email) return null;

  const nombre =
    (typeof user.user_metadata?.nombre === "string" ? user.user_metadata.nombre : null) ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ||
    email;

  const admin = createAdminClient();
  if (!admin) return null;

  const result = await syncContadorProfile(admin, user.id, { email, nombre });
  if (result.error) return null;

  return admin
    .from("profiles")
    .select("rol, activo")
    .eq("id", user.id)
    .maybeSingle()
    .then((r) => r.data);
}
