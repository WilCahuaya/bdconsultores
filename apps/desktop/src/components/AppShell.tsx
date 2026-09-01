import type { ReactNode } from "react";
import { useState } from "react";
import { APP_CLIENT, MODULE_INVENTARIO, PLATFORM_NAME } from "@inventario/types";
import { Button } from "@inventario/ui";
import { IconLogOut, IconMenu, PanelBreadcrumbs, PanelSidebarSpa, panelMainScrollClass, panelPageClass } from "@inventario/ui/panel";
import type { PanelBreadcrumbItem, PanelNavSection } from "@inventario/ui/panel";
import { ThemeToggle } from "@inventario/ui/theme-toggle";
import { signOut } from "../hooks/useAuth";
import { ConnectionBadge } from "./ConnectionBadge";
import { SyncBlockingOverlay } from "./SyncBlockingOverlay";
import type { DesktopMainNav } from "../lib/panel-nav";
import { isDesktopMainNav } from "../lib/panel-nav";

export type MainNav = DesktopMainNav;

export interface AppSubheader {
  breadcrumbs: PanelBreadcrumbItem[];
  subtitle?: string;
}

interface AppShellProps {
  activeNav: MainNav;
  onNavChange: (nav: MainNav) => void;
  navSections: PanelNavSection[];
  subheader?: AppSubheader;
  online: boolean;
  pendingSync?: number;
  syncing?: boolean;
  blockingSync?: boolean;
  syncMessage?: string | null;
  onSyncClick?: () => void;
  user: { nombre: string; email: string };
  children: ReactNode;
}

export function AppShell({
  activeNav,
  onNavChange,
  navSections,
  subheader,
  online,
  pendingSync = 0,
  syncing = false,
  blockingSync = false,
  syncMessage = null,
  onSyncClick,
  user,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-muted/30">
      <SyncBlockingOverlay open={blockingSync} pending={pendingSync} message={syncMessage} />
      <header className="shrink-0 border-b border-border/70 bg-card shadow-sm">
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
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-primary sm:text-lg">{PLATFORM_NAME}</p>
              <p className="truncate text-xs text-muted-foreground">
                {MODULE_INVENTARIO} · Panel de campo — {APP_CLIENT}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionBadge
              online={online}
              pending={pendingSync}
              syncing={syncing}
              message={syncMessage}
              onSyncClick={onSyncClick}
            />
            <ThemeToggle />
          </div>
        </div>
        {!online && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-center text-xs text-amber-900 dark:text-amber-100 sm:px-4">
            Sin conexión: puede trabajar con la caché local. Los cambios se enviarán al reconectar.
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden md:flex-row">
        <PanelSidebarSpa
          sections={navSections}
          user={user}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          storageKey="desktop-panel-sidebar-collapsed"
          activeKey={activeNav}
          onSelect={(key) => {
            if (isDesktopMainNav(key)) onNavChange(key);
          }}
          renderFooter={(collapsed) => (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={collapsed ? "h-9 w-full justify-center px-2" : "w-full"}
              title={collapsed ? "Cerrar sesión" : undefined}
              onClick={() => void signOut()}
            >
              {collapsed ? <IconLogOut className="h-4 w-4" /> : "Cerrar sesión"}
            </Button>
          )}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {subheader && (
            <div className="shrink-0 border-b border-border/60 bg-card/80 px-3 py-2.5 sm:px-4 md:px-6">
              <PanelBreadcrumbs items={subheader.breadcrumbs} />
              {subheader.subtitle && (
                <p
                  className="mt-1 truncate text-sm text-muted-foreground"
                  title={subheader.subtitle}
                >
                  {subheader.subtitle}
                </p>
              )}
            </div>
          )}

          <main className={`${panelMainScrollClass} min-w-0 flex-1`}>
            <div className={`${panelPageClass} overflow-x-clip`}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
