import type { Ambiente, Edificio, Espacio, EspacioConOcupacion, Piso, Sede, SedeConConteo, UbicacionEspacioInput } from "@inventario/types";
import { espacioRepetidoEnSucursal, etiquetaNombreEspacio, mensajeEspacioRepetido, nombreEspacioDesdeNumero, pisoEspacio, resumenOcupacionEspacio } from "@inventario/types";
import { listCachedActivos } from "./offline";
import {
  enqueueOfflineOp,
  findMasterItem,
  isOnline,
  listMasterDomain,
  newLocalId,
  removeMasterItem,
  replaceMasterDomain,
  upsertMasterItem,
} from "./master-cache";
import { getSupabaseClient } from "./supabase";
import { loadSedesForEntidad } from "./sede-principal-direccion";

export { listEntidades } from "./entidades";

export type AmbienteConSede = Ambiente & {
  sede_nombre: string;
  sede_es_principal: boolean;
  espacio_nombre?: string | null;
  espacio_local?: string | null;
  espacio_descripcion?: string | null;
  piso?: number | null;
  edificio_nombre?: string | null;
  activo_count: number;
};

function camposUbicacionEspacio(ubicacion?: UbicacionEspacioInput) {
  return {
    edificio_id: ubicacion?.edificioId || null,
    piso: pisoEspacio(ubicacion?.piso),
  };
}

async function activoCountByAmbienteIds(
  ambienteIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ambienteIds.length === 0) return counts;

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("activos")
    .select("ambiente_id")
    .in("ambiente_id", ambienteIds);

  for (const row of data ?? []) {
    const ambienteId = row.ambiente_id as string | null;
    if (!ambienteId) continue;
    counts.set(ambienteId, (counts.get(ambienteId) ?? 0) + 1);
  }
  return counts;
}

async function activoCountFromCache(
  entidadId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const activos = await listCachedActivos(entidadId);
  for (const a of activos) {
    const id = a.ambiente_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export interface CreateAmbienteInput {
  sedeId: string;
  nombre: string;
  descripcion?: string;
  responsableId?: string | null;
  espacioId?: string | null;
}

const ESPACIO_OCUPADO_MSG = "Ese espacio ya está ocupado por otro ambiente.";

function mapAmbienteEspacioError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("idx_ambientes_espacio_unico") ||
    (m.includes("duplicate key") && m.includes("espacio"))
  ) {
    return ESPACIO_OCUPADO_MSG;
  }
  return message;
}

function descripcionEspacio(raw: string | null | undefined): { descripcion: string } {
  return { descripcion: raw?.trim() ?? "" };
}

function sortAmbientesConSede(items: AmbienteConSede[]): AmbienteConSede[] {
  return [...items].sort((a, b) => {
    if (a.es_preregistro !== b.es_preregistro) return a.es_preregistro ? -1 : 1;
    if (Boolean(a.es_faltante) !== Boolean(b.es_faltante)) return a.es_faltante ? -1 : 1;
    if (a.sede_es_principal !== b.sede_es_principal) return a.sede_es_principal ? -1 : 1;
    if (a.sede_nombre !== b.sede_nombre) return a.sede_nombre.localeCompare(b.sede_nombre);
    return a.nombre.localeCompare(b.nombre);
  });
}

async function listAmbientesPorEntidadFromCache(
  entidadId: string,
  sedeId?: string,
): Promise<AmbienteConSede[]> {
  let items = await listMasterDomain<AmbienteConSede>("ambientes", entidadId);
  items = items.filter((a) => a.activo);
  if (sedeId) items = items.filter((a) => a.sede_id === sedeId);
  const counts = await activoCountFromCache(entidadId);
  return sortAmbientesConSede(
    items.map((a) => ({ ...a, activo_count: counts.get(a.id) ?? a.activo_count ?? 0 })),
  );
}

