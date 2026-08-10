"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { InventarioColumnFilterOption } from "@inventario/types";
import { computeFloatingMenuLayout, type FloatingMenuLayout } from "./dropdown-position";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function FilterChevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export interface ColumnHeaderFilterProps {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  options: InventarioColumnFilterOption[];
  onChange: (value: string) => void;
  emptyLabel?: string;
  /** @deprecated Sin efecto: los títulos usan una sola tipografía. */
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  accent?: boolean;
}

export function ColumnHeaderFilter({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  emptyLabel = "Todos",
  className,
  style,
  title,
  accent = false,
}: ColumnHeaderFilterProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState<FloatingMenuLayout | null>(null);
  const active = Boolean(value);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuLayout(null);
      return;
    }

    function updatePosition() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = listRef.current?.getBoundingClientRect().height ?? 0;
      setMenuLayout(
        computeFloatingMenuLayout(rect, menuHeight, {
          preferredMaxHeight: 240,
        }),
      );
    }

    updatePosition();
    const frameId = requestAnimationFrame(() => updatePosition());
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const items: InventarioColumnFilterOption[] = [
    { value: "", label: emptyLabel },
    ...options,
  ];

  return (
    <th
      className={cn(
        accent ? "inventario-th-accent" : "inventario-th-std",
        active && "inventario-th-filtered",
        className,
      )}
      style={style}
      title={title}
    >
      <div ref={containerRef} className="flex min-w-0 items-center gap-0.5">
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[11px] font-semibold leading-tight tracking-wide">
          {label}
        </span>
        <button
          ref={buttonRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            active && "text-primary",
            open && "bg-muted text-foreground",
          )}
          onClick={() => setOpen((prev) => !prev)}
        >
          <FilterChevron className="h-3.5 w-3.5" />
        </button>
      </div>
      {open &&
        menuLayout &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="z-[80] overflow-auto rounded-md border border-border bg-card py-1 text-card-foreground shadow-xl ring-1 ring-border/60"
            style={{
              position: "fixed",
              top: menuLayout.top,
              left: menuLayout.left,
              minWidth: Math.max(menuLayout.minWidth, 140),
              maxWidth: Math.min(menuLayout.maxWidth, 320),
              maxHeight: menuLayout.maxHeight,
            }}
          >
            {items.map((item) => {
              const selected = item.value === value;
              return (
                <li key={item.value || "__all"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex w-full px-2.5 py-1.5 text-left text-xs transition-colors",
                      selected
                        ? "bg-primary/15 font-medium text-primary"
                        : "text-foreground hover:bg-muted/70",
                    )}
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{item.label}</span>
                  </button>
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="px-2.5 py-1.5 text-xs text-muted-foreground">Sin valores en la lista</li>
            )}
          </ul>,
          document.body,
        )}
    </th>
  );
}
