import type {
  Ambiente,
  EntidadConConteo,
  Espacio,
  EspacioConOcupacion,
  Responsable,
  ResponsableConConteo,
  SedeConConteo,
} from "@inventario/types";
import { etiquetaNombreEspacio, resumenOcupacionEspacio } from "@inventario/types";
import { replaceMasterDomain } from "./master-cache";
import { getSupabaseClient } from "./supabase";
import { loadSedesForEntidad } from "./sede-principal-direccion";
import { syncVisitasForEntidad } from "./visitas-campo";

async function fetchEntidadesRemote(): Promise<EntidadConConteo[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("entidades")
    .select("*")
    .order("activo", { ascending: false })
    .order("nombre");
  if (error) throw new Error(error.message);

  const { data: ambientesRows } = await supabase
    .from("ambientes")
    .select("id, sedes!inner(entidad_id)")
    .eq("activo", true);

  const ambienteCountByEntidad = new Map<string, number>();
  for (const row of ambientesRows ?? []) {
    const sedes = row.sedes;
    const sede = Array.isArray(sedes) ? sedes[0] : sedes;
    const entidadId =
      sede && typeof sede === "object" && "entidad_id" in sede
        ? String((sede as { entidad_id: string }).entidad_id)
        : "";
    if (!entidadId) continue;
    ambienteCountByEntidad.set(entidadId, (ambienteCountByEntidad.get(entidadId) ?? 0) + 1);
  }

  const { data: activosRows } = await supabase.from("activos").select("entidad_id");
  const activoCountByEntidad = new Map<string, number>();
  for (const row of activosRows ?? []) {
    const entidadId = row.entidad_id as string;
    activoCountByEntidad.set(entidadId, (activoCountByEntidad.get(entidadId) ?? 0) + 1);
  }

  return (data ?? []).map((e) => ({
    ...(e as EntidadConConteo),
    ambiente_count: ambienteCountByEntidad.get(e.id) ?? 0,
    activo_count: activoCountByEntidad.get(e.id) ?? 0,
  }));
}

async function fetchSedesConConteoRemote(entidadId: string): Promise<SedeConConteo[]> {
  const supabase = getSupabaseClient();
  const sedes = await loadSedesForEntidad(supabase, entidadId);
  const sorted = [...sedes].sort((a, b) => {
    if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
    return a.nombre.localeCompare(b.nombre);
  });

  const result: SedeConConteo[] = [];
  for (const sede of sorted) {
    const { count } = await supabase
      .from("ambientes")
      .select("*", { count: "exact", head: true })
      .eq("sede_id", sede.id)
      .eq("activo", true);
    result.push({ ...sede, ambiente_count: count ?? 0 });
  }
  return result;
}

async function fetchAmbientesRemote(entidadId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ambientes")
    .select("*, sedes!inner(nombre, es_principal, entidad_id)")
    .eq("activo", true)
    .eq("sedes.entidad_id", entidadId)
    .order("nombre");
  if (error) throw new Error(error.message);

  const mapped = (data ?? []).map((row) => {
    const sede = row.sedes as { nombre: string; es_principal: boolean } | null;
    const { sedes: _, ...ambiente } = row;
    return {
      ...(ambiente as Ambiente),
      sede_nombre: sede?.nombre ?? "",
      sede_es_principal: sede?.es_principal ?? false,
      espacio_nombre: null as string | null,
      activo_count: 0,
    };
  });

  const ids = mapped.map((a) => a.id);
  if (ids.length > 0) {
    const { data: activos } = await supabase.from("activos").select("ambiente_id").in("ambiente_id", ids);
    const counts = new Map<string, number>();
    for (const row of activos ?? []) {
      const id = row.ambiente_id as string | null;
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const amb of mapped) {
      amb.activo_count = counts.get(amb.id) ?? 0;
    }
  }

  const espacioIds = [
    ...new Set(mapped.map((a) => a.espacio_id).filter((id): id is string => Boolean(id))),
  ];
  if (espacioIds.length > 0) {
    const { data: espaciosRows } = await supabase
      .from("espacios")
      .select("id, nombre, descripcion")
      .in("id", espacioIds);
    const nombreById = new Map(
      (espaciosRows ?? []).map((e) => [
        e.id as string,
        etiquetaNombreEspacio(e.nombre as string, e.descripcion as string | null),
      ]),
    );
    for (const amb of mapped) {
      if (amb.espacio_id) amb.espacio_nombre = nombreById.get(amb.espacio_id) ?? null;
    }
  }

  return mapped;
}