async function listEspaciosFromCache(sedeId: string): Promise<EspacioConOcupacion[]> {
  const sede = await findMasterItem<Sede>("sedes", sedeId);
  if (!sede) return [];
  const espacios = await listMasterDomain<Espacio>("espacios", sede.entidadId);
  const ambientes = await listMasterDomain<Ambiente>("ambientes", sede.entidadId);
  return espacios
    .filter((e) => e.sede_id === sedeId && e.activo)
    .map((e) => {
      const delEspacio = ambientes.filter((a) => a.activo && a.espacio_id === e.id);
      return {
        ...e,
      descripcion: e.descripcion ?? "",
      edificio_id: e.edificio_id ?? null,
      piso: pisoEspacio(e.piso),
      ...resumenOcupacionEspacio(delEspacio),
      };
    })
    .sort((a, b) => a.piso - b.piso || a.nombre.localeCompare(b.nombre, "es"));
}

export async function listSedes(entidadId: string): Promise<Sede[]> {
  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();
      return await loadSedesForEntidad(supabase, entidadId);
    } catch {
      /* caché */
    }
  }
  return listMasterDomain<SedeConConteo>("sedes", entidadId);
}

export async function listAmbientes(sedeId: string): Promise<Ambiente[]> {
  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("ambientes")
        .select("*")
        .eq("sede_id", sedeId)
        .eq("activo", true)
        .eq("es_preregistro", false)
        .order("nombre");
      if (error) throw new Error(error.message);
      return (data ?? []) as Ambiente[];
    } catch {
      /* caché */
    }
  }
  const sede = await findMasterItem<Sede>("sedes", sedeId);
  if (!sede) return [];
  const items = await listMasterDomain<Ambiente>("ambientes", sede.entidadId);
  return items
    .filter((a) => a.activo && !a.es_preregistro && a.sede_id === sedeId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getAmbientePreregistro(entidadId: string): Promise<Ambiente | null> {
  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();
      const { data: ambienteId, error } = await supabase.rpc("ensure_ambiente_preregistro", {
        p_entidad_id: entidadId,
      });
      if (error || !ambienteId) return null;
      const { data } = await supabase
        .from("ambientes")
        .select("*")
        .eq("id", ambienteId as string)
        .maybeSingle();
      return (data as Ambiente) ?? null;
    } catch {
      /* caché */
    }
  }
  const items = await listMasterDomain<Ambiente>("ambientes", entidadId);
  return items.find((a) => a.activo && a.es_preregistro) ?? null;
}

export async function listAmbientesPorEntidad(
  entidadId: string,
  sedeId?: string,
): Promise<AmbienteConSede[]> {
  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("ambientes")
        .select("*, sedes!inner(nombre, es_principal, entidad_id)")
        .eq("activo", true);

      if (sedeId) {
        query = query.eq("sede_id", sedeId);
      } else {
        query = query.eq("sedes.entidad_id", entidadId);
      }

      const { data, error } = await query.order("nombre");
      if (error) throw new Error(error.message);

      const mapped = (data ?? []).map((row) => {
        const sede = row.sedes as { nombre: string; es_principal: boolean } | null;
        const { sedes: _, ...ambiente } = row;
        return {
          ...(ambiente as Ambiente),
          sede_nombre: sede?.nombre ?? "",
          sede_es_principal: sede?.es_principal ?? false,
          espacio_nombre: null as string | null,
          espacio_local: null as string | null,
          espacio_descripcion: null as string | null,
          piso: null as number | null,
          edificio_nombre: null as string | null,
          activo_count: 0,
        };
      });

      const espacioIds = [
        ...new Set(mapped.map((a) => a.espacio_id).filter((id): id is string => Boolean(id))),
      ];
      if (espacioIds.length > 0) {
        const { data: espaciosRows } = await supabase
          .from("espacios")
          .select("id, nombre, descripcion, piso, edificio_id, edificios(nombre)")
          .in("id", espacioIds);
        const porId = new Map(
          (espaciosRows ?? []).map((e) => {
            const edificio = e.edificios as { nombre: string } | { nombre: string }[] | null;
            const edificioNombre = Array.isArray(edificio) ? edificio[0]?.nombre : edificio?.nombre;
            return [
              e.id as string,
              {
                espacio_nombre: etiquetaNombreEspacio(e.nombre as string, e.descripcion as string | null),
                espacio_local: e.nombre as string,
                espacio_descripcion: (e.descripcion as string | null)?.trim() || null,
                piso: pisoEspacio(e.piso as number | null),
                edificio_nombre: edificioNombre?.trim() || null,
              },
            ] as const;
          }),
        );
        for (const amb of mapped) {
          const meta = amb.espacio_id ? porId.get(amb.espacio_id) : undefined;
          if (!meta) continue;
          amb.espacio_nombre = meta.espacio_nombre;
          amb.espacio_local = meta.espacio_local;
          amb.espacio_descripcion = meta.espacio_descripcion;
          amb.piso = meta.piso;
          amb.edificio_nombre = meta.edificio_nombre;
        }
      }

      const activoCounts = await activoCountByAmbienteIds(mapped.map((ambiente) => ambiente.id));
      const withCounts = mapped.map((ambiente) => ({
        ...ambiente,
        activo_count: activoCounts.get(ambiente.id) ?? 0,
      }));
      const sorted = sortAmbientesConSede(withCounts);
      if (!sedeId) await replaceMasterDomain("ambientes", entidadId, sorted);
      return sorted;
    } catch {
      /* caché */
    }
  }
  return listAmbientesPorEntidadFromCache(entidadId, sedeId);
}

