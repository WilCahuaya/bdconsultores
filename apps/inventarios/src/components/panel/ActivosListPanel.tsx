"use client";

import { useMemo, useState } from "react";
import type { Activo } from "@inventario/types";
import { formatPosibleAmbienteLabel, matchesCodigoBarrasQuery } from "@inventario/types";
import { ActivoUpload } from "./ActivoUpload";
import { RegistrarActivoButton } from "./RegistrarActivoButton";
import {
  PanelCountLabel,
  PanelEmptyState,
  PanelSearchInput,
  StatusBadge,
  panelCardClass,
} from "./panel-ui";

export interface ActivoListItem extends Activo {
  entidad_nombre?: string;
  posible_ambiente_nombre?: string;
  posible_sede_nombre?: string;
}

interface ActivosListPanelProps {
  activos: ActivoListItem[];
  title?: string;
  emptyMessage?: string;
  showEntidad?: boolean;
  createButton?: React.ReactNode;
}

function estadoBadgeVariant(estado: string): "active" | "pending" | "default" {
  if (estado === "REGISTRADO") return "active";
  if (estado === "PREREGISTRADO") return "pending";
  return "default";
}

export function ActivosListPanel({
  activos,
  title = "Inventario de activos",
  emptyMessage = "No hay activos registrados.",
  showEntidad = false,
  createButton,
}: ActivosListPanelProps) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return activos;
    return activos.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        matchesCodigoBarrasQuery(busqueda, a.codigo_barras, a.codigo_catalogo) ||
        (a.entidad_nombre?.toLowerCase().includes(q) ?? false),
    );
  }, [activos, busqueda]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">{title}</h2>
          <PanelCountLabel
            count={filtrados.length}
            singular="activo"
            plural="activos"
          />
        </div>
        {createButton}
      </div>

      <PanelSearchInput
        value={busqueda}
        onChange={setBusqueda}
        placeholder="Buscar por código, nombre o entidad…"
      />

      {filtrados.length === 0 ? (
        <PanelEmptyState
          message={
            busqueda.trim() ? "No hay activos que coincidan con la búsqueda." : emptyMessage
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((activo) => (
            <article key={activo.id} className={`${panelCardClass} flex flex-col`}>
              <div className="flex items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-foreground">{activo.nombre}</h3>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {activo.codigo_barras ?? activo.codigo_catalogo}
                  </p>
                </div>
                <StatusBadge variant={estadoBadgeVariant(activo.estado_registro)}>
                  {activo.estado_registro}
                </StatusBadge>
              </div>

              <div className="flex flex-1 flex-col gap-2 px-4 py-3 text-sm">
                <p className="text-muted-foreground">
                  Catálogo: <span className="font-medium text-foreground">{activo.codigo_catalogo}</span>
                </p>
                {showEntidad && activo.entidad_nombre && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Entidad: {activo.entidad_nombre}
                  </p>
                )}
              </div>

              <div className="space-y-3 border-t border-border/50 bg-muted/20 px-4 py-3">
                <ActivoUpload
                  activoId={activo.id}
                  entidadId={activo.entidad_id}
                  fotoPath={activo.foto_path}
                  comprobantePath={activo.comprobante_path}
                />
                {activo.estado_registro === "PREREGISTRADO" && (
                  <RegistrarActivoButton
                    entidadId={activo.entidad_id}
                    activoId={activo.id}
                    nombre={activo.nombre}
                    codigoCatalogo={activo.codigo_catalogo}
                    posibleAmbienteId={activo.posible_ambiente_id}
                    posibleAmbienteNombre={(() => {
                      const label = formatPosibleAmbienteLabel(activo);
                      return label === "—" ? undefined : label;
                    })()}
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
