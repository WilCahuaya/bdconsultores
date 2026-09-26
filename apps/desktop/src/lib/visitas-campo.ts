import type {
  EstadoVisitaAmbiente,
  EstadoVisitaCampo,
  VisitaCampoActiva,
  VisitaCampoAmbienteDetalle,
  VisitaCampoHistorial,
} from "@inventario/types";
import { getSupabaseClient } from "./supabase";
import type { AmbienteConSede } from "./ubicacion";
import {
  enqueueOfflineOp,
  findMasterItem,
  isOnline,
  listMasterDomain,
  newLocalId,
  replaceMasterDomain,
  upsertMasterItem,
} from "./master-cache";

type ProfileJoin = { nombre: string } | { nombre: string }[] | null;
type SedeJoin = { nombre: string } | { nombre: string }[] | null;

function profileNombre(join: ProfileJoin): string | null {
  if (!join) return null;
  if (Array.isArray(join)) return join[0]?.nombre ?? null;
  return join.nombre;
}

function sedeNombre(join: SedeJoin): string | null {
  if (!join) return null;
  if (Array.isArray(join)) return join[0]?.nombre ?? null;
  return join.nombre;
}

async function visitaRevisionCompleta(visitaId: string, ambienteIds: string[]): Promise<boolean> {
  if (ambienteIds.length === 0) return false;
  const supabase = getSupabaseClient();
  const { data: bienes } = await supabase
    .from("activos")
    .select("id")
    .eq("estado_registro", "REGISTRADO")
    .in("ambiente_id", ambienteIds);
  if (!bienes?.length) return true;
  const { data: revisiones } = await supabase
    .from("visita_revisiones")
    .select("activo_id")
    .eq("visita_id", visitaId)
    .in(
      "activo_id",
      bienes.map((bien) => bien.id as string),
    );
  const hechos = new Set((revisiones ?? []).map((fila) => fila.activo_id as string));
  return bienes.every((bien) => hechos.has(bien.id as string));
}

/** Fila cacheada de `visitas_campo` (activa o del historial). */
export interface VisitaCampoCache {
  id: string;
  entidad_id: string;
  numero: number;
  estado: EstadoVisitaCampo;
  abierto_at: string;
  abierto_por_nombre: string | null;
  cerrado_at: string | null;
  cerrado_por_nombre: string | null;
  sede_id: string | null;
  sede_nombre: string | null;
}

/** Fila cacheada de `visita_ambientes` (detalle por ambiente dentro de una visita). */
export interface VisitaAmbienteCache {
  id: string;
  visita_id: string;
  ambiente_id: string;
  ambiente_nombre: string;
  sede_nombre: string;
  es_preregistro: boolean;
  estado: EstadoVisitaAmbiente;
  culminado_at: string | null;
  culminado_por_nombre: string | null;
}

type VisitaRow = {
  id: string;
  numero: number;
  estado: EstadoVisitaCampo;
  abierto_at: string;
  cerrado_at: string | null;
  abierto_por: string;
  cerrado_por: string | null;
  sede_id: string | null;
  abierto: ProfileJoin;
  cerrado: ProfileJoin;
  sedes: SedeJoin;
};

