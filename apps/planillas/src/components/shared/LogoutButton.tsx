"use client";

import { portalOrigin } from "@bd/config";
import { Button } from "@inventario/ui";
import { IconLogOut } from "@inventario/ui/panel";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `${portalOrigin()}/login`;
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
      <span className="inline-flex items-center gap-2">
        <IconLogOut className="h-4 w-4" />
        Cerrar sesión
      </span>
    </Button>
  );
}
