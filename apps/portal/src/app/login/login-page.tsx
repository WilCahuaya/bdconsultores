"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BD_PORTAL_LOGIN_HINT } from "@inventario/types";
import { BdGoogleSignInButton, BdPortalShell } from "@inventario/ui/panel";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "no_profile") {
      setError(
        "Su cuenta de Google no está autorizada. Debe ser invitado como administrador al crear una entidad, o tener un perfil de contador.",
      );
      return;
    }
    if (err === "auth") {
      // Mensaje legado (callbacks antiguos). Limpiamos la URL; el reintento suele bastar.
      setError(null);
      router.replace("/login");
    }
  }, [searchParams, router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    if (searchParams.get("error")) {
      router.replace("/login");
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("provider is not enabled") || msg.includes("unsupported provider")) {
        setError(
          "Google no está habilitado en Supabase. Vaya a Authentication → Providers → Google, actívelo y guarde Client ID y Secret.",
        );
      } else {
        setError(authError.message);
      }
      setLoading(false);
    }
  }

  return (
    <BdPortalShell onExit={() => { window.location.href = "/"; }} exitLabel="SALIR">
      <div className="bd-portal-card">
        <p className="bd-portal-login-hint">{BD_PORTAL_LOGIN_HINT}</p>
        {error && <p className="bd-portal-error">{error}</p>}
        <BdGoogleSignInButton loading={loading} onClick={() => void handleGoogleLogin()} />
      </div>
    </BdPortalShell>
  );
}
