import { createServerClient } from "@supabase/ssr";
import { esUsuarioEntidad, homePathForRole, type RolUsuario } from "@inventario/types";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/routes";

function isPrivatePath(pathname: string): boolean {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/contador") ||
    pathname.startsWith("/admin")
  );
}

function panelForRole(rol: RolUsuario): "/contador" | "/admin" {
  return esUsuarioEntidad(rol) ? "/admin" : "/contador";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  let profile: { rol: RolUsuario; activo: boolean } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("rol, activo")
      .eq("id", user.id)
      .maybeSingle();
    profile = data as { rol: RolUsuario; activo: boolean } | null;
  }

  const hasValidProfile = Boolean(profile?.activo);

  if (user && !hasValidProfile && isPrivatePath(pathname)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "no_profile");
    return NextResponse.redirect(url);
  }

  if (!user && isPrivatePath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && hasValidProfile && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(profile!.rol);
    return NextResponse.redirect(url);
  }

  if (user && hasValidProfile && profile) {
    const allowedPanel = panelForRole(profile.rol);
    if (pathname.startsWith("/contador") && allowedPanel !== "/contador") {
      const url = request.nextUrl.clone();
      url.pathname = homePathForRole(profile.rol);
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/admin") && allowedPanel !== "/admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/contador";
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isPublicPath(pathname) && !isPrivatePath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
