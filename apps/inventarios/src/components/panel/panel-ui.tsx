"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  PanelBreadcrumbs as PanelBreadcrumbsBase,
  type PanelBreadcrumbItem,
  panelCardClass,
} from "@inventario/ui/panel";

export {
  PanelBanner,
  PanelCountLabel,
  PanelEmptyState,
  PanelFlashMessage,
  PanelSearchInput,
  PanelTabs,
  PanelToolbar,
  PanelToolbarExpandTrigger,
  SearchIcon,
  StatusBadge,
  usePanelInventarioUnifiedScroll,
  panelCardClass,
  panelFieldsetClass,
  panelLegendClass,
  panelModalClass,
  panelFilterRowClass,
  panelInventarioScrollClass,
  panelInventarioBodyScrollClass,
  panelInventarioPaginationFooterClass,
  panelInventarioPageClass,
  panelInventarioChromeClass,
  panelInventarioToolbarClass,
  panelStickyToolbarClass,
  panelStickyToolbarCollapsedClass,
  panelToolbarExpandTriggerStickyClass,
  panelToolbarActionsClass,
  type PanelBreadcrumbItem,
} from "@inventario/ui/panel";

export function PanelBreadcrumbs({ items }: { items: PanelBreadcrumbItem[] }) {
  return (
    <PanelBreadcrumbsBase
      items={items}
      LinkComponent={({ href, className, title, children }) => (
        <Link href={href} className={className} title={title}>
          {children}
        </Link>
      )}
    />
  );
}

export function EditIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
      />
    </svg>
  );
}

export function PanelPageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  breadcrumbs,
  actions,
}: {
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: PanelBreadcrumbItem[];
  actions?: ReactNode;
}) {
  const crumbs =
    breadcrumbs ??
    (title && backHref && backLabel
      ? [{ label: backLabel, href: backHref }, { label: title }]
      : title
        ? [{ label: title }]
        : undefined);

  return (
    <div>
      {crumbs && crumbs.length > 0 && <PanelBreadcrumbs items={crumbs} />}
      {(subtitle || actions) && (
        <div
          className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 ${crumbs?.length ? "mt-2" : ""}`}
        >
          {subtitle ? (
            <p className="min-w-0 text-sm text-muted-foreground">{subtitle}</p>
          ) : (
            <span className="hidden sm:block sm:flex-1" />
          )}
          {actions && (
            <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none [&>a]:flex-1 sm:[&>a]:flex-none">
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PanelStatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const content = (
    <div className={`${panelCardClass} p-5 transition-colors ${href ? "hover:border-primary/40" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
