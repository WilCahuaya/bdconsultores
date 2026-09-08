import { createMiddlewareSupabase } from "@bd/auth/middleware";
import { esUsuarioEntidad, inventarioHomePathForRole, type RolUsuario } from "@inventario/types";
import { portalOrigin } from "@bd/config";
import { NextResponse, type NextRequest } from "next/server";

function isPrivatePath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/contador") ||
    pathname.startsWith("/admin")
  );
}

function isOpenPath(pathname: string): boolean {
  return pathname.startsWith("/auth") || pathname.startsWith("/api");
}

function panelForRole(rol: RolUsuario): "/contador" | "/admin" {
  return esUsuarioEntidad(rol) ? "/admin" : "/contador";
}

export async function updateSession(request: NextRequest) {
  const { supabase, getResponse } = createMiddlewareSupabase(request);
  const loginUrl = `${portalOrigin()}/login`;
  const { pathname } = request.nextUrl;

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    return NextResponse.redirect(`${loginUrl}?error=no_profile`);
  }

  if (!user && isPrivatePath(pathname)) {
    return NextResponse.redirect(loginUrl);
  }

  if (user && hasValidProfile && profile && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = inventarioHomePathForRole(profile.rol);
    return NextResponse.redirect(url);
  }

  if (user && hasValidProfile && profile) {
    const allowedPanel = panelForRole(profile.rol);
    if (pathname.startsWith("/contador") && allowedPanel !== "/contador") {
      const url = request.nextUrl.clone();
      url.pathname = inventarioHomePathForRole(profile.rol);
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/admin") && allowedPanel !== "/admin") {
      const url = request.nextUrl.clone();
      url.pathname = inventarioHomePathForRole(profile.rol);
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isOpenPath(pathname) && !isPrivatePath(pathname)) {
    return NextResponse.redirect(loginUrl);
  }

  return getResponse();
}
