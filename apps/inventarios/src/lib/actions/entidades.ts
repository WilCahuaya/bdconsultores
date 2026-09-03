"use server";

import { revalidatePath } from "next/cache";
import type { Entidad, EntidadConConteo } from "@inventario/types";
import { normalizeResponsableDni, validarAdminEntidadDni } from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { inviteEntidadAdmin } from "@/lib/auth/entidad-admin";
import { getProfile, requireProfile } from "@/lib/auth/profile";
import { syncSedePrincipalDireccionFromEntidad } from "@/lib/sede-principal-direccion";
import { syncAdminResponsableForEntidad } from "@/lib/responsables-admin-sync";

export interface CreateEntidadInput {
  nombre: string;
  nombre_etiqueta?: string | null;
  ruc?: string;
  direccion?: string;
  admin_nombre?: string;
  admin_email?: string;
  admin_dni?: string;
  admin_telefono?: string;
}

export async function createEntidad(input: CreateEntidadInput) {
  await requireProfile("CONTADOR");
  const supabase = await createClient();

  const nombre = input.nombre.trim();
  const ruc = input.ruc?.trim() || null;
  const adminEmail = input.admin_email?.trim() || null;
  const adminNombre = input.admin_nombre?.trim() || null;

  if (!nombre) return { error: "La razón social es obligatoria." };
  if (!adminEmail) return { error: "El correo del administrador es obligatorio." };
  if (!adminNombre) return { error: "El nombre del administrador es obligatorio." };
  const adminDni = normalizeResponsableDni(input.admin_dni ?? "");
  const dniError = validarAdminEntidadDni(adminDni);
  if (dniError) return { error: dniError };

  const { data, error } = await supabase
    .from("entidades")
    .insert({
      nombre,
      nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
      ruc,
      direccion: input.direccion?.trim() || null,
      admin_nombre: adminNombre,
      admin_email: adminEmail,
      admin_dni: adminDni,
      admin_telefono: input.admin_telefono?.trim() || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await syncSedePrincipalDireccionFromEntidad(supabase, data.id, data.direccion);

  await syncAdminResponsableForEntidad(
    supabase,
    data.id,
    adminNombre,
    adminEmail,
    input.admin_telefono,
    adminDni,
  );

  const invite = await inviteEntidadAdmin(data.id, adminEmail, adminNombre, nombre);
  if (invite.error) return { error: invite.error };

  revalidatePath("/contador/entidades");
  revalidatePath("/contador/usuarios");
  return {
    success: true,
    data: data as Entidad,
    inviteMessage: invite.message ?? invite.warning ?? null,
  };
}

/** Devuelve la entidad aunque esté inactiva (útil para gestión y bloqueo de admin). */
export async function getEntidad(entidadId: string): Promise<Entidad | null> {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entidades")
    .select("*")
    .eq("id", entidadId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Entidad;
}

export async function listEntidades(): Promise<EntidadConConteo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entidades")
    .select("*")
    .order("activo", { ascending: false })
    .order("nombre");

  if (error) throw new Error(error.message);

  const { data: ambientesRows } = await supabase
    .from("ambientes")
    .select("id, sedes!inner(entidad_id)")
    .eq("activo", true);

  const ambienteCountByEntidad = new Map<string, number>();
  for (const row of ambientesRows ?? []) {
    const sedes = row.sedes;
    const sede = Array.isArray(sedes) ? sedes[0] : sedes;
    const entidadId =
      sede && typeof sede === "object" && "entidad_id" in sede
        ? String((sede as { entidad_id: string }).entidad_id)
        : null;
    if (!entidadId) continue;
    ambienteCountByEntidad.set(entidadId, (ambienteCountByEntidad.get(entidadId) ?? 0) + 1);
  }

  const { data: activosRows } = await supabase.from("activos").select("entidad_id");
  const activoCountByEntidad = new Map<string, number>();
  for (const row of activosRows ?? []) {
    const entidadId = row.entidad_id as string;
    activoCountByEntidad.set(entidadId, (activoCountByEntidad.get(entidadId) ?? 0) + 1);
  }

  return ((data ?? []) as Entidad[]).map((entidad) => ({
    ...entidad,
    ambiente_count: ambienteCountByEntidad.get(entidad.id) ?? 0,
    activo_count: activoCountByEntidad.get(entidad.id) ?? 0,
  }));
}

export async function updateEntidad(entidadId: string, input: CreateEntidadInput) {
  await requireProfile("CONTADOR");
  const supabase = await createClient();

  const nombre = input.nombre.trim();
  const adminEmail = input.admin_email?.trim() || null;
  const adminNombre = input.admin_nombre?.trim() || null;

  if (!nombre) return { error: "La razón social es obligatoria." };
  if (!adminEmail) return { error: "El correo del administrador es obligatorio." };
  if (!adminNombre) return { error: "El nombre del administrador es obligatorio." };
  const adminDni = normalizeResponsableDni(input.admin_dni ?? "");
  const dniError = validarAdminEntidadDni(adminDni);
  if (dniError) return { error: dniError };

  const { data: entidadAnterior } = await supabase
    .from("entidades")
    .select("admin_email")
    .eq("id", entidadId)
    .eq("activo", true)
    .maybeSingle();

  const adminEmailAnterior = entidadAnterior?.admin_email?.trim().toLowerCase() ?? null;
  const adminEmailNorm = adminEmail.toLowerCase();
  const inviteMode =
    adminEmailAnterior && adminEmailAnterior === adminEmailNorm ? "resend" : "invite";

  const { data, error } = await supabase
    .from("entidades")
    .update({
      nombre,
      nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
      ruc: input.ruc?.trim() || null,
      direccion: input.direccion?.trim() || null,
      admin_nombre: adminNombre,
      admin_email: adminEmail,
      admin_dni: adminDni,
      admin_telefono: input.admin_telefono?.trim() || null,
    })
    .eq("id", entidadId)
    .eq("activo", true)
    .select()
    .single();

  if (error) return { error: error.message };

  await syncSedePrincipalDireccionFromEntidad(supabase, data.id, data.direccion);

  await syncAdminResponsableForEntidad(
    supabase,
    entidadId,
    adminNombre,
    adminEmail,
    input.admin_telefono,
    adminDni,
  );

  const invite = await inviteEntidadAdmin(entidadId, adminEmail, adminNombre, nombre, {
    mode: inviteMode,
  });
  if (invite.error) return { error: invite.error };

  revalidatePath("/contador/entidades");
  revalidatePath(`/contador/entidades/${entidadId}`);
  return {
    success: true,
    data: data as Entidad,
    inviteMessage: invite.message ?? invite.warning ?? null,
  };
}

export async function setEntidadActivo(entidadId: string, activo: boolean) {
  await requireProfile("CONTADOR");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entidades")
    .update({ activo })
    .eq("id", entidadId)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/contador/entidades");
  revalidatePath(`/contador/entidades/${entidadId}`);
  return { success: true, data: data as Entidad };
}

/** Elimina la entidad de forma permanente. Solo si no tiene activos (cualquier estado).
 *  En cascada se borran sedes, ambientes (incluido el de preregistros), responsables, etc.
 */
export async function deleteEntidad(entidadId: string) {
  await requireProfile("CONTADOR");
  const supabase = await createClient();

  const { count } = await supabase
    .from("activos")
    .select("*", { count: "exact", head: true })
    .eq("entidad_id", entidadId);

  if ((count ?? 0) > 0) {
    return {
      error:
        "No puede eliminar una entidad que tiene activos (registrados, preregistrados o dados de baja). Elimine o dé de baja los bienes primero, o desactive la entidad.",
    };
  }

  const { error } = await supabase.from("entidades").delete().eq("id", entidadId);

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("preregistro") || msg.includes("preregistros")) {
      return {
        error:
          "No se pudo eliminar por el ambiente de preregistros. Actualice la base de datos (migración de cascada) e intente de nuevo.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/contador/entidades");
  return { success: true };
}
