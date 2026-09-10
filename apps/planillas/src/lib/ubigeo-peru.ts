import data from "./ubigeo-peru.json";

type UbigeoTree = Record<string, Record<string, string[]>>;

const UBIGEO = data as UbigeoTree;

export function normalizarUbigeo(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function regionesPeru(): string[] {
  return Object.keys(UBIGEO);
}

export function provinciasPeru(region: string): string[] {
  const canon = canonizarUbigeo(regionesPeru(), region);
  return canon ? Object.keys(UBIGEO[canon] ?? {}) : [];
}

export function distritosPeru(region: string, provincia: string): string[] {
  const regionCanon = canonizarUbigeo(regionesPeru(), region);
  if (!regionCanon) return [];
  const provinciaCanon = canonizarUbigeo(Object.keys(UBIGEO[regionCanon] ?? {}), provincia);
  return provinciaCanon ? [...(UBIGEO[regionCanon]?.[provinciaCanon] ?? [])] : [];
}

export function canonizarUbigeo(opciones: string[], valor: string | null | undefined): string {
  const raw = valor?.trim() ?? "";
  if (!raw) return "";
  const exacto = opciones.find((item) => item === raw);
  if (exacto) return exacto;
  const n = normalizarUbigeo(raw);
  return opciones.find((item) => normalizarUbigeo(item) === n) ?? raw;
}

export function filtrarUbigeo(opciones: string[], query: string): string[] {
  const q = normalizarUbigeo(query);
  if (!q) return opciones;
  const empieza = opciones.filter((item) => normalizarUbigeo(item).startsWith(q));
  if (empieza.length) return empieza;
  return opciones.filter((item) => {
    const n = normalizarUbigeo(item);
    const iniciales = item
      .split(/\s+/)
      .map((word) => normalizarUbigeo(word).charAt(0))
      .join("");
    return n.includes(q) || iniciales.startsWith(q);
  });
}

export function autoSeleccionarUbigeo(opciones: string[], query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  const exacto = canonizarUbigeo(opciones, q);
  if (opciones.includes(exacto)) return exacto;
  const filtradas = filtrarUbigeo(opciones, q);
  return filtradas.length === 1 ? filtradas[0] : null;
}
