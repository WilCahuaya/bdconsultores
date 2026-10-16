"use client";

export type ActivoEditScope = "single" | "bulk";

interface ActivoEditScopeNavProps {
  scope: ActivoEditScope;
  ejemplaresTotal: number;
  onScopeChange: (scope: ActivoEditScope) => void;
  disabled?: boolean;
  className?: string;
  singleHint?: string;
  bulkHint?: string;
}

export function ActivoEditScopeNav({
  scope,
  ejemplaresTotal,
  onScopeChange,
  disabled = false,
  className = "",
  singleHint = "Solo se modifica el activo seleccionado.",
  bulkHint = "Los cambios se aplican a todas las unidades del mismo lote de compra.",
}: ActivoEditScopeNavProps) {
  if (ejemplaresTotal < 2) return null;

  const tabClass = (active: boolean) =>
    `rounded px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    }`;

  return (
    <nav
      className={`flex flex-wrap items-center gap-2 ${className}`}
      aria-label="Alcance de la edición"
    >
      <div className="inline-flex flex-wrap gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5">
        <button
          type="button"
          disabled={disabled}
          className={tabClass(scope === "single")}
          aria-current={scope === "single" ? "page" : undefined}
          onClick={() => onScopeChange("single")}
        >
          Este activo
        </button>
        <button
          type="button"
          disabled={disabled}
          className={tabClass(scope === "bulk")}
          aria-current={scope === "bulk" ? "page" : undefined}
          onClick={() => onScopeChange("bulk")}
        >
          {ejemplaresTotal} ejemplares
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {scope === "bulk" ? bulkHint : singleHint}
      </p>
    </nav>
  );
}
