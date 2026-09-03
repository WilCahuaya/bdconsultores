import { redirect } from "next/navigation";
import { inventarioHomePathForRole } from "@inventario/types";
import { portalOrigin } from "@bd/config";
import { getProfile } from "@/lib/auth/profile";

export default async function InventariosIndexPage() {
  const profile = await getProfile();
  if (!profile) {
    redirect(`${portalOrigin()}/login`);
  }
  redirect(inventarioHomePathForRole(profile.rol));
}
