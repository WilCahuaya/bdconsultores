"use client";

import { Button } from "@inventario/ui";
import { IconLogOut } from "@inventario/ui/panel";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={collapsed ? "h-9 w-full justify-center px-2" : "w-full"}
      title={collapsed ? "Cerrar sesión" : undefined}
      onClick={() => void handleLogout()}
    >
      {collapsed ? <IconLogOut className="h-4 w-4" /> : "Cerrar sesión"}
    </Button>
  );
}
