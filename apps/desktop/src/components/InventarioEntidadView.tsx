import type { Entidad } from "@inventario/types";
import { EliminarActivosPorCodigosButton } from "@inventario/ui";
import type { ActivoConUbicacion } from "../lib/activos";
import type { AmbienteDestinoNavigation } from "./AgregarBienesSimilaresDialog";
import { ActivosCampoList } from "./ActivosCampoList";

interface InventarioEntidadViewProps {
  entidad: Entidad;
  entidades: Entidad[];
  activos: ActivoConUbicacion[];
  activosLoading: boolean;
  online: boolean;
  onPrintLabel: (activo: ActivoConUbicacion) => void;
  onPrintBatch?: (activos: ActivoConUbicacion[]) => void;
  onEditActivo?: (activo: ActivoConUbicacion) => void;
  onEditarSeleccion?: (activos: ActivoConUbicacion[]) => void;
  onIrAmbiente?: (activo: ActivoConUbicacion) => void;
  onAbrirAmbienteDestino?: (destino: AmbienteDestinoNavigation) => void;
  onActivoUpdated: (activo: ActivoConUbicacion) => void;
  onActivoDeleted?: () => void;
  onOpenEliminarPorCodigos?: () => void;
}

export function InventarioEntidadView({
  entidad,
  entidades,
  activos,
  activosLoading,
  online,
  onPrintLabel,
  onPrintBatch,
  onEditActivo,
  onEditarSeleccion,
  onIrAmbiente,
  onAbrirAmbienteDestino,
  onActivoUpdated,
  onActivoDeleted,
  onOpenEliminarPorCodigos,
}: InventarioEntidadViewProps) {
  const statusBanner =
    !online ? (
      <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-200">
        Sin conexión: se muestra la caché local de activos de esta entidad.
      </p>
    ) : null;

  return (
    <ActivosCampoList
      variant="entity-inventario"
      entidades={entidades}
      entidadId={entidad.id}
      activos={activos}
      loading={activosLoading}
      online={online}
      statusBanner={statusBanner}
      toolbarExtra={
        onOpenEliminarPorCodigos ? (
          <EliminarActivosPorCodigosButton
            onClick={onOpenEliminarPorCodigos}
          />
        ) : undefined
      }
      onPrintLabel={onPrintLabel}
      onPrintBatch={onPrintBatch}
      onEditActivo={onEditActivo}
      onEditarSeleccion={onEditarSeleccion}
      onIrAmbiente={onIrAmbiente}
      onAbrirAmbienteDestino={onAbrirAmbienteDestino}
      onActivoUpdated={onActivoUpdated}
      onActivoDeleted={onActivoDeleted}
    />
  );
}
