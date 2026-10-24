import { formatActivoCodigoDisplay } from "@inventario/types";

export type OrdenInventario = "codigo" | "creacion";

export const ORDEN_INVENTARIO_OPCIONES: { value: OrdenInventario; label: string }[] = [
  { value: "codigo", label: "Código" },
  { value: "creacion", label: "Fecha" },
];

type ActivoOrdenable = {
  codigo_barras?: string | null;
  codigo_catalogo: string;
  correlativo?: number | null;
  created_at?: string | null;
};

function codigoVacio(codigo: string): boolean {
  return !codigo || codigo === "—";
}

export function compararActivosPorCodigo(a: ActivoOrdenable, b: ActivoOrdenable): number {
  const ca = formatActivoCodigoDisplay(a);
  const cb = formatActivoCodigoDisplay(b);
  if (codigoVacio(ca) && codigoVacio(cb)) return 0;
  if (codigoVacio(ca)) return 1;
  if (codigoVacio(cb)) return -1;
  return ca.localeCompare(cb, "es", { numeric: true, sensitivity: "base" });
}

export function compararActivosPorCreacion(a: ActivoOrdenable, b: ActivoOrdenable): number {
  const ta = a.created_at ? Date.parse(a.created_at) : 0;
  const tb = b.created_at ? Date.parse(b.created_at) : 0;
  return tb - ta;
}

export function ordenarActivosInventario<T extends ActivoOrdenable>(
  items: T[],
  orden: OrdenInventario,
): T[] {
  const comparar = orden === "creacion" ? compararActivosPorCreacion : compararActivosPorCodigo;
  return [...items].sort(comparar);
}
