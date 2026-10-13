"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { PanelNavItem, PanelNavSection } from "./panel-nav-icons";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  PanelNavIcon,
} from "./panel-nav-icons";

const DEFAULT_STORAGE_KEY = "panel-sidebar-collapsed";

export interface PanelSidebarUser {
  nombre: string;
  email: string;
}

export type PanelMobileBreakpoint = "md" | "lg";

interface PanelSidebarCoreProps {
  sections: PanelNavSection[];
  user?: PanelSidebarUser;
  mobileOpen: boolean;
  onMobileClose: () => void;
  storageKey?: string;
  /** Por debajo de este ancho el menú es un cajón. `md` = 768, `lg` = 1024. */
  mobileBreakpoint?: PanelMobileBreakpoint;
  /** Si es false, cada visita empieza con el menú abierto. */
  persistCollapsed?: boolean;
  isItemActive: (item: PanelNavItem) => boolean;
  renderNavItem: (item: PanelNavItem, content: ReactNode, props: NavItemShellProps) => ReactNode;
  renderFooter?: (collapsed: boolean) => ReactNode;
}

function SidebarFooter({
  collapsed,
  renderFooter,
}: {
  collapsed: boolean;
  renderFooter: (collapsed: boolean) => ReactNode;
}) {
  return (
    <div
      className={`shrink-0 border-t border-border/50 ${collapsed ? "p-2" : "p-3"}`}
    >
      {renderFooter(collapsed)}
    </div>
  );
}

export interface NavItemShellProps {
  active: boolean;
  collapsed?: boolean;
  className: string;
  onNavigate?: () => void;
  title?: string;
}

function userInitials(nombre: string) {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function SidebarUserInfo({
  user,
  collapsed,
}: {
  user: PanelSidebarUser;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
        title={`${user.nombre}\n${user.email}`}
      >
        {userInitials(user.nombre)}
      </span>
    );
  }

  return (
    <div className="min-w-0 flex-1" title={`${user.nombre} — ${user.email}`}>
      <p className="truncate text-sm font-semibold leading-tight text-foreground">{user.nombre}</p>
      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
    </div>
  );
}

function formatBadge(value: number) {
  return value > 99 ? "99+" : String(value);
}

function NavBadge({
  value,
  title,
  collapsed,
}: {
  value: number;
  title?: string;
  collapsed?: boolean;
}) {
  if (value <= 0) return null;

  if (collapsed) {
    return (
      <span
        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-card"
        title={title ?? `${value} pendientes`}
        aria-hidden
      />
    );
  }

  return (
    <span
      className="ml-auto shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-300"
      title={title}
    >
      {formatBadge(value)}
    </span>
  );
}

export function navItemClassName(active: boolean, collapsed?: boolean) {
  return `relative flex w-full items-center rounded-lg font-medium transition-colors ${
    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
  } text-sm ${
    active
      ? "border-l-2 border-primary bg-primary/10 pl-[10px] text-primary"
      : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  }`;
}

function SidebarNavItemContent({
  item,
  collapsed,
}: {
  item: PanelNavItem;
  collapsed?: boolean;
}) {
  const badgeValue = item.badge ?? 0;

  return (
    <>
      <span className="relative shrink-0">
        <PanelNavIcon name={item.icon} />
        {collapsed && badgeValue > 0 && (
          <NavBadge value={badgeValue} title={item.badgeTitle} collapsed />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          <NavBadge value={badgeValue} title={item.badgeTitle} />
        </>
      )}
    </>
  );
}

