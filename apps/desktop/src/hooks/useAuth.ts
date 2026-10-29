import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { extractOAuthRedirectTo, forceOAuthRedirectUrl } from "@shared/auth/oauth-url";
import { getAuthCallbackUrl } from "../lib/auth-config";
import {
  allowNextSignIn,
  beginExplicitSignOut,
  isExplicitSignOut,
  onLocalSignOut,
  readKeptSessionUser,
} from "../lib/local-auth-session";
import { clearCachedProfile } from "../lib/profile";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export type AuthLoginDebug = {
  callbackUrl: string;
  oauthRedirectBefore: string | null;
  oauthRedirectAfter: string | null;
  oauthUrlPreview: string | null;
  oauthUrlKind: string | null;
  redirectPatched: boolean;
  serverOk: boolean | null;
  status: string | null;
};

function classifyOAuthUrl(oauthUrl: string): string {
  if (oauthUrl.includes("/auth/v1/authorize")) return "supabase-authorize";
  if (oauthUrl.includes("accounts.google.com")) return "google-direct";
  return "otro";
}

function isElectronDesktop(): boolean {
  return Boolean(window.electronAPI?.platform);
}

function getDesktopAuthError(): Error | null {
  if (!window.location.protocol.startsWith("file:")) return null;

  if (!window.electronAPI) {
    return new Error(
      "La aplicación no inició el puente de escritorio. Abra «Inventario Activos B&D.exe» (no index.html) desde el menú Inicio o desde release\\win-unpacked.",
    );
  }

  if (!window.electronAPI.openGoogleAuth) {
    return new Error(
      "La versión instalada está desactualizada. Cierre la app, ejecute de nuevo el instalador y abra la app desde el acceso directo creado.",
    );
  }

  return null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();

    function userToKeep(sessionUser: User | null | undefined): User | null {
      if (isExplicitSignOut()) return null;
      return sessionUser ?? readKeptSessionUser();
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(userToKeep(session?.user));
        setLoading(false);
      })
      .catch(() => {
        setUser(userToKeep(null));
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_OUT" || isExplicitSignOut()) {
        setUser(isExplicitSignOut() ? null : readKeptSessionUser());
        return;
      }
      setUser(userToKeep(session?.user));
    });

    const stopLocalSignOut = onLocalSignOut(() => setUser(null));

    return () => {
      stopLocalSignOut();
      subscription.unsubscribe();
    };
  }, [configured]);

  useEffect(() => {
    if (!configured || isElectronDesktop()) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code || !window.location.pathname.includes("/auth/callback")) return;

    void completeOAuthCallback(window.location.href).then(() => {
      window.history.replaceState({}, "", "/");
    });
  }, [configured]);

  return { user, loading, configured };
}

function readOAuthParams(callbackUrl: string): URLSearchParams {
  const queryStart = callbackUrl.indexOf("?");
  const hashStart = callbackUrl.indexOf("#");

  if (queryStart >= 0) {
    const end = hashStart >= 0 ? hashStart : callbackUrl.length;
    return new URLSearchParams(callbackUrl.slice(queryStart + 1, end));
  }

  if (hashStart >= 0) {
    return new URLSearchParams(callbackUrl.slice(hashStart + 1));
  }

  return new URLSearchParams();
}

async function completeOAuthCallback(callbackUrl: string) {
  const params = readOAuthParams(callbackUrl);
  const hashStart = callbackUrl.indexOf("#");
  const hashParams =
    hashStart >= 0 ? new URLSearchParams(callbackUrl.slice(hashStart + 1)) : new URLSearchParams();

  const oauthError = params.get("error") ?? hashParams.get("error");
  if (oauthError) {
    throw new Error(params.get("error_description") ?? hashParams.get("error_description") ?? oauthError);
  }

  const supabase = getSupabaseClient();
  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const accessToken = params.get("access_token") ?? hashParams.get("access_token");
  const refreshToken = params.get("refresh_token") ?? hashParams.get("refresh_token");
  if (accessToken) {
    if (!refreshToken) {
      throw new Error("No se recibió refresh_token en la respuesta de Google.");
    }
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return;
  }

  throw new Error("No se recibieron credenciales de sesión en el callback.");
}

