"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { computeFloatingMenuLayout, type FloatingMenuLayout } from "./dropdown-position";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type SelectOptionKind =
  | "placeholder"
  | "section-header"
  | "predeterminado"
  | "personalizado"
  | "extra"
  | "action";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  kind?: SelectOptionKind;
};

const selectMenuClass = cn(
  "max-h-60 overflow-auto rounded-md border border-border bg-card py-1 text-card-foreground",
  "shadow-xl ring-1 ring-border/60",
);

function SelectChevron({ className }: { className?: string }) {
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

export const nativeSelectClass = cn(
  "relative flex h-10 w-full items-center rounded-md border border-input bg-background py-2 pl-3 pr-10 text-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export const nativeSelectCompactClass = cn(
  "relative flex h-8 min-w-[6.5rem] max-w-[10rem] items-center truncate rounded-md border border-input bg-background py-1 pl-2 pr-9 text-xs",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function Select({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  options,
  disabled,
  required,
  className,
  size = "default",
  "aria-label": ariaLabel,
  deletableValues = [],
  onDeleteValue,
  deletingValue = null,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
  size?: "default" | "compact";
  "aria-label"?: string;
  deletableValues?: string[];
  onDeleteValue?: (value: string) => void;
  deletingValue?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [menuRect, setMenuRect] = useState<FloatingMenuLayout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  function setCurrentValue(next: string) {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
    setOpen(false);
  }

  const selectedOption = options.find(
    (option) => option.value === currentValue && option.kind !== "section-header",
  );
  const displayLabel = selectedOption?.label ?? "Seleccionar…";

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuRect(null);
      return;
    }

    function updatePosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = listRef.current?.getBoundingClientRect().height ?? 0;
      setMenuRect(computeFloatingMenuLayout(rect, menuHeight));
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
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const triggerClass = cn(
    size === "compact" ? nativeSelectCompactClass : nativeSelectClass,
    open && "ring-2 ring-ring",
    className,
  );

  const chevronClass = cn(
    "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform",
    size === "compact" ? "right-3" : "right-3.5",
    open && "rotate-180",
  );

  const deletableSet = useMemo(() => new Set(deletableValues), [deletableValues]);

  const menu =
    open && menuRect ? (
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        data-select-menu=""
        className={selectMenuClass}
        style={{
          position: "fixed",
          top: menuRect.top,
          left: menuRect.left,
          minWidth: menuRect.minWidth,
          maxWidth: menuRect.maxWidth,
          maxHeight: menuRect.maxHeight,
          width: "max-content",
          zIndex: 400,
        }}
      >
        {options.map((option, index) => {
          const kind = option.kind ?? (option.value === "" ? "placeholder" : "predeterminado");
          const optionKey = option.value || `__opt_${index}`;

          if (kind === "section-header") {
            return (
              <li key={optionKey} role="presentation" className="sticky top-0 z-[1] bg-card">
                <div
                  className={cn(
                    "border-t border-border/50 px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-primary first:border-t-0 first:pt-1.5",
                    size === "compact" && "px-2",
                    index === 0 && "border-t-0",
                  )}
                >
                  {option.label}
                </div>
              </li>
            );
          }

          const isSelected = option.value === currentValue;
          const isPersonalizado = kind === "personalizado";
          const isDeletable =
            isPersonalizado &&
            Boolean(option.value) &&
            deletableSet.has(option.value) &&
            Boolean(onDeleteValue);
          const isDeleting = deletingValue === option.value;
          const isAction = kind === "action";

          return (
            <li key={optionKey} role="presentation">
              <div
                className={cn(
                  "flex items-stretch",
                  isSelected
                    ? "bg-primary/20"
                    : isPersonalizado
                      ? "bg-muted/35 hover:bg-muted/50"
                      : isAction
                        ? "border-t border-border/50 bg-card hover:bg-accent"
                        : "bg-card hover:bg-accent",
                )}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  className={cn(
                    "min-w-0 flex-1 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    size === "compact" && "px-2 py-1.5 text-xs",
                    isSelected
                      ? "font-medium text-primary"
                      : isPersonalizado
                        ? "text-foreground"
                        : isAction
                          ? "font-medium text-primary"
                          : "text-foreground hover:text-accent-foreground",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => !option.disabled && setCurrentValue(option.value)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="whitespace-nowrap">{option.label}</span>
                    {isPersonalizado && !isSelected && (
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-primary">
                        Propio
                      </span>
                    )}
                  </span>
                </button>
                {isDeletable && (
                  <button
                    type="button"
                    title={`Eliminar ${option.label}`}
                    aria-label={`Eliminar ${option.label}`}
                    disabled={disabled || isDeleting}
                    className={cn(
                      "shrink-0 border-l border-border/60 px-2.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50",
                      size === "compact" && "px-2",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteValue?.(option.value);
                    }}
                  >
                    {isDeleting ? "…" : "×"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div
      ref={wrapperRef}
      className={cn("relative min-w-0", open && "z-[1]", size === "compact" && "w-auto")}
    >
      {name && (
        <input
          type="hidden"
          name={name}
          value={currentValue}
          required={required && currentValue === ""}
          tabIndex={-1}
          aria-hidden
        />
      )}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={triggerClass}
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        <span className="min-w-0 flex-1 truncate text-left">{displayLabel}</span>
        <SelectChevron className={chevronClass} />
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
