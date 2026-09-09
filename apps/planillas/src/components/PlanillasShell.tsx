import type { ReactNode } from "react";
import Link from "next/link";
import { portalOrigin } from "@bd/config";
import { MODULE_PLANILLAS, PLATFORM_NAME, plataformaModulosPath, type Profile } from "@inventario/types";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { PlanillasNav } from "@/components/PlanillasNav";

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
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b border-border/70 bg-card shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="min-w-0">
            <p className="truncate text-base font-bold text-primary sm:text-lg">{PLATFORM_NAME}</p>
            <p className="truncate text-xs text-muted-foreground">{MODULE_PLANILLAS}</p>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`${portalOrigin()}${plataformaModulosPath(profile.rol)}`}
              className="inline-flex h-9 items-center rounded-md border border-border/70 bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Volver a módulos
            </a>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        <PlanillasNav entidadId={entidadId} />
        {children}
      </main>
    </div>
  );
}
