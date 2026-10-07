import { redirect } from "next/navigation";
import { ContadorPortalView } from "@/components/portal/ContadorPortalView";
import { portalLoginHref, requirePersonalEstudio } from "@/lib/auth/profile";

export default async function ContadorPortalPage() {
  try {
    const profile = await requirePersonalEstudio();
    return <ContadorPortalView nombre={profile.nombre} email={profile.email} />;
  } catch {
    redirect(portalLoginHref());
  }
}
