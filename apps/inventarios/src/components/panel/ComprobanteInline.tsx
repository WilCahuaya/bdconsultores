"use client";

import { useState } from "react";
import type { Activo } from "@inventario/types";
import { PdfPreviewDialog } from "./ActivoMediaDialogs";

interface ComprobanteInlineProps {
  activo: Activo;
  className?: string;
}

export function ComprobanteInline({ activo, className = "text-xs leading-snug" }: ComprobanteInlineProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const serie = activo.comprobante_serie?.trim();
  const tienePdf = Boolean(activo.comprobante_path);

  if (!serie && !tienePdf) {
    return <span className={`text-muted-foreground ${className}`}>SIN CP</span>;
  }

  const label = serie ?? "Ver PDF";

  if (tienePdf && activo.comprobante_path) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className={`block w-full break-words text-left font-medium text-primary underline-offset-2 hover:underline ${className}`}
        >
          {label}
        </button>
        <PdfPreviewDialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          path={activo.comprobante_path}
          titulo={serie ?? "Comprobante de adquisición"}
        />
      </>
    );
  }

  return (
    <span className={`block w-full break-words font-medium text-foreground ${className}`}>
      {label}
    </span>
  );
}
