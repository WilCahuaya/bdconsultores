"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FechaDdMmYyyyInput } from "./fecha-dd-mm-yyyy-input";

export interface AmbienteFiltroOpcion {
  value: string;
  label: string;
}

interface GrupoFiltro {
  label: string;
  value: string;
  options: AmbienteFiltroOpcion[];
  onChange: (value: string) => void;
}

interface AmbienteBienesFiltrosMenuProps {
  /** Texto corto cuando hay algún filtro distinto del habitual. */
  resumen?: string | null;
  estado?: GrupoFiltro;
  categoria?: GrupoFiltro;
  orden?: GrupoFiltro;
  fecha?: {
    id: string;
    value: string;
    error?: string | null;
    onChange: (value: string) => void;
    onBlur: (value: string) => void;
  };
}

function GrupoOpciones({ grupo }: { grupo: GrupoFiltro }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {grupo.label}
      </legend>
      <div className="flex flex-wrap gap-1">
        {grupo.options.map((option) => {
          const activo = grupo.value === option.value;
          return (
            <button
              key={option.value || "all"}
              type="button"
              aria-pressed={activo}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                activo
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => grupo.onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AmbienteBienesFiltrosMenu({
  resumen,
  estado,
  categoria,
  orden,
  fecha,
}: AmbienteBienesFiltrosMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activo = Boolean(resumen);
  const label = resumen ? `Filtros · ${resumen}` : "Filtros";

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }

    function updatePosition() {
      const anchor = rootRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const gap = 4;
      const width = Math.min(288, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
      const height = menuRef.current?.offsetHeight ?? 220;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUp = spaceBelow < Math.min(height, 160) && rect.top > spaceBelow;
      const top = openUp ? Math.max(margin, rect.top - height - gap) : rect.bottom + gap;
      setMenuRect((prev) => {
        if (prev && prev.top === top && prev.left === left && prev.width === width) return prev;
        return { top, left, width };
      });
    }

    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, resumen]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex h-8 max-w-[16rem] items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${
          activo
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border bg-background text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setOpen((value) => !value)}
      >
        {activo ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
        <span className="truncate">{label}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open &&
        menuRect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Filtros del inventario"
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              zIndex: 80,
            }}
            className="space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg"
          >
            {estado ? <GrupoOpciones grupo={estado} /> : null}
            {categoria ? <GrupoOpciones grupo={categoria} /> : null}
            {orden ? <GrupoOpciones grupo={orden} /> : null}
            {fecha ? (
              <div className="space-y-1.5">
                <label
                  htmlFor={fecha.id}
                  className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Fecha de corte
                </label>
                <FechaDdMmYyyyInput
                  id={fecha.id}
                  value={fecha.value}
                  onChange={fecha.onChange}
                  onBlur={(event) => fecha.onBlur(event.currentTarget.value)}
                  aria-invalid={Boolean(fecha.error)}
                  aria-label="Fecha de corte"
                  className="h-8 text-sm"
                />
                {fecha.error ? <p className="text-[10px] leading-tight text-destructive">{fecha.error}</p> : null}
              </div>
            ) : null}
          </div>,
          document.body,
        )}
    </div>
  );
}
