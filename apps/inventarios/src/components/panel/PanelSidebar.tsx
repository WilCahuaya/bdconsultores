"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PanelSidebarLink, matchPanelNavPath } from "@inventario/ui/panel";
import type { PanelNavSection } from "./panel-nav-icons";
import { LogoutButton } from "@/components/shared/LogoutButton";

interface PanelSidebarProps {
  sections: PanelNavSection[];
  user?: { nombre: string; email: string };
  mobileOpen: boolean;
  onMobileClose: () => void;
}

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
    <Link
      href={href}
      className={className}
      title={title}
      onClick={onClick}
      aria-current={ariaCurrent}
    >
      {children}
    </Link>
  );
}

export function PanelSidebar({ sections, user, mobileOpen, onMobileClose }: PanelSidebarProps) {
  const pathname = usePathname();

  return (
    <PanelSidebarLink
      sections={sections}
      user={user}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
      pathname={pathname}
      isPathActive={matchPanelNavPath}
      LinkComponent={NavLink}
      renderFooter={(collapsed) => <LogoutButton collapsed={collapsed} />}
    />
  );
}
