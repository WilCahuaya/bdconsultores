import { sendUserInvitation } from "@inventario/auth-invite";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/auth/site-origin";

export async function inviteEntidadAdmin(
  entidadId: string,
  email: string,
  nombre: string,
  entidadNombre?: string,
) {
  const admin = createAdminClient();
  if (!admin) {
    return {
      success: true,
      invited: false,
      warning:
        "Empresa guardada. Configure SUPABASE_SERVICE_ROLE_KEY para enviar la invitación por correo; el administrador podrá ingresar con Google usando ese correo.",
    };
  }

  return sendUserInvitation(admin, {
    email,
    nombre,
    rol: "ADMIN_ENTIDAD",
    entidadId,
    entidadNombre,
    mode: "invite",
    redirectTo: `${siteOrigin()}/auth/callback`,
  });
}
