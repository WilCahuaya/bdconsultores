import { createMiddlewareSupabase } from "@bd/auth/middleware";
import { NextResponse, type NextRequest } from "next/server";
import type { RolUsuario } from "@inventario/types";
import { portalHomePathForRole } from "@/lib/auth/home-path";
import { isPublicPath } from "@/lib/routes";

function isZonedApp(pathname: string): boolean {
  return pathname.startsWith("/inventarios") || pathname.startsWith("/planillas");
}

function isPrivatePath(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isZonedApp(pathname)) {
    return NextResponse.next({ request });
  }

  const { supabase, getResponse } = createMiddlewareSupabase(request);

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
    url.pathname = portalHomePathForRole(profile!.rol);
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicPath(pathname) && !isPrivatePath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return getResponse();
}
