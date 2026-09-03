"use client";

import { useState } from "react";
import type { Activo } from "@inventario/types";
import { Button } from "@inventario/ui";
import {
  exportInventarioExcel,
  exportInventarioPdf,
  type InventarioExportMeta,
} from "@/lib/inventario-export";

interface InventarioExportButtonsProps {
  activos: Activo[];
  meta: InventarioExportMeta;
  /** Administradores exportan sin columnas monetarias */
  sinValores?: boolean;
  size?: "sm" | "default";
}

export function InventarioExportButtons({
  activos,
  meta,
  sinValores = false,
  size = "sm",
}: InventarioExportButtonsProps) {
  const [pending, setPending] = useState<"excel" | "pdf" | null>(null);

  async function handleExport(kind: "excel" | "pdf") {
    if (activos.length === 0) {
      window.alert("No hay activos para exportar.");
      return;
    }
    setPending(kind);
    try {
      const valorizado = !sinValores;
      if (kind === "excel") {
        await exportInventarioExcel(activos, meta, valorizado);
      } else {
        await exportInventarioPdf(activos, meta, valorizado);
      }
    } catch (err) {
      console.error(err);
      window.alert("No se pudo generar el archivo. Intente de nuevo.");
    } finally {
      setPending(null);
    }
  }

  const compact = size === "sm";

  return (
    <div className="flex flex-nowrap gap-2">
      <Button
        type="button"
        variant="outline"
        size={size}
        className={compact ? "h-8 shrink-0 px-2 text-xs" : undefined}
        disabled={pending !== null || activos.length === 0}
        onClick={() => void handleExport("excel")}
      >
        {pending === "excel" ? "Exportando…" : "Exportar Excel"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={compact ? "h-8 shrink-0 px-2 text-xs" : undefined}
        disabled={pending !== null || activos.length === 0}
        onClick={() => void handleExport("pdf")}
      >
        {pending === "pdf" ? "Exportando…" : "Exportar PDF"}
      </Button>
    </div>
  );
}
