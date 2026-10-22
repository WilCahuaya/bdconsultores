import type { CatalogoNacional, CatalogoOrigen } from "@inventario/types";
import { CATALOGO_SEARCH_MAX_RESULTS, minCatalogoQueryLength } from "@inventario/types";
import { listCatalogoBusqueda, type CatalogoBusquedaItem } from "@/lib/actions/catalogo";

type CatalogoIndexado = {
  codigo: string;
  codigoUp: string;
  denominacion: string;
  denominacionLower: string;
  origen: CatalogoOrigen;
};

let cache: CatalogoIndexado[] | null = null;
let inflight: Promise<CatalogoIndexado[]> | null = null;

function origenDeCodigo(codigo: string): CatalogoOrigen {
  return codigo.toUpperCase().startsWith("BD") ? "PROPIO" : "NACIONAL";
}

function indexar(items: CatalogoBusquedaItem[]): CatalogoIndexado[] {
  return items.map((item) => ({
    codigo: item.codigo,
    codigoUp: item.codigo.toUpperCase(),
    denominacion: item.denominacion,
    denominacionLower: item.denominacion.toLowerCase(),
    origen: origenDeCodigo(item.codigo),
  }));
}

function aCatalogo(item: CatalogoIndexado): CatalogoNacional {
  return {
    codigo: item.codigo,
    denominacion: item.denominacion,
    grupo: null,
    clase: null,
    cuenta_codigo: null,
    contabilidad: null,
    depreciacion: null,
    resolucion: null,
    estado: null,
    origen: item.origen,
  };
}

export function filtrarCatalogoLocal(
  items: CatalogoIndexado[],
  query: string,
  limit = CATALOGO_SEARCH_MAX_RESULTS,
): CatalogoNacional[] {
  const raw = query.trim();
  if (raw.length < minCatalogoQueryLength(raw)) return [];

  const up = raw.toUpperCase();
  const lower = raw.toLowerCase();
  const origen: CatalogoOrigen | null = up.startsWith("BD")
    ? "PROPIO"
    : /^\d+$/.test(raw)
      ? "NACIONAL"
      : null;

  const hits: Array<{
    item: CatalogoIndexado;
    rankExact: number;
    rankPrefix: number;
    denomLen: number;
  }> = [];

  for (const item of items) {
    if (origen && item.origen !== origen) continue;
    const prefix = item.codigoUp.startsWith(up);
    const inName = item.denominacionLower.includes(lower);
    if (!prefix && !inName) continue;
    hits.push({
      item,
      rankExact: item.codigoUp === up ? 0 : 1,
      rankPrefix: prefix ? 0 : 1,
      denomLen: item.denominacion.length,
    });
  }

  hits.sort((a, b) => {
    if (a.rankExact !== b.rankExact) return a.rankExact - b.rankExact;
    if (a.rankPrefix !== b.rankPrefix) return a.rankPrefix - b.rankPrefix;
    if (a.denomLen !== b.denomLen) return a.denomLen - b.denomLen;
    return a.item.denominacion.localeCompare(b.item.denominacion, "es");
  });

  return hits.slice(0, limit).map((hit) => aCatalogo(hit.item));
}

export async function ensureCatalogoBusqueda(force = false): Promise<CatalogoIndexado[]> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;

  const run = listCatalogoBusqueda().then((result) => {
    if (result.error) throw new Error(result.error);
    cache = indexar(result.data);
    return cache;
  });

  inflight = run;
  try {
    return await run;
  } finally {
    if (inflight === run) inflight = null;
  }
}

export function buscarCatalogoLocal(
  query: string,
  limit = CATALOGO_SEARCH_MAX_RESULTS,
): CatalogoNacional[] {
  if (!cache) return [];
  return filtrarCatalogoLocal(cache, query, limit);
}
