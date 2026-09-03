"use client";

import type { Activo } from "@inventario/types";
import { inventarioTdComprobanteClass } from "@inventario/ui/panel";
import { ComprobanteInline } from "./ComprobanteInline";

interface ComprobanteCellProps {
  activo: Activo;
  className?: string;
}

export function ComprobanteCell({ activo, className }: ComprobanteCellProps) {
  const serie = activo.comprobante_serie?.trim();
  const tienePdf = Boolean(activo.comprobante_path);
  const tdClass = `${inventarioTdComprobanteClass} ${className ?? ""}`.trim();

  if (!serie && !tienePdf) {
    return (
      <td className={`${tdClass} text-muted-foreground`}>
        SIN CP
      </td>
    );
  }

  return (
    <td className={tdClass} title={serie ?? "Comprobante PDF"}>
      <ComprobanteInline activo={activo} className="text-xs leading-snug" />
    </td>
  );
}
