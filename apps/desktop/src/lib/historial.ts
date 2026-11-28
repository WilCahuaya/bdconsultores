import {
  collectHistorialLookupIds,
  type HistorialActivoItem,
  type HistorialLookupMaps,
} from "@inventario/types";
import { isOnline, listMasterDomain } from "./master-cache";
import { getSupabaseClient } from "./supabase";

export interface HistorialActivoResult {
  items: HistorialActivoItem[];
  lookups: HistorialLookupMaps;
}

async function buildHistorialLookups(
  items: HistorialActivoItem[],
  entidadId?: string,
): Promise<HistorialLookupMaps> {
  const { sedeIds, ambienteIds } = collectHistorialLookupIds(items);
  const lookups: HistorialLookupMaps = { sedes: {}, ambientes: {} };
  if (sedeIds.length === 0 && ambienteIds.length === 0) return lookups;

  if (!isOnline() && entidadId) {
    const sedes = await listMasterDomain<{ id: string; nombre: string }>("sedes", entidadId);
    const ambientes = await listMasterDomain<{ id: string; nombre: string }>("ambientes", entidadId);
    for (const sede of sedes) {
      if (sedeIds.includes(sede.id)) lookups.sedes[sede.id] = sede.nombre;
    }
    for (const ambiente of ambientes) {
      if (ambienteIds.includes(ambiente.id)) lookups.ambientes[ambiente.id] = ambiente.nombre;
    }
    return lookups;
  }

  const supabase = getSupabaseClient();

  if (sedeIds.length > 0) {
    const { data } = await supabase.from("sedes").select("id, nombre").in("id", sedeIds);
    for (const row of data ?? []) {
      lookups.sedes[row.id] = row.nombre;
    }
  }

  if (ambienteIds.length > 0) {
    const { data } = await supabase.from("ambientes").select("id, nombre").in("id", ambienteIds);
    for (const row of data ?? []) {
      lookups.ambientes[row.id] = row.nombre;
    }
  }

  return lookups;
}

export async function listHistorialActivo(
  activoId: string,
): Promise<{ data?: HistorialActivoResult; error?: string }> {
  if (activoId.startsWith("pending-")) {
    return { data: { items: [], lookups: { sedes: {}, ambientes: {} } } };
  }

  if (!isOnline()) {
    const entidades = await listMasterDomain<{ id: string }>("entidades", "");
    for (const entidad of entidades) {
      const rows = await listMasterDomain<HistorialActivoItem>("historial", entidad.id);
      const items = rows
        .filter((row) => row.activo_id === activoId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (items.length === 0) continue;
      const lookups = await buildHistorialLookups(items, entidad.id);
      return { data: { items, lookups } };
    }
    return { data: { items: [], lookups: { sedes: {}, ambientes: {} } } };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("historial_cambios")
      .select("*, profiles(nombre)")
      .eq("activo_id", activoId)
      .order("created_at", { ascending: false });

    if (error) return { error: error.message };

    const items: HistorialActivoItem[] = (data ?? []).map((row) => {
      const { profiles, ...rest } = row as HistorialActivoItem & {
        profiles: { nombre: string } | null;
      };
      return {
        ...rest,
        usuario_nombre: profiles?.nombre,
      };
    });

    const lookups = await buildHistorialLookups(items);
    return { data: { items, lookups } };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo cargar el historial.",
    };
  }
}
