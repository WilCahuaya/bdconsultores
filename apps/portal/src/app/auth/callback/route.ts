import { supabaseCookieOptions } from "@bd/auth";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { portalHomePathForRole } from "@/lib/auth/home-path";
import { provisionProfileFromContador } from "@/lib/auth/contador-invite";
import { provisionProfileFromEntidad } from "@/lib/auth/entidad-admin";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Intercambia el code OAuth y adjunta las cookies de sesión al redirect.
 * Sin esto, Next puede devolver el redirect sin Set-Cookie y el 1.er login falla.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  // Cancelación / error del proveedor o callback sin code → login limpio para reintentar.
  if (oauthError || !code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = await cookies();
  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options });
            try {
              cookieStore.set(name, value, { ...supabaseCookieOptions, ...options, path: "/" });
            } catch {
              // El store puede ser de solo lectura en algunos contextos; igual van al response.
            }
          });
        },
      },
    },
  );

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

  if (sessionError) {
    // Code ya usado, PKCE inválido, etc. → login sin mensaje agresivo (reintento suele funcionar).
    return NextResponse.redirect(`${origin}/login`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.activo) {
    const provisioned =
      (await provisionProfileFromEntidad(user)) ?? (await provisionProfileFromContador(user));
    if (provisioned?.activo) {
      profile = provisioned;
    }
  }

  if (!profile?.activo) {
    await supabase.auth.signOut();
    return applyCookies(
      NextResponse.redirect(`${origin}/login?error=no_profile`),
      pendingCookies,
    );
  }

  const redirectPath = portalHomePathForRole(profile.rol);
  return applyCookies(NextResponse.redirect(`${origin}${redirectPath}`), pendingCookies);
}

function applyCookies(response: NextResponse, pending: CookieToSet[]) {
  for (const { name, value, options } of pending) {
    response.cookies.set(name, value, { ...supabaseCookieOptions, ...options, path: "/" });
  }
  return response;
}
