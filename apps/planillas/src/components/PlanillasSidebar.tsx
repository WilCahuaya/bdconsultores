"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PanelSidebarLink, type PanelNavSection } from "@inventario/ui/panel";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { matchPlanillasNavPath } from "@/lib/planillas-nav";

function NavLink({
  href,
  className,
  title,
  onClick,
  "aria-current": ariaCurrent,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  onClick?: () => void;
  "aria-current"?: "page";
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} title={title} onClick={onClick} aria-current={ariaCurrent}>
      {children}
    </Link>
  );
}

export function PlanillasSidebar({
  sections,
  user,
  mobileOpen,
  onMobileClose,
}: {
  sections: PanelNavSection[];
  user?: { nombre: string; email: string };
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <PanelSidebarLink
      sections={sections}
      user={user}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
      storageKey="planillas-panel-sidebar-collapsed"
      pathname={pathname}
      isPathActive={matchPlanillasNavPath}
      LinkComponent={NavLink}
      renderFooter={(collapsed) => <LogoutButton collapsed={collapsed} />}
    />
  );
}
