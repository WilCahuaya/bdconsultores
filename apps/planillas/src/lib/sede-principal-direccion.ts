import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncSedePrincipalDireccionFromEntidad(
  supabase: SupabaseClient,
  entidadId: string,
  direccion?: string | null,
): Promise<void> {
  const normalized = direccion?.trim() || null;
  await supabase
    .from("sedes")
    .update({ direccion: normalized })
    .eq("entidad_id", entidadId)
    .eq("es_principal", true)
    .eq("activo", true);
}
