import { cache } from "react";
import type { Profile } from "@inventario/types";
import { createClient } from "@/lib/supabase/server";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .eq("activo", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
});
