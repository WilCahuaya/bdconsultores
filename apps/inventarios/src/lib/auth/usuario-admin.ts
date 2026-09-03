import {
  validarDesactivarUsuario,
  validarEliminarUsuario,
  validarReactivarUsuario,
  type Profile,
  type UsuarioGestionResumen,
} from "@inventario/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function countUsuarioVinculos(userId: string): Promise<{
  activos: number;
  historial: number;
}> {
  const supabase = await createClient();

  const [activos, historial] = await Promise.all([
    supabase
      .from("activos")
      .select("id", { count: "exact", head: true })
      .or(`created_by.eq.${userId},updated_by.eq.${userId}`),
    supabase
      .from("historial_cambios")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", userId),
  ]);

  return { activos: activos.count ?? 0, historial: historial.count ?? 0 };
}

async function loadUsuarioGestion(userId: string): Promise<UsuarioGestionResumen | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, rol, activo, nombre, email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as UsuarioGestionResumen;
}

async function loadUsuariosGestion(): Promise<UsuarioGestionResumen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, rol, activo, nombre, email")
    .order("nombre");

  if (error) throw new Error(error.message);
  return (data ?? []) as UsuarioGestionResumen[];
}

export async function setUsuarioActivoForAdmin(input: {
  userId: string;
  activo: boolean;
  actor: Profile;
}): Promise<{ error?: string }> {
  const target = await loadUsuarioGestion(input.userId);
  if (!target) return { error: "Usuario no encontrado." };

  const usuarios = await loadUsuariosGestion();
  const validationError = input.activo
    ? validarReactivarUsuario(target)
    : validarDesactivarUsuario({
        target,
        actorId: input.actor.id,
        usuarios,
      });

  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ activo: input.activo })
    .eq("id", input.userId);

  if (error) return { error: error.message };
  return {};
}

export async function deleteUsuarioForAdmin(input: {
  userId: string;
  actor: Profile;
}): Promise<{ error?: string }> {
  const target = await loadUsuarioGestion(input.userId);
  if (!target) return { error: "Usuario no encontrado." };

  const vinculos = await countUsuarioVinculos(input.userId);
  const validationError = validarEliminarUsuario({
    target,
    actorId: input.actor.id,
    activosVinculados: vinculos.activos,
    historialVinculado: vinculos.historial,
  });

  if (validationError) return { error: validationError };

  const admin = createAdminClient();
  if (!admin) {
    return {
      error: "Configure SUPABASE_SERVICE_ROLE_KEY para eliminar usuarios de forma permanente.",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(input.userId);
  if (error) return { error: error.message };
  return {};
}
