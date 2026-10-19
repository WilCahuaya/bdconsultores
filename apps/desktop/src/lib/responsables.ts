import type {
  CreateResponsableInput,
  Entidad,
  Responsable,
  ResponsableConConteo,
  UpdateResponsableInput,
} from "@inventario/types";
import {
  marcarResponsablesDesdePlanilla,
  MENSAJE_RESPONSABLE_DESDE_PLANILLA,
  normalizeResponsableDni,
  normalizeResponsableNombre,
  RESPONSABLE_CARGO_DEFAULT,
  validarCreateResponsableInput,
} from "@inventario/types";
import {
  enqueueOfflineOp,
  findMasterItem,
  isOnline,
  listMasterDomain,
  newLocalId,
  removeMasterItem,
  replaceMasterDomain,
  upsertMasterItem,
} from "./master-cache";
import { syncAdminResponsableForEntidad } from "./responsables-admin-sync";
import { fetchProfile } from "./profile";
import { getSupabaseClient } from "./supabase";

async function assertCanManageEntidad(
  entidadId: string,
): Promise<{ error?: string } | null> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol === "CONTADOR") return null;
  if (profile.rol === "ADMIN_ENTIDAD" && profile.entidad_id === entidadId) return null;
  return { error: "No autorizado." };
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

async function dnisTrabajadoresActivosPlanilla(entidadId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data: entidad } = await supabase
    .from("entidades")
    .select("usa_planillas")
    .eq("id", entidadId)
    .maybeSingle();
  if (!entidad || entidad.usa_planillas === false) return [];

  const { data, error } = await supabase
    .schema("planillas")
    .from("relaciones_laborales")
    .select("personas!inner(dni)")
    .eq("entidad_id", entidadId)
    .eq("estado", "ACTIVA")
    .is("fecha_cese", null);
  if (error || !data) return [];

  const dnis: string[] = [];
  for (const row of data) {
    const personas = row.personas as { dni?: string } | { dni?: string }[] | null;
    const persona = Array.isArray(personas) ? personas[0] : personas;
    const dni = normalizeResponsableDni(persona?.dni ?? "");
    if (dni) dnis.push(dni);
  }
  return dnis;
}

