"use server";

import { esUsuarioEntidad, type Entidad } from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { requirePlanillasProfile } from "@/lib/auth/access";

export async function listEntidadesPlanillas(): Promise<Entidad[]> {
  const profile = await requirePlanillasProfile();
  const supabase = await createClient();

  let query = supabase
    .from("entidades")
    .select("id, nombre, ruc, pe_codigo, activo")
    .eq("activo", true)
    .order("nombre");

  if (esUsuarioEntidad(profile.rol) && profile.entidad_id) {
    query = query.eq("id", profile.entidad_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Entidad[];
}
