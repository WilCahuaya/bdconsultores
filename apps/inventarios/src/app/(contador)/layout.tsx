import { PanelLayout } from "@/components/panel/PanelLayout";
import { getProfile } from "@/lib/auth/profile";
import { contadorNavSections, getContadorPreregistradoCount } from "@/lib/panel-nav";

export default async function ContadorLayout({ children }: { children: React.ReactNode }) {
  const [preregistrados, profile] = await Promise.all([
    getContadorPreregistradoCount(),
    getProfile(),
  ]);

  return (
    <PanelLayout
      panelLabel="Panel contador"
      homeHref="/contador/portal"
      sections={contadorNavSections(preregistrados)}
      user={profile ? { nombre: profile.nombre, email: profile.email } : undefined}
    >
      {children}
    </PanelLayout>
  );
}
