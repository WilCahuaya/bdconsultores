import {
  CatalogoPage,
} from "@inventario/ui";
import { useOnline } from "../hooks/useOnline";
import {
  createCatalogoNacional,
  createCatalogoNacionalExtension,
  deleteCatalogoOpcionPersonalizada,
  deleteCatalogoPropio,
  getNextCodigoCatalogoPropio,
  listCatalogoClases,
  listCatalogoGrupos,
  listCatalogoPropio,
  registerCatalogoOpcionPersonalizada,
  searchCatalogoNacionalOficial,
  suggestCatalogoClase,
  suggestCatalogoGrupo,
  updateCatalogoPropio,
  updateCatalogoNacionalContabilidad,
  searchCuentasContables,
  listCuentasContables,
  upsertCuentaContable,
  deleteCuentaContable,
} from "../lib/catalogo";

interface CatalogoViewProps {
  initialDenominacion?: string;
}

export function CatalogoView({ initialDenominacion = "" }: CatalogoViewProps) {
  const online = useOnline();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Catálogo</h2>
        <p className="text-sm text-muted-foreground">
          Administree bienes de cuenta de orden (catálogo propio) y consulte el catálogo nacional
          oficial.
        </p>
      </div>

      {!online && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-foreground">
          Sin conexión. Puede consultar el catálogo nacional sincronizado y editar ítems propios;
          los cambios se sincronizarán al reconectar.
        </p>
      )}

      <CatalogoPage
        initialDenominacion={initialDenominacion}
        successSuffix="Quedó disponible offline en este equipo."
        offlineHint={
          online
            ? undefined
            : "Mostrando resultados del catálogo nacional sincronizado en este equipo."
        }
        readOnlyPropio={false}
        readOnlyNacionalCreate={false}
        loadNextCodigo={getNextCodigoCatalogoPropio}
        loadGrupos={listCatalogoGrupos}
        loadClases={listCatalogoClases}
        suggestGrupo={suggestCatalogoGrupo}
        suggestClase={suggestCatalogoClase}
        onRegisterOpcionPersonalizada={registerCatalogoOpcionPersonalizada}
        onDeleteOpcionPersonalizada={deleteCatalogoOpcionPersonalizada}
        onCreate={createCatalogoNacional}
        onCreateNacional={createCatalogoNacionalExtension}
        listPropio={listCatalogoPropio}
        onUpdatePropio={updateCatalogoPropio}
        onDeletePropio={deleteCatalogoPropio}
        searchNacional={searchCatalogoNacionalOficial}
        searchCuentasContables={searchCuentasContables}
        listCuentasContables={listCuentasContables}
        onUpsertCuentaContable={upsertCuentaContable}
        onDeleteCuentaContable={deleteCuentaContable}
        readOnlyCuentasContables={false}
        onUpdateNacionalContabilidad={updateCatalogoNacionalContabilidad}
        readOnlyNacionalContabilidad={false}
      />
    </div>
  );
}
