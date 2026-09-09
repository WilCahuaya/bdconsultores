import { normalizeResponsableDni, normalizeResponsableNombre, RESPONSABLE_CARGO_ADMIN } from "@inventario/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Mantiene un registro en responsables alineado con el administrador de la entidad. */
export async function syncAdminResponsableForEntidad(
  supabase: SupabaseClient,
  entidadId: string,
  adminNombre: string,
  adminEmail: string,
  adminTelefono?: string | null,
  adminDni?: string | null,
): Promise<void> {
  const emailNorm = adminEmail.trim().toLowerCase();
  const nombre = normalizeResponsableNombre(adminNombre);
  if (!emailNorm || !nombre) return;

  const payload = {
    nombre,
    email: emailNorm,
    dni: normalizeResponsableDni(adminDni ?? "") || null,
    telefono: adminTelefono?.trim() || null,
    cargo: RESPONSABLE_CARGO_ADMIN,
    activo: true,
  };

  const { data: byEmail } = await supabase
    .from("responsables")
    .select("id")
    .eq("entidad_id", entidadId)
    .ilike("email", emailNorm)
    .maybeSingle();

  if (byEmail) {
    await supabase.from("responsables").update(payload).eq("id", byEmail.id);
    return;
  }

  const { error } = await supabase.from("responsables").insert({
    entidad_id: entidadId,
    ...payload,
  });

  if (error?.code === "23505") {
    const { data: byName } = await supabase
      .from("responsables")
      .select("id")
      .eq("entidad_id", entidadId)
      .ilike("nombre", nombre)
      .maybeSingle();
    if (byName) await supabase.from("responsables").update(payload).eq("id", byName.id);
  }
}
