import type {
  Entidad,
  EntidadConConteo,
  ResponsableConConteo,
  SedeConConteo,
} from "@inventario/types";
import {
  buildAmbientePreregistroNombre,
  mensajeErrorNumeroInterno,
  normalizeNumeroInterno,
  normalizePeCodigo,
  normalizeResponsableDni,
  normalizeResponsableNombre,
  RESPONSABLE_CARGO_ADMIN,
  entidadUsaInventarios,
  sortEntidadesByNumero,
  validarAdminEntidadDni,
  validarNumeroInterno,
  validarPeCodigo,
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
import type { AmbienteConSede } from "./ubicacion";
import { getSupabaseClient } from "./supabase";
import { syncSedePrincipalDireccionFromEntidad } from "./sede-principal-direccion";
import { syncAdminResponsableForEntidad } from "./responsables-admin-sync";

export interface CreateEntidadInput {
  nombre: string;
  numero_interno?: string | null;
  pe_codigo?: string | null;
  nombre_etiqueta?: string | null;
  ruc?: string;
  direccion?: string;
  admin_nombre?: string;
  admin_email?: string;
  admin_dni?: string;
  admin_telefono?: string;
}

async function inviteAdminAfterSave(
  entidadId: string,
  adminEmail: string,
  adminNombre: string,
  entidadNombre: string,
  mode: "invite" | "resend" = "invite",
): Promise<string | null> {
  if (!window.electronAPI?.inviteEntidadAdmin) {
    return "Entidad guardada. Configure SUPABASE_SERVICE_ROLE_KEY para enviar la invitación por correo.";
  }

  const result = await window.electronAPI.inviteEntidadAdmin({
    entidadId,
    email: adminEmail,
    nombre: adminNombre,
    entidadNombre,
    mode,
  });

  if (result.error) return `Entidad guardada, pero la invitación falló: ${result.error}`;
  return result.message ?? result.warning ?? null;
}

/** Invitación al admin en segundo plano (no bloquea el guardado de la entidad). */
export function inviteEntidadAdminInBackground(
  entidadId: string,
  input: Pick<CreateEntidadInput, "admin_email" | "admin_nombre" | "nombre">,
  onMessage?: (message: string) => void,
  mode: "invite" | "resend" = "invite",
): void {
  const adminEmail = input.admin_email?.trim();
  const adminNombre = input.admin_nombre?.trim();
  const entidadNombre = input.nombre.trim();
  if (!adminEmail || !adminNombre) return;

  void inviteAdminAfterSave(entidadId, adminEmail, adminNombre, entidadNombre, mode).then(
    (message) => {
      if (message) onMessage?.(message);
    },
  );
}

async function fetchEntidadesRemote(): Promise<EntidadConConteo[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("entidades")
    .select("*")
    .eq("usa_inventarios", true)
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

export async function listEntidades(): Promise<EntidadConConteo[]> {
  if (isOnline()) {
    try {
      const items = await fetchEntidadesRemote();
      await replaceMasterDomain("entidades", "", items);
      return sortEntidadesByNumero(items);
    } catch {
      /* usar caché */
    }
  }
  const cached = await listMasterDomain<EntidadConConteo>("entidades", "");
  return sortEntidadesByNumero(cached.filter((item) => entidadUsaInventarios(item)));
}

export async function createEntidad(
  input: CreateEntidadInput,
): Promise<{
  data?: Entidad;
  error?: string;
  inviteMessage?: string | null;
  invitePendingOffline?: boolean;
}> {
  const nombre = input.nombre.trim();
  const numeroInterno = normalizeNumeroInterno(input.numero_interno);
  const peCodigo = normalizePeCodigo(input.pe_codigo);
  const adminEmail = input.admin_email?.trim() || null;
  const adminNombre = input.admin_nombre?.trim() || null;

  if (!nombre) return { error: "La razón social es obligatoria." };
  const numeroError = validarNumeroInterno(numeroInterno);
  if (numeroError) return { error: numeroError };
  const codigoError = validarPeCodigo(peCodigo);
  if (codigoError) return { error: codigoError };
  if (!adminEmail) return { error: "El correo del administrador es obligatorio." };
  if (!adminNombre) return { error: "El nombre del administrador es obligatorio." };
  const adminDni = normalizeResponsableDni(input.admin_dni ?? "");
  const dniError = validarAdminEntidadDni(adminDni);
  if (dniError) return { error: dniError };

  if (!isOnline()) {
    const existentes = await listMasterDomain<EntidadConConteo>("entidades", "");
    if (existentes.some((item) => item.numero_interno === numeroInterno)) {
      return { error: "Ya existe un proyecto con ese número." };
    }
    if (existentes.some((item) => item.pe_codigo === peCodigo)) {
      return { error: "Ya existe un proyecto con ese código." };
    }
    const id = newLocalId();
    const sedeId = newLocalId();
    const preregistroId = newLocalId();
    const responsableId = newLocalId();
    const now = new Date().toISOString();

    const entidad: EntidadConConteo = {
      id,
      nombre,
      numero_interno: numeroInterno,
      pe_codigo: peCodigo,
      nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
      ruc: input.ruc?.trim() || null,
      direccion: input.direccion?.trim() || null,
      admin_nombre: adminNombre,
      admin_email: adminEmail,
      admin_dni: adminDni,
      admin_telefono: input.admin_telefono?.trim() || null,
      usa_inventarios: true,
      usa_planillas: false,
      activo: true,
      created_at: now,
      updated_at: now,
      ambiente_count: 1,
      activo_count: 0,
    };

    const sede: SedeConConteo = {
      id: sedeId,
      entidad_id: id,
      nombre: "Principal",
      direccion: input.direccion?.trim() || null,
      es_principal: true,
      activo: true,
      created_at: now,
      updated_at: now,
      ambiente_count: 1,
    };

    const preregistro: AmbienteConSede = {
      id: preregistroId,
      sede_id: sedeId,
      nombre: buildAmbientePreregistroNombre(),
      descripcion: null,
      responsable_id: null,
      responsable: null,
      espacio_id: null,
      es_preregistro: true,
      activo: true,
      created_at: now,
      updated_at: now,
      sede_nombre: sede.nombre,
      sede_es_principal: true,
      espacio_nombre: null,
      activo_count: 0,
    };

    const responsable: ResponsableConConteo = {
      id: responsableId,
      entidad_id: id,
      nombre: normalizeResponsableNombre(adminNombre),
      dni: adminDni || null,
      email: adminEmail.toLowerCase(),
      telefono: input.admin_telefono?.trim() || null,
      cargo: RESPONSABLE_CARGO_ADMIN,
      activo: true,
      created_at: now,
      updated_at: now,
      ambiente_count: 0,
      es_administrador: true,
    };

    await upsertMasterItem("entidades", "", entidad);
    await upsertMasterItem("sedes", id, sede);
    await upsertMasterItem("ambientes", id, preregistro);
    await upsertMasterItem("responsables", id, responsable);

    await enqueueOfflineOp("entidad:create", id, {
      id,
      sedeId,
      preregistroId,
      responsableId,
      input: {
        nombre,
        numero_interno: numeroInterno,
        pe_codigo: peCodigo,
        nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
        ruc: input.ruc?.trim() || null,
        direccion: input.direccion?.trim() || null,
        admin_nombre: adminNombre,
        admin_email: adminEmail,
        admin_dni: adminDni,
        admin_telefono: input.admin_telefono?.trim() || null,
      },
    });

    return {
      data: entidad,
      inviteMessage:
        "Invitación pendiente: la entidad se guardó sin conexión. Al reconectar se creará en el servidor y se enviará la invitación al administrador.",
      invitePendingOffline: true,
    };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("entidades")
    .insert({
      nombre,
      numero_interno: numeroInterno,
      pe_codigo: peCodigo,
      nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
      ruc: input.ruc?.trim() || null,
      direccion: input.direccion?.trim() || null,
      admin_nombre: adminNombre,
      admin_email: adminEmail,
      admin_dni: adminDni,
      admin_telefono: input.admin_telefono?.trim() || null,
    })
    .select()
    .single();

  if (error) return { error: mensajeErrorNumeroInterno(error) ?? error.message };

  await syncSedePrincipalDireccionFromEntidad(
    supabase,
    (data as Entidad).id,
    (data as Entidad).direccion,
  );

  await syncAdminResponsableForEntidad(
    supabase,
    (data as Entidad).id,
    adminNombre,
    adminEmail,
    input.admin_telefono,
    adminDni,
  );

  return {
    data: data as Entidad,
    inviteMessage: "Entidad creada correctamente.",
  };
}

export async function updateEntidad(
  entidadId: string,
  input: CreateEntidadInput,
): Promise<{
  data?: Entidad;
  error?: string;
  inviteMessage?: string | null;
  inviteMode?: "invite" | "resend";
  invitePendingOffline?: boolean;
}> {
  const nombre = input.nombre.trim();
  const numeroInterno = normalizeNumeroInterno(input.numero_interno);
  const peCodigo = normalizePeCodigo(input.pe_codigo);
  const adminEmail = input.admin_email?.trim() || null;
  const adminNombre = input.admin_nombre?.trim() || null;

  if (!nombre) return { error: "La razón social es obligatoria." };
  const numeroError = validarNumeroInterno(numeroInterno);
  if (numeroError) return { error: numeroError };
  const codigoError = validarPeCodigo(peCodigo);
  if (codigoError) return { error: codigoError };
  if (!adminEmail) return { error: "El correo del administrador es obligatorio." };
  if (!adminNombre) return { error: "El nombre del administrador es obligatorio." };
  const adminDni = normalizeResponsableDni(input.admin_dni ?? "");
  const dniError = validarAdminEntidadDni(adminDni);
  if (dniError) return { error: dniError };

  if (!isOnline()) {
    const cached = await findMasterItem<EntidadConConteo>("entidades", entidadId);
    if (!cached) return { error: "Entidad no encontrada en caché local." };
    const existentes = await listMasterDomain<EntidadConConteo>("entidades", "");
    if (
      existentes.some(
        (item) => item.id !== entidadId && item.numero_interno === numeroInterno,
      )
    ) {
      return { error: "Ya existe un proyecto con ese número." };
    }
    if (
      existentes.some((item) => item.id !== entidadId && item.pe_codigo === peCodigo)
    ) {
      return { error: "Ya existe un proyecto con ese código." };
    }
    const updated: EntidadConConteo = {
      ...cached.data,
      nombre,
      numero_interno: numeroInterno,
      pe_codigo: peCodigo,
      nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
      ruc: input.ruc?.trim() || null,
      direccion: input.direccion?.trim() || null,
      admin_nombre: adminNombre,
      admin_email: adminEmail,
      admin_dni: adminDni,
      admin_telefono: input.admin_telefono?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    await upsertMasterItem("entidades", "", updated);
    await enqueueOfflineOp("entidad:update", entidadId, { input });
    return {
      data: updated,
      inviteMessage:
        "Invitación pendiente: cambios guardados sin conexión. Al reconectar se sincronizarán y, si corresponde, se reenviará la invitación.",
      inviteMode: "resend",
      invitePendingOffline: true,
    };
  }

  const supabase = getSupabaseClient();
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
      numero_interno: numeroInterno,
      pe_codigo: peCodigo,
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

  if (error) return { error: mensajeErrorNumeroInterno(error) ?? error.message };

  await syncSedePrincipalDireccionFromEntidad(
    supabase,
    (data as Entidad).id,
    (data as Entidad).direccion,
  );

  await syncAdminResponsableForEntidad(
    supabase,
    entidadId,
    adminNombre,
    adminEmail,
    input.admin_telefono,
    adminDni,
  );

  return {
    data: data as Entidad,
    inviteMessage: "Entidad actualizada correctamente.",
    inviteMode,
  };
}

export async function setEntidadActivo(
  entidadId: string,
  activo: boolean,
): Promise<{ data?: Entidad; success?: true; error?: string }> {
  if (!isOnline()) {
    const cached = await findMasterItem<EntidadConConteo>("entidades", entidadId);
    if (!cached) return { error: "Entidad no encontrada en caché local." };
    const updated = { ...cached.data, activo, updated_at: new Date().toISOString() };
    await upsertMasterItem("entidades", "", updated);
    await enqueueOfflineOp("entidad:setActivo", entidadId, { activo });
    return { success: true, data: updated };
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("entidades")
    .update({ activo })
    .eq("id", entidadId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, data: data as Entidad };
}

/** Elimina la entidad de forma permanente. Solo si no tiene activos (cualquier estado).
 *  En cascada se borran sedes, ambientes (incluido el de preregistros), responsables, etc.
 */
export async function deleteEntidad(
  entidadId: string,
): Promise<{ success?: true; error?: string }> {
  if (!isOnline()) {
    const cached = await findMasterItem<EntidadConConteo>("entidades", entidadId);
    if (!cached) return { error: "Entidad no encontrada en caché local." };
    if ((cached.data.activo_count ?? 0) > 0) {
      return {
        error:
          "No puede eliminar una entidad que tiene activos. Elimine o dé de baja los bienes primero, o desactive la entidad.",
      };
    }
    await removeMasterItem("entidades", "", entidadId);
    await enqueueOfflineOp("entidad:delete", entidadId, {});
    return { success: true };
  }

  const supabase = getSupabaseClient();

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
  return { success: true };
}
