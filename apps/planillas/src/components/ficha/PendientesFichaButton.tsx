"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

export type PendienteFicha = {
  id: string;
  etiqueta: string;
  href: string;
};

export function PendientesFichaButton({ pendientes }: { pendientes: PendienteFicha[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (pendientes.length === 0) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${pendientes.length} pendientes`}
        title="Pendientes"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6M10 21h4" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.5 15.5a6 6 0 1 1 7 0c-.6.5-1 1.2-1 2h-5c0-.8-.4-1.5-1-2Z"
          />
        </svg>
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold leading-none text-white">
          {pendientes.length}
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-20 mt-2 w-72 rounded-md border border-border bg-background p-2 shadow-md"
        >
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Pendientes</p>
          <ul>
            {pendientes.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  {item.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
