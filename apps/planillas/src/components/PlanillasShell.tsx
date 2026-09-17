import type { ReactNode } from "react";
import { portalOrigin } from "@bd/config";
import { esPersonalEstudio, plataformaModulosPath, type Profile } from "@inventario/types";
import { PlanillasLayout } from "@/components/PlanillasLayout";
import { PlanillasToastProvider } from "@/components/PlanillasToastProvider";
import { planillasHomeHref, planillasNavSections } from "@/lib/planillas-nav";

export function PlanillasShell({
  profile,
  children,
  entidadId,
}: {
  profile: Profile;
  children: ReactNode;
  entidadId?: string;
}) {
  return (
    <PlanillasToastProvider>
      <PlanillasLayout
        sections={planillasNavSections({
          entidadId,
          esEstudio: esPersonalEstudio(profile.rol),
        })}
        user={{ nombre: profile.nombre, email: profile.email }}
        homeHref={planillasHomeHref(entidadId)}
        modulesHref={`${portalOrigin()}${plataformaModulosPath(profile.rol)}`}
      >
        {children}
      </PlanillasLayout>
    </PlanillasToastProvider>
  );
}