async function fetchVisitasRemote(entidadId: string): Promise<{
  activas: VisitaCampoActiva[];
  historial: VisitaCampoHistorial[];
  ambientesCache: VisitaAmbienteCache[];
}> {
  const supabase = getSupabaseClient();
  const { data: visitas, error } = await supabase
    .from("visitas_campo")
    .select(
      "id, numero, estado, abierto_at, cerrado_at, abierto_por, cerrado_por, sede_id, abierto:abierto_por(nombre), cerrado:cerrado_por(nombre), sedes:sede_id(nombre)",
    )
    .eq("entidad_id", entidadId)
    .order("numero", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (visitas ?? []) as unknown as VisitaRow[];

  const historial: VisitaCampoHistorial[] = [];
  const ambientesCache: VisitaAmbienteCache[] = [];

  for (const v of rows) {
    const { data: filas } = await supabase
      .from("visita_ambientes")
      .select(
        "estado, culminado_at, ambiente_id, culminado:culminado_por(nombre), ambientes(nombre, es_preregistro, sedes(nombre))",
      )
      .eq("visita_id", v.id)
      .order("created_at");

    const detalle = (filas ?? []).map((fila) => {
      const ambRaw = fila.ambientes as unknown;
      const amb = (Array.isArray(ambRaw) ? ambRaw[0] : ambRaw) as {
        nombre: string;
        es_preregistro: boolean;
        sedes: { nombre: string } | { nombre: string }[] | null;
      } | null;
      const sede = amb?.sedes;
      const sn = Array.isArray(sede) ? sede[0]?.nombre : sede?.nombre;
      return {
        ambiente_id: fila.ambiente_id as string,
        ambiente_nombre: amb?.nombre ?? "—",
        sede_nombre: sn ?? "—",
        es_preregistro: amb?.es_preregistro ?? false,
        estado: fila.estado as EstadoVisitaAmbiente,
        culminado_at: fila.culminado_at as string | null,
        culminado_por_nombre: profileNombre(fila.culminado as ProfileJoin),
      };
    });

    for (const d of detalle) {
      ambientesCache.push({ id: `${v.id}:${d.ambiente_id}`, visita_id: v.id, ...d });
    }

    historial.push({
      id: v.id,
      numero: v.numero,
      estado: v.estado,
      abierto_at: v.abierto_at,
      cerrado_at: v.cerrado_at,
      abierto_por_nombre: profileNombre(v.abierto),
      cerrado_por_nombre: profileNombre(v.cerrado),
      sede_id: v.sede_id ?? null,
      sede_nombre: sedeNombre(v.sedes),
      ambientes_total: detalle.length,
      ambientes_culminados: detalle.filter((d) => d.estado === "CULMINADO").length,
    });
  }

  const abiertas = historial.filter((h) => h.estado === "ABIERTO");
  const activas: VisitaCampoActiva[] = (
    await Promise.all(
      abiertas.map(async (h) => ({
        id: h.id,
        entidad_id: entidadId,
        numero: h.numero,
        estado: h.estado,
        abierto_at: h.abierto_at,
        abierto_por_nombre: h.abierto_por_nombre,
        sede_id: h.sede_id,
        sede_nombre: h.sede_nombre,
        ambientes_total: h.ambientes_total,
        ambientes_culminados: h.ambientes_culminados,
        revision_completa: await visitaRevisionCompleta(
          h.id,
          ambientesCache.filter((fila) => fila.visita_id === h.id).map((fila) => fila.ambiente_id),
        ),
      })),
    )
  ).sort((a, b) => a.abierto_at.localeCompare(b.abierto_at));

  return { activas, historial, ambientesCache };
}

async function cacheVisitas(
  entidadId: string,
  historial: VisitaCampoHistorial[],
  ambientesCache: VisitaAmbienteCache[],
): Promise<void> {
  const visitasCache: VisitaCampoCache[] = historial.map((h) => ({
    id: h.id,
    entidad_id: entidadId,
    numero: h.numero,
    estado: h.estado,
    abierto_at: h.abierto_at,
    abierto_por_nombre: h.abierto_por_nombre,
    cerrado_at: h.cerrado_at,
    cerrado_por_nombre: h.cerrado_por_nombre,
    sede_id: h.sede_id,
    sede_nombre: h.sede_nombre,
  }));
  await replaceMasterDomain("visitas", entidadId, visitasCache);
  await replaceMasterDomain("visita_ambientes", entidadId, ambientesCache);
}

/** Descarga y cachea las visitas de campo de una entidad (usado por master-sync). */
export async function syncVisitasForEntidad(entidadId: string): Promise<void> {
  const { historial, ambientesCache } = await fetchVisitasRemote(entidadId);
  await cacheVisitas(entidadId, historial, ambientesCache);
}

function conteoAmbientes(visitaId: string, filas: VisitaAmbienteCache[]) {
  const relevantes = filas.filter((f) => f.visita_id === visitaId);
  return {
    ambientes_total: relevantes.length,
    ambientes_culminados: relevantes.filter((f) => f.estado === "CULMINADO").length,
  };
}

async function listVisitasActivasFromCache(entidadId: string): Promise<VisitaCampoActiva[]> {
  const visitas = await listMasterDomain<VisitaCampoCache>("visitas", entidadId);
  const filas = await listMasterDomain<VisitaAmbienteCache>("visita_ambientes", entidadId);
  return visitas
    .filter((v) => v.estado === "ABIERTO")
    .map((v) => ({
      id: v.id,
      entidad_id: v.entidad_id,
      numero: v.numero,
      estado: v.estado,
      abierto_at: v.abierto_at,
      abierto_por_nombre: v.abierto_por_nombre,
      sede_id: v.sede_id,
      sede_nombre: v.sede_nombre,
      ...conteoAmbientes(v.id, filas),
      revision_completa: false,
    }))
    .sort((a, b) => a.abierto_at.localeCompare(b.abierto_at));
}

async function listHistorialFromCache(entidadId: string): Promise<VisitaCampoHistorial[]> {
  const visitas = await listMasterDomain<VisitaCampoCache>("visitas", entidadId);
  const filas = await listMasterDomain<VisitaAmbienteCache>("visita_ambientes", entidadId);
  return visitas
    .map((v) => ({
      id: v.id,
      numero: v.numero,
      estado: v.estado,
      abierto_at: v.abierto_at,
      cerrado_at: v.cerrado_at,
      abierto_por_nombre: v.abierto_por_nombre,
      cerrado_por_nombre: v.cerrado_por_nombre,
      sede_id: v.sede_id,
      sede_nombre: v.sede_nombre,
      ...conteoAmbientes(v.id, filas),
    }))
    .sort((a, b) => b.numero - a.numero);
}

async function findVisitaAcrossEntidades(
  visitaId: string,
): Promise<{ entidadId: string; visita: VisitaCampoCache } | null> {
  const entidades = await listMasterDomain<{ id: string }>("entidades", "");
  for (const e of entidades) {
    const visitas = await listMasterDomain<VisitaCampoCache>("visitas", e.id);
    const found = visitas.find((v) => v.id === visitaId);
    if (found) return { entidadId: e.id, visita: found };
  }
  return null;
}

async function findVisitaAmbientesAcrossEntidades(visitaId: string): Promise<VisitaAmbienteCache[]> {
  const entidades = await listMasterDomain<{ id: string }>("entidades", "");
  for (const e of entidades) {
    const rows = await listMasterDomain<VisitaAmbienteCache>("visita_ambientes", e.id);
    const matched = rows.filter((r) => r.visita_id === visitaId);
    if (matched.length > 0) return matched;
  }
  return [];
}

export type AmbienteConVisita = AmbienteConSede & {
  visita_estado: EstadoVisitaAmbiente | null;
};

export async function getVisitasCampoActivas(entidadId: string): Promise<VisitaCampoActiva[]> {
  if (isOnline()) {
    try {
      const { activas, historial, ambientesCache } = await fetchVisitasRemote(entidadId);
      await cacheVisitas(entidadId, historial, ambientesCache);
      return activas;
    } catch {
      /* usar caché */
    }
  }
  return listVisitasActivasFromCache(entidadId);
}

export async function getVisitaCampoActiva(entidadId: string): Promise<VisitaCampoActiva | null> {
  const visitas = await getVisitasCampoActivas(entidadId);
  return visitas[0] ?? null;
}

export async function attachVisitaEstadoToAmbientes(
  ambientes: AmbienteConSede[],
  entidadId: string,
): Promise<AmbienteConVisita[]> {
  const visitas = await getVisitasCampoActivas(entidadId);
  if (visitas.length === 0) {
    return ambientes.map((a) => ({ ...a, visita_estado: null }));
  }

  const porAmbiente = new Map<string, EstadoVisitaAmbiente>();

  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();
      for (const visita of visitas) {
        const { data: filas } = await supabase
          .from("visita_ambientes")
          .select("ambiente_id, estado")
          .eq("visita_id", visita.id);

        for (const fila of filas ?? []) {
          porAmbiente.set(fila.ambiente_id, fila.estado as EstadoVisitaAmbiente);
        }
      }
      return ambientes.map((a) => ({
        ...a,
        visita_estado: a.es_preregistro ? null : (porAmbiente.get(a.id) ?? null),
      }));
    } catch {
      /* usar caché */
    }
  }

  const filas = await listMasterDomain<VisitaAmbienteCache>("visita_ambientes", entidadId);
  const visitaIds = new Set(visitas.map((v) => v.id));
  for (const fila of filas) {
    if (visitaIds.has(fila.visita_id)) {
      porAmbiente.set(fila.ambiente_id, fila.estado);
    }
  }

  return ambientes.map((a) => ({
    ...a,
    visita_estado: a.es_preregistro ? null : (porAmbiente.get(a.id) ?? null),
  }));
}

