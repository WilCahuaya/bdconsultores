import { normalizeResponsableDni, normalizeResponsableNombre, RESPONSABLE_CARGO_ADMIN } from "@inventario/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ResponsableSyncRow = {
  id: string;
  nombre: string;
  email: string | null;
  dni: string | null;
  telefono: string | null;
  cargo: string | null;
  activo: boolean;
};

function sameAdminPayload(
  row: Pick<ResponsableSyncRow, "nombre" | "email" | "dni" | "telefono" | "cargo" | "activo">,
  payload: {
    nombre: string;
    email: string;
    dni: string | null;
    telefono: string | null;
    cargo: string;
    activo: boolean;
  },
): boolean {
  return (
    normalizeResponsableNombre(row.nombre) === payload.nombre &&
    (row.email?.trim().toLowerCase() ?? "") === payload.email &&
    (normalizeResponsableDni(row.dni ?? "") || null) === payload.dni &&
    (row.telefono?.trim() || null) === payload.telefono &&
    (row.cargo ?? null) === payload.cargo &&
    row.activo === payload.activo
  );
}

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
    .select("id, nombre, email, dni, telefono, cargo, activo")
    .eq("entidad_id", entidadId)
    .ilike("email", emailNorm)
    .maybeSingle();

  if (byEmail) {
    if (sameAdminPayload(byEmail as ResponsableSyncRow, payload)) return;
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
      .select("id, nombre, email, dni, telefono, cargo, activo")
      .eq("entidad_id", entidadId)
      .ilike("nombre", nombre)
      .maybeSingle();
    if (byName) {
      if (sameAdminPayload(byName as ResponsableSyncRow, payload)) return;
      await supabase.from("responsables").update(payload).eq("id", byName.id);
    }
  }
}
