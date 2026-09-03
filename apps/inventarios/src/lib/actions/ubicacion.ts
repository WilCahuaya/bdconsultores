"use server";

import { revalidatePath } from "next/cache";
import type { Ambiente, Espacio, EspacioConOcupacion, Sede, SedeConConteo } from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { loadSedesForEntidad } from "@/lib/sede-principal-direccion";
import { getProfile, requireProfile } from "@/lib/auth/profile";

function revalidateEntidad(entidadId: string, sedeId?: string) {
  revalidatePath("/contador/entidades");
  revalidatePath(`/contador/entidades/${entidadId}`);
  revalidatePath(`/contador/entidades/${entidadId}/responsables`);
  if (sedeId) {
    revalidatePath(`/contador/entidades/${entidadId}/sedes/${sedeId}`);
    revalidatePath(`/admin/sedes/${sedeId}`);
  }
  revalidatePath("/admin/activos");
  revalidatePath("/admin/responsables");
  revalidatePath("/admin");
}

/** Contador (cualquier entidad) o admin de esa entidad. */
async function assertPuedeGestionarSedes(entidadId: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." as const };
  if (profile.rol === "CONTADOR") return { profile };
  if (profile.rol === "ADMIN_ENTIDAD" && profile.entidad_id === entidadId) {
    return { profile };
  }
  return { error: "No tiene permiso para gestionar sucursales de esta entidad." as const };
}

export async function getSedePrincipal(entidadId: string): Promise<Sede | null> {
  const supabase = await createClient();
  const sedes = await loadSedesForEntidad(supabase, entidadId);
  return sedes.find((sede) => sede.es_principal) ?? null;
}

export async function getSede(sedeId: string): Promise<Sede | null> {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sedes")
    .select("*")
    .eq("id", sedeId)
    .eq("activo", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Sede;
}

/** Asegura el ambiente sistema de preregistros (nombre con año actual) y lo devuelve. */
export async function getAmbientePreregistro(entidadId: string): Promise<Ambiente | null> {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: ambienteId, error } = await supabase.rpc("ensure_ambiente_preregistro", {
    p_entidad_id: entidadId,
  });

  if (error || !ambienteId) return null;

  const { data } = await supabase
    .from("ambientes")
    .select("*")
    .eq("id", ambienteId as string)
    .maybeSingle();

  return (data as Ambiente) ?? null;
}

export async function listSedesConConteo(entidadId: string): Promise<SedeConConteo[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const sedes = await loadSedesForEntidad(supabase, entidadId);

  const sorted = sedes.sort((a, b) => {
    if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
    return a.nombre.localeCompare(b.nombre);
  });

  const result: SedeConConteo[] = [];
  for (const sede of sorted) {
    const { count } = await supabase
      .from("ambientes")
      .select("*", { count: "exact", head: true })
      .eq("sede_id", sede.id)
      .eq("activo", true);
    result.push({ ...sede, ambiente_count: count ?? 0 });
  }
  return result;
}

export async function listSedes(entidadId: string): Promise<Sede[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  return loadSedesForEntidad(supabase, entidadId);
}

export type AmbienteConSede = Ambiente & {
  sede_nombre: string;
  sede_es_principal: boolean;
  espacio_nombre?: string | null;
  activo_count: number;
};

async function activoCountByAmbienteIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ambienteIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ambienteIds.length === 0) return counts;

  const { data } = await supabase
    .from("activos")
    .select("ambiente_id")
    .in("ambiente_id", ambienteIds);

  for (const row of data ?? []) {
    const ambienteId = row.ambiente_id as string | null;
    if (!ambienteId) continue;
    counts.set(ambienteId, (counts.get(ambienteId) ?? 0) + 1);
  }
  return counts;
}

