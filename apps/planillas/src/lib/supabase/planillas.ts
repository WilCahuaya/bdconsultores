import { createClient } from "@/lib/supabase/server";

export async function planillasDb() {
  const supabase = await createClient();
  return supabase.schema("planillas");
}
