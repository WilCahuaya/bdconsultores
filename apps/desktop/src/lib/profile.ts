import type { Profile } from "@inventario/types";
import { readKeptSessionUser } from "./local-auth-session";
import { isOnline } from "./master-cache";
import { getSupabaseClient } from "./supabase";

const PROFILE_CACHE_KEY = "inventario.desktop.profile";

function readCachedProfile(userId?: string): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as Profile;
    if (!profile?.id || !profile.activo) return null;
    if (userId && profile.id !== userId) return null;
    return profile;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // ignore quota / private mode
  }
}

export function clearCachedProfile(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore
  }
}

async function resolveAuthUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();

  // Sesión local primero: funciona sin red (getUser() valida contra el servidor).
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch {
    // Token vencido o sin red: se usa la sesión guardada en el equipo.
  }

  const kept = readKeptSessionUser();
  if (kept?.id) return kept.id;

  if (!isOnline()) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function fetchProfile(): Promise<Profile | null> {
  const userId = await resolveAuthUserId();
  if (!userId) return null;

  const cached = readCachedProfile(userId);

  if (!isOnline()) {
    return cached;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .eq("activo", true)
      .maybeSingle();

    if (!error && data) {
      const profile = data as Profile;
      writeCachedProfile(profile);
      return profile;
    }
  } catch {
    // Fallo de red aunque navigator.onLine diga true
  }

  return cached;
}
