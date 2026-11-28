import type { HistorialActivoItem } from "@inventario/types";
import { replaceMasterDomain } from "./master-cache";
import { cacheArchivosDeActivos } from "./media-cache";
import { listCachedActivos } from "./offline";
import { getSupabaseClient } from "./supabase";

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

async function fetchPages<T>(
  load: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await load(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function opcionCatalogoId(tipo: string, valor: string): string {
  return `${tipo}::${valor}`;
}

export async function syncCuentasToLocal(): Promise<void> {
  const supabase = getSupabaseClient();
  const rows = await fetchPages<{ codigo: string; nombre: string | null }>(async (from, to) => {
    const { data, error } = await supabase
      .from("cuentas_contables")
      .select("codigo, nombre")
      .order("codigo")
      .range(from, to);
    return { data: (data ?? null) as { codigo: string; nombre: string | null }[] | null, error };
  });
  await replaceMasterDomain(
    "cuentas",
    "",
    rows
      .filter((row) => row.codigo)
      .map((row) => ({
        id: row.codigo,
        codigo: row.codigo,
        nombre: row.nombre?.trim() || row.codigo,
      })),
  );
}

export async function syncOpcionesCatalogoToLocal(): Promise<void> {
  const supabase = getSupabaseClient();
  const rows = await fetchPages<{ tipo: string; valor: string }>(async (from, to) => {
    const { data, error } = await supabase
      .from("catalogo_opciones_personalizadas")
      .select("tipo, valor")
      .order("tipo")
      .range(from, to);
    return { data: (data ?? null) as { tipo: string; valor: string }[] | null, error };
  });
  await replaceMasterDomain(
    "catalogo_opciones",
    "",
    rows
      .filter((row) => row.tipo && row.valor?.trim())
      .map((row) => ({
        id: opcionCatalogoId(row.tipo, row.valor.trim()),
        tipo: row.tipo,
        valor: row.valor.trim(),
      })),
  );
}

export async function syncRevisionesEntidad(entidadId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const rows = await fetchPages<Record<string, unknown>>(async (from, to) => {
    const { data, error } = await supabase
      .from("visita_revisiones")
      .select(
        "id, visita_id, activo_id, ambiente_id, hallado, accion, estado_bien_anterior, motivo, visitas_campo!inner(entidad_id)",
      )
      .eq("visitas_campo.entidad_id", entidadId)
      .range(from, to);
    return { data: (data ?? null) as Record<string, unknown>[] | null, error };
  });
  await replaceMasterDomain(
    "visita_revisiones",
    entidadId,
    rows.map((row) => {
      const { visitas_campo: _visita, ...rest } = row;
      return rest;
    }),
  );
}

function nombrePerfil(
  profiles: { nombre?: string | null } | { nombre?: string | null }[] | null,
): string | undefined {
  if (!profiles) return undefined;
  const row = Array.isArray(profiles) ? profiles[0] : profiles;
  const nombre = row?.nombre?.trim();
  return nombre || undefined;
}

export async function syncHistorialEntidad(entidadId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const rows = await fetchPages<HistorialActivoItem & { profiles?: { nombre?: string | null } | { nombre?: string | null }[] | null }>(
    async (from, to) => {
      const { data, error } = await supabase
        .from("historial_cambios")
        .select(
          "id, activo_id, entidad_id, usuario_id, accion, campo, valor_anterior, valor_nuevo, created_at, profiles(nombre)",
        )
        .eq("entidad_id", entidadId)
        .order("created_at", { ascending: false })
        .range(from, to);
      return {
        data: (data ?? null) as Array<
          HistorialActivoItem & {
            profiles?: { nombre?: string | null } | { nombre?: string | null }[] | null;
          }
        > | null,
        error,
      };
    },
  );
  await replaceMasterDomain(
    "historial",
    entidadId,
    rows.map((row) => {
      const { profiles, ...rest } = row;
      return { ...rest, usuario_nombre: nombrePerfil(profiles ?? null) };
    }),
  );
}

export async function syncArchivosEntidad(entidadId: string): Promise<void> {
  const activos = await listCachedActivos(entidadId);
  await cacheArchivosDeActivos(
    activos as Array<{
      foto_path?: string | null;
      comprobante_path?: string | null;
      comprobantes?: Array<{ pdf_path?: string | null }> | null;
    }>,
  );
}
