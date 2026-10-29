import type { SupportedStorage, User } from "@supabase/supabase-js";

export const AUTH_STORAGE_KEY = "inventario.desktop.auth";

let explicitSignOut = false;
let snapshotRaw: string | null = null;
const localSignOutListeners = new Set<() => void>();

function browserStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function parseStoredUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { user?: User };
    if (!parsed?.user?.id) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

/** La sesión local solo se borra al pulsar Cerrar sesión. */
export function beginExplicitSignOut(): void {
  explicitSignOut = true;
  snapshotRaw = null;
  try {
    browserStorage()?.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
  for (const listener of localSignOutListeners) listener();
}

/** Llamar antes de un login nuevo, para que el guardado de la sesión no quede bloqueado. */
export function allowNextSignIn(): void {
  explicitSignOut = false;
}

export function isExplicitSignOut(): boolean {
  return explicitSignOut;
}

export function onLocalSignOut(listener: () => void): () => void {
  localSignOutListeners.add(listener);
  return () => localSignOutListeners.delete(listener);
}

export function readKeptSessionUser(): User | null {
  if (explicitSignOut) return null;
  const store = browserStorage();
  const current = store?.getItem(AUTH_STORAGE_KEY) ?? null;
  const fromStorage = parseStoredUser(current);
  if (fromStorage) {
    if (current) snapshotRaw = current;
    return fromStorage;
  }
  const fromSnapshot = parseStoredUser(snapshotRaw);
  if (fromSnapshot && snapshotRaw && store) {
    try {
      store.setItem(AUTH_STORAGE_KEY, snapshotRaw);
    } catch {
      // ignore quota
    }
    return fromSnapshot;
  }
  return null;
}

/**
 * Storage de Supabase que ignora el borrado automático cuando falla la
 * renovación del token. Cerrar sesión sigue pudiendo eliminar la clave.
 */
export const persistentAuthStorage: SupportedStorage = {
  getItem(key) {
    return browserStorage()?.getItem(key) ?? null;
  },
  setItem(key, value) {
    if (key === AUTH_STORAGE_KEY && explicitSignOut) return;
    browserStorage()?.setItem(key, value);
    if (key === AUTH_STORAGE_KEY) snapshotRaw = value;
  },
  removeItem(key) {
    if (key === AUTH_STORAGE_KEY && !explicitSignOut) return;
    browserStorage()?.removeItem(key);
    if (key === AUTH_STORAGE_KEY) snapshotRaw = null;
  },
};
