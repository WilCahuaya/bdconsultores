import type { ReactNode } from "react";
import { cn } from "./components";

/** @deprecated Usar ENTIDADES_TABLE_COLS con layout="auto" en PanelDataTable. */
export const ENTIDADES_TABLE_COL_WIDTHS_PCT = [24, 9, 15, 24, 8, 20] as const;

/** grow = ocupa el espacio libre; shrink = solo el ancho del contenido */
export type PanelTableColSpec = { type: "grow" } | { type: "shrink" };

/** Razón social, RUC, administrador, dirección, ambientes, estado, acciones */
export const ENTIDADES_TABLE_COLS: PanelTableColSpec[] = [
  { type: "grow" },
  { type: "shrink" },
  { type: "grow" },
  { type: "grow" },
  { type: "shrink" },
  { type: "shrink" },
  { type: "shrink" },
];

/** nombre, dni, cargo, correo, teléfono, ambientes, estado, acciones */
export const RESPONSABLES_TABLE_COLS: PanelTableColSpec[] = [
  { type: "grow" },
  { type: "shrink" },
  { type: "shrink" },
  { type: "grow" },
  { type: "shrink" },
  { type: "grow" },
  { type: "shrink" },
  { type: "shrink" },
];

export const panelTableShrinkCellClass = "w-0 whitespace-nowrap";

/** Compacta al contenido sin colapsar la celda (p. ej. estado, acciones). */
export const panelTableNowrapCellClass = "whitespace-nowrap";

/** Anchos % — ambientes: nombre, responsable, descripción, sucursal, activos, estado, acciones */
export const AMBIENTES_TABLE_COL_WIDTHS_PCT = [16, 12, 22, 10, 8, 8, 24] as const;

/** Ambientes: nombre, espacio, responsable, descripción, sucursal, activos, estado, acciones */
export const AMBIENTES_TABLE_COLS: PanelTableColSpec[] = [
  { type: "grow" },
  { type: "shrink" },
  { type: "grow" },
  { type: "grow" },
  { type: "shrink" },
  { type: "shrink" },
  { type: "shrink" },
  { type: "shrink" },
];

/** Con columna visita de campo */
export const AMBIENTES_TABLE_COLS_VISITA: PanelTableColSpec[] = [
  ...AMBIENTES_TABLE_COLS.slice(0, 6),
  { type: "shrink" },
  ...AMBIENTES_TABLE_COLS.slice(6),
];

/** Sin columna sucursal (filtro por sede activo) */
export const AMBIENTES_TABLE_COLS_SIN_SUCURSAL: PanelTableColSpec[] = [
  { type: "grow" },
  { type: "shrink" },
  { type: "grow" },
  { type: "grow" },
  { type: "shrink" },
  { type: "shrink" },
  { type: "shrink" },
];

/** Sin sucursal, con columna visita */
export const AMBIENTES_TABLE_COLS_SIN_SUCURSAL_VISITA: PanelTableColSpec[] = [
  ...AMBIENTES_TABLE_COLS_SIN_SUCURSAL.slice(0, 5),
  { type: "shrink" },
  ...AMBIENTES_TABLE_COLS_SIN_SUCURSAL.slice(5),
];

/** Anchos % — sucursales: nombre, dirección, # ambientes, tipo, acciones */
export const SUCURSALES_TABLE_COL_WIDTHS_PCT = [24, 26, 10, 14, 26] as const;

/** #, sucursal, apertura, cierre, ambientes, estado, detalle */
export const VISITAS_HISTORIAL_TABLE_WIDTHS_PCT = [5, 18, 22, 22, 9, 11, 13] as const;

/** Sucursales: nombre, dirección, ambientes, tipo, acciones */
export const SUCURSALES_TABLE_COLS: PanelTableColSpec[] = [
  { type: "grow" },
  { type: "grow" },
  { type: "shrink" },
  { type: "shrink" },
  { type: "shrink" },
];

export function panelTableColWidths(widths: readonly number[]): string[] {
  return widths.map((w) => `${w}%`);
}

export function PanelTableColgroup({
  widths,
  cols,
}: {
  widths?: readonly number[];
  cols?: PanelTableColSpec[];
}) {
  if (cols) {
    return (
      <colgroup>
        {cols.map((col, i) => (
          <col key={i} style={col.type === "shrink" ? { width: "1%" } : undefined} />
        ))}
      </colgroup>
    );
  }

  const pctCols = panelTableColWidths(widths ?? []);
  return (
    <colgroup>
      {pctCols.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

export function PanelTableTh({
  children,
  className,
  align,
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  const nowrap = className?.includes("whitespace-nowrap");

  return (
    <th
      className={cn(
        "overflow-hidden px-2 py-2.5 text-xs font-semibold uppercase tracking-wide sm:px-3",
        nowrap ? "w-0 whitespace-nowrap" : "max-w-0",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      <span className={cn("block", !nowrap && "truncate")}>{children}</span>
    </th>
  );
}

export function PanelTableTd({
  children,
  className,
  align,
  title,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  title?: string;
  colSpan?: number;
}) {
  const nowrap = className?.includes("whitespace-nowrap");

  return (
    <td
      colSpan={colSpan}
      className={cn(
        "overflow-hidden px-2 py-2.5 align-middle text-sm sm:px-3",
        nowrap ? "w-0 whitespace-nowrap" : colSpan ? undefined : "max-w-0",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      title={title}
    >
      {typeof children === "string" || typeof children === "number" ? (
        <span className={cn("block", !nowrap && !colSpan && "truncate")}>{children}</span>
      ) : (
        children
      )}
    </td>
  );
}