export async function listVisitasCampoHistorial(entidadId: string): Promise<VisitaCampoHistorial[]> {
  if (isOnline()) {
    try {
      const { historial, ambientesCache } = await fetchVisitasRemote(entidadId);
      await cacheVisitas(entidadId, historial, ambientesCache);
      return historial;
    } catch {
      /* usar caché */
    }
  }
  return listHistorialFromCache(entidadId);
}

export async function getVisitaCampoDetalle(
  visitaId: string,
): Promise<VisitaCampoAmbienteDetalle[]> {
  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();
      const { data: filas, error } = await supabase
        .from("visita_ambientes")
        .select(
          "estado, culminado_at, ambiente_id, culminado:culminado_por(nombre), ambientes(nombre, es_preregistro, sedes(nombre))",
        )
        .eq("visita_id", visitaId)
        .order("created_at");

      if (error) throw new Error(error.message);

      return (filas ?? []).map((fila) => {
        const ambRaw = fila.ambientes as unknown;
        const amb = (Array.isArray(ambRaw) ? ambRaw[0] : ambRaw) as {
          nombre: string;
          es_preregistro: boolean;
          sedes: { nombre: string } | { nombre: string }[] | null;
        } | null;
        const sede = amb?.sedes;
        const sn = Array.isArray(sede) ? sede[0]?.nombre : sede?.nombre;

        return {
          ambiente_id: fila.ambiente_id,
          ambiente_nombre: amb?.nombre ?? "—",
          sede_nombre: sn ?? "—",
          es_preregistro: amb?.es_preregistro ?? false,
          estado: fila.estado as EstadoVisitaAmbiente,
          culminado_at: fila.culminado_at,
          culminado_por_nombre: profileNombre(fila.culminado as ProfileJoin),
        };
      });
    } catch {
      /* usar caché */
    }
  }

  const rows = await findVisitaAmbientesAcrossEntidades(visitaId);
  return rows.map((r) => ({
    ambiente_id: r.ambiente_id,
    ambiente_nombre: r.ambiente_nombre,
    sede_nombre: r.sede_nombre,
    es_preregistro: r.es_preregistro,
    estado: r.estado,
    culminado_at: r.culminado_at,
    culminado_por_nombre: r.culminado_por_nombre,
  }));
}

