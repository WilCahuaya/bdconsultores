"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn, Tooltip } from "./components";

export interface TableActionItem {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}

function IconKebab({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

const iconBtnClass =
  "inline-flex shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

export function TableActionsOverflow({
  items,
  iconClassName = "h-7 w-7",
  variant = "auto",
}: {
  items: TableActionItem[];
  iconClassName?: string;
  /** "menu" = siempre menú ⋮. "auto" = iconos si caben. "icons-and-menu" = iconos + ⋮. "icons" = solo iconos. */
  variant?: "auto" | "menu" | "icons-and-menu" | "icons";
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [useMenu, setUseMenu] = useState(variant === "menu");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const btnClass = cn(iconBtnClass, iconClassName);
  const forceMenu = variant === "menu";
  const iconsAndMenu = variant === "icons-and-menu";
  const iconsOnly = variant === "icons";

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (forceMenu || iconsAndMenu || iconsOnly) {
      setUseMenu(forceMenu);
      return;
    }

    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const check = () => {
      setUseMenu(measure.scrollWidth > container.clientWidth + 1);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [items, forceMenu, iconsAndMenu, iconsOnly]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = menu?.offsetWidth ?? 176;
    const menuHeight = menu?.offsetHeight ?? 0;
    const gap = 4;
    const margin = 8;

    let left = rect.right - menuWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - margin && rect.top - menuHeight - gap > margin) {
      top = rect.top - menuHeight - gap;
    }

    setMenuPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();
    const id = requestAnimationFrame(() => updateMenuPosition());
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuOpen, updateMenuPosition, items]);

  useEffect(() => {
    if (!menuOpen) return;

    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (useMenu) setMenuOpen(false);
  }, [useMenu]);

  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function ActionButton({ item }: { item: TableActionItem }) {
    return (
      <Tooltip label={item.label}>
        <button
          type="button"
          aria-label={item.label}
          className={cn(
            btnClass,
            item.tone === "danger" &&
              "!border-destructive/30 !text-destructive hover:!bg-destructive/10 hover:!text-destructive",
          )}
          disabled={item.disabled}
          onClick={item.onClick}
        >
          {item.icon}
        </button>
      </Tooltip>
    );
  }

  const menuPortal =
    menuOpen && mounted
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[350] min-w-[11rem] rounded-md border border-border bg-card py-1 text-card-foreground shadow-lg ring-1 ring-border/50"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
                  item.tone === "danger" && "text-destructive",
                )}
                onClick={() => {
                  setMenuOpen(false);
                  item.onClick();
                }}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center opacity-80">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  if (iconsOnly) {
    return (
      <div ref={containerRef} className="flex shrink-0 flex-nowrap items-center justify-center gap-0.5">
        {items.map((item) => (
          <ActionButton key={item.id} item={item} />
        ))}
      </div>
    );
  }

  if (useMenu && !iconsAndMenu) {
    return (
      <>
        <div ref={containerRef} className="flex justify-center">
          <button
            ref={triggerRef}
            type="button"
            className={btnClass}
            aria-label="Más acciones"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <IconKebab className="h-4 w-4" />
          </button>
        </div>
        {menuPortal}
      </>
    );
  }

  if (iconsAndMenu) {
    return (
      <>
        <div ref={containerRef} className="flex shrink-0 flex-nowrap items-center justify-center gap-0.5">
          {items.map((item) => (
            <ActionButton key={item.id} item={item} />
          ))}
          <button
            ref={triggerRef}
            type="button"
            className={btnClass}
            aria-label="Más acciones"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <IconKebab className="h-4 w-4" />
          </button>
        </div>
        {menuPortal}
      </>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute left-0 top-0 z-[-1] flex items-center gap-1 whitespace-nowrap"
        aria-hidden
      >
        {items.map((item) => (
          <span key={item.id} className={btnClass}>
            {item.icon}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1">
        {items.map((item) => (
          <ActionButton key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
