import type { ReactNode } from "react";
import { Input } from "./components";
import { PanelBreadcrumbs, type PanelBreadcrumbItem } from "./panel-breadcrumbs";

export type { PanelBreadcrumbItem };
export { PanelBreadcrumbs, withSedeBreadcrumb } from "./panel-breadcrumbs";
export {
  AmbienteBreadcrumbSelect,
  AMBIENTE_BREADCRUMB_INDEX_AFTER_SEDE,
  withAmbienteBreadcrumbSelect,
  type AmbienteNavOption,
  type FetchAmbientesPorSede,
} from "./ambiente-breadcrumb-select";

export const panelCardClass =
  "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm";
export const panelFieldsetClass =
  "min-w-0 space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm";
export const panelLegendClass = "px-1 text-sm font-semibold text-foreground";

export const panelModalClass =
  "w-full max-w-[min(70rem,calc(100%-1rem))] sm:max-w-[min(60rem,95%)] md:max-w-[min(56rem,88%)] lg:max-w-[min(48rem,70%)]";

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

export function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
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
        d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
      />
    </svg>
  );
}

export function PanelPageHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  breadcrumbs,
  actions,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  breadcrumbs?: PanelBreadcrumbItem[];
  actions?: ReactNode;
}) {
  const crumbs =
    breadcrumbs ??
    (title && onBack && backLabel
      ? [{ label: backLabel, onClick: onBack }, { label: title }]
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
            <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PanelBanner({
  label,
  title,
  subtitle,
}: {
  label: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">{label}</p>
      <p className="truncate font-semibold text-primary" title={title}>
        {title}
      </p>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function PanelTabs<T extends string>({
  tabs,
  value,
  onChange,
  actions,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60">
      <div className="flex gap-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={value === tab.id}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              value === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {actions ? <div className="flex shrink-0 pb-2">{actions}</div> : null}
    </div>
  );
}

export function PanelFlashMessage({
  variant,
  children,
}: {
  variant: "success" | "error";
  children: ReactNode;
}) {
  const classes =
    variant === "success"
      ? "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100"
      : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${classes}`} role="status">
      {children}
    </p>
  );
}

export function PanelSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <SearchIcon />
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Buscar…"}
        className="pl-9"
        spellCheck={false}
      />
    </div>
  );
}

export function PanelEmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
      <p className="font-medium text-muted-foreground">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PanelCountLabel({
  count,
  singular,
  plural,
}: {
  count: number;
  singular: string;
  plural: string;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {count} {count === 1 ? singular : plural}
    </p>
  );
}

export function StatusBadge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "active" | "pending" | "default";
}) {
  const classes =
    variant === "active"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
      : variant === "pending"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        : "bg-muted text-muted-foreground";

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {children}
    </span>
  );
}

export function PanelToolbar({
  left,
  right,
}: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {left}
      {right}
    </div>
  );
}

export { TABLE_PAGE_SIZE, TABLE_PAGE_SIZE_OPTIONS, TablePagination, useTablePagination, type TablePageSize } from "./table-pagination";
export {
  INVENTARIO_TABLE_COL_COUNT,
  INVENTARIO_TABLE_COMPACT_COL_COUNT,
  INVENTARIO_TABLE_COL_WIDTHS_PCT,
  inventarioTableColWidths,
  inventarioTableColWidthsCompact,
} from "./inventario-table-cols";
export * from "./inventario-column-header-filter";
export {
  ActivosInventarioTable,
  type ActivosInventarioTableProps,
  type InventarioSelectionProps,
} from "./inventario-activos-table";
export {
  EstadoBienBadge,
  InventarioTablaLeyenda,
  INVENTARIO_TABLA_LEYENDA,
  ValorBienCell,
  InventarioFechaCell,
  fechaAdquisicionToneClass,
  inventarioCuentaContable,
  inventarioDepreciacionFila,
  inventarioDescripcion,
  inventarioTdAccionesClass,
  inventarioTdComprobanteClass,
  inventarioTdFechaClass,
  formatInventarioListaTexto,
} from "./inventario-table-cells";
export {
  ActivoDetalleSheet,
  type ActivoDetalle,
} from "./activo-detalle-sheet";
export { Sheet } from "./sheet";
export { Tooltip } from "./tooltip";
export { TableActionsOverflow, type TableActionItem } from "./table-actions-overflow";
export * from "./panel-table-layout";
export * from "./panel-action-buttons";
export * from "./panel-view-toggle";
export * from "./panel-list-table";
export * from "./panel-nav-icons";
export * from "./panel-sidebar";
export * from "./reportes-panel";
export * from "./ambiente-reportes-export-menu";
export * from "./ambientes-datos-menu";
export * from "./activo-edit-scope-nav";
export * from "./use-inventario-selection";
export * from "./eliminar-preregistrados-bulk-dialog";
export * from "./preregistro-gestion-toolbar";
export type { PreregistroGestionToolbarState } from "./preregistro-gestion-toolbar";
export * from "./responsive-layout";
export { usePanelInventarioUnifiedScroll, usePanelToolbarCollapseOnVerticalScroll, usePanelToolbarCollapseOnHorizontalScroll } from "./use-panel-toolbar-collapse";
export { PanelToolbarExpandTrigger } from "./panel-toolbar-collapse";
export * from "./sede-nav-cards";
export * from "./sede-ambiente-filter";
export * from "./visitas-campo";
export * from "./entidad-resumen-panel";
export * from "./bd-portal-shell";
export * from "./bd-portal-brand-icon";
export * from "./bd-portal-theme-toggle";
export * from "./bd-google-sign-in-button";
export * from "./entity-portal-menu";
