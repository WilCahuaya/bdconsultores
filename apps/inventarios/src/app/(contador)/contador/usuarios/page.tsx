import { redirect } from "next/navigation";
import { PanelPageHeader } from "@/components/panel/panel-ui";
import { UsuariosPageClient } from "@/components/panel/UsuariosPageClient";
import { listUsuarios } from "@/lib/actions/usuarios";
import { requireProfile } from "@/lib/auth/profile";

export default async function ContadorUsuariosPage() {
  let profile;
  try {
    profile = await requireProfile("CONTADOR");
  } catch {
    redirect("/login");
  }

  const usuarios = await listUsuarios();

  return (
    <div className="space-y-6">
      <PanelPageHeader
        title="Usuarios"
        subtitle="Gestione contadores del estudio e invíte administradores al crear una entidad."
      />
      <UsuariosPageClient usuarios={usuarios} currentUserId={profile.id} />
    </div>
  );
}
