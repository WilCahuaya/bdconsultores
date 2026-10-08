"use client";

import { useCallback, useRef, type MouseEvent, type ReactNode } from "react";
import { panelCardClass } from "@inventario/ui/panel";

export function ApartadoDesplegable({
  titulo,
  resumen,
  pendiente = false,
  defaultOpen = false,
  variante = "panel",
  children,
}: {
  titulo: string;
  resumen: string;
  pendiente?: boolean;
  defaultOpen?: boolean;
  /** `interno`: sin tarjeta, para anidar (p. ej. datos a copiar). */
  variante?: "panel" | "interno";
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const abiertoAlInicio = useRef(defaultOpen);
  const inicioAplicado = useRef(false);
  const asignarDetails = useCallback((node: HTMLDetailsElement | null) => {
    detailsRef.current = node;
    if (!node || inicioAplicado.current) return;
    inicioAplicado.current = true;
    if (abiertoAlInicio.current) node.open = true;
  }, []);

  function alternar(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    const details = detailsRef.current;
    if (!details) return;
    const scroller = details.closest("main");
    const top = scroller?.scrollTop ?? 0;
    details.open = !details.open;
    if (!scroller) return;
    scroller.scrollTop = top;
    requestAnimationFrame(() => {
      scroller.scrollTop = top;
    });
  }

  const interno = variante === "interno";
  return (
    <details
      ref={asignarDetails}
      className={
        interno
          ? "group rounded-md border border-border/70 bg-muted/20 p-4"
          : `group ${panelCardClass} !overflow-visible p-5`
      }
    >
      <summary
        onClick={alternar}
        className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden [&::marker]:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{titulo}</p>
          <p
            className={`text-sm ${
              interno
                ? "text-muted-foreground"
                : pendiente
                  ? "text-amber-900"
                  : "text-emerald-800"
            }`}
          >
            {resumen}
          </p>
        </div>
      </summary>
      <div className="mt-4 space-y-4 border-t border-border/60 pt-4">{children}</div>
    </details>
  );
}
