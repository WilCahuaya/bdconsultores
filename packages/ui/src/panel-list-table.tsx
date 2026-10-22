import type { ReactNode } from "react";
import { panelCardClass } from "./panel";

export function PanelDataTable({
  children,
  minWidth: _minWidth,
  layout = "fixed",
  scroll = false,
  className,
  footer,
}: {
  children: ReactNode;
  /** @deprecated Las tablas usan ancho fluido sin scroll horizontal. */
  minWidth?: number;
  layout?: "fixed" | "auto";
  /** La tabla crece con el contenido y se desplaza en horizontal. */
  scroll?: boolean;
  className?: string;
  footer?: ReactNode;
}) {
  const catalogo = className?.includes("catalogo-cols-full") ?? false;
  const table = (
    <table
      className={`text-left text-sm ${
        layout === "auto" ? "table-auto" : "table-fixed"
      } ${scroll ? "w-max min-w-full" : "min-w-0 w-full max-w-full"}`}
    >
      {children}
    </table>
  );

  if (catalogo) {
    return (
      <div
        className={`${panelCardClass} panel-list-table catalogo-cols-full flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden`}
      >
        <div className="catalogo-cols-scroll min-h-0 min-w-0 flex-1 overflow-auto">
          {table}
        </div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={`${panelCardClass} panel-list-table min-w-0 max-w-full ${
        scroll ? "overflow-x-auto" : "overflow-hidden"
      } ${className ?? ""}`}
    >
      {table}
      {footer}
    </div>
  );
}

export const panelTableStickyHeadClass = "sticky top-0 z-10";

export const panelTableHeadRowClass =
  "border-b border-border/60 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground";

export const panelTableThClass =
  "max-w-0 overflow-hidden px-2 py-2.5 font-semibold sm:px-3 lg:py-3 xl:px-4 2xl:px-5";

export const panelTableBodyRowClass =
  "border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/30";

export const panelTableClickableRowClass = `${panelTableBodyRowClass} cursor-pointer hover:bg-muted/50`;

export const panelTableTdClass =
  "max-w-0 overflow-hidden px-2 py-2.5 align-middle sm:px-3 lg:py-3 xl:px-4 2xl:px-5";

export const panelTableMutedClass = "text-muted-foreground";
