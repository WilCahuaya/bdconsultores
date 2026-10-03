"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Cabecera de la ficha de contrato: queda fija al hacer scroll en el panel. */
export function FichaCabeceraFija({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const root = el?.parentElement;
    if (!el || !root) return;

    const apply = () => {
      root.style.setProperty("--ficha-cabecera-offset", `${el.offsetHeight + 16}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--ficha-cabecera-offset");
    };
  }, []);

  return (
    <div ref={ref} className="sticky top-0 z-30 -mb-6 pb-6">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-3 bottom-0 -z-10 bg-background">
        <div className="absolute inset-0 bg-muted/30" />
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
