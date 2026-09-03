import { redirect } from "next/navigation";
import { ContadorPortalView } from "@/components/portal/ContadorPortalView";
import { requireProfile } from "@/lib/auth/profile";

export default async function ContadorPortalPage() {
  try {
    const profile = await requireProfile("CONTADOR");
    return <ContadorPortalView nombre={profile.nombre} email={profile.email} />;
  } catch {
    redirect("/login");
  }
}
