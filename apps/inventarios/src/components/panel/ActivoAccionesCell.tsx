"use client";

import type { Activo } from "@inventario/types";
import { ActivoAccionesBar } from "./ActivoAccionesBar";

interface ActivoAccionesCellProps {
  activo: Activo;
  onEdit: (activo: Activo) => void;
  puedeDarDeBaja?: boolean;
  puedeValidarPreregistro?: boolean;
  puedeEliminarPreregistro?: boolean;
  editarLabel?: string;
  modoAdmin?: boolean;
}

export function ActivoAccionesCell({
  activo,
  onEdit,
  puedeDarDeBaja,
  puedeValidarPreregistro,
  puedeEliminarPreregistro,
  editarLabel,
  modoAdmin,
}: ActivoAccionesCellProps) {
  return (
    <td className="max-w-0 overflow-visible border-b border-r border-border/40 px-1 py-1 last:border-r-0">
      <ActivoAccionesBar
        activo={activo}
        onEdit={onEdit}
        compact
        className="justify-center"
        puedeDarDeBaja={puedeDarDeBaja}
        puedeValidarPreregistro={puedeValidarPreregistro}
        puedeEliminarPreregistro={puedeEliminarPreregistro}
        editarLabel={editarLabel}
        modoAdmin={modoAdmin}
      />
    </td>
  );
}