function sortResponsables(rows: ResponsableConConteo[]): ResponsableConConteo[] {
  return [...rows].sort((a, b) => {
    if (a.es_administrador !== b.es_administrador) return a.es_administrador ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export async function listResponsables(
  entidadId: string,
): Promise<{ data?: ResponsableConConteo[]; error?: string }> {
  const auth = await assertCanManageEntidad(entidadId);
  if (auth?.error) return auth;

  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();

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

      if (error) return { error: error.message };

      const rows = (data ?? []).map((row) =>
        mapResponsableRow(
          row as Responsable & { ambientes?: AmbienteRow[] | null },
          adminEmailNorm,
        ),
      );
      const sorted = sortResponsables(
        marcarResponsablesDesdePlanilla(rows, await dnisTrabajadoresActivosPlanilla(entidadId)),
      );
      await replaceMasterDomain("responsables", entidadId, sorted);
      return { data: sorted };
    } catch (err) {
      const cached = await listMasterDomain<ResponsableConConteo>("responsables", entidadId);
      if (cached.length > 0) return { data: sortResponsables(cached) };
      return { error: err instanceof Error ? err.message : "Error al listar responsables" };
    }
  }

  const cached = await listMasterDomain<ResponsableConConteo>("responsables", entidadId);
  return { data: sortResponsables(cached) };
}

export async function createResponsable(
  entidadId: string,
  input: CreateResponsableInput,
): Promise<{ data?: Responsable; error?: string }> {
  const auth = await assertCanManageEntidad(entidadId);
  if (auth?.error) return auth;

  const validationError = validarCreateResponsableInput(input);
  if (validationError) return { error: validationError };

  const nombre = normalizeResponsableNombre(input.nombre);
  const trimOrNull = (v?: string) => {
    const t = v?.trim();
    return t ? t : null;
  };

  if (!isOnline()) {
    const existentes = await listMasterDomain<ResponsableConConteo>("responsables", entidadId);
    const dni = normalizeResponsableDni(input.dni) || null;
    if (dni && existentes.some((r) => r.dni === dni)) {
      return { error: "Ya existe un responsable con ese DNI en esta entidad." };
    }
    if (existentes.some((r) => r.nombre.toLowerCase() === nombre.toLowerCase())) {
      return { error: `Ya existe un responsable llamado «${nombre}» en esta entidad.` };
    }
    const id = newLocalId();
    const now = new Date().toISOString();
    const row: ResponsableConConteo = {
      id,
      entidad_id: entidadId,
      nombre,
      dni,
      email: trimOrNull(input.email),
      telefono: trimOrNull(input.telefono),
      cargo: RESPONSABLE_CARGO_DEFAULT,
      activo: true,
      created_at: now,
      updated_at: now,
      ambiente_count: 0,
      ambiente_nombres: [],
      es_administrador: false,
    };
    await upsertMasterItem("responsables", entidadId, row);
    await enqueueOfflineOp("responsable:create", entidadId, { id, input });
    return { data: row };
  }

  const supabase = getSupabaseClient();
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

  return { data: data as Responsable };
}

export async function updateResponsable(
  responsableId: string,
  input: UpdateResponsableInput,
): Promise<{ error?: string }> {
  const validationError = validarCreateResponsableInput(input);
  if (validationError) return { error: validationError };

  const trimOrNull = (v?: string) => {
    const t = v?.trim();
    return t ? t : null;
  };

  if (!isOnline()) {
    const found = await findMasterItem<ResponsableConConteo>("responsables", responsableId);
    if (!found) return { error: "Responsable no encontrado." };
    const auth = await assertCanManageEntidad(found.entidadId);
    if (auth?.error) return auth;

    if (found.data.es_administrador) {
      const telefono = trimOrNull(input.telefono);
      await upsertMasterItem("responsables", found.entidadId, {
        ...found.data,
        telefono,
        updated_at: new Date().toISOString(),
      });
      const entidad = await findMasterItem<Entidad>("entidades", found.entidadId);
      if (entidad) {
        await upsertMasterItem("entidades", "", {
          ...entidad.data,
          admin_telefono: telefono,
          updated_at: new Date().toISOString(),
        });
      }
      await enqueueOfflineOp("responsable:update", found.entidadId, {
        responsableId,
        input: {
          nombre: found.data.nombre,
          dni: found.data.dni ?? "",
          email: found.data.email ?? "",
          telefono: telefono ?? "",
        },
        soloTelefonoAdmin: true,
      });
      return {};
    }

    if (found.data.desde_planilla) {
      return { error: MENSAJE_RESPONSABLE_DESDE_PLANILLA };
    }

    await upsertMasterItem("responsables", found.entidadId, {
      ...found.data,
      nombre: normalizeResponsableNombre(input.nombre),
      dni: normalizeResponsableDni(input.dni) || null,
      email: trimOrNull(input.email),
      telefono: trimOrNull(input.telefono),
      ...(input.activo !== undefined ? { activo: input.activo } : {}),
      updated_at: new Date().toISOString(),
    });
    await enqueueOfflineOp("responsable:update", found.entidadId, {
      responsableId,
      input,
    });
    return {};
  }

  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from("responsables")
    .select("entidad_id, email, nombre, dni")
    .eq("id", responsableId)
    .maybeSingle();

  if (!existing) return { error: "Responsable no encontrado." };

  const auth = await assertCanManageEntidad(existing.entidad_id as string);
  if (auth?.error) return auth;

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
    const { error } = await supabase
      .from("responsables")
      .update({ telefono })
      .eq("id", responsableId);
    if (error) return { error: error.message };
    await supabase
      .from("entidades")
      .update({ admin_telefono: telefono })
      .eq("id", existing.entidad_id);
    return {};
  }

  const dnisPlanilla = await dnisTrabajadoresActivosPlanilla(existing.entidad_id as string);
  if (dnisPlanilla.includes(normalizeResponsableDni(existing.dni ?? ""))) {
    return { error: MENSAJE_RESPONSABLE_DESDE_PLANILLA };
  }

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

  return {};
}