export async function abrirVisitaCampo(entidadId: string, sedeId?: string | null) {
  const sede = sedeId || null;

  if (!isOnline()) {
    const activas = await listVisitasActivasFromCache(entidadId);
    if (sede) {
      if (activas.some((v) => v.sede_id === null)) {
        return { error: "Ya hay una visita abierta en todas las sucursales." };
      }
      if (activas.some((v) => v.sede_id === sede)) {
        return { error: "Ya hay una visita de campo abierta en esta sucursal." };
      }
    } else if (activas.length > 0) {
      return { error: "Cierre las visitas abiertas antes de iniciar una en todas las sucursales." };
    }

    const ambientesTodas = await listMasterDomain<AmbienteConSede>("ambientes", entidadId);
    const ambientesRelevantes = ambientesTodas.filter(
      (a) => a.activo && !a.es_preregistro && (!sede || a.sede_id === sede),
    );

    const historialActual = await listMasterDomain<VisitaCampoCache>("visitas", entidadId);
    const numero = historialActual.reduce((max, v) => Math.max(max, v.numero), 0) + 1;

    const visitaId = newLocalId();
    const now = new Date().toISOString();
    const sedeInfo = sede ? await findMasterItem<{ nombre: string }>("sedes", sede) : null;

    const visitaCache: VisitaCampoCache = {
      id: visitaId,
      entidad_id: entidadId,
      numero,
      estado: "ABIERTO",
      abierto_at: now,
      abierto_por_nombre: null,
      cerrado_at: null,
      cerrado_por_nombre: null,
      sede_id: sede,
      sede_nombre: sedeInfo?.data.nombre ?? null,
    };
    await upsertMasterItem("visitas", entidadId, visitaCache);

    for (const amb of ambientesRelevantes) {
      const row: VisitaAmbienteCache = {
        id: `${visitaId}:${amb.id}`,
        visita_id: visitaId,
        ambiente_id: amb.id,
        ambiente_nombre: amb.nombre,
        sede_nombre: amb.sede_nombre,
        es_preregistro: false,
        estado: "EN_PROCESO",
        culminado_at: null,
        culminado_por_nombre: null,
      };
      await upsertMasterItem("visita_ambientes", entidadId, row);
    }

    await enqueueOfflineOp("visita:abrir", entidadId, {
      id: visitaId,
      sedeId: sede,
      numero,
      ambienteIds: ambientesRelevantes.map((a) => a.id),
    });

    return { success: true, visitaId };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("abrir_visita_campo", {
    p_entidad_id: entidadId,
    p_sede_id: sede,
  });
  if (error) return { error: error.message };
  return { success: true, visitaId: data as string };
}

export async function culminarAmbienteVisita(ambienteId: string) {
  if (!isOnline()) {
    const ambiente = await findMasterItem<AmbienteConSede>("ambientes", ambienteId);
    if (!ambiente) return { error: "Ambiente no encontrado en caché local." };
    if (ambiente.data.es_preregistro) {
      return { error: "El ambiente de preregistros no participa en visitas de campo." };
    }

    const entidadId = ambiente.entidadId;
    const visitas = (await listMasterDomain<VisitaCampoCache>("visitas", entidadId))
      .filter((v) => v.estado === "ABIERTO" && (v.sede_id === null || v.sede_id === ambiente.data.sede_id))
      .sort((a, b) => (a.sede_id === null ? 1 : 0) - (b.sede_id === null ? 1 : 0));
    const visita = visitas[0];
    if (!visita) return { error: "No hay una visita de campo abierta para este ambiente." };

    const filas = await listMasterDomain<VisitaAmbienteCache>("visita_ambientes", entidadId);
    const fila = filas.find((f) => f.visita_id === visita.id && f.ambiente_id === ambienteId);
    if (!fila || fila.estado !== "EN_PROCESO") {
      return { error: "El ambiente no está en proceso en la visita actual." };
    }

    await upsertMasterItem("visita_ambientes", entidadId, {
      ...fila,
      estado: "CULMINADO" as EstadoVisitaAmbiente,
      culminado_at: new Date().toISOString(),
      culminado_por_nombre: null,
    });
    await enqueueOfflineOp("visita:culminar", entidadId, { visitaId: visita.id, ambienteId });
    return { success: true };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("culminar_ambiente_visita", {
    p_ambiente_id: ambienteId,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function cerrarVisitaCampo(visitaId: string) {
  if (!isOnline()) {
    const found = await findVisitaAcrossEntidades(visitaId);
    if (!found) return { error: "Visita de campo no encontrada o ya cerrada." };
    const { entidadId, visita } = found;

    if (visita.estado !== "ABIERTO") {
      return { error: "Visita de campo no encontrada o ya cerrada." };
    }

    const filas = await listMasterDomain<VisitaAmbienteCache>("visita_ambientes", entidadId);
    const pendientes = filas.filter(
      (f) => f.visita_id === visitaId && f.estado === "EN_PROCESO",
    ).length;
    if (pendientes > 0) {
      return {
        error: `Debe culminar todos los ambientes antes de cerrar la visita (${pendientes} pendientes)`,
      };
    }

    await upsertMasterItem("visitas", entidadId, {
      ...visita,
      estado: "CERRADO" as EstadoVisitaCampo,
      cerrado_at: new Date().toISOString(),
      cerrado_por_nombre: null,
    });
    await enqueueOfflineOp("visita:cerrar", entidadId, { visitaId, sedeId: visita.sede_id });
    return { success: true };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("cerrar_visita_campo", {
    p_visita_id: visitaId,
  });
  if (error) return { error: error.message };
  return { success: true };
}
