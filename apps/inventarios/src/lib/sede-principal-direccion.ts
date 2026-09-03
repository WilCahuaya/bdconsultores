import type { Sede } from "@inventario/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeDireccion(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export async function syncSedePrincipalDireccionFromEntidad(
  supabase: SupabaseClient,
  entidadId: string,
  direccion?: string | null,
): Promise<void> {
  const normalized = normalizeDireccion(direccion);
  await supabase
    .from("sedes")
    .update({ direccion: normalized })
    .eq("entidad_id", entidadId)
    .eq("es_principal", true)
    .eq("activo", true);
}

export async function loadSedesForEntidad(
  supabase: SupabaseClient,
  entidadId: string,
): Promise<Sede[]> {
  const [{ data: sedes, error }, { data: entidad }] = await Promise.all([
    supabase.from("sedes").select("*").eq("entidad_id", entidadId).eq("activo", true),
    supabase.from("entidades").select("direccion").eq("id", entidadId).maybeSingle(),
  ]);

  if (error || !sedes) return [];

  const entidadDireccion = normalizeDireccion(entidad?.direccion);
  const principal = (sedes as Sede[]).find((sede) => sede.es_principal);
  if (principal && principal.direccion !== entidadDireccion) {
    await syncSedePrincipalDireccionFromEntidad(supabase, entidadId, entidadDireccion);
  }

  return (sedes as Sede[]).map((sede) =>
    sede.es_principal ? { ...sede, direccion: entidadDireccion } : sede,
  );
}
