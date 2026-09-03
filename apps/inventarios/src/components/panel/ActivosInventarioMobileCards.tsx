"use client";

import type { Activo } from "@inventario/types";
import {
  formatActivoCodigoDisplay,
  formatFechaISOToCortoES,
  formatMonedaPE,
  categoriaBienLetra,
} from "@inventario/types";
import {
  EstadoBienBadge,
  fechaAdquisicionToneClass,
  formatInventarioListaTexto,
  inventarioCuentaContable,
  inventarioDepreciacionFila,
  inventarioDescripcion,
} from "@inventario/ui/panel";
import { ActivoAccionesBar } from "./ActivoAccionesBar";
import { ComprobanteInline } from "./ComprobanteInline";
import { panelCardClass } from "./panel-ui";

interface ActivosInventarioMobileCardsProps {
  activos: Activo[];
  onEditActivo: (activo: Activo) => void;
  onIrAmbiente?: (activo: Activo) => void;
  puedeDarDeBaja?: boolean;
  puedeValidarPreregistro?: boolean;
  puedeEliminarPreregistro?: boolean;
  editarLabel?: string;
  mostrarEstadoRegistro?: boolean;
  mostrarUbicacion?: boolean;
  ubicacionMultiplesSedes?: boolean;
  emptyActionLabel?: string;
  modoAdmin?: boolean;
  onActivoEliminado?: (activoId: string) => void;
  withPreregistroSelection?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  puedeSeleccionar?: (activo: Activo) => boolean;
  fechaCorte?: Date;
}

function InfoItem({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value?: string | null;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`truncate text-sm ${valueClassName ?? "text-foreground"}`}>{value?.trim() || "—"}</p>
    </div>
  );
}

function ValorCardItem({ activo }: { activo: Activo }) {
  const esMercado = activo.valor_es_mercado;
  const monto = activo.valor_adquisicion;
  if (monto == null) return <InfoItem label="Precio" />;
  const etiqueta = esMercado ? "VM" : "PA";
  return (
    <InfoItem label="Precio" value={`${etiqueta} S/ ${formatMonedaPE(monto)}`} />
  );
}

type ActivoConUbicacionCard = Activo & {
  sede_nombre?: string | null;
  ambiente_nombre?: string | null;
};

function ubicacionCardTexto(activo: ActivoConUbicacionCard, mostrarSede: boolean): string {
  const ambiente = activo.ambiente_nombre?.trim() || "—";
  const sede = activo.sede_nombre?.trim();
  if (mostrarSede && sede) return `${ambiente} · ${sede}`;
  return ambiente;
}

export function ActivosInventarioMobileCards({
  activos,
  onEditActivo,
  onIrAmbiente,
  puedeDarDeBaja = true,
  puedeValidarPreregistro = false,
  puedeEliminarPreregistro = false,
  editarLabel,
  mostrarEstadoRegistro = false,
  mostrarUbicacion = false,
  ubicacionMultiplesSedes = false,
  emptyActionLabel = "+ Nuevo activo",
  modoAdmin = false,
  onActivoEliminado,
  withPreregistroSelection = false,
  selectedIds,
  onToggleSelect,
  puedeSeleccionar,
  fechaCorte,
}: ActivosInventarioMobileCardsProps) {
  if (activos.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        No hay activos registrados. Use «{emptyActionLabel}» para agregar el primero.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 sm:p-4">
      {activos.map((activo, index) => {
        const activoUbicacion = activo as ActivoConUbicacionCard;
        const descripcion = inventarioDescripcion(activo);
        const inactivo = activo.estado_registro === "DADO_DE_BAJA";
        const { valorNeto } = inventarioDepreciacionFila(activo, inactivo, fechaCorte);
        const preregistrado = activo.estado_registro === "PREREGISTRADO";
        const seleccionable =
          withPreregistroSelection &&
          puedeSeleccionar?.(activo) &&
          selectedIds &&
          onToggleSelect;

        return (
          <article
            key={activo.id}
            className={`${panelCardClass} p-4 ${
              inactivo
                ? "border-red-500/40 bg-red-500/5"
                : preregistrado
                  ? "border-amber-500/40 bg-amber-500/5"
                  : ""
            }`}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              {seleccionable && (
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-input"
                  checked={selectedIds.has(activo.id)}
                  onChange={() => onToggleSelect(activo.id)}
                  aria-label={`Seleccionar ${activo.nombre}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  #{index + 1} · {categoriaBienLetra(activo.categoria)} ·{" "}
                  {inactivo
                    ? "Dado de baja"
                    : preregistrado
                      ? "Preregistrado"
                      : formatActivoCodigoDisplay(activo)}
                </p>
                <h3
                  className={`mt-1 text-base font-semibold leading-snug text-foreground ${
                    inactivo ? "line-through decoration-red-400/60" : ""
                  }`}
                >
                  {activo.nombre}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {formatActivoCodigoDisplay(activo)}
                </p>
                {!modoAdmin && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {inventarioCuentaContable(activo)}
                  </p>
                )}
              </div>
              <EstadoBienBadge estado={activo.estado_bien} />
            </div>

            {descripcion && (
              <p className="mb-3 text-xs leading-snug text-muted-foreground">{descripcion}</p>
            )}

            {mostrarUbicacion && (
              <p className="mb-3 text-xs text-foreground">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                  Ubicación:{" "}
                </span>
                {ubicacionMultiplesSedes ? (
                  <>
                    {activoUbicacion.ambiente_nombre?.trim() || "—"}
                    {activoUbicacion.sede_nombre?.trim() ? (
                      <span className="text-[10px] text-muted-foreground">
                        {" "}
                        · {activoUbicacion.sede_nombre.trim()}
                      </span>
                    ) : null}
                  </>
                ) : (
                  ubicacionCardTexto(activoUbicacion, false)
                )}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoItem
                label="Fecha adq."
                value={formatFechaISOToCortoES(activo.fecha_adquisicion)}
                valueClassName={
                  activo.fecha_adquisicion
                    ? fechaAdquisicionToneClass(activo.valor_es_mercado)
                    : undefined
                }
              />
              <ValorCardItem activo={activo} />
              <InfoItem
                label="Valor neto"
                value={valorNeto != null ? `S/ ${formatMonedaPE(valorNeto)}` : undefined}
              />
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                CP:
              </span>
              <ComprobanteInline activo={activo} />
            </div>

            {activo.observacion?.trim() && (
              <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Obs: </span>
                {formatInventarioListaTexto(activo.observacion)}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
              <p className="text-xs text-muted-foreground">Acciones</p>
              <ActivoAccionesBar
                activo={activo}
                onEdit={onEditActivo}
                onIrAmbiente={onIrAmbiente}
                puedeDarDeBaja={puedeDarDeBaja}
                puedeValidarPreregistro={puedeValidarPreregistro}
                puedeEliminarPreregistro={puedeEliminarPreregistro}
                editarLabel={editarLabel}
                modoAdmin={modoAdmin}
                onActivoEliminado={onActivoEliminado}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
