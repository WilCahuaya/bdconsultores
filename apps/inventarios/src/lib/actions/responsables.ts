"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateResponsableInput,
  Responsable,
  ResponsableConConteo,
  UpdateResponsableInput,
} from "@inventario/types";
import {
  normalizeResponsableDni,
  normalizeResponsableNombre,
  RESPONSABLE_CARGO_DEFAULT,
  validarCreateResponsableInput,
} from "@inventario/types";
import { syncAdminResponsableForEntidad } from "@/lib/responsables-admin-sync";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";

function revalidateEntidadResponsables(entidadId: string) {
  revalidatePath(`/contador/entidades/${entidadId}`);
  revalidatePath("/admin/activos");
}

async function assertCanManageEntidad(entidadId: string) {
  const profile = await getProfile();
  if (!profile) throw new Error("Sesión no válida.");
  if (profile.rol === "CONTADOR") return profile;
  if (profile.rol === "ADMIN_ENTIDAD" && profile.entidad_id === entidadId) return profile;
  throw new Error("No autorizado.");
}

type AmbienteRow = {
  id: string;
  nombre: string;
  activo: boolean;
  sedes: { nombre: string } | null;
};

function mapResponsableRow(
  row: Responsable & { ambientes?: AmbienteRow[] | null },
  adminEmailNorm: string,
): ResponsableConConteo {
  const { ambientes: ambientesRaw, ...rest } = row;
  const ambientesActivos = (ambientesRaw ?? []).filter((a) => a.activo);
  const ambiente_nombres = ambientesActivos.map((a) => {
    const sede = a.sedes?.nombre;
    return sede ? `${a.nombre} (${sede})` : a.nombre;
  });
  const emailNorm = rest.email?.trim().toLowerCase() ?? "";

  return {
    ...rest,
    ambiente_count: ambientesActivos.length,
    ambiente_nombres,
    es_administrador: Boolean(adminEmailNorm && emailNorm && emailNorm === adminEmailNorm),
  };
}

