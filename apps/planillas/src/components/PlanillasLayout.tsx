"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { MODULE_PLANILLAS, PLATFORM_NAME } from "@inventario/types";
import {
  IconMenu,
  panelMainScrollClass,
  panelPageClass,
  panelShellHeaderClass,
  type PanelNavSection,
} from "@inventario/ui/panel";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { PlanillasSidebar } from "@/components/PlanillasSidebar";

export function PlanillasLayout({
  sections,
  user,
  homeHref,
  modulesHref,
  children,
}: {
  sections: PanelNavSection[];
  user?: { nombre: string; email: string };
  homeHref: string;
  modulesHref: string;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="panel-shell flex h-dvh w-full max-w-full flex-col overflow-hidden bg-muted/30">
      <header className="border-b border-border/70 bg-card shadow-sm">
        <div className={panelShellHeaderClass}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Abrir menú de navegación"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/60 text-foreground hover:bg-muted md:hidden"
            >
              <IconMenu />
            </button>
            <Link href={homeHref} className="group min-w-0">
              <p className="truncate text-base font-bold text-primary group-hover:opacity-90 sm:text-lg">
                {PLATFORM_NAME}
              </p>
              <p className="truncate text-xs text-muted-foreground">{MODULE_PLANILLAS}</p>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={modulesHref}
              className="inline-flex h-9 items-center rounded-md border border-border/70 bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Volver a módulos
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="flex min-h-0 w-full max-w-full flex-1 overflow-hidden md:flex-row">
        <PlanillasSidebar
          sections={sections}
          user={user}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className={`${panelMainScrollClass} min-w-0 flex-1`}>
          <div className={`${panelPageClass} space-y-6`}>{children}</div>
        </main>
      </div>
    </div>
  );
}
