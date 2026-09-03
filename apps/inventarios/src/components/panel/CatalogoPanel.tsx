"use client";

import { CatalogoPage } from "@inventario/ui";
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
  suggestCatalogoGrupo,
  updateCatalogoPropio,
  updateCatalogoNacionalContabilidad,
  searchCuentasContables,
  listCuentasContables,
  upsertCuentaContable,
  deleteCuentaContable,
} from "@/lib/actions/catalogo";

interface CatalogoPanelProps {
  initialDenominacion?: string;
}

export function CatalogoPanel({ initialDenominacion = "" }: CatalogoPanelProps) {
  return (
    <CatalogoPage
      initialDenominacion={initialDenominacion}
      successSuffix="En desktop, sincronice el catálogo al reconectar."
      loadNextCodigo={getNextCodigoCatalogoPropio}
      loadGrupos={listCatalogoGrupos}
      loadClases={listCatalogoClases}
      suggestGrupo={suggestCatalogoGrupo}
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
      onUpdateNacionalContabilidad={updateCatalogoNacionalContabilidad}
    />
  );
}
