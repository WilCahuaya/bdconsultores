"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "./components";
import { Select } from "./select";

export const TABLE_PAGE_SIZE = 25;

export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

const TABLE_PAGE_SIZE_STORAGE_KEY = "inventario-table-page-size";

function isTablePageSize(n: number): n is TablePageSize {
  return (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n);
}

function readStoredPageSize(): TablePageSize {
  if (typeof window === "undefined") return TABLE_PAGE_SIZE;
  try {
    const raw = localStorage.getItem(TABLE_PAGE_SIZE_STORAGE_KEY);
    if (!raw) return TABLE_PAGE_SIZE;
    const n = Number(raw);
    if (isTablePageSize(n)) return n;
  } catch {
    /* ignore */
  }
  return TABLE_PAGE_SIZE;
}

export function useTablePagination<T>(
  items: T[],
  resetKey?: string | number,
  options?: { initialPageSize?: TablePageSize; persistPageSize?: boolean },
) {
  const persistPageSize = options?.persistPageSize !== false;
  // Misma página inicial en SSR y cliente; localStorage se aplica tras montar (evita hydration mismatch).
  const [pageSize, setPageSizeState] = useState<TablePageSize>(
    () => options?.initialPageSize ?? TABLE_PAGE_SIZE,
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!persistPageSize) return;
    const stored = readStoredPageSize();
    setPageSizeState((prev) => (prev === stored ? prev : stored));
  }, [persistPageSize]);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const setPageSize = useCallback(
    (size: TablePageSize) => {
      setPageSizeState(size);
      if (!persistPageSize) return;
      try {
        localStorage.setItem(TABLE_PAGE_SIZE_STORAGE_KEY, String(size));
      } catch {
        /* ignore */
      }
    },
    [persistPageSize],
  );

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const rangeStart = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, items.length);

  return {
    page: safePage,
    setPage,
    setPageSize,
    pageSize,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
    totalPages,
    paginated,
    total: items.length,
    rangeStart,
    rangeEnd,
    rowOffset: (safePage - 1) * pageSize,
  };
}

export function TablePagination({
  page,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  pageSize,
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  legend,
  unitLabel = "activos",
}: {
  page: number;
  totalPages: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: TablePageSize) => void;
  legend?: ReactNode;
  /** Texto de unidad en el rango (ej. activos, resultados, ítems). */
  unitLabel?: string;
}) {
  if (total === 0) return null;

  const showPageNav = total > pageSize;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-muted/30 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
        <p className="shrink-0 text-xs text-muted-foreground">
          {rangeStart}–{rangeEnd} de {total.toLocaleString("es-PE")} {unitLabel}
        </p>
        {onPageSizeChange && (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Mostrar</span>
            <Select
              aria-label={`${unitLabel} por página`}
              size="compact"
              value={String(pageSize)}
              onChange={(value) => {
                const n = Number(value);
                if (isTablePageSize(n)) onPageSizeChange(n);
              }}
              options={pageSizeOptions.map((n) => ({
                value: String(n),
                label: String(n),
              }))}
            />
          </div>
        )}
        {legend ? <div className="min-w-0 flex-1 basis-full sm:basis-auto">{legend}</div> : null}
      </div>
      {showPageNav && (
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <span className="min-w-[5.5rem] text-center text-xs text-muted-foreground">
            Pág. {page} / {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