export async function listAmbientesPorEntidad(
  entidadId: string,
  sedeId?: string,
): Promise<AmbienteConSede[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase
    .from("ambientes")
    .select("*, sedes!inner(nombre, es_principal, entidad_id)")
    .eq("activo", true);

  if (sedeId) {
    query = query.eq("sede_id", sedeId);
  } else {
    query = query.eq("sedes.entidad_id", entidadId);
  }

  const { data, error } = await query.order("nombre");

  if (error || !data) return [];

  const mapped = data.map((row) => {
    const sede = row.sedes as { nombre: string; es_principal: boolean } | null;
    const { sedes: _, ...ambiente } = row;
    return {
      ...(ambiente as Ambiente),
      sede_nombre: sede?.nombre ?? "",
      sede_es_principal: sede?.es_principal ?? false,
      espacio_nombre: null as string | null,
      activo_count: 0,
    };
  });

  const espacioIds = [
    ...new Set(
      mapped
        .map((a) => a.espacio_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (espacioIds.length > 0) {
    const { data: espaciosRows } = await supabase
      .from("espacios")
      .select("id, nombre")
      .in("id", espacioIds);
    const nombreById = new Map(
      (espaciosRows ?? []).map((e) => [e.id as string, e.nombre as string]),
    );
    for (const amb of mapped) {
      if (amb.espacio_id) {
        amb.espacio_nombre = nombreById.get(amb.espacio_id) ?? null;
      }
    }
  }

  const activoCounts = await activoCountByAmbienteIds(
    supabase,
    mapped.map((ambiente) => ambiente.id),
  );

  const withCounts = mapped.map((ambiente) => ({
    ...ambiente,
    activo_count: activoCounts.get(ambiente.id) ?? 0,
  }));

  return withCounts.sort((a, b) => {
    if (a.es_preregistro !== b.es_preregistro) return a.es_preregistro ? -1 : 1;
    if (a.sede_es_principal !== b.sede_es_principal) {
      return a.sede_es_principal ? -1 : 1;
    }
    if (a.sede_nombre !== b.sede_nombre) {
      return a.sede_nombre.localeCompare(b.sede_nombre);
    }
    return a.nombre.localeCompare(b.nombre);
  });
}

export async function listAmbientes(sedeId: string): Promise<Ambiente[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ambientes")
    .select("*")
    .eq("sede_id", sedeId)
    .eq("activo", true)
    .eq("es_preregistro", false)
    .order("nombre");

  if (error) return [];
  return (data ?? []) as Ambiente[];
}

export async function getAmbiente(ambienteId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ambientes")
    .select("*, sedes(entidad_id, nombre)")
    .eq("id", ambienteId)
    .eq("activo", true)
    .maybeSingle();

  if (!data) return null;
  const sede = data.sedes as { entidad_id: string; nombre: string } | null;
  const { sedes: _, ...ambiente } = data;
  return {
    ambiente: ambiente as Ambiente,
    entidad_id: sede?.entidad_id ?? "",
    sede_nombre: sede?.nombre ?? "",
  };
}

export async function createSede(entidadId: string, nombre: string, direccion?: string) {
  const auth = await assertPuedeGestionarSedes(entidadId);
  if (auth.error) return { error: auth.error };

  const trimmed = nombre.trim();
  if (!trimmed) return { error: "Nombre de sucursal obligatorio." };
  if (trimmed.toLowerCase() === "principal") {
    return { error: 'Use otro nombre; "Principal" está reservado.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sedes")
    .insert({
      entidad_id: entidadId,
      nombre: trimmed,
      direccion: direccion?.trim() || null,
      es_principal: false,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidateEntidad(entidadId);
  return { success: true, data: data as Sede };
}

export async function updateSede(sedeId: string, nombre: string, direccion?: string) {
  const trimmed = nombre.trim();
  if (!trimmed) return { error: "Nombre obligatorio." };

  const supabase = await createClient();
  const { data: sede } = await supabase.from("sedes").select("*").eq("id", sedeId).single();
  if (!sede) return { error: "Sucursal no encontrada." };

  const auth = await assertPuedeGestionarSedes((sede as Sede).entidad_id);
  if (auth.error) return { error: auth.error };

  if ((sede as Sede).es_principal) return { error: "La sucursal Principal no se puede editar." };

  const { error } = await supabase
    .from("sedes")
    .update({
      nombre: trimmed,
      direccion: direccion?.trim() || null,
    })
    .eq("id", sedeId);
  if (error) return { error: error.message };

  revalidateEntidad((sede as Sede).entidad_id);
  return { success: true };
}

export async function deleteSede(sedeId: string) {
  const supabase = await createClient();
  const { data: sede } = await supabase.from("sedes").select("*").eq("id", sedeId).single();
  if (!sede) return { error: "Sucursal no encontrada." };

  const auth = await assertPuedeGestionarSedes((sede as Sede).entidad_id);
  if (auth.error) return { error: auth.error };

  if ((sede as Sede).es_principal) return { error: "La sucursal Principal no se puede eliminar." };

  const { count } = await supabase
    .from("ambientes")
    .select("*", { count: "exact", head: true })
    .eq("sede_id", sedeId)
    .eq("activo", true);

  if ((count ?? 0) > 0) {
    return { error: "Solo puede eliminar sucursales sin ambientes asociados." };
  }

  const { error } = await supabase.from("sedes").update({ activo: false }).eq("id", sedeId);
  if (error) return { error: error.message };

  revalidateEntidad((sede as Sede).entidad_id);
  return { success: true };
}

export interface CreateAmbienteInput {
  sedeId: string;
  nombre: string;
  descripcion?: string;
  responsableId?: string | null;
  espacioId?: string | null;
}

const ESPACIO_OCUPADO_MSG = "Ese espacio ya está ocupado por otro ambiente.";

function mapAmbienteEspacioError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("idx_ambientes_espacio_unico") ||
    (m.includes("duplicate key") && m.includes("espacio"))
  ) {
    return ESPACIO_OCUPADO_MSG;
  }
  return message;
}

async function mensajeSiEspacioOcupado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  espacioId: string | null | undefined,
  excludeAmbienteId?: string,
): Promise<string | null> {
  if (!espacioId) return null;
  let query = supabase
    .from("ambientes")
    .select("id, nombre")
    .eq("espacio_id", espacioId)
    .eq("activo", true);
  if (excludeAmbienteId) {
    query = query.neq("id", excludeAmbienteId);
  }
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const nombre = (data.nombre as string | null)?.trim();
  return nombre
    ? `Ese espacio ya está ocupado por «${nombre}».`
    : ESPACIO_OCUPADO_MSG;
}

export async function createAmbiente(input: CreateAmbienteInput) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };

  const trimmed = input.nombre.trim();
  if (!trimmed) return { error: "Nombre de ambiente obligatorio." };

  const supabase = await createClient();
  const { data: sede } = await supabase
    .from("sedes")
    .select("entidad_id")
    .eq("id", input.sedeId)
    .single();

  const ocupado = await mensajeSiEspacioOcupado(supabase, input.espacioId);
  if (ocupado) return { error: ocupado };

  const { data, error } = await supabase
    .from("ambientes")
    .insert({
      sede_id: input.sedeId,
      nombre: trimmed,
      descripcion: input.descripcion?.trim() || null,
      responsable_id: input.responsableId || null,
      espacio_id: input.espacioId || null,
    })
    .select()
    .single();

  if (error) return { error: mapAmbienteEspacioError(error.message) };

  if (sede?.entidad_id) revalidateEntidad(sede.entidad_id as string);
  revalidatePath(`/contador/entidades/${sede?.entidad_id}/ambientes/${data.id}`);
  return { success: true, data: data as Ambiente };
}

/** Crea ambiente en la sede Principal de la entidad */
export async function createAmbienteEnPrincipal(
  entidadId: string,
  input: Omit<CreateAmbienteInput, "sedeId">,
) {
  const principal = await getSedePrincipal(entidadId);
  if (!principal) return { error: "No existe sede Principal para esta entidad." };
  return createAmbiente({ ...input, sedeId: principal.id });
}

export async function updateAmbiente(
  ambienteId: string,
  input: Omit<CreateAmbienteInput, "sedeId">,
) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR" && profile.rol !== "ADMIN_ENTIDAD") {
    return { error: "No autorizado." };
  }

  const trimmed = input.nombre.trim();
  if (!trimmed) return { error: "Nombre de ambiente obligatorio." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ambientes")
    .select("id, sede_id, es_preregistro")
    .eq("id", ambienteId)
    .eq("activo", true)
    .single();

  if (!existing) return { error: "Ambiente no encontrado." };
  if ((existing as Ambiente).es_preregistro) {
    return { error: "El ambiente de preregistros no se puede editar." };
  }

  if (profile.rol === "ADMIN_ENTIDAD") {
    const { data: sedeRow } = await supabase
      .from("sedes")
      .select("entidad_id")
      .eq("id", existing.sede_id)
      .maybeSingle();
    if (!sedeRow || sedeRow.entidad_id !== profile.entidad_id) {
      return { error: "No autorizado." };
    }
  }

  const espacioId = input.espacioId ?? null;
  const ocupado = await mensajeSiEspacioOcupado(supabase, espacioId, ambienteId);
  if (ocupado) return { error: ocupado };

  const { error } = await supabase
    .from("ambientes")
    .update({
      nombre: trimmed,
      descripcion: input.descripcion?.trim() || null,
      responsable_id: input.responsableId ?? null,
      espacio_id: espacioId,
    })
    .eq("id", ambienteId);

  if (error) return { error: mapAmbienteEspacioError(error.message) };

  const { data: sede } = await supabase
    .from("sedes")
    .select("entidad_id")
    .eq("id", existing.sede_id)
    .single();
  const entidadId = sede?.entidad_id as string | undefined;
  if (entidadId) revalidateEntidad(entidadId);
  revalidatePath(`/contador/entidades/${entidadId}/ambientes/${ambienteId}`);
  return { success: true };
}

export async function deleteAmbiente(ambienteId: string) {
  await requireProfile("CONTADOR");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("ambientes")
    .select("id, sede_id, es_preregistro")
    .eq("id", ambienteId)
    .eq("activo", true)
    .single();

  if (!existing) return { error: "Ambiente no encontrado." };
  if ((existing as Ambiente).es_preregistro) {
    return { error: "El ambiente de preregistros no se puede eliminar." };
  }

  const { count } = await supabase
    .from("activos")
    .select("*", { count: "exact", head: true })
    .eq("ambiente_id", ambienteId);

  if ((count ?? 0) > 0) {
    return { error: "No puede eliminar un ambiente que tiene activos registrados." };
  }

  const { error } = await supabase.from("ambientes").update({ activo: false }).eq("id", ambienteId);
  if (error) return { error: error.message };

  const { data: sede } = await supabase
    .from("sedes")
    .select("entidad_id")
    .eq("id", existing.sede_id)
    .single();
  const entidadId = sede?.entidad_id as string | undefined;
  if (entidadId) revalidateEntidad(entidadId);
  return { success: true };
}

function nombreEspacioNumerado(n: number): string {
  return `Espacio ${String(n).padStart(2, "0")}`;
}

function maxNumeroEspacioExistente(existentes: Array<{ nombre: string }>): number {
  let max = 0;
  for (const e of existentes) {
    const match = e.nombre.trim().match(/^espacio\s*0*(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

export async function listEspacios(sedeId: string): Promise<EspacioConOcupacion[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("espacios")
    .select("*, ambientes(id, nombre, activo)")
    .eq("sede_id", sedeId)
    .eq("activo", true)
    .order("nombre");

  if (error || !data) return [];

  return data.map((row) => {
    const ambientes = (row.ambientes as Array<{ id: string; nombre: string; activo: boolean }> | null) ?? [];
    const ocupante = ambientes.find((a) => a.activo);
    const { ambientes: _, ...espacio } = row;
    return {
      ...(espacio as Espacio),
      ambiente_id: ocupante?.id ?? null,
      ambiente_nombre: ocupante?.nombre ?? null,
    };
  });
}

export async function listEspaciosPorEntidad(entidadId: string): Promise<Espacio[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("espacios")
    .select("*, sedes!inner(entidad_id)")
    .eq("activo", true)
    .eq("sedes.entidad_id", entidadId)
    .order("nombre");

  if (error || !data) return [];
  return data.map((row) => {
    const { sedes: _, ...espacio } = row;
    return espacio as Espacio;
  });
}

export async function createEspacio(sedeId: string, nombre: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR" && profile.rol !== "ADMIN_ENTIDAD") {
    return { error: "No autorizado." };
  }

  const trimmed = nombre.trim();
  if (!trimmed) return { error: "Nombre de espacio obligatorio." };

  const supabase = await createClient();

  if (profile.rol === "ADMIN_ENTIDAD") {
    const { data: sedeRow } = await supabase
      .from("sedes")
      .select("entidad_id")
      .eq("id", sedeId)
      .maybeSingle();
    if (!sedeRow || sedeRow.entidad_id !== profile.entidad_id) {
      return { error: "No autorizado." };
    }
  }

  const { data: existentes } = await supabase
    .from("espacios")
    .select("nombre")
    .eq("sede_id", sedeId)
    .eq("activo", true);

  const nombreNorm = trimmed.toLowerCase();
  if ((existentes ?? []).some((e) => e.nombre.trim().toLowerCase() === nombreNorm)) {
    return {
      error: "No puede haber dos espacios con el mismo nombre en la sucursal.",
    };
  }

  const { data, error } = await supabase
    .from("espacios")
    .insert({ sede_id: sedeId, nombre: trimmed })
    .select()
    .single();

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("idx_espacios_sede_nombre_activo") || msg.includes("duplicate key")) {
      return {
        error: "No puede haber dos espacios con el mismo nombre en la sucursal.",
      };
    }
    return { error: error.message };
  }

  const { data: sede } = await supabase.from("sedes").select("entidad_id").eq("id", sedeId).single();
  if (sede?.entidad_id) revalidateEntidad(sede.entidad_id as string, sedeId);
  return { success: true, data: data as Espacio };
}

/** Agrega `cantidad` espacios a continuación del último número (ej. tras Espacio 10 → 11, 12…). */
export async function ensureEspaciosHasta(sedeId: string, cantidad: number) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR" && profile.rol !== "ADMIN_ENTIDAD") {
    return { error: "No autorizado." };
  }
  if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 500) {
    return { error: "Indique una cantidad entre 1 y 500." };
  }

  const supabase = await createClient();

  if (profile.rol === "ADMIN_ENTIDAD") {
    const { data: sedeRow } = await supabase
      .from("sedes")
      .select("entidad_id")
      .eq("id", sedeId)
      .maybeSingle();
    if (!sedeRow || sedeRow.entidad_id !== profile.entidad_id) {
      return { error: "No autorizado." };
    }
  }

  const existentes = await listEspacios(sedeId);
  const nombres = new Set(existentes.map((e) => e.nombre.trim().toLowerCase()));
  const desde = maxNumeroEspacioExistente(existentes) + 1;
  const aCrear: { sede_id: string; nombre: string }[] = [];
  for (let i = 0; i < cantidad; i++) {
    const nombre = nombreEspacioNumerado(desde + i);
    if (!nombres.has(nombre.toLowerCase())) {
      aCrear.push({ sede_id: sedeId, nombre });
    }
  }

  if (aCrear.length === 0) {
    return { success: true, creados: 0, data: existentes };
  }

  const { error } = await supabase.from("espacios").insert(aCrear);
  if (error) return { error: error.message };

  const { data: sede } = await supabase.from("sedes").select("entidad_id").eq("id", sedeId).single();
  if (sede?.entidad_id) revalidateEntidad(sede.entidad_id as string, sedeId);

  const actualizados = await listEspacios(sedeId);
  return { success: true, creados: aCrear.length, data: actualizados };
}

export async function deleteEspacio(espacioId: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR" && profile.rol !== "ADMIN_ENTIDAD") {
    return { error: "No autorizado." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("espacios")
    .select("id, sede_id")
    .eq("id", espacioId)
    .eq("activo", true)
    .maybeSingle();

  if (!existing) return { error: "Espacio no encontrado." };

  if (profile.rol === "ADMIN_ENTIDAD") {
    const { data: sedeRow } = await supabase
      .from("sedes")
      .select("entidad_id")
      .eq("id", existing.sede_id)
      .maybeSingle();
    if (!sedeRow || sedeRow.entidad_id !== profile.entidad_id) {
      return { error: "No autorizado." };
    }
  }

  await supabase.from("ambientes").update({ espacio_id: null }).eq("espacio_id", espacioId);

  const { error } = await supabase
    .from("espacios")
    .update({ activo: false })
    .eq("id", espacioId);

  if (error) return { error: error.message };

  const { data: sede } = await supabase
    .from("sedes")
    .select("entidad_id")
    .eq("id", existing.sede_id)
    .single();
  if (sede?.entidad_id) revalidateEntidad(sede.entidad_id as string, existing.sede_id);
  return { success: true };
}
