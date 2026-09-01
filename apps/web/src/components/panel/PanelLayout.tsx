"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { MODULE_INVENTARIO, PLATFORM_HOME, PLATFORM_NAME } from "@inventario/types";
import { ThemeToggle } from "@inventario/ui/theme-toggle";
import { ToastProvider } from "@inventario/ui";
import { panelMainScrollClass, panelPageClass } from "@inventario/ui/panel";
import type { PanelNavSection } from "./panel-nav-icons";
import { IconMenu } from "./panel-nav-icons";
import { PanelSidebar } from "./PanelSidebar";
import { PanelDataSync } from "./PanelDataSync";

interface PanelLayoutProps {
  panelLabel: string;
  homeHref: string;
  sections: PanelNavSection[];
  user?: { nombre: string; email: string };
  /** Admin: limita realtime a la entidad del perfil. */
  realtimeEntidadId?: string | null;
  children: ReactNode;
}

export function PanelLayout({
  panelLabel,
  homeHref,
  sections,
  user,
  realtimeEntidadId,
  children,
}: PanelLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="panel-shell flex h-dvh w-full max-w-full flex-col overflow-hidden bg-muted/30">
        <PanelDataSync entidadId={realtimeEntidadId} />
      <header className="border-b border-border/70 bg-card shadow-sm">
        <div className="panel-shell-header">
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
              <p className="truncate text-xs text-muted-foreground">
                {MODULE_INVENTARIO} · {panelLabel}
              </p>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={PLATFORM_HOME}
              className="text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm"
            >
              Aplicaciones
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 w-full max-w-full flex-1 overflow-hidden md:flex-row">
        <PanelSidebar
          sections={sections}
          user={user}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className={`${panelMainScrollClass} min-w-0 flex-1`}>
          <div className={panelPageClass}>{children}</div>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