export async function signInWithGoogle(
  onDebug?: (debug: AuthLoginDebug) => void,
): Promise<{
  error: Error | null;
  debug?: AuthLoginDebug;
}> {
  const publishDebug = (partial: AuthLoginDebug) => {
    onDebug?.(partial);
  };
  const desktopAuthError = getDesktopAuthError();
  if (desktopAuthError) {
    return { error: desktopAuthError };
  }

  const desktopApi = window.electronAPI;
  const isDesktop = isElectronDesktop();
  const callbackUrl = getAuthCallbackUrl();
  const debug: AuthLoginDebug = {
    callbackUrl,
    oauthRedirectBefore: null,
    oauthRedirectAfter: null,
    oauthUrlPreview: null,
    oauthUrlKind: null,
    redirectPatched: false,
    serverOk: null,
    status: null,
  };

  allowNextSignIn();

  if (isDesktop && desktopApi?.getAuthDiagnostics) {
    const diag = await desktopApi.getAuthDiagnostics();
    debug.serverOk = diag.ok;
    if (!diag.ok && diag.error) {
      return {
        error: new Error(`Servidor OAuth local: ${diag.error}`),
        debug,
      };
    }
  }

  if (isDesktop) {
    await desktopApi!.beginGoogleAuth();
  }

  const cancelDesktopAuth = () => {
    if (isDesktop) void desktopApi?.cancelGoogleAuth();
  };

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      cancelDesktopAuth();
      return { error, debug };
    }

    if (!data?.url) {
      cancelDesktopAuth();
      return {
        error: new Error(
          "No se pudo obtener la URL de Google. Verifique su conexión e intente de nuevo.",
        ),
        debug,
      };
    }

    debug.oauthUrlPreview = data.url.slice(0, 160);
    debug.oauthUrlKind = classifyOAuthUrl(data.url);
    debug.oauthRedirectBefore = extractOAuthRedirectTo(data.url);
    const patched = forceOAuthRedirectUrl(data.url, callbackUrl);
    debug.oauthRedirectAfter = extractOAuthRedirectTo(patched.url);
    debug.redirectPatched = patched.patched;
    debug.status = "Abriendo navegador…";
    publishDebug({ ...debug });

    if (debug.oauthRedirectAfter !== callbackUrl) {
      cancelDesktopAuth();
      return {
        error: new Error(
          `No se pudo fijar redirect_to (tipo: ${debug.oauthUrlKind}, obtenido: ${debug.oauthRedirectAfter ?? "vacío"}).`,
        ),
        debug,
      };
    }

    if (desktopApi?.openGoogleAuth) {
      try {
        debug.status = "Esperando login en el navegador…";
        publishDebug({ ...debug });
        const resultCallbackUrl = await desktopApi.openGoogleAuth(patched.url);
        await completeOAuthCallback(resultCallbackUrl);
        return { error: null, debug };
      } catch (err) {
        cancelDesktopAuth();
        return {
          error: err instanceof Error ? err : new Error("Autenticación cancelada"),
          debug,
        };
      }
    }

    if (isDesktop) {
      cancelDesktopAuth();
      return {
        error: new Error("No se pudo iniciar la autenticación en la aplicación de escritorio."),
        debug,
      };
    }

    window.location.assign(patched.url);
    return { error: null, debug };
  } catch (err) {
    cancelDesktopAuth();
    return {
      error: err instanceof Error ? err : new Error("No se pudo iniciar sesión con Google"),
      debug,
    };
  }
}

export async function signOut() {
  beginExplicitSignOut();
  clearCachedProfile();
  const supabase = getSupabaseClient();
  return supabase.auth.signOut({ scope: "local" });
}
