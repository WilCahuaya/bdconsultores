"use client";

import { useEffect, useState } from "react";
import { Button } from "./components";

export type PanelViewMode = "cards" | "list";

export function useStoredViewMode(
  storageKey: string,
  defaultMode: PanelViewMode = "list",
): [PanelViewMode, (mode: PanelViewMode) => void] {
  const [mode, setMode] = useState<PanelViewMode>(defaultMode);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "cards" || stored === "list") setMode(stored);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function setStored(next: PanelViewMode) {
    setMode(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  }

  return [mode, setStored];
}

function IconCards() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 lg:hidden" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 lg:hidden" aria-hidden="true">
      <rect x="1" y="2" width="14" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 6h14M1 10h14M6 2v12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function PanelViewToggle({
  value,
  onChange,
  listLabel = "Lista",
}: {
  value: PanelViewMode;
  onChange: (mode: PanelViewMode) => void;
  listLabel?: string;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-md border border-border/70 bg-muted/30 p-0.5"
      role="group"
      aria-label="Modo de vista"
    >
      <Button
        type="button"
        variant={value === "cards" ? "default" : "ghost"}
        size="sm"
        className="h-8 px-2 text-xs lg:px-2.5 lg:text-sm"
        onClick={() => onChange("cards")}
        aria-pressed={value === "cards"}
        aria-label="Tarjetas"
      >
        <IconCards />
        <span className="hidden lg:inline">Tarjetas</span>
      </Button>
      <Button
        type="button"
        variant={value === "list" ? "default" : "ghost"}
        size="sm"
        className="h-8 px-2 text-xs lg:px-2.5 lg:text-sm"
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
        aria-label={listLabel}
      >
        <IconTable />
        <span className="hidden lg:inline">{listLabel}</span>
      </Button>
    </div>
  );
}
