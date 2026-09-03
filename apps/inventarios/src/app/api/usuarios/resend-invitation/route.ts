import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resendInvitacionUsuarioById } from "@/lib/auth/resend-invitacion-usuario";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Sesión no válida." },
      { status: 401, headers: corsHeaders },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Servidor no configurado." },
      { status: 500, headers: corsHeaders },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json(
      { error: "Sesión no válida." },
      { status: 401, headers: corsHeaders },
    );
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (!actor?.activo || actor.rol !== "CONTADOR") {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 403, headers: corsHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400, headers: corsHeaders },
    );
  }

  const userId =
    typeof body === "object" && body !== null && "userId" in body
      ? (body as { userId?: unknown }).userId
      : undefined;

  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json(
      { error: "Usuario inválido." },
      { status: 400, headers: corsHeaders },
    );
  }

  const result = await resendInvitacionUsuarioById(supabase, userId);
  const status = result.error ? 400 : 200;
  return NextResponse.json(result, { status, headers: corsHeaders });
}
