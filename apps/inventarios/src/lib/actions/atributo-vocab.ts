"use server";

import type { ActivoAtributoCampo } from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";

export async function suggestActivoAtributo(
  campo: ActivoAtributoCampo,
  query: string,
  limit = 10,
): Promise<string[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const trimmed = query.trim();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("suggest_activo_atributo", {
    p_campo: campo,
    p_query: trimmed,
    p_limit: limit,
  });

  if (error) {
    console.error("suggest_activo_atributo:", error.message);
    return [];
  }

  return (data ?? []).map((row: { valor: string }) => row.valor);
}
