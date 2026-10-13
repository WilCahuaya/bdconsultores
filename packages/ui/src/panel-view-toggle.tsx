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
      className="inline-flex rounded-md border border-border/70 bg-muted/30 p-0.5"
      role="group"
      aria-label="Modo de vista"
    >
      <Button
        type="button"
        variant={value === "cards" ? "default" : "ghost"}
        size="sm"
        className="h-8 px-2.5 text-xs sm:text-sm"
        onClick={() => onChange("cards")}
        aria-pressed={value === "cards"}
      >
        Tarjetas
      </Button>
      <Button
        type="button"
        variant={value === "list" ? "default" : "ghost"}
        size="sm"
        className="h-8 px-2.5 text-xs sm:text-sm"
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        {listLabel}
      </Button>
    </div>
  );
}
