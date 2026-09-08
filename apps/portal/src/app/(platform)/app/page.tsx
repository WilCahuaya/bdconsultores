import { redirect } from "next/navigation";
import { portalHomePathForRole } from "@/lib/auth/home-path";
import { getProfile } from "@/lib/auth/profile";

export default async function PlatformHomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(portalHomePathForRole(profile.rol));
}
