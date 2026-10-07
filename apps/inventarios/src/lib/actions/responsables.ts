"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateResponsableInput,
  Responsable,
  ResponsableConConteo,
  TrabajadorPlanillaOpcion,
  UpdateResponsableInput,
} from "@inventario/types";
import {
  normalizeResponsableDni,
  normalizeResponsableNombre,
  RESPONSABLE_CARGO_DEFAULT,
  validarCreateResponsableInput,
  validarResponsableEmail,
  validarResponsableTelefono,
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

type PersonaPlanillaEmbed = {
  dni: string;
  nombres: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  celular: string | null;
  correo: string | null;
};

function nombrePersonaPlanilla(persona: PersonaPlanillaEmbed): string {
  return [persona.nombres, persona.apellido_paterno, persona.apellido_materno]
    .map((parte) => parte?.trim())
    .filter(Boolean)
    .join(" ");
}

function personaEmbed(
  personas: PersonaPlanillaEmbed | PersonaPlanillaEmbed[] | null,
): PersonaPlanillaEmbed | null {
  if (!personas) return null;
  return Array.isArray(personas) ? (personas[0] ?? null) : personas;
}

/** Trabajadores con relación activa, para elegirlos como responsable de inventario. */
export async function listTrabajadoresActivosPlanilla(
  entidadId: string,
): Promise<TrabajadorPlanillaOpcion[]> {
  const profile = await getProfile();
  if (!profile) return [];
  if (profile.rol === "ADMIN_ENTIDAD" && profile.entidad_id !== entidadId) return [];

  const supabase = await createClient();
  const { data: entidad } = await supabase
    .from("entidades")
    .select("usa_planillas")
    .eq("id", entidadId)
    .maybeSingle();
  if (!entidad || entidad.usa_planillas === false) return [];

  const { data, error } = await supabase
    .schema("planillas")
    .from("relaciones_laborales")
    .select(
      "id, cargo, personas!inner(dni, nombres, apellido_paterno, apellido_materno, celular, correo)",
    )
    .eq("entidad_id", entidadId)
    .eq("estado", "ACTIVA")
    .is("fecha_cese", null);

  if (error || !data) return [];

  const opciones: TrabajadorPlanillaOpcion[] = [];
  for (const row of data) {
    const persona = personaEmbed(
      row.personas as PersonaPlanillaEmbed | PersonaPlanillaEmbed[] | null,
    );
    if (!persona) continue;
    const nombre = normalizeResponsableNombre(nombrePersonaPlanilla(persona));
    if (!nombre) continue;
    opciones.push({
      relacionId: row.id as string,
      nombre,
      dni: normalizeResponsableDni(persona.dni ?? ""),
      email: persona.correo?.trim() || null,
      telefono: persona.celular?.trim() || null,
      cargo: typeof row.cargo === "string" && row.cargo.trim() ? row.cargo.trim() : null,
    });
  }

  opciones.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return opciones;
}

export async function createResponsable(
  entidadId: string,
  input: CreateResponsableInput,
): Promise<{ data?: Responsable; error?: string; reused?: boolean }> {
  try {
    await assertCanManageEntidad(entidadId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const desdePlanilla = Boolean(input.desdePlanilla);
  const contacto: CreateResponsableInput = desdePlanilla
    ? {
        ...input,
        email: validarResponsableEmail(input.email) ? "" : input.email,
        telefono: validarResponsableTelefono(input.telefono) ? "" : input.telefono,
      }
    : input;

  const validationError = validarCreateResponsableInput(contacto);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const nombre = normalizeResponsableNombre(contacto.nombre);
  const dni = normalizeResponsableDni(contacto.dni) || null;
  const trimOrNull = (v?: string) => {
    const t = v?.trim();
    return t ? t : null;
  };

  if (desdePlanilla && dni) {
    const { data: existing } = await supabase
      .from("responsables")
      .select("*")
      .eq("entidad_id", entidadId)
      .eq("dni", dni)
      .maybeSingle();

    if (existing) {
      const cargoPlanilla = contacto.cargo?.trim() || RESPONSABLE_CARGO_DEFAULT;
      const emailPlanilla = trimOrNull(contacto.email)?.toLowerCase() ?? null;
      const telefonoPlanilla = trimOrNull(contacto.telefono);
      const sinCambios =
        existing.activo &&
        normalizeResponsableNombre(existing.nombre) === nombre &&
        (normalizeResponsableDni(existing.dni ?? "") || null) === dni &&
        (existing.email?.trim().toLowerCase() ?? null) === emailPlanilla &&
        (existing.telefono?.trim() || null) === telefonoPlanilla &&
        (existing.cargo ?? null) === cargoPlanilla;
      if (sinCambios) {
        return { data: existing as Responsable, reused: true };
      }
      const { data: actualizado, error: actError } = await supabase
        .from("responsables")
        .update({
          activo: true,
          nombre,
          dni,
          email: emailPlanilla,
          telefono: telefonoPlanilla,
          cargo: cargoPlanilla,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (actError) return { error: actError.message };
      revalidateEntidadResponsables(entidadId);
      return { data: actualizado as Responsable, reused: true };
    }
  }

  const cargo = desdePlanilla
    ? contacto.cargo?.trim() || RESPONSABLE_CARGO_DEFAULT
    : RESPONSABLE_CARGO_DEFAULT;

  const { data, error } = await supabase
    .from("responsables")
    .insert({
      entidad_id: entidadId,
      nombre,
      dni,
      email: trimOrNull(contacto.email),
      telefono: trimOrNull(contacto.telefono),
      cargo,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505" && desdePlanilla) {
      const { data: mismoNombre } = await supabase
        .from("responsables")
        .select("*")
        .eq("entidad_id", entidadId)
        .ilike("nombre", nombre)
        .maybeSingle();
      if (mismoNombre) {
        if (!mismoNombre.activo) {
          const { data: reactivado, error: actError } = await supabase
            .from("responsables")
            .update({ activo: true })
            .eq("id", mismoNombre.id)
            .select()
            .single();
          if (actError) return { error: actError.message };
          revalidateEntidadResponsables(entidadId);
          return { data: reactivado as Responsable, reused: true };
        }
        return { data: mismoNombre as Responsable, reused: true };
      }
    }
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
