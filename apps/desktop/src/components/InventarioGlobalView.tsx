import type { Entidad } from "@inventario/types";
import { type ReactNode } from "react";
import type { ActivoConUbicacion } from "../lib/activos";
import type { AmbienteDestinoNavigation } from "./AgregarBienesSimilaresDialog";
import type { CatalogSyncState } from "../hooks/useCatalogSync";
import { ActivosCampoList } from "./ActivosCampoList";

interface InventarioGlobalViewProps {
  entidades: Entidad[];
  activos: ActivoConUbicacion[];
  activosLoading: boolean;
  catalog: CatalogSyncState;
  catalogSyncing: boolean;
  onSyncCatalog: () => void;
  online: boolean;
  syncMessage: string | null;
  onSyncNow: () => void;
  syncing: boolean;
  onPrintLabel: (activo: ActivoConUbicacion) => void;
  onPrintBatch?: (activos: ActivoConUbicacion[]) => void;
  onEditActivo?: (activo: ActivoConUbicacion) => void;
  onEditarSeleccion?: (activos: ActivoConUbicacion[]) => void;
  onIrAmbiente?: (activo: ActivoConUbicacion) => void;
  onAbrirAmbienteDestino?: (destino: AmbienteDestinoNavigation) => void;
  onActivoUpdated: (activo: ActivoConUbicacion) => void;
  onActivoDeleted?: () => void;
}

function CatalogSyncButton({
  catalog,
  catalogSyncing,
  online,
  onSyncCatalog,
}: {
  catalog: CatalogSyncState;
  catalogSyncing: boolean;
  online: boolean;
  onSyncCatalog: () => void;
}) {
  const title = catalog.error
    ? catalog.error
    : catalog.syncedAt
      ? `Última sync: ${new Date(catalog.syncedAt).toLocaleString("es-PE")}`
      : "Sincronizar catálogo nacional";

  return (
    <button
      type="button"
      title={title}
      disabled={!online || catalogSyncing}
      onClick={onSyncCatalog}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-card px-2 text-xs transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-muted-foreground">Catálogo</span>
      <span className="font-semibold text-primary">
        {catalogSyncing ? "…" : catalog.count.toLocaleString("es-PE")}
      </span>
    </button>
  );
}

export function InventarioGlobalView({
  entidades,
  activos,
  activosLoading,
  catalog,
  catalogSyncing,
  onSyncCatalog,
  online,
  syncMessage,
  onSyncNow,
  syncing,
  onPrintLabel,
  onPrintBatch,
  onEditActivo,
  onEditarSeleccion,
  onIrAmbiente,
  onAbrirAmbienteDestino,
  onActivoUpdated,
  onActivoDeleted,
}: InventarioGlobalViewProps) {
  const toolbarExtra: ReactNode = (
    <>
      <CatalogSyncButton
        catalog={catalog}
        catalogSyncing={catalogSyncing}
        online={online}
        onSyncCatalog={onSyncCatalog}
      />
      {online && (
        <button
          type="button"
          disabled={syncing}
          onClick={onSyncNow}
          className="inline-flex h-8 items-center rounded-md border border-border/60 bg-card px-2.5 text-xs font-medium transition-colors hover:border-primary/40 disabled:opacity-60"
        >
          {syncing ? "Sync…" : "Sincronizar"}
        </button>
      )}
    </>
  );

  const statusBanner =
    !online || syncMessage ? (
      <div className="shrink-0 space-y-1">
        {!online && (
          <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-200">
            Sin conexión: se muestra la caché local agregada de todas las entidades.
          </p>
        )}
        {syncMessage && (
          <p className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs text-primary">
            {syncMessage}
          </p>
        )}
      </div>
    ) : null;

  return (
    <ActivosCampoList
      variant="global"
      compactLayout
      entidades={entidades}
      entidadId=""
      activos={activos}
      loading={activosLoading}
      online={online}
      toolbarExtra={toolbarExtra}
      statusBanner={statusBanner}
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