export async function setResponsableActivo(
  responsableId: string,
  activo: boolean,
): Promise<{ error?: string }> {
  if (!isOnline()) {
    const found = await findMasterItem<ResponsableConConteo>("responsables", responsableId);
    if (!found) return { error: "Responsable no encontrado." };
    const auth = await assertCanManageEntidad(found.entidadId);
    if (auth?.error) return auth;
    await upsertMasterItem("responsables", found.entidadId, {
      ...found.data,
      activo,
      updated_at: new Date().toISOString(),
    });
    await enqueueOfflineOp("responsable:setActivo", found.entidadId, {
      responsableId,
      activo,
    });
    return {};
  }

  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from("responsables")
    .select("entidad_id")
    .eq("id", responsableId)
    .maybeSingle();

  if (!existing) return { error: "Responsable no encontrado." };

  const auth = await assertCanManageEntidad(existing.entidad_id as string);
  if (auth?.error) return auth;

  const { error } = await supabase
    .from("responsables")
    .update({ activo })
    .eq("id", responsableId);

  if (error) return { error: error.message };
  return {};
}

export async function deleteResponsable(
  responsableId: string,
): Promise<{ error?: string }> {
  if (!isOnline()) {
    const found = await findMasterItem<ResponsableConConteo>("responsables", responsableId);
    if (!found) return { error: "Responsable no encontrado." };
    const auth = await assertCanManageEntidad(found.entidadId);
    if (auth?.error) return auth;
    if (found.data.activo) {
      return { error: "Desactive el responsable antes de eliminarlo definitivamente." };
    }
    if (found.data.es_administrador) {
      return {
        error:
          "No puede eliminar al administrador de la entidad. Actualice los datos del administrador en la ficha de la entidad.",
      };
    }
    if ((found.data.ambiente_count ?? 0) > 0) {
      return {
        error:
          "No puede eliminar un responsable con ambientes asignados. Reasigne los ambientes o desactívelo.",
      };
    }
    await removeMasterItem("responsables", found.entidadId, responsableId);
    await enqueueOfflineOp("responsable:delete", found.entidadId, { responsableId });
    return {};
  }

  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from("responsables")
    .select("entidad_id, email, activo")
    .eq("id", responsableId)
    .maybeSingle();

  if (!existing) return { error: "Responsable no encontrado." };

  const auth = await assertCanManageEntidad(existing.entidad_id as string);
  if (auth?.error) return auth;

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
      error:
        "No puede eliminar un responsable con ambientes asignados. Reasigne los ambientes o desactívelo.",
    };
  }

  const { error } = await supabase.from("responsables").delete().eq("id", responsableId);

  if (error) return { error: error.message };
  return {};
}

export async function assignResponsableAmbiente(
  ambienteId: string,
  responsableId: string | null,
): Promise<{ error?: string }> {
  if (!isOnline()) {
    const found = await findMasterItem<{ id: string; sede_id: string; responsable_id: string | null }>(
      "ambientes",
      ambienteId,
    );
    if (!found) return { error: "Ambiente no encontrado." };
    const auth = await assertCanManageEntidad(found.entidadId);
    if (auth?.error) return auth;
    await upsertMasterItem("ambientes", found.entidadId, {
      ...found.data,
      responsable_id: responsableId,
    });
    await enqueueOfflineOp("ambiente:assignResponsable", found.entidadId, {
      ambienteId,
      responsableId,
    });
    return {};
  }

  const supabase = getSupabaseClient();
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

  const auth = await assertCanManageEntidad(sede.entidad_id as string);
  if (auth?.error) return auth;

  const { error } = await supabase
    .from("ambientes")
    .update({ responsable_id: responsableId })
    .eq("id", ambienteId);

  if (error) return { error: error.message };
  return {};
}

/** Usado por sync: obtener admin email de entidad en caché. */
export async function getEntidadAdminEmailFromCache(
  entidadId: string,
): Promise<string | null> {
  const found = await findMasterItem<Entidad>("entidades", entidadId);
  return found?.data.admin_email ?? null;
}
