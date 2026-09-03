import { redirect } from "next/navigation";
import { portalOrigin } from "@bd/config";
import { MODULE_PLANILLAS, PLATFORM_NAME } from "@inventario/types";
import { panelCardClass } from "@inventario/ui/panel";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { getProfile } from "@/lib/auth/profile";

export default async function PlanillasHomePage() {
  const profile = await getProfile();
  if (!profile) redirect(`${portalOrigin()}/login`);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b border-border/70 bg-card shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-primary sm:text-lg">{PLATFORM_NAME}</p>
            <p className="truncate text-xs text-muted-foreground">{MODULE_PLANILLAS}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`${portalOrigin()}/app`}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Aplicaciones
            </a>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-primary sm:text-2xl">{MODULE_PLANILLAS}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hola, {profile.nombre}. Este módulo ya está en la plataforma; la lógica de negocio viene después.
            </p>
          </div>
          <div className={`${panelCardClass} space-y-2 p-5`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">En construcción</p>
            <p className="text-sm text-foreground/80">
              Contratos, documentos, T-Registro y planilla mensual se irán habilitando aquí, con el mismo
              login del Portal.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