function SidebarNav({
  sections,
  collapsed,
  isItemActive,
  renderNavItem,
  onNavigate,
}: {
  sections: PanelNavSection[];
  collapsed?: boolean;
  isItemActive: (item: PanelNavItem) => boolean;
  renderNavItem: PanelSidebarCoreProps["renderNavItem"];
  onNavigate?: () => void;
}) {
  return (
    <nav className={`flex flex-1 flex-col ${collapsed ? "px-2 py-3" : "px-3 py-3"}`}>
      {sections.map((section, sectionIndex) => (
        <div
          key={section.label ?? `section-${sectionIndex}`}
          className={
            sectionIndex > 0
              ? collapsed
                ? "mt-2"
                : "mt-4 border-t border-border/40 pt-4"
              : ""
          }
        >
          {section.label && !collapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {section.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isItemActive(item);
              const shell: NavItemShellProps = {
                active,
                collapsed,
                className: navItemClassName(active, collapsed),
                onNavigate,
                title: collapsed ? item.label : undefined,
              };
              const content = <SidebarNavItemContent item={item} collapsed={collapsed} />;
              return <div key={item.href}>{renderNavItem(item, content, shell)}</div>;
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function PanelSidebarCore({
  sections,
  user,
  mobileOpen,
  onMobileClose,
  storageKey = DEFAULT_STORAGE_KEY,
  mobileBreakpoint = "md",
  persistCollapsed = true,
  isItemActive,
  renderNavItem,
  renderFooter,
}: PanelSidebarCoreProps) {
  const [collapsed, setCollapsed] = useState(false);
  const wide = mobileBreakpoint === "lg";

  useEffect(() => {
    if (!persistCollapsed) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "true") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, [persistCollapsed, storageKey]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      if (persistCollapsed) {
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onMobileClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onMobileClose]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const sidebarWidth = wide
    ? collapsed
      ? "lg:w-[4.5rem]"
      : "lg:w-60 xl:w-72"
    : collapsed
      ? "md:w-[4.5rem]"
      : "md:w-60 lg:w-64 xl:w-72";
  const drawerVisibility = wide ? "lg:hidden" : "md:hidden";
  const asideVisibility = wide ? "hidden lg:flex" : "hidden md:flex";

  return (
    <>
      {mobileOpen && (
        <div className={`fixed inset-0 z-50 ${drawerVisibility}`} role="presentation">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/50"
            onClick={onMobileClose}
          />
          <aside className="relative flex h-full w-[min(18rem,85vw)] flex-col border-r border-border/70 bg-card shadow-xl">
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-4">
              {user ? (
                <SidebarUserInfo user={user} />
              ) : (
                <p className="min-w-0 flex-1 text-sm font-semibold text-primary">Menú</p>
              )}
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={onMobileClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted"
              >
                <IconClose />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <SidebarNav
                sections={sections}
                isItemActive={isItemActive}
                renderNavItem={renderNavItem}
                onNavigate={onMobileClose}
              />
            </div>
            {renderFooter && <SidebarFooter collapsed={false} renderFooter={renderFooter} />}
          </aside>
        </div>
      )}

      <aside
        className={`${asideVisibility} min-h-0 shrink-0 flex-col self-stretch border-r border-border/70 bg-card transition-[width] duration-200 ${sidebarWidth}`}
      >
        <div
          className={`flex shrink-0 items-center gap-2 border-b border-border/50 py-3 ${
            collapsed ? "flex-col px-2" : "px-3"
          }`}
        >
          {user && <SidebarUserInfo user={user} collapsed={collapsed} />}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <IconChevronRight className="h-4 w-4" />
            ) : (
              <IconChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <SidebarNav
            sections={sections}
            collapsed={collapsed}
            isItemActive={isItemActive}
            renderNavItem={renderNavItem}
          />
        </div>

        {renderFooter && <SidebarFooter collapsed={collapsed} renderFooter={renderFooter} />}
      </aside>
    </>
  );
}

export interface PanelSidebarSpaProps {
  sections: PanelNavSection[];
  user?: PanelSidebarUser;
  mobileOpen: boolean;
  onMobileClose: () => void;
  storageKey?: string;
  mobileBreakpoint?: PanelMobileBreakpoint;
  persistCollapsed?: boolean;
  activeKey: string;
  onSelect: (key: string) => void;
  renderFooter?: (collapsed: boolean) => ReactNode;
}

export function PanelSidebarSpa({
  sections,
  user,
  mobileOpen,
  onMobileClose,
  storageKey,
  mobileBreakpoint,
  persistCollapsed,
  activeKey,
  onSelect,
  renderFooter,
}: PanelSidebarSpaProps) {
  return (
    <PanelSidebarCore
      sections={sections}
      user={user}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
      storageKey={storageKey}
      mobileBreakpoint={mobileBreakpoint}
      persistCollapsed={persistCollapsed}
      renderFooter={renderFooter}
      isItemActive={(item) => item.href === activeKey}
      renderNavItem={(item, content, shell) => (
        <button
          type="button"
          className={shell.className}
          title={shell.title}
          aria-current={shell.active ? "page" : undefined}
          onClick={() => {
            onSelect(item.href);
            shell.onNavigate?.();
          }}
        >
          {content}
        </button>
      )}
    />
  );
}

export interface PanelSidebarLinkProps {
  sections: PanelNavSection[];
  user?: PanelSidebarUser;
  mobileOpen: boolean;
  onMobileClose: () => void;
  storageKey?: string;
  mobileBreakpoint?: PanelMobileBreakpoint;
  persistCollapsed?: boolean;
  pathname: string;
  isPathActive?: (pathname: string, href: string) => boolean;
  renderFooter?: (collapsed: boolean) => ReactNode;
  LinkComponent: React.ComponentType<{
    href: string;
    className?: string;
    title?: string;
    onClick?: () => void;
    "aria-current"?: "page" | undefined;
    children: ReactNode;
  }>;
}

export function PanelSidebarLink({
  sections,
  user,
  mobileOpen,
  onMobileClose,
  storageKey,
  mobileBreakpoint,
  persistCollapsed,
  pathname,
  isPathActive,
  renderFooter,
  LinkComponent,
}: PanelSidebarLinkProps) {
  const match = isPathActive ?? ((p, href) => p === href || p.startsWith(`${href}/`));

  return (
    <PanelSidebarCore
      sections={sections}
      user={user}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
      storageKey={storageKey}
      mobileBreakpoint={mobileBreakpoint}
      persistCollapsed={persistCollapsed}
      renderFooter={renderFooter}
      isItemActive={(item) => match(pathname, item.href)}
      renderNavItem={(item, content, shell) => (
        <LinkComponent
          href={item.href}
          className={shell.className}
          title={shell.title}
          onClick={shell.onNavigate}
          aria-current={shell.active ? "page" : undefined}
        >
          {content}
        </LinkComponent>
      )}
    />
  );
}