export async function createAmbiente(
  input: CreateAmbienteInput,
): Promise<{ data?: Ambiente; error?: string }> {
  const trimmed = input.nombre.trim();
  if (!trimmed) return { error: "Nombre de ambiente obligatorio." };

  if (!isOnline()) {
    const sede = await findMasterItem<Sede>("sedes", input.sedeId);
    if (!sede) return { error: "Sucursal no encontrada en caché local." };
    const espacios = await listMasterDomain<Espacio>("espacios", sede.entidadId);
    const espacioElegido = input.espacioId
      ? espacios.find((e) => e.id === input.espacioId)
      : undefined;
    const espacioNombre = espacioElegido
      ? etiquetaNombreEspacio(espacioElegido.nombre, espacioElegido.descripcion)
      : null;

    const id = newLocalId();
    const now = new Date().toISOString();
    const ambiente: AmbienteConSede = {
      id,
      sede_id: input.sedeId,
      nombre: trimmed,
      descripcion: input.descripcion?.trim() || null,
      responsable_id: input.responsableId || null,
      responsable: null,
      espacio_id: input.espacioId || null,
      es_preregistro: false,
      activo: true,
      created_at: now,
      updated_at: now,
      sede_nombre: sede.data.nombre,
      sede_es_principal: sede.data.es_principal,
      espacio_nombre: espacioNombre,
      activo_count: 0,
    };
    await upsertMasterItem("ambientes", sede.entidadId, ambiente);
    await enqueueOfflineOp("ambiente:create", sede.entidadId, {
      id,
      input: {
        sedeId: input.sedeId,
        nombre: trimmed,
        descripcion: input.descripcion?.trim() || null,
        responsableId: input.responsableId || null,
        espacioId: input.espacioId || null,
      },
    });
    return { data: ambiente };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ambientes")
    .insert({
      sede_id: input.sedeId,
      nombre: trimmed,
      descripcion: input.descripcion?.trim() || null,
      responsable_id: input.responsableId || null,
      espacio_id: input.espacioId || null,
    })
    .select()
    .single();

  if (error) return { error: mapAmbienteEspacioError(error.message) };
  return { data: data as Ambiente };
}

export async function updateAmbiente(
  ambienteId: string,
  input: Omit<CreateAmbienteInput, "sedeId">,
): Promise<{ success?: true; error?: string }> {
  const trimmed = input.nombre.trim();
  if (!trimmed) return { error: "Nombre de ambiente obligatorio." };

  if (!isOnline()) {
    const found = await findMasterItem<AmbienteConSede>("ambientes", ambienteId);
    if (!found) return { error: "Ambiente no encontrado en caché local." };
    if (found.data.es_preregistro) {
      return { error: "El ambiente de preregistros no se puede editar." };
    }
    const espacios = await listMasterDomain<Espacio>("espacios", found.entidadId);
    const espacioElegido = input.espacioId
      ? espacios.find((e) => e.id === input.espacioId)
      : undefined;
    const espacioNombre = espacioElegido
      ? etiquetaNombreEspacio(espacioElegido.nombre, espacioElegido.descripcion)
      : null;

    const updated: AmbienteConSede = {
      ...found.data,
      nombre: trimmed,
      descripcion: input.descripcion?.trim() || null,
      responsable_id: input.responsableId ?? null,
      espacio_id: input.espacioId ?? null,
      espacio_nombre: espacioNombre,
      updated_at: new Date().toISOString(),
    };
    await upsertMasterItem("ambientes", found.entidadId, updated);
    await enqueueOfflineOp("ambiente:update", found.entidadId, {
      ambienteId,
      input: {
        nombre: trimmed,
        descripcion: input.descripcion?.trim() || null,
        responsableId: input.responsableId ?? null,
        espacioId: input.espacioId ?? null,
      },
    });
    return { success: true };
  }

  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from("ambientes")
    .select("es_preregistro")
    .eq("id", ambienteId)
    .maybeSingle();

  if (existing?.es_preregistro) {
    return { error: "El ambiente de preregistros no se puede editar." };
  }

  const { error } = await supabase
    .from("ambientes")
    .update({
      nombre: trimmed,
      descripcion: input.descripcion?.trim() || null,
      responsable_id: input.responsableId ?? null,
      espacio_id: input.espacioId ?? null,
    })
    .eq("id", ambienteId);

  if (error) return { error: mapAmbienteEspacioError(error.message) };
  return { success: true };
}

export async function deleteAmbiente(
  ambienteId: string,
): Promise<{ success?: true; error?: string }> {
  if (!isOnline()) {
    const found = await findMasterItem<AmbienteConSede>("ambientes", ambienteId);
    if (!found) return { error: "Ambiente no encontrado en caché local." };
    if (found.data.es_preregistro) {
      return { error: "El ambiente de preregistros no se puede eliminar." };
    }
    if ((found.data.activo_count ?? 0) > 0) {
      return { error: "No puede eliminar un ambiente que tiene activos registrados." };
    }
    await upsertMasterItem("ambientes", found.entidadId, {
      ...found.data,
      activo: false,
      updated_at: new Date().toISOString(),
    });
    await enqueueOfflineOp("ambiente:delete", found.entidadId, { ambienteId });
    return { success: true };
  }

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from("ambientes")
    .select("es_preregistro")
    .eq("id", ambienteId)
    .maybeSingle();

  if (existing?.es_preregistro) {
    return { error: "El ambiente de preregistros no se puede eliminar." };
  }

  const { count } = await supabase
    .from("activos")
    .select("*", { count: "exact", head: true })
    .eq("ambiente_id", ambienteId);

  if ((count ?? 0) > 0) {
    return { error: "No puede eliminar un ambiente que tiene activos registrados." };
  }

  const { error } = await supabase
    .from("ambientes")
    .update({ activo: false })
    .eq("id", ambienteId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function listSedesConConteo(entidadId: string): Promise<SedeConConteo[]> {
  if (isOnline()) {
    try {
      const sedes = await listSedes(entidadId);
      const supabase = getSupabaseClient();
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
      await replaceMasterDomain("sedes", entidadId, result);
      return result;
    } catch {
      /* caché */
    }
  }
  const cached = await listMasterDomain<SedeConConteo>("sedes", entidadId);
  return [...cached].sort((a, b) => {
    if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
    return a.nombre.localeCompare(b.nombre);
  });
}

export async function createSede(
  entidadId: string,
  nombre: string,
  direccion?: string,
): Promise<{ data?: Sede; error?: string }> {
  const trimmed = nombre.trim();
  if (!trimmed) return { error: "Nombre de sucursal obligatorio." };
  if (trimmed.toLowerCase() === "principal") {
    return { error: 'Use otro nombre; "Principal" está reservado.' };
  }

  if (!isOnline()) {
    const id = newLocalId();
    const now = new Date().toISOString();
    const sede: SedeConConteo = {
      id,
      entidad_id: entidadId,
      nombre: trimmed,
      direccion: direccion?.trim() || null,
      es_principal: false,
      activo: true,
      created_at: now,
      updated_at: now,
      ambiente_count: 0,
    };
    await upsertMasterItem("sedes", entidadId, sede);
    await enqueueOfflineOp("sede:create", entidadId, {
      id,
      nombre: trimmed,
      direccion: direccion?.trim() || null,
    });
    return { data: sede };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("sedes")
    .insert({
      entidad_id: entidadId,
      nombre: trimmed,
      direccion: direccion?.trim() || null,
      es_principal: false,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as Sede };
}

export async function updateSede(
  sedeId: string,
  nombre: string,
  direccion?: string,
): Promise<{ success?: true; error?: string }> {
  const trimmed = nombre.trim();
  if (!trimmed) return { error: "Nombre obligatorio." };

  if (!isOnline()) {
    const found = await findMasterItem<SedeConConteo>("sedes", sedeId);
    if (!found) return { error: "Sucursal no encontrada." };
    if (found.data.es_principal) return { error: "La sucursal Principal no se puede editar." };
    await upsertMasterItem("sedes", found.entidadId, {
      ...found.data,
      nombre: trimmed,
      direccion: direccion?.trim() || null,
      updated_at: new Date().toISOString(),
    });
    await enqueueOfflineOp("sede:update", found.entidadId, {
      sedeId,
      nombre: trimmed,
      direccion: direccion?.trim() || null,
    });
    return { success: true };
  }

  const supabase = getSupabaseClient();
  const { data: sede } = await supabase.from("sedes").select("*").eq("id", sedeId).single();
  if (!sede) return { error: "Sucursal no encontrada." };
  if ((sede as Sede).es_principal) return { error: "La sucursal Principal no se puede editar." };

  const { error } = await supabase
    .from("sedes")
    .update({
      nombre: trimmed,
      direccion: direccion?.trim() || null,
    })
    .eq("id", sedeId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteSede(sedeId: string): Promise<{ success?: true; error?: string }> {
  if (!isOnline()) {
    const found = await findMasterItem<SedeConConteo>("sedes", sedeId);
    if (!found) return { error: "Sucursal no encontrada." };
    if (found.data.es_principal) return { error: "La sucursal Principal no se puede eliminar." };
    if ((found.data.ambiente_count ?? 0) > 0) {
      return { error: "Solo puede eliminar sucursales sin ambientes asociados." };
    }
    await upsertMasterItem("sedes", found.entidadId, {
      ...found.data,
      activo: false,
      updated_at: new Date().toISOString(),
    });
    await enqueueOfflineOp("sede:delete", found.entidadId, { sedeId });
    return { success: true };
  }

  const supabase = getSupabaseClient();
  const { data: sede } = await supabase.from("sedes").select("*").eq("id", sedeId).single();
  if (!sede) return { error: "Sucursal no encontrada." };
  if ((sede as Sede).es_principal) return { error: "La sucursal Principal no se puede eliminar." };

  const { count } = await supabase
    .from("ambientes")
    .select("*", { count: "exact", head: true })
    .eq("sede_id", sedeId)
    .eq("activo", true);

  if ((count ?? 0) > 0) {
    return { error: "Solo puede eliminar sucursales sin ambientes asociados." };
  }

  const { error } = await supabase.from("sedes").update({ activo: false }).eq("id", sedeId);
  if (error) return { error: error.message };
  return { success: true };
}

export function nombreEspacioNumerado(n: number): string {
  return `Espacio ${String(n).padStart(2, "0")}`;
}

function maxNumeroEspacioExistente(existentes: Array<{ nombre: string }>): number {
  let max = 0;
  for (const e of existentes) {
    const match = e.nombre.trim().match(/^espacio\s*0*(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

export async function listEspacios(sedeId: string): Promise<EspacioConOcupacion[]> {
  if (isOnline()) {
    try {
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
    } catch {
      /* caché */
    }
  }
  return listEspaciosFromCache(sedeId);
}

export async function listEspaciosPorEntidad(entidadId: string): Promise<Espacio[]> {
  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("espacios")
        .select("*, sedes!inner(entidad_id)")
        .eq("activo", true)
        .eq("sedes.entidad_id", entidadId)
        .order("nombre");
      if (error) throw new Error(error.message);
      const mapped = (data ?? []).map((row) => {
        const { sedes: _, ...espacio } = row;
        return espacio as Espacio;
      });
      return mapped;
    } catch {
      /* caché */
    }
  }
  return (await listMasterDomain<Espacio>("espacios", entidadId)).filter((e) => e.activo);
}

export async function createEspacio(
  sedeId: string,
  nombre: string,
  descripcion: string,
  ubicacion?: UbicacionEspacioInput,
): Promise<{ data?: Espacio; error?: string }> {
  const ingresado = nombre.trim();
  if (!ingresado) return { error: "Nombre de espacio obligatorio." };
  const trimmed = nombreEspacioDesdeNumero(ingresado) ?? ingresado;
  const desc = descripcionEspacio(descripcion);

  if (!isOnline()) {
    const sede = await findMasterItem<Sede>("sedes", sedeId);
    if (!sede) return { error: "Sucursal no encontrada en caché local." };
    const existentes = await listEspaciosFromCache(sedeId);
    if (espacioRepetidoEnSucursal(trimmed, existentes)) {
      return { error: mensajeEspacioRepetido(trimmed) };
    }
    const id = newLocalId();
    const now = new Date().toISOString();
    const ubicacionCampos = camposUbicacionEspacio(ubicacion);
    const espacio: EspacioConOcupacion = {
      id,
      sede_id: sedeId,
      nombre: trimmed,
      descripcion: desc.descripcion,
      ...ubicacionCampos,
      activo: true,
      created_at: now,
      updated_at: now,
      ocupantes: [],
      ambiente_id: null,
      ambiente_nombre: null,
    };
    await upsertMasterItem("espacios", sede.entidadId, espacio);
    await enqueueOfflineOp("espacio:create", sede.entidadId, {
      id,
      sedeId,
      nombre: trimmed,
      descripcion: desc.descripcion,
      ...ubicacionCampos,
    });
    return { data: espacio };
  }

  const supabase = getSupabaseClient();

  const { data: existentes } = await supabase
    .from("espacios")
    .select("nombre")
    .eq("sede_id", sedeId)
    .eq("activo", true);

  if (espacioRepetidoEnSucursal(trimmed, existentes ?? [])) {
    return { error: mensajeEspacioRepetido(trimmed) };
  }

  const { data, error } = await supabase
    .from("espacios")
    .insert({
      sede_id: sedeId,
      nombre: trimmed,
      descripcion: desc.descripcion,
      ...camposUbicacionEspacio(ubicacion),
    })
    .select()
    .single();

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("idx_espacios_sede_nombre_activo") || msg.includes("duplicate key")) {
      return { error: mensajeEspacioRepetido(trimmed) };
    }
    return { error: error.message };
  }
  return { data: data as Espacio };
}

/** Agrega `cantidad` espacios a continuación del último número (ej. tras Espacio 10 → 11, 12…). */
export async function ensureEspaciosHasta(
  sedeId: string,
  cantidad: number,
  descripcion: string,
  ubicacion?: UbicacionEspacioInput,
): Promise<{ success?: true; creados?: number; data?: EspacioConOcupacion[]; error?: string }> {
  if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 500) {
    return { error: "Indique una cantidad entre 1 y 500." };
  }
  const desc = descripcionEspacio(descripcion);

  const existentes = await listEspacios(sedeId);
  const nombres = new Set(existentes.map((e) => e.nombre.trim().toLowerCase()));
  const desde = maxNumeroEspacioExistente(existentes) + 1;
  const ubicacionCampos = camposUbicacionEspacio(ubicacion);
  const aCrear: {
    id?: string;
    sede_id: string;
    nombre: string;
    descripcion: string;
    edificio_id: string | null;
    piso: number;
  }[] = [];
  for (let i = 0; i < cantidad; i++) {
    const nombre = nombreEspacioNumerado(desde + i);
    if (!nombres.has(nombre.toLowerCase())) {
      aCrear.push({ sede_id: sedeId, nombre, descripcion: desc.descripcion, ...ubicacionCampos });
    }
  }

  if (aCrear.length === 0) {
    return { success: true, creados: 0, data: existentes };
  }

  if (!isOnline()) {
    const sede = await findMasterItem<Sede>("sedes", sedeId);
    if (!sede) return { error: "Sucursal no encontrada en caché local." };
    const now = new Date().toISOString();
    const creados: EspacioConOcupacion[] = [];
    for (const row of aCrear) {
      const id = newLocalId();
      const espacio: EspacioConOcupacion = {
        id,
        sede_id: sedeId,
        nombre: row.nombre,
        descripcion: row.descripcion,
        edificio_id: row.edificio_id,
        piso: row.piso,
        activo: true,
        created_at: now,
        updated_at: now,
        ocupantes: [],
        ambiente_id: null,
        ambiente_nombre: null,
      };
      await upsertMasterItem("espacios", sede.entidadId, espacio);
      await enqueueOfflineOp("espacio:create", sede.entidadId, {
        id,
        sedeId,
        nombre: row.nombre,
        descripcion: row.descripcion,
        edificio_id: row.edificio_id,
        piso: row.piso,
      });
      creados.push(espacio);
    }
    return {
      success: true,
      creados: creados.length,
      data: [...existentes, ...creados].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("espacios").insert(aCrear);
  if (error) return { error: error.message };

  const actualizados = await listEspacios(sedeId);
  return { success: true, creados: aCrear.length, data: actualizados };
}

export async function deleteEspacio(espacioId: string): Promise<{ success?: true; error?: string }> {
  if (!isOnline()) {
    const found = await findMasterItem<Espacio>("espacios", espacioId);
    if (!found) return { error: "Espacio no encontrado en caché local." };
    const ambientes = await listMasterDomain<AmbienteConSede>("ambientes", found.entidadId);
    for (const amb of ambientes) {
      if (amb.espacio_id === espacioId) {
        await upsertMasterItem("ambientes", found.entidadId, {
          ...amb,
          espacio_id: null,
          espacio_nombre: null,
        });
      }
    }
    await removeMasterItem("espacios", found.entidadId, espacioId);
    await enqueueOfflineOp("espacio:delete", found.entidadId, { espacioId });
    return { success: true };
  }

  const supabase = getSupabaseClient();
  await supabase.from("ambientes").update({ espacio_id: null }).eq("espacio_id", espacioId);
  const { error } = await supabase
    .from("espacios")
    .update({ activo: false })
    .eq("id", espacioId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateEspacio(
  espacioId: string,
  descripcion: string,
  ubicacion?: UbicacionEspacioInput,
): Promise<{ success?: true; error?: string }> {
  const desc = descripcionEspacio(descripcion);
  const ubicacionCampos = ubicacion ? camposUbicacionEspacio(ubicacion) : null;

  if (!isOnline()) {
    const found = await findMasterItem<Espacio>("espacios", espacioId);
    if (!found) return { error: "Espacio no encontrado en caché local." };
    await upsertMasterItem("espacios", found.entidadId, {
      ...found.data,
      descripcion: desc.descripcion,
      ...(ubicacionCampos ?? {}),
      updated_at: new Date().toISOString(),
    });
    await enqueueOfflineOp("espacio:update", found.entidadId, {
      espacioId,
      descripcion: desc.descripcion,
      ...(ubicacionCampos ?? {}),
    });
    return { success: true };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("espacios")
    .update({
      descripcion: desc.descripcion,
      ...(ubicacionCampos ?? {}),
    })
    .eq("id", espacioId)
    .eq("activo", true);
  if (error) return { error: error.message };
  return { success: true };
}

export async function listEdificios(sedeId: string): Promise<Edificio[]> {
  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("edificios")
        .select("*")
        .eq("sede_id", sedeId)
        .eq("activo", true)
        .order("orden")
        .order("nombre");
      if (error) throw new Error(error.message);
      return (data ?? []) as Edificio[];
    } catch {
      /* caché */
    }
  }
  const sede = await findMasterItem<Sede>("sedes", sedeId);
  if (!sede) return [];
  const items = await listMasterDomain<Edificio>("edificios", sede.entidadId);
  return items
    .filter((e) => e.activo && e.sede_id === sedeId)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
}

export async function createEdificio(sedeId: string, nombre: string) {
  const trimmed = nombre.trim();
  if (!trimmed) return { error: "Nombre de edificio obligatorio." };

  if (!isOnline()) {
    const sede = await findMasterItem<Sede>("sedes", sedeId);
    if (!sede) return { error: "Sucursal no encontrada en caché local." };
    const existentes = await listEdificios(sedeId);
    if (existentes.some((e) => e.nombre.trim().toLowerCase() === trimmed.toLowerCase())) {
      return { error: "Ya existe un edificio con ese nombre en la sucursal." };
    }
    const now = new Date().toISOString();
    const edificio: Edificio = {
      id: newLocalId(),
      sede_id: sedeId,
      nombre: trimmed,
      orden: existentes.length,
      activo: true,
      created_at: now,
      updated_at: now,
    };
    await upsertMasterItem("edificios", sede.entidadId, edificio);
    const piso: Piso = {
      id: newLocalId(),
      edificio_id: edificio.id,
      numero: 1,
      created_at: now,
    };
    await upsertMasterItem("pisos", sede.entidadId, piso);
    await enqueueOfflineOp("edificio:create", sede.entidadId, {
      id: edificio.id,
      sedeId,
      nombre: trimmed,
    });
    return { success: true as const, data: edificio };
  }

  const supabase = getSupabaseClient();
  const { data: existentes } = await supabase
    .from("edificios")
    .select("nombre")
    .eq("sede_id", sedeId)
    .eq("activo", true);
  if ((existentes ?? []).some((e) => e.nombre.trim().toLowerCase() === trimmed.toLowerCase())) {
    return { error: "Ya existe un edificio con ese nombre en la sucursal." };
  }
  const { data, error } = await supabase
    .from("edificios")
    .insert({ sede_id: sedeId, nombre: trimmed })
    .select()
    .single();
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("duplicate") || msg.includes("idx_edificios_sede_nombre_activo")) {
      return { error: "Ya existe un edificio con ese nombre en la sucursal." };
    }
    return { error: error.message };
  }
  return { success: true as const, data: data as Edificio };
}

export async function listPisos(sedeId: string): Promise<Piso[]> {
  if (isOnline()) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("pisos")
        .select("*, edificios!inner(sede_id)")
        .eq("edificios.sede_id", sedeId)
        .order("numero");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => {
        const { edificios: _, ...piso } = row;
        return piso as Piso;
      });
    } catch {
      /* caché */
    }
  }
  const sede = await findMasterItem<Sede>("sedes", sedeId);
  if (!sede) return [];
  const items = await listMasterDomain<Piso>("pisos", sede.entidadId);
  const edificios = await listMasterDomain<Edificio>("edificios", sede.entidadId);
  const ids = new Set(edificios.filter((e) => e.sede_id === sedeId).map((e) => e.id));
  return items
    .filter((p) => ids.has(p.edificio_id))
    .sort((a, b) => a.numero - b.numero);
}

export async function createPiso(edificioId: string) {
  if (!isOnline()) {
    const found = await findMasterItem<Edificio>("edificios", edificioId);
    if (!found) return { error: "El edificio no existe en la caché local." };
    const sede = await findMasterItem<Sede>("sedes", found.sede_id);
    if (!sede) return { error: "Sucursal no encontrada en caché local." };
    const pisos = (await listMasterDomain<Piso>("pisos", sede.entidadId)).filter(
      (p) => p.edificio_id === edificioId,
    );
    const numero = pisos.length === 0 ? 1 : Math.max(...pisos.map((p) => p.numero)) + 1;
    const piso: Piso = {
      id: newLocalId(),
      edificio_id: edificioId,
      numero,
      created_at: new Date().toISOString(),
    };
    await upsertMasterItem("pisos", sede.entidadId, piso);
    await enqueueOfflineOp("piso:create", sede.entidadId, {
      id: piso.id,
      edificioId,
      numero,
    });
    return { success: true as const, numero };
  }

  const supabase = getSupabaseClient();
  const { data: rows, error: listError } = await supabase
    .from("pisos")
    .select("numero")
    .eq("edificio_id", edificioId);
  if (listError) return { error: listError.message };
  const numero = (rows ?? []).length === 0 ? 1 : Math.max(...(rows ?? []).map((p) => p.numero)) + 1;
  const { error } = await supabase.from("pisos").insert({ edificio_id: edificioId, numero });
  if (error) return { error: error.message };
  return { success: true as const, numero };
}
