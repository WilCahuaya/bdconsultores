import { createMiddlewareSupabase } from "@bd/auth/middleware";
import { portalOrigin } from "@bd/config";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth")) {
    return NextResponse.next({ request });
  }

  const { supabase, getResponse } = createMiddlewareSupabase(request);
  const loginUrl = `${portalOrigin()}/login`;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("activo")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.activo) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${loginUrl}?error=no_profile`);
  }

  return getResponse();
}