export async function listResponsables(entidadId: string): Promise<ResponsableConConteo[]> {
  const profile = await getProfile();
  if (!profile) return [];
  if (profile.rol === "ADMIN_ENTIDAD" && profile.entidad_id !== entidadId) return [];

  const supabase = await createClient();

  const { data: entidad } = await supabase
    .from("entidades")
    .select("admin_nombre, admin_email, admin_dni, admin_telefono")
    .eq("id", entidadId)
    .maybeSingle();

  if (entidad?.admin_email && entidad.admin_nombre) {
    await syncAdminResponsableForEntidad(
      supabase,
      entidadId,
      entidad.admin_nombre,
      entidad.admin_email,
      entidad.admin_telefono,
      entidad.admin_dni,
    );
  }

  const adminEmailNorm = entidad?.admin_email?.trim().toLowerCase() ?? "";

  const { data, error } = await supabase
    .from("responsables")
    .select("*, ambientes(id, nombre, activo, sedes(nombre))")
    .eq("entidad_id", entidadId)
    .order("nombre");

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) =>
    mapResponsableRow(row as Responsable & { ambientes?: AmbienteRow[] | null }, adminEmailNorm),
  );

  return rows.sort((a, b) => {
    if (a.es_administrador !== b.es_administrador) return a.es_administrador ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export async function createResponsable(
  entidadId: string,
  input: CreateResponsableInput,
): Promise<{ data?: Responsable; error?: string }> {
  try {
    await assertCanManageEntidad(entidadId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const validationError = validarCreateResponsableInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const nombre = normalizeResponsableNombre(input.nombre);
  const trimOrNull = (v?: string) => {
    const t = v?.trim();
    return t ? t : null;
  };

  const { data, error } = await supabase
    .from("responsables")
    .insert({
      entidad_id: entidadId,
      nombre,
      dni: normalizeResponsableDni(input.dni) || null,
      email: trimOrNull(input.email),
      telefono: trimOrNull(input.telefono),
      cargo: RESPONSABLE_CARGO_DEFAULT,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("dni") || error.message.includes("idx_responsables_entidad_dni")) {
        return { error: "Ya existe un responsable con ese DNI en esta entidad." };
      }
      return { error: `Ya existe un responsable llamado «${nombre}» en esta entidad.` };
    }
    return { error: error.message };
  }

  revalidateEntidadResponsables(entidadId);
  return { data: data as Responsable };
}

export async function updateResponsable(
  responsableId: string,
  input: UpdateResponsableInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("responsables")
    .select("entidad_id, email, nombre, dni, telefono")
    .eq("id", responsableId)
    .maybeSingle();

  if (!existing) return { error: "Responsable no encontrado." };

  try {
    await assertCanManageEntidad(existing.entidad_id as string);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const trimOrNull = (v?: string) => {
    const t = v?.trim();
    return t ? t : null;
  };

  const { data: entidad } = await supabase
    .from("entidades")
    .select("admin_email")
    .eq("id", existing.entidad_id)
    .maybeSingle();
  const adminEmailNorm = entidad?.admin_email?.trim().toLowerCase() ?? "";
  const esAdministrador = Boolean(
    adminEmailNorm && (existing.email?.trim().toLowerCase() ?? "") === adminEmailNorm,
  );

  if (esAdministrador) {
    const telefono = trimOrNull(input.telefono);
    const validationError = validarCreateResponsableInput({
      nombre: existing.nombre,
      dni: existing.dni ?? "",
      email: existing.email ?? "",
      telefono: telefono ?? "",
    });
    if (validationError) return { error: validationError };

    const { error } = await supabase
      .from("responsables")
      .update({ telefono })
      .eq("id", responsableId);
    if (error) return { error: error.message };

    await supabase
      .from("entidades")
      .update({ admin_telefono: telefono })
      .eq("id", existing.entidad_id);

    revalidateEntidadResponsables(existing.entidad_id as string);
    return {};
  }

  const validationError = validarCreateResponsableInput(input);
  if (validationError) return { error: validationError };

  const { error } = await supabase
    .from("responsables")
    .update({
      nombre: normalizeResponsableNombre(input.nombre),
      dni: normalizeResponsableDni(input.dni) || null,
      email: trimOrNull(input.email),
      telefono: trimOrNull(input.telefono),
      ...(input.activo !== undefined ? { activo: input.activo } : {}),
    })
    .eq("id", responsableId);

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("dni") || error.message.includes("idx_responsables_entidad_dni")) {
        return { error: "Ya existe otro responsable con ese DNI en la entidad." };
      }
      return { error: "Ya existe otro responsable con ese nombre en la entidad." };
    }
    return { error: error.message };
  }

  revalidateEntidadResponsables(existing.entidad_id as string);
  return {};
}

export async function setResponsableActivo(
  responsableId: string,
  activo: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("responsables")
    .select("entidad_id")
    .eq("id", responsableId)
    .maybeSingle();

  if (!existing) return { error: "Responsable no encontrado." };

  try {
    await assertCanManageEntidad(existing.entidad_id as string);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const { error } = await supabase
    .from("responsables")
    .update({ activo })
    .eq("id", responsableId);

  if (error) return { error: error.message };
  revalidateEntidadResponsables(existing.entidad_id as string);
  return {};
}

export async function deleteResponsable(
  responsableId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("responsables")
    .select("entidad_id, email, activo")
    .eq("id", responsableId)
    .maybeSingle();

  if (!existing) return { error: "Responsable no encontrado." };

  try {
    await assertCanManageEntidad(existing.entidad_id as string);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  if (existing.activo) {
    return { error: "Desactive el responsable antes de eliminarlo definitivamente." };
  }

  const { data: entidad } = await supabase
    .from("entidades")
    .select("admin_email")
    .eq("id", existing.entidad_id)
    .maybeSingle();

  const adminEmailNorm = entidad?.admin_email?.trim().toLowerCase() ?? "";
  const emailNorm = (existing.email as string | null)?.trim().toLowerCase() ?? "";
  if (adminEmailNorm && emailNorm === adminEmailNorm) {
    return {
      error:
        "No puede eliminar al administrador de la entidad. Actualice los datos del administrador en la ficha de la entidad.",
    };
  }

  const { count } = await supabase
    .from("ambientes")
    .select("*", { count: "exact", head: true })
    .eq("responsable_id", responsableId)
    .eq("activo", true);

  if ((count ?? 0) > 0) {
    return {
      error: "No puede eliminar un responsable con ambientes asignados. Reasigne los ambientes o desactívelo.",
    };
  }

  const { error } = await supabase.from("responsables").delete().eq("id", responsableId);

  if (error) return { error: error.message };
  revalidateEntidadResponsables(existing.entidad_id as string);
  return {};
}

export async function assignResponsableAmbiente(
  ambienteId: string,
  responsableId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: ambiente } = await supabase
    .from("ambientes")
    .select("id, sede_id")
    .eq("id", ambienteId)
    .eq("activo", true)
    .maybeSingle();

  if (!ambiente) return { error: "Ambiente no encontrado." };

  const { data: sede } = await supabase
    .from("sedes")
    .select("entidad_id")
    .eq("id", ambiente.sede_id)
    .maybeSingle();

  if (!sede?.entidad_id) return { error: "Sucursal no encontrada." };

  try {
    await assertCanManageEntidad(sede.entidad_id as string);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const { error } = await supabase
    .from("ambientes")
    .update({ responsable_id: responsableId })
    .eq("id", ambienteId);

  if (error) return { error: error.message };
  revalidateEntidadResponsables(sede.entidad_id as string);
  return {};
}