async function fetchEspaciosRemote(sedeId: string): Promise<EspacioConOcupacion[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("espacios")
    .select("*, ambientes(id, nombre, activo)")
    .eq("sede_id", sedeId)
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const ambientes =
      (row.ambientes as Array<{ id: string; nombre: string; activo: boolean }> | null) ?? [];
    const { ambientes: _, ...espacio } = row;
    const base = espacio as Espacio;
    return {
      ...base,
      descripcion: base.descripcion ?? "",
      ...resumenOcupacionEspacio(ambientes),
    };
  });
}

async function fetchResponsablesRemote(entidadId: string): Promise<ResponsableConConteo[]> {
  const supabase = getSupabaseClient();
  const { data: entidad } = await supabase
    .from("entidades")
    .select("admin_email")
    .eq("id", entidadId)
    .maybeSingle();
  const adminEmailNorm = entidad?.admin_email?.trim().toLowerCase() ?? "";

  const { data, error } = await supabase
    .from("responsables")
    .select("*, ambientes(id, nombre, activo, sedes(nombre))")
    .eq("entidad_id", entidadId)
    .order("nombre");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { ambientes: ambientesRaw, ...rest } = row as Responsable & {
      ambientes?: Array<{
        id: string;
        nombre: string;
        activo: boolean;
        sedes: { nombre: string } | null;
      }> | null;
    };
    const ambientesActivos = (ambientesRaw ?? []).filter((a) => a.activo);
    const emailNorm = rest.email?.trim().toLowerCase() ?? "";
    return {
      ...rest,
      ambiente_count: ambientesActivos.length,
      ambiente_nombres: ambientesActivos.map((a) =>
        a.sedes?.nombre ? `${a.nombre} (${a.sedes.nombre})` : a.nombre,
      ),
      es_administrador: Boolean(adminEmailNorm && emailNorm && emailNorm === adminEmailNorm),
    };
  });
}

/** Descarga maestros desde Supabase y los guarda en SQLite local. */
export async function syncMasterDataForEntidad(entidadId: string): Promise<void> {
  if (!entidadId || !window.electronAPI?.offlineMasterReplace) return;

  const [ambientes, sedes, responsables] = await Promise.all([
    fetchAmbientesRemote(entidadId),
    fetchSedesConConteoRemote(entidadId),
    fetchResponsablesRemote(entidadId),
  ]);

  await replaceMasterDomain("ambientes", entidadId, ambientes);
  await replaceMasterDomain("sedes", entidadId, sedes);
  await replaceMasterDomain("responsables", entidadId, responsables);

  const espacios: EspacioConOcupacion[] = [];
  for (const sede of sedes) {
    try {
      espacios.push(...(await fetchEspaciosRemote(sede.id)));
    } catch {
      /* ignore */
    }
  }
  await replaceMasterDomain("espacios", entidadId, espacios);

  try {
    await syncVisitasForEntidad(entidadId);
  } catch {
    /* las visitas de campo no son críticas para el resto del caché offline */
  }
}

export async function syncAllMasterData(): Promise<{ entidades: number }> {
  if (!window.electronAPI?.offlineMasterReplace) return { entidades: 0 };

  const entidades = await fetchEntidadesRemote();
  await replaceMasterDomain("entidades", "", entidades);

  for (const entidad of entidades.filter((e) => e.activo)) {
    try {
      await syncMasterDataForEntidad(entidad.id);
    } catch (err) {
      console.warn("[master-sync] entidad", entidad.id, err);
    }
  }

  return { entidades: entidades.length };
}

export { fetchEntidadesRemote };
