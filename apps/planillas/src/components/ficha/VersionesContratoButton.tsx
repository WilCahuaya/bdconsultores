"use client";

import { useEffect, useId, useRef, useState } from "react";
import { claseTonoEstadoContrato, type TonoEstadoContrato } from "@/lib/flujo-ficha";

export type VersionContratoLista = {
  version: number;
  fechas: string;
  estado: string;
  pdf: boolean;
  solicitud: boolean;
  tono: TonoEstadoContrato;
  vigente: boolean;
};

export function MarcasDocumentoContrato({ pdf, solicitud }: { pdf: boolean; solicitud: boolean }) {
  if (!pdf && !solicitud) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {pdf ? (
        <span className="inline-flex rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-950">Contrato firmado</span>
      ) : null}
      {solicitud ? (
        <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">Solicitud</span>
      ) : null}
    </div>
  );
}

export function VersionesContratoButton({ versiones }: { versiones: VersionContratoLista[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
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

  if (versiones.length < 2) return null;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${versiones.length} versiones de contrato`}
        title="Versiones"
        className="inline-flex text-muted-foreground hover:text-foreground"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen((value) => !value);
        }}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M5 2.5h6.5V12H5z" />
          <path d="M3.5 4.5H4V13.5h7" />
        </svg>
      </button>
      {open ? (
        <div
          id={panelId}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-30 w-72 rounded-md border border-border bg-background p-2 shadow-md"
        >
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Versiones</p>
          <ul>
            {versiones.map((item) => (
              <li key={item.version} className="rounded-md px-2 py-1.5 text-sm">
                <p className="font-medium text-foreground">
                  Versión {item.version}
                  {item.vigente ? " · vigente" : ""}
                </p>
                <p className="text-muted-foreground">{item.fechas}</p>
                <p className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${claseTonoEstadoContrato(item.tono)}`}
                  >
                    {item.estado}
                  </span>
                </p>
                <div className="mt-1">
                  <MarcasDocumentoContrato pdf={item.pdf} solicitud={item.solicitud} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
