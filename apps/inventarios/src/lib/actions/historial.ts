"use server";

import {
  collectHistorialLookupIds,
  type HistorialActivoItem,
  type HistorialLookupMaps,
} from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";

export interface HistorialActivoResult {
  items: HistorialActivoItem[];
  lookups: HistorialLookupMaps;
}

async function buildHistorialLookups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: HistorialActivoItem[],
): Promise<HistorialLookupMaps> {
  const { sedeIds, ambienteIds } = collectHistorialLookupIds(items);
  const lookups: HistorialLookupMaps = { sedes: {}, ambientes: {} };

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

export async function listHistorialActivo(activoId: string): Promise<HistorialActivoResult> {
  const profile = await getProfile();
  if (!profile) return { items: [], lookups: { sedes: {}, ambientes: {} } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("historial_cambios")
    .select("*, profiles(nombre)")
    .eq("activo_id", activoId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const items: HistorialActivoItem[] = (data ?? []).map((row) => {
    const { profiles, ...rest } = row as HistorialActivoItem & {
      profiles: { nombre: string } | null;
    };
    return {
      ...rest,
      usuario_nombre: profiles?.nombre,
    };
  });

  const lookups = await buildHistorialLookups(supabase, items);
  return { items, lookups };
}
