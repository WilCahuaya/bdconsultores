import {
  MAX_ACTIVOS_SIMILARES_CANTIDAD,
  applyCuentaContableToPayloadIfProvided,
  attachCatalogoNacionalPorCodigo,
  codigoBarrasLookupVariants,
  resolveCuentaContableActivo,
  type ActivosSimilaresPreview,
  type CreateActivosSimilaresResult,
  type EjemplaresSimilaresResumen,
  type UpdateActivosSimilaresInput,
  type UpdateActivosSimilaresResult,
  type PreviewDeleteActivosPorCodigosResult,
  type DeleteActivosPorCodigosResult,
  type DeleteActivosPreregistradosResult,
  type ActivoEliminarPreviewItem,
  type ActivoEliminarNoElegibleItem,
  MAX_ELIMINAR_ACTIVOS_PREREGISTRADOS_POR_LOTE,
  MAX_ELIMINAR_ACTIVOS_POR_CODIGOS,
  parseCodigosBarrasInputDetailed,
  matchesCodigoBarrasQuery,
} from "@inventario/types";
import type { Activo, CategoriaBien, EstadoBien, EstadoRegistro } from "@inventario/types";
import { fetchProfile } from "./profile";
import { getSupabaseClient } from "./supabase";
import { removeActivoStoragePaths } from "./storage";
import { enqueueOfflineOp, findMasterItem, isOnline } from "./master-cache";
import type { AmbienteConSede } from "./ubicacion";

async function findCachedActivoAcrossEntidades(
  activoId: string,
): Promise<{ entidadId: string; activo: ActivoConUbicacion } | null> {
  const { listMasterDomain } = await import("./master-cache");
  const { listCachedActivos } = await import("./offline");
  const entidades = await listMasterDomain<{ id: string }>("entidades", "");
  for (const e of entidades) {
    const cached = await listCachedActivos(e.id);
    const found = cached.find((a) => a.id === activoId);
    if (found) return { entidadId: e.id, activo: found };
  }
  return null;
}

function mergeObservacionAdmin(existing: string | null, admin: string | null): string | null {
  const sep = "\n---ADMIN---\n";
  const adminTrimmed = admin?.trim() || null;

  if (!existing?.trim()) {
    return adminTrimmed ? sep + adminTrimmed : null;
  }

  const sepIndex = existing.indexOf(sep);
  const contador = sepIndex === 0 ? "" : sepIndex > 0 ? existing.slice(0, sepIndex).trim() : existing.trim();

  if (!adminTrimmed) return contador || null;
  if (!contador) return sep + adminTrimmed;
  return contador + sep + adminTrimmed;
}

export type ActivoConUbicacion = Activo & {
  entidad_nombre?: string;
  sede_nombre?: string;
  ambiente_nombre?: string;
  posible_ambiente_nombre?: string;
  posible_sede_nombre?: string;
  posible_sede_id?: string | null;
  cuenta_codigo?: string | null;
  contabilidad?: string | null;
  catalogo_grupo?: string | null;
  catalogo_clase?: string | null;
};

const POSIBLE_AMBIENTE_SELECT = "posible_ambiente:posible_ambiente_id(nombre, sede_id)";

const ACTIVO_SELECT_SIN_ENTIDAD =
  `*, sedes:sede_id(nombre), ambientes:ambiente_id(nombre), ${POSIBLE_AMBIENTE_SELECT}`;

const ACTIVO_SELECT_GLOBAL =
  `*, entidades(nombre), sedes:sede_id(nombre), ambientes:ambiente_id(nombre), ${POSIBLE_AMBIENTE_SELECT}`;

export interface CreateActivoInput {
  entidad_id: string;
  codigo_catalogo: string;
  nombre: string;
  nombre_etiqueta?: string | null;
  descripcion?: string;
  caracteristicas?: string;
  categoria?: CategoriaBien;
  estado_bien?: EstadoBien | null;
  marca?: string;
  modelo?: string;
  serie?: string;
  color?: string;
  medidas?: string;
  depreciacion?: string;
  observacion?: string;
  valor_adquisicion?: number;
  valor_es_mercado?: boolean;
  fecha_adquisicion?: string;
  fecha_inicio_depreciacion?: string;
  incremento_detalle?: string | null;
  valor_incremento?: number | null;
  vida_util_meses?: number;
  comprobante_serie?: string;
  cuenta_contable_codigo?: string | null;
  cuenta_contable_nombre?: string | null;
  sede_id?: string;
  ambiente_id?: string;
  posible_ambiente_id?: string | null;
  estado_registro?: EstadoRegistro;
}

export type UpdateActivoInput = Omit<CreateActivoInput, "entidad_id">;

function mapActivoRow(row: Record<string, unknown>): ActivoConUbicacion {
  const entidades = row.entidades as { nombre: string } | null;
  const sedes = row.sedes as { nombre: string } | null;
  const ambientes = row.ambientes as { nombre: string } | null;
  const posibleAmbiente = row.posible_ambiente as {
    nombre: string;
    sede_id?: string;
  } | null;
  const catalogo = row.catalogo_nacional as
    | {
        cuenta_codigo: string | null;
        contabilidad: string | null;
        grupo: string | null;
        clase: string | null;
      }
    | null
    | Array<{
        cuenta_codigo: string | null;
        contabilidad: string | null;
        grupo: string | null;
        clase: string | null;
      }>;
  const cat = Array.isArray(catalogo) ? catalogo[0] : catalogo;
  const { entidades: _e, sedes: _s, ambientes: _a, posible_ambiente: _p, catalogo_nacional: _c, ...activo } =
    row;
  const activoBase = activo as unknown as Activo;
  const cuenta = resolveCuentaContableActivo(activoBase, cat);
  return {
    ...activoBase,
    entidad_nombre: entidades?.nombre,
    sede_nombre: sedes?.nombre,
    ambiente_nombre: ambientes?.nombre,
    posible_ambiente_nombre: posibleAmbiente?.nombre,
    posible_sede_nombre: undefined,
    posible_sede_id: posibleAmbiente?.sede_id ?? null,
    cuenta_codigo: cuenta.cuenta_codigo,
    contabilidad: cuenta.contabilidad,
    catalogo_grupo: cat?.grupo?.trim() || null,
    catalogo_clase: cat?.clase?.trim() || null,
  };
}

export async function previewCodigoBarras(
  entidadId: string,
  codigoCatalogo: string,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("preview_codigo_barras", {
    p_entidad_id: entidadId,
    p_catalogo: codigoCatalogo.trim(),
  });
  if (error) return null;
  return data as string;
}

export async function findActivoByCodigo(
  codigo: string,
  entidadId: string,
  options?: { allowCache?: boolean },
): Promise<ActivoConUbicacion | null> {
  const variants = codigoBarrasLookupVariants(codigo);
  if (variants.length === 0) return null;

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (online) {
    try {
      const supabase = getSupabaseClient();
      const orFilter = variants
        .flatMap((variant) => [`codigo_barras.eq.${variant}`, `codigo_catalogo.eq.${variant}`])
        .join(",");

      const { data, error } = await supabase
        .from("activos")
        .select(ACTIVO_SELECT_SIN_ENTIDAD)
        .eq("entidad_id", entidadId)
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (data) {
        const [hydrated] =
          (await attachCatalogoNacionalPorCodigo(supabase, [
            data as Record<string, unknown>,
          ])) ?? [];
        const mapped = mapActivoRow(hydrated ?? (data as Record<string, unknown>));
        const { upsertCachedActivo } = await import("./offline");
        await upsertCachedActivo(entidadId, mapped);
        return mapped;
      }
    } catch {
      /* intentar caché local */
    }
  }

  if (options?.allowCache !== false && window.electronAPI?.offlineCacheFind) {
    const { findCachedActivo } = await import("./offline");
    for (const variant of variants) {
      const cached = await findCachedActivo(entidadId, variant);
      if (cached) return cached;
    }
    return null;
  }

  return null;
}

export async function listActivosForEntidad(entidadId: string): Promise<ActivoConUbicacion[]> {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (online) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("activos")
        .select(ACTIVO_SELECT_SIN_ENTIDAD)
        .eq("entidad_id", entidadId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const mapped = await mapActivoRowsEnriched(data as Record<string, unknown>[]);
      const { listCachedActivos, refreshActivosCache } = await import("./offline");
      const cached = await listCachedActivos(entidadId);
      const pendingLocal = cached.filter((a) => String(a.id).startsWith("pending-"));
      const remoteIds = new Set(mapped.map((a) => a.id));
      const merged = [
        ...pendingLocal.filter((p) => !remoteIds.has(p.id)),
        ...mapped,
      ];
      await refreshActivosCache(entidadId, merged);
      return merged;
    } catch {
      /* caché */
    }
  }
  const { listCachedActivos } = await import("./offline");
  return listCachedActivos(entidadId);
}

export async function listActivosPorAmbiente(ambienteId: string): Promise<ActivoConUbicacion[]> {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (online) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("activos")
        .select(ACTIVO_SELECT_SIN_ENTIDAD)
        .eq("ambiente_id", ambienteId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return mapActivoRowsEnriched(data as Record<string, unknown>[]);
    } catch {
      /* caché */
    }
  }
  const { findMasterItem } = await import("./master-cache");
  const { listCachedActivos } = await import("./offline");
  const found = await findMasterItem("ambientes", ambienteId);
  if (!found) return [];
  const cached = await listCachedActivos(found.entidadId);
  return cached.filter((a) => a.ambiente_id === ambienteId);
}

export async function listActivosGlobal(): Promise<ActivoConUbicacion[]> {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (online) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("activos")
        .select(ACTIVO_SELECT_GLOBAL)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return mapActivoRowsEnriched(data as Record<string, unknown>[]);
    } catch {
      /* caché */
    }
  }
  const { listMasterDomain } = await import("./master-cache");
  const { listCachedActivos } = await import("./offline");
  const entidades = await listMasterDomain<{ id: string }>("entidades", "");
  const all: ActivoConUbicacion[] = [];
  for (const e of entidades) {
    all.push(...(await listCachedActivos(e.id)));
  }
  return all;
}

function mapActivoRows(data: Record<string, unknown>[] | null): ActivoConUbicacion[] {
  return (data ?? []).map((row) => mapActivoRow(row));
}

async function enrichPosibleSedeNombres(
  rows: ActivoConUbicacion[],
): Promise<ActivoConUbicacion[]> {
  const sedeIds = [
    ...new Set(
      rows
        .map((r) => r.posible_sede_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (sedeIds.length === 0) return rows;

  const supabase = getSupabaseClient();
  const { data } = await supabase.from("sedes").select("id, nombre").in("id", sedeIds);
  const nombreById = new Map((data ?? []).map((s) => [s.id as string, s.nombre as string]));

  return rows.map((row) => {
    if (!row.posible_sede_id) return row;
    const sedeNombre = nombreById.get(row.posible_sede_id);
    if (!sedeNombre) return row;
    return { ...row, posible_sede_nombre: sedeNombre };
  });
}

async function mapActivoRowsEnriched(
  data: Record<string, unknown>[] | null,
): Promise<ActivoConUbicacion[]> {
  const conCatalogo = await attachCatalogoNacionalPorCodigo(getSupabaseClient(), data);
  return enrichPosibleSedeNombres(mapActivoRows(conCatalogo));
}

export async function getActivoById(activoId: string): Promise<ActivoConUbicacion | null> {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (online) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("activos")
        .select(ACTIVO_SELECT_SIN_ENTIDAD)
        .eq("id", activoId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;
      const [hydrated] =
        (await attachCatalogoNacionalPorCodigo(supabase, [
          data as Record<string, unknown>,
        ])) ?? [];
      const mapped = mapActivoRow(hydrated ?? (data as Record<string, unknown>));
      const [enriched] = await enrichPosibleSedeNombres([mapped]);
      return enriched ?? mapped;
    } catch {
      /* caché */
    }
  }

  const found = await findCachedActivoAcrossEntidades(activoId);
  return found?.activo ?? null;
}

export async function createActivo(
  input: CreateActivoInput,
): Promise<{ data?: Activo; error?: string }> {
  const supabase = getSupabaseClient();

  // Con sede+ambiente se registra; sin ellos (o estado explícito) queda preregistro.
  const tieneUbicacion = Boolean(input.sede_id && input.ambiente_id);
  const esPreregistro =
    input.estado_registro === "PREREGISTRADO" ||
    (input.estado_registro !== "REGISTRADO" && !tieneUbicacion);

  let responsable: string | null = null;
  const ambienteResponsableId = esPreregistro ? input.posible_ambiente_id : input.ambiente_id;
  if (ambienteResponsableId) {
    const { data: ambiente } = await supabase
      .from("ambientes")
      .select("responsable")
      .eq("id", ambienteResponsableId)
      .maybeSingle();
    responsable = ambiente?.responsable?.trim() || null;
  }

  const payload: Record<string, unknown> = {
    entidad_id: input.entidad_id,
    codigo_catalogo: input.codigo_catalogo.trim(),
    nombre: input.nombre.trim(),
    nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
    descripcion: input.descripcion?.trim() || null,
    caracteristicas: input.caracteristicas?.trim() || null,
    categoria: input.categoria ?? "ACTIVO",
    estado_bien: input.estado_bien ?? null,
    marca: input.marca?.trim() || null,
    modelo: input.modelo?.trim() || null,
    serie: input.serie?.trim() || null,
    color: input.color?.trim() || null,
    medidas: input.medidas?.trim() || null,
    depreciacion: input.depreciacion?.trim() || null,
    observacion: input.observacion?.trim() || null,
    responsable,
    valor_adquisicion: input.valor_adquisicion ?? null,
    valor_es_mercado: input.valor_es_mercado ?? false,
    fecha_adquisicion: input.fecha_adquisicion || null,
    fecha_inicio_depreciacion: input.fecha_inicio_depreciacion || null,
    incremento_detalle: input.incremento_detalle?.trim() || null,
    valor_incremento: input.valor_incremento ?? null,
    vida_util_meses: input.vida_util_meses ?? null,
    comprobante_serie: input.comprobante_serie?.trim() || null,
  };

  let payloadFinal = applyCuentaContableToPayloadIfProvided(payload, input);

  if (esPreregistro) {
    payloadFinal.posible_ambiente_id = input.posible_ambiente_id || null;
    payloadFinal.estado_registro = "PREREGISTRADO";
  } else {
    payloadFinal.estado_registro = "REGISTRADO";
    payloadFinal.sede_id = input.sede_id || null;
    payloadFinal.ambiente_id = input.ambiente_id || null;
    if (!payloadFinal.sede_id || !payloadFinal.ambiente_id) {
      return { error: "Seleccione sede y ambiente para registrar el activo." };
    }
  }

  if (!payloadFinal.codigo_catalogo || !payloadFinal.nombre) {
    return { error: "Código catálogo y nombre son obligatorios." };
  }

  const { data, error } = await supabase.from("activos").insert(payloadFinal).select().single();
  if (error) return { error: error.message };
  return { data: data as Activo };
}

export async function updateActivo(
  activoId: string,
  input: UpdateActivoInput,
): Promise<{ data?: Activo; error?: string }> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from("activos")
    .select("ambiente_id, estado_registro, posible_ambiente_id")
    .eq("id", activoId)
    .maybeSingle();

  const esPreregistro = existing?.estado_registro === "PREREGISTRADO";
  const ambienteId = input.ambiente_id ?? existing?.ambiente_id;
  const responsableAmbienteId = esPreregistro
    ? input.posible_ambiente_id ?? existing?.posible_ambiente_id
    : ambienteId;
  let responsable: string | null = null;
  if (responsableAmbienteId) {
    const { data: ambiente } = await supabase
      .from("ambientes")
      .select("responsable")
      .eq("id", responsableAmbienteId)
      .maybeSingle();
    responsable = ambiente?.responsable?.trim() || null;
  }

  const payload: Record<string, unknown> = {
    codigo_catalogo: input.codigo_catalogo.trim(),
    nombre: input.nombre.trim(),
    nombre_etiqueta: input.nombre_etiqueta?.trim() || null,
    descripcion: input.descripcion?.trim() || null,
    caracteristicas: input.caracteristicas?.trim() || null,
    categoria: input.categoria ?? "ACTIVO",
    estado_bien: input.estado_bien ?? null,
    marca: input.marca?.trim() || null,
    modelo: input.modelo?.trim() || null,
    serie: input.serie?.trim() || null,
    color: input.color?.trim() || null,
    medidas: input.medidas?.trim() || null,
    depreciacion: input.depreciacion?.trim() || null,
    observacion: input.observacion?.trim() || null,
    responsable,
    valor_adquisicion: input.valor_adquisicion ?? null,
    valor_es_mercado: input.valor_es_mercado ?? false,
    fecha_adquisicion: input.fecha_adquisicion || null,
    fecha_inicio_depreciacion: input.fecha_inicio_depreciacion || null,
    incremento_detalle: input.incremento_detalle?.trim() || null,
    valor_incremento: input.valor_incremento ?? null,
    vida_util_meses: input.vida_util_meses ?? null,
    comprobante_serie: input.comprobante_serie?.trim() || null,
  };

  const payloadFinal = applyCuentaContableToPayloadIfProvided(payload, input);

  if (esPreregistro) {
    payloadFinal.posible_ambiente_id = input.posible_ambiente_id ?? null;
  } else {
    payloadFinal.sede_id = input.sede_id || null;
    payloadFinal.ambiente_id = ambienteId;
  }

  if (!payloadFinal.codigo_catalogo || !payloadFinal.nombre) {
    return { error: "Código catálogo y nombre son obligatorios." };
  }

  const { data, error } = await supabase
    .from("activos")
    .update(payloadFinal)
    .eq("id", activoId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as Activo };
}

export async function cambiarUbicacionActivo(
  activoId: string,
  sedeId: string,
  ambienteId: string,
): Promise<{ data?: ActivoConUbicacion; error?: string }> {
  if (!sedeId || !ambienteId) return { error: "Seleccione sede y ambiente." };

  if (!isOnline()) {
    const found = await findCachedActivoAcrossEntidades(activoId);
    if (!found) return { error: "Activo no encontrado en caché local." };
    const { entidadId, activo } = found;

    if (activo.estado_registro === "DADO_DE_BAJA") {
      return { error: "No se puede mover un activo dado de baja." };
    }

    const ambiente = await findMasterItem<AmbienteConSede>("ambientes", ambienteId);
    if (!ambiente || ambiente.data.sede_id !== sedeId) {
      return { error: "El ambiente no pertenece a la sede seleccionada." };
    }

    const { upsertCachedActivo } = await import("./offline");
    const updated: ActivoConUbicacion = {
      ...activo,
      sede_id: sedeId,
      ambiente_id: ambienteId,
      responsable: ambiente.data.responsable?.trim() || null,
      sede_nombre: ambiente.data.sede_nombre,
      ambiente_nombre: ambiente.data.nombre,
      updated_at: new Date().toISOString(),
    };
    await upsertCachedActivo(entidadId, updated);
    await enqueueOfflineOp(
      "activo:cambiarUbicacion",
      entidadId,
      { activoId, sedeId, ambienteId },
      activoId,
    );
    return { data: updated };
  }

  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };

  const supabase = getSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from("activos")
    .select("entidad_id, ambiente_id, estado_registro")
    .eq("id", activoId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Activo no encontrado." };
  }

  if (existing.estado_registro === "DADO_DE_BAJA") {
    return { error: "No se puede mover un activo dado de baja." };
  }

  if (profile.rol !== "CONTADOR") {
    return { error: "No autorizado." };
  }

  const { data: sede } = await supabase
    .from("sedes")
    .select("entidad_id")
    .eq("id", sedeId)
    .maybeSingle();

  if (!sede || sede.entidad_id !== existing.entidad_id) {
    return { error: "La sede seleccionada no pertenece a la entidad del activo." };
  }

  const { data: ambiente } = await supabase
    .from("ambientes")
    .select("sede_id, responsable")
    .eq("id", ambienteId)
    .eq("activo", true)
    .maybeSingle();

  if (!ambiente || ambiente.sede_id !== sedeId) {
    return { error: "El ambiente no pertenece a la sede seleccionada." };
  }

  const responsable = ambiente.responsable?.trim() || null;

  const { error } = await supabase
    .from("activos")
    .update({
      sede_id: sedeId,
      ambiente_id: ambienteId,
      responsable,
      updated_by: profile.id,
    })
    .eq("id", activoId);

  if (error) return { error: error.message };

  const activo = await getActivoById(activoId);
  if (!activo) return { error: "Activo no encontrado tras actualizar." };

  const { upsertCachedActivo } = await import("./offline");
  const ambienteMaster = await findMasterItem<AmbienteConSede>("ambientes", ambienteId);
  const updated: ActivoConUbicacion = {
    ...activo,
    sede_nombre: ambienteMaster?.data.sede_nombre ?? activo.sede_nombre,
    ambiente_nombre: ambienteMaster?.data.nombre ?? activo.ambiente_nombre,
  };
  await upsertCachedActivo(existing.entidad_id, updated);
  return { data: updated };
}

export async function darDeBajaActivo(
  activoId: string,
  motivo: string,
): Promise<{ data?: ActivoConUbicacion; error?: string }> {
  const motivoBaja = motivo.trim();
  if (!motivoBaja) return { error: "Indique el motivo de baja." };

  if (!isOnline()) {
    const found = await findCachedActivoAcrossEntidades(activoId);
    if (!found) return { error: "Activo no encontrado en caché local." };
    const { entidadId, activo } = found;

    if (activo.estado_registro === "DADO_DE_BAJA") {
      return { error: "El activo ya está inactivo." };
    }
    if (activo.estado_registro === "PREREGISTRADO") {
      return { error: "Un bien preregistrado no puede darse de baja. Elimínelo si fue un error." };
    }

    const { upsertCachedActivo } = await import("./offline");
    const updated: ActivoConUbicacion = {
      ...activo,
      estado_registro: "DADO_DE_BAJA" as EstadoRegistro,
      motivo_baja: motivoBaja,
      updated_at: new Date().toISOString(),
    };
    await upsertCachedActivo(entidadId, updated);
    await enqueueOfflineOp("activo:baja", entidadId, { activoId, motivo: motivoBaja }, activoId);
    return { data: updated };
  }

  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") {
    return { error: "Solo el contador puede dar de baja activos." };
  }

  const supabase = getSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from("activos")
    .select("entidad_id, ambiente_id, estado_registro")
    .eq("id", activoId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Activo no encontrado." };
  }

  if (existing.estado_registro === "DADO_DE_BAJA") {
    return { error: "El activo ya está inactivo." };
  }

  if (existing.estado_registro === "PREREGISTRADO") {
    return { error: "Un bien preregistrado no puede darse de baja. Elimínelo si fue un error." };
  }

  const { error } = await supabase
    .from("activos")
    .update({
      estado_registro: "DADO_DE_BAJA" as EstadoRegistro,
      motivo_baja: motivoBaja,
      updated_by: profile.id,
    })
    .eq("id", activoId);

  if (error) return { error: error.message };

  const activo = await getActivoById(activoId);
  if (!activo) return { error: "Activo no encontrado tras dar de baja." };
  return { data: activo };
}

export async function recuperarActivo(
  activoId: string,
): Promise<{ data?: ActivoConUbicacion; error?: string }> {
  if (!isOnline()) {
    const found = await findCachedActivoAcrossEntidades(activoId);
    if (!found) return { error: "Activo no encontrado en caché local." };
    const { entidadId, activo } = found;

    if (activo.estado_registro !== "DADO_DE_BAJA") {
      return { error: "El activo no está dado de baja." };
    }

    const nuevoEstado: EstadoRegistro = activo.codigo_barras?.trim()
      ? "REGISTRADO"
      : "PREREGISTRADO";

    const { upsertCachedActivo } = await import("./offline");
    const updated: ActivoConUbicacion = {
      ...activo,
      estado_registro: nuevoEstado,
      motivo_baja: null,
      updated_at: new Date().toISOString(),
    };
    await upsertCachedActivo(entidadId, updated);
    await enqueueOfflineOp("activo:recuperar", entidadId, { activoId }, activoId);
    return { data: updated };
  }

  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") {
    return { error: "Solo el contador puede recuperar activos dados de baja." };
  }

  const supabase = getSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from("activos")
    .select("estado_registro, codigo_barras")
    .eq("id", activoId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Activo no encontrado." };
  }

  if (existing.estado_registro !== "DADO_DE_BAJA") {
    return { error: "El activo no está dado de baja." };
  }

  const nuevoEstado: EstadoRegistro = existing.codigo_barras?.trim()
    ? "REGISTRADO"
    : "PREREGISTRADO";

  const { error } = await supabase
    .from("activos")
    .update({
      estado_registro: nuevoEstado,
      motivo_baja: null,
      updated_by: profile.id,
    })
    .eq("id", activoId);

  if (error) return { error: error.message };

  const activo = await getActivoById(activoId);
  if (!activo) return { error: "Activo no encontrado tras recuperar." };
  return { data: activo };
}

export async function registrarActivo(
  activoId: string,
  destino: { sedeId: string; ambienteId: string },
): Promise<{ data?: ActivoConUbicacion; error?: string }> {
  if (!destino.sedeId || !destino.ambienteId) {
    return { error: "Seleccione sede y ambiente destino." };
  }

  if (!isOnline()) {
    const found = await findCachedActivoAcrossEntidades(activoId);
    if (!found) return { error: "Activo no encontrado en caché local." };
    const { entidadId, activo } = found;

    if (activo.estado_registro !== "PREREGISTRADO") {
      return { error: "El activo no está en preregistro." };
    }

    const ambiente = await findMasterItem<AmbienteConSede>("ambientes", destino.ambienteId);
    if (!ambiente || ambiente.data.sede_id !== destino.sedeId) {
      return { error: "El ambiente no pertenece a la sede seleccionada." };
    }
    if (ambiente.data.es_preregistro) {
      return { error: "Seleccione un ambiente real, no el de preregistros." };
    }

    const { upsertCachedActivo } = await import("./offline");
    const updated: ActivoConUbicacion = {
      ...activo,
      estado_registro: "REGISTRADO",
      sede_id: destino.sedeId,
      ambiente_id: destino.ambienteId,
      posible_ambiente_id: null,
      responsable: ambiente.data.responsable?.trim() || null,
      sede_nombre: ambiente.data.sede_nombre,
      ambiente_nombre: ambiente.data.nombre,
      updated_at: new Date().toISOString(),
    };
    await upsertCachedActivo(entidadId, updated);
    await enqueueOfflineOp(
      "activo:validarPreregistro",
      entidadId,
      { activoId, sedeId: destino.sedeId, ambienteId: destino.ambienteId },
      activoId,
    );
    return { data: updated };
  }

  const supabase = getSupabaseClient();

  const { data: ambienteDestino } = await supabase
    .from("ambientes")
    .select("id, sede_id, es_preregistro, responsable")
    .eq("id", destino.ambienteId)
    .maybeSingle();

  if (!ambienteDestino || ambienteDestino.sede_id !== destino.sedeId) {
    return { error: "El ambiente no pertenece a la sede seleccionada." };
  }
  if (ambienteDestino.es_preregistro) {
    return { error: "Seleccione un ambiente real, no el de preregistros." };
  }

  const { error } = await supabase
    .from("activos")
    .update({
      estado_registro: "REGISTRADO",
      sede_id: destino.sedeId,
      ambiente_id: destino.ambienteId,
      posible_ambiente_id: null,
      responsable: ambienteDestino.responsable?.trim() || null,
    })
    .eq("id", activoId)
    .eq("estado_registro", "PREREGISTRADO");

  if (error) return { error: error.message };

  const activo = await getActivoById(activoId);
  if (!activo) return { error: "Activo no encontrado tras validar." };

  const { upsertCachedActivo } = await import("./offline");
  const ambiente = await findMasterItem<AmbienteConSede>("ambientes", destino.ambienteId);
  const updated: ActivoConUbicacion = {
    ...activo,
    sede_nombre: ambiente?.data.sede_nombre ?? activo.sede_nombre,
    ambiente_nombre: ambiente?.data.nombre ?? activo.ambiente_nombre,
  };
  await upsertCachedActivo(activo.entidad_id, updated);
  return { data: updated };
}

export async function previewActivosSimilares(
  entidadId: string,
  codigoCatalogo: string,
  cantidad: number,
): Promise<ActivosSimilaresPreview | null> {
  const qty = Math.floor(cantidad);
  if (qty < 1 || qty > MAX_ACTIVOS_SIMILARES_CANTIDAD) return null;

  if (!isOnline()) {
    const { listCachedActivos } = await import("./offline");
    const cached = await listCachedActivos(entidadId);
    const template = cached.find(
      (a) =>
        a.codigo_catalogo.trim() === codigoCatalogo.trim() &&
        a.estado_registro !== "DADO_DE_BAJA",
    );
    if (!template) return null;
    return {
      es_registrado: template.estado_registro === "REGISTRADO",
      primer_codigo: null,
      ultimo_codigo: null,
    };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("preview_activos_similares_rango", {
    p_entidad_id: entidadId,
    p_catalogo: codigoCatalogo.trim(),
    p_cantidad: qty,
  });

  if (error) return null;
  const row = data as {
    es_registrado?: boolean;
    primer_codigo?: string | null;
    ultimo_codigo?: string | null;
  };
  return {
    es_registrado: Boolean(row.es_registrado),
    primer_codigo: row.primer_codigo ?? null,
    ultimo_codigo: row.ultimo_codigo ?? null,
  };
}

export type CreateActivosSimilaresUbicacion = {
  sedeId: string;
  ambienteId: string;
};

export async function createActivosSimilares(
  activoId: string,
  cantidad: number,
  ubicacion?: CreateActivosSimilaresUbicacion,
): Promise<{ data?: CreateActivosSimilaresResult; error?: string }> {
  const qty = Math.floor(cantidad);
  if (qty < 1 || qty > MAX_ACTIVOS_SIMILARES_CANTIDAD) {
    return { error: `La cantidad debe estar entre 1 y ${MAX_ACTIVOS_SIMILARES_CANTIDAD}.` };
  }

  if (!isOnline()) {
    const found = await findCachedActivoAcrossEntidades(activoId);
    if (!found) return { error: "Activo no encontrado en caché local." };
    const { entidadId, activo: template } = found;

    if (template.estado_registro === "DADO_DE_BAJA") {
      return { error: "No puede duplicar un activo dado de baja." };
    }

    let sedeId = ubicacion?.sedeId ?? template.sede_id ?? "";
    let ambienteId = ubicacion?.ambienteId ?? template.ambiente_id ?? "";
    let sedeNombre = template.sede_nombre;
    let ambienteNombre = template.ambiente_nombre;
    let responsable = template.responsable;

    if (ubicacion) {
      const ambiente = await findMasterItem<AmbienteConSede>("ambientes", ubicacion.ambienteId);
      if (!ambiente || ambiente.data.sede_id !== ubicacion.sedeId) {
        return { error: "El ambiente no pertenece a la sede seleccionada." };
      }
      sedeId = ubicacion.sedeId;
      ambienteId = ubicacion.ambienteId;
      sedeNombre = ambiente.data.sede_nombre;
      ambienteNombre = ambiente.data.nombre;
      responsable = ambiente.data.responsable?.trim() || null;
    }

    if (template.estado_registro === "REGISTRADO" && (!sedeId || !ambienteId)) {
      return { error: "Seleccione sede y ambiente para las copias." };
    }

    const { enqueueOfflineCreate, upsertCachedActivo } = await import("./offline");
    const now = new Date().toISOString();
    const esPreregistro = template.estado_registro === "PREREGISTRADO";

    for (let i = 0; i < qty; i++) {
      const localId = `pending-${crypto.randomUUID()}`;
      const localActivo: ActivoConUbicacion = {
        ...template,
        id: localId,
        correlativo: null,
        codigo_barras: null,
        serie: null,
        foto_path: null,
        comprobante_path: null,
        sede_id: esPreregistro ? null : sedeId || null,
        ambiente_id: esPreregistro ? (template.ambiente_id ?? null) : ambienteId || null,
        posible_ambiente_id: esPreregistro
          ? (ubicacion?.ambienteId ?? template.posible_ambiente_id)
          : null,
        responsable: esPreregistro ? template.responsable : responsable,
        sede_nombre: esPreregistro ? template.sede_nombre : sedeNombre,
        ambiente_nombre: esPreregistro ? template.ambiente_nombre : ambienteNombre,
        created_at: now,
        updated_at: now,
        created_by: "",
        updated_by: null,
      };

      const input: CreateActivoInput = {
        entidad_id: entidadId,
        codigo_catalogo: template.codigo_catalogo,
        nombre: template.nombre,
        nombre_etiqueta: template.nombre_etiqueta,
        descripcion: template.descripcion ?? undefined,
        caracteristicas: template.caracteristicas ?? undefined,
        categoria: template.categoria,
        estado_bien: template.estado_bien,
        marca: template.marca ?? undefined,
        modelo: template.modelo ?? undefined,
        color: template.color ?? undefined,
        medidas: template.medidas ?? undefined,
        depreciacion: template.depreciacion ?? undefined,
        observacion: template.observacion ?? undefined,
        valor_adquisicion: template.valor_adquisicion ?? undefined,
        valor_es_mercado: template.valor_es_mercado ?? undefined,
        fecha_adquisicion: template.fecha_adquisicion ?? undefined,
        fecha_inicio_depreciacion: template.fecha_inicio_depreciacion ?? undefined,
        incremento_detalle: template.incremento_detalle ?? undefined,
        valor_incremento: template.valor_incremento ?? undefined,
        vida_util_meses: template.vida_util_meses ?? undefined,
        comprobante_serie: template.comprobante_serie ?? undefined,
        cuenta_contable_codigo: template.cuenta_contable_codigo,
        cuenta_contable_nombre: template.cuenta_contable_nombre,
        estado_registro: template.estado_registro,
        ...(esPreregistro
          ? { posible_ambiente_id: localActivo.posible_ambiente_id }
          : { sede_id: sedeId, ambiente_id: ambienteId }),
      };

      await enqueueOfflineCreate(entidadId, { input, localActivo });
      await upsertCachedActivo(entidadId, localActivo);
    }

    return {
      data: {
        creados: qty,
        estado_registro: template.estado_registro,
        primer_codigo_barras: null,
        ultimo_codigo_barras: null,
      },
    };
  }

  const supabase = getSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from("activos")
    .select("estado_registro")
    .eq("id", activoId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Activo no encontrado." };
  }

  if (existing.estado_registro === "DADO_DE_BAJA") {
    return { error: "No puede duplicar un activo dado de baja." };
  }

  const rpcParams: {
    p_activo_id: string;
    p_cantidad: number;
    p_sede_id?: string;
    p_ambiente_id?: string;
  } = {
    p_activo_id: activoId,
    p_cantidad: qty,
  };
  if (ubicacion) {
    rpcParams.p_sede_id = ubicacion.sedeId;
    rpcParams.p_ambiente_id = ubicacion.ambienteId;
  }

  const { data, error } = await supabase.rpc("create_activos_similares", rpcParams);

  if (error) return { error: error.message };
  return { data: data as CreateActivosSimilaresResult };
}

export async function getEjemplaresSimilaresResumen(
  activoId: string,
): Promise<EjemplaresSimilaresResumen | null> {
  if (!isOnline()) {
    const found = await findCachedActivoAcrossEntidades(activoId);
    if (!found) return null;
    const { listCachedActivos } = await import("./offline");
    const cached = await listCachedActivos(found.entidadId);
    const similares = cached.filter((a) => activoEsSimilarLocal(a, found.activo));
    return {
      total: similares.length,
      registrados: similares.filter((a) => a.estado_registro === "REGISTRADO").length,
      preregistrados: similares.filter((a) => a.estado_registro === "PREREGISTRADO").length,
    };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("resumen_ejemplares_similares", {
    p_activo_id: activoId,
  });

  if (error) return null;
  const row = data as {
    total?: number;
    registrados?: number;
    preregistrados?: number;
  };
  return {
    total: row.total ?? 0,
    registrados: row.registrados ?? 0,
    preregistrados: row.preregistrados ?? 0,
  };
}

function buildActivosSimilaresPatch(
  input: UpdateActivosSimilaresInput,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      patch[key] = value;
    }
  }
  return patch;
}

/** Equivalente local de `public.activo_es_ejemplar_similar` (ver migraciones SQL). */
function activoEsSimilarLocal(a: ActivoConUbicacion, t: ActivoConUbicacion): boolean {
  const norm = (v?: string | null) => (v ?? "").trim();
  return (
    a.entidad_id === t.entidad_id &&
    (a.sede_id ?? null) === (t.sede_id ?? null) &&
    (a.ambiente_id ?? null) === (t.ambiente_id ?? null) &&
    a.codigo_catalogo === t.codigo_catalogo &&
    a.categoria === t.categoria &&
    norm(a.nombre) === norm(t.nombre) &&
    norm(a.marca) === norm(t.marca) &&
    norm(a.modelo) === norm(t.modelo) &&
    norm(a.color) === norm(t.color) &&
    norm(a.medidas) === norm(t.medidas) &&
    norm(a.caracteristicas) === norm(t.caracteristicas) &&
    (a.valor_adquisicion ?? null) === (t.valor_adquisicion ?? null) &&
    (a.valor_es_mercado ?? null) === (t.valor_es_mercado ?? null) &&
    (a.fecha_adquisicion ?? null) === (t.fecha_adquisicion ?? null) &&
    (a.fecha_inicio_depreciacion ?? null) === (t.fecha_inicio_depreciacion ?? null) &&
    norm(a.incremento_detalle) === norm(t.incremento_detalle) &&
    (a.valor_incremento ?? null) === (t.valor_incremento ?? null) &&
    norm(a.comprobante_serie) === norm(t.comprobante_serie) &&
    norm(a.depreciacion) === norm(t.depreciacion) &&
    a.estado_registro !== "DADO_DE_BAJA"
  );
}

/**
 * Aplica localmente (caché offline) el mismo patch que `update_activos_similares` aplicaría
 * en el servidor, para reflejar el cambio de inmediato en la UI. La sincronización posterior
 * reemplazará estos valores con el resultado autoritativo del servidor.
 */
export async function applyActivosSimilaresPatchLocal(
  entidadId: string,
  template: ActivoConUbicacion,
  input: UpdateActivosSimilaresInput,
): Promise<number> {
  const patch = buildActivosSimilaresPatch(input);
  if (Object.keys(patch).length === 0) return 0;

  const { listCachedActivos, upsertCachedActivo } = await import("./offline");

  let ambienteData: AmbienteConSede | null = null;
  if ("ambiente_id" in patch && patch.ambiente_id) {
    const found = await findMasterItem<AmbienteConSede>("ambientes", String(patch.ambiente_id));
    ambienteData = found?.data ?? null;
  }

  const cached = await listCachedActivos(entidadId);
  const similares = cached.filter((a) => activoEsSimilarLocal(a, template));
  const now = new Date().toISOString();

  for (const activo of similares) {
    const updated: ActivoConUbicacion = { ...activo, ...(patch as Partial<ActivoConUbicacion>), updated_at: now };

    if ("observacion_admin" in patch) {
      updated.observacion = mergeObservacionAdmin(
        activo.observacion,
        (patch.observacion_admin as string | null) ?? null,
      );
    }

    if ("ambiente_id" in patch) {
      if (ambienteData) {
        updated.sede_id = ambienteData.sede_id;
        updated.ambiente_id = ambienteData.id;
        updated.ambiente_nombre = ambienteData.nombre;
        updated.sede_nombre = ambienteData.sede_nombre;
        updated.responsable = ambienteData.responsable?.trim() || null;
      } else {
        updated.ambiente_id = null;
      }
    } else if ("sede_id" in patch) {
      updated.sede_id = (patch.sede_id as string | null) ?? null;
    }

    await upsertCachedActivo(entidadId, updated);
  }

  return similares.length;
}

export async function updateActivosSimilares(
  activoId: string,
  input: UpdateActivosSimilaresInput,
): Promise<{ data?: UpdateActivosSimilaresResult; error?: string }> {
  const patch = buildActivosSimilaresPatch(input);
  if (Object.keys(patch).length === 0) {
    return { error: "No hay cambios para aplicar." };
  }

  if (!isOnline()) {
    const found = await findCachedActivoAcrossEntidades(activoId);
    if (!found) return { error: "Activo no encontrado en caché local." };
    const { entidadId, activo } = found;
    await enqueueOfflineOp("activos:updateSimilares", entidadId, { activoId, patch }, activoId);
    const actualizados = await applyActivosSimilaresPatchLocal(entidadId, activo, input);
    return { data: { actualizados } };
  }

  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR" && profile.rol !== "ADMIN_ENTIDAD") {
    return { error: "No autorizado." };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("update_activos_similares", {
    p_activo_id: activoId,
    p_patch: patch,
  });

  if (error) return { error: error.message };
  const result = data as { actualizados?: number };
  return { data: { actualizados: result.actualizados ?? 0 } };
}

export async function listActivosSimilaresParaEtiquetas(
  activoId: string,
): Promise<ActivoConUbicacion[]> {
  const supabase = getSupabaseClient();
  const { data: ids, error: idsError } = await supabase.rpc("list_activos_similares_ids", {
    p_activo_id: activoId,
    p_solo_registrados: true,
  });

  if (idsError) throw new Error(idsError.message);
  const activoIds = (ids as string[] | null) ?? [];
  if (activoIds.length === 0) return [];

  const { data, error } = await supabase
    .from("activos")
    .select(ACTIVO_SELECT_GLOBAL)
    .in("id", activoIds)
    .order("correlativo", { ascending: true });

  if (error) throw new Error(error.message);
  return mapActivoRowsEnriched(data as Record<string, unknown>[]);
}

function mapPreviewDeleteActivos(data: unknown): PreviewDeleteActivosPorCodigosResult {
  const row = data as {
    solicitados?: number;
    encontrados?: PreviewDeleteActivosPorCodigosResult["encontrados"];
    no_encontrados?: string[];
    no_elegibles?: PreviewDeleteActivosPorCodigosResult["no_elegibles"];
  };
  return {
    solicitados: row.solicitados ?? 0,
    encontrados: row.encontrados ?? [],
    no_encontrados: row.no_encontrados ?? [],
    no_elegibles: row.no_elegibles ?? [],
  };
}

function findCachedActivoByCodigoBarras(
  cached: ActivoConUbicacion[],
  codigo: string,
): ActivoConUbicacion | null {
  return (
    cached.find((activo) => matchesCodigoBarrasQuery(codigo, activo.codigo_barras)) ?? null
  );
}

async function previewDeleteActivosPorCodigosOffline(
  entidadId: string,
  codigos: string[],
): Promise<PreviewDeleteActivosPorCodigosResult> {
  const { listCachedActivos } = await import("./offline");
  const cached = await listCachedActivos(entidadId);

  const encontrados: ActivoEliminarPreviewItem[] = [];
  const no_encontrados: string[] = [];
  const no_elegibles: ActivoEliminarNoElegibleItem[] = [];

  for (const codigo of codigos) {
    const activo = findCachedActivoByCodigoBarras(cached, codigo);
    if (!activo) {
      no_encontrados.push(codigo);
      continue;
    }

    if (activo.estado_registro !== "REGISTRADO") {
      no_elegibles.push({
        codigo_barras: codigo,
        estado_registro: activo.estado_registro,
        nombre: activo.nombre,
      });
      continue;
    }

    encontrados.push({
      id: activo.id,
      codigo_barras: activo.codigo_barras ?? codigo,
      nombre: activo.nombre,
      sede_nombre: activo.sede_nombre,
      ambiente_nombre: activo.ambiente_nombre,
    });
  }

  return {
    solicitados: codigos.length,
    encontrados,
    no_encontrados,
    no_elegibles,
  };
}

function parseDeleteActivosPorCodigosInput(
  entidadId: string,
  codigosText: string,
): { codigos?: string[]; error?: string } {
  if (!entidadId) return { error: "Seleccione la entidad." };

  const parsed = parseCodigosBarrasInputDetailed(codigosText);
  if (parsed.invalidos.length > 0) {
    return {
      error: `Formato inválido (nacional 12 dígitos / 8-4, o catálogo propio BD000001-0001): ${parsed.invalidos.join(", ")}`,
    };
  }
  const codigos = parsed.codigos;
  if (codigos.length === 0) return { error: "Indique al menos un código de barras." };
  if (codigos.length > MAX_ELIMINAR_ACTIVOS_POR_CODIGOS) {
    return { error: `Máximo ${MAX_ELIMINAR_ACTIVOS_POR_CODIGOS} códigos por operación.` };
  }
  return { codigos };
}

export async function previewDeleteActivosPorCodigos(
  entidadId: string,
  codigosText: string,
): Promise<{ data?: PreviewDeleteActivosPorCodigosResult; error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "Solo el contador puede eliminar activos." };

  const parsedInput = parseDeleteActivosPorCodigosInput(entidadId, codigosText);
  if (parsedInput.error) return { error: parsedInput.error };
  const codigos = parsedInput.codigos!;

  if (!isOnline()) {
    return { data: await previewDeleteActivosPorCodigosOffline(entidadId, codigos) };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("preview_delete_activos_por_codigos", {
    p_entidad_id: entidadId,
    p_codigos: codigos,
  });

  if (error) return { error: error.message };
  return { data: mapPreviewDeleteActivos(data) };
}

export async function deleteActivosPorCodigos(
  entidadId: string,
  codigosText: string,
): Promise<{ data?: DeleteActivosPorCodigosResult; error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "Solo el contador puede eliminar activos." };

  const parsedInput = parseDeleteActivosPorCodigosInput(entidadId, codigosText);
  if (parsedInput.error) return { error: parsedInput.error };
  const codigos = parsedInput.codigos!;

  if (!isOnline()) {
    const preview = await previewDeleteActivosPorCodigosOffline(entidadId, codigos);
    if (preview.no_encontrados.length > 0) {
      return { error: `Códigos no encontrados: ${preview.no_encontrados.join(", ")}` };
    }
    if (preview.no_elegibles.length > 0) {
      return {
        error: `Solo se pueden eliminar activos registrados. Revise: ${preview.no_elegibles
          .map((e) => `${e.codigo_barras} (${e.estado_registro})`)
          .join(", ")}`,
      };
    }
    if (preview.encontrados.length === 0) {
      return { error: "No hay activos elegibles para eliminar" };
    }

    const { listCachedActivos, removeCachedActivo } = await import("./offline");
    const cached = await listCachedActivos(entidadId);
    const fotoPaths: string[] = [];
    const comprobantePaths: string[] = [];
    const deletedCodigos: string[] = [];

    for (const item of preview.encontrados) {
      const activo = cached.find((a) => a.id === item.id);
      if (activo?.foto_path && !fotoPaths.includes(activo.foto_path)) {
        fotoPaths.push(activo.foto_path);
      }
      if (activo?.comprobante_path && !comprobantePaths.includes(activo.comprobante_path)) {
        comprobantePaths.push(activo.comprobante_path);
      }
      await removeCachedActivo(entidadId, item.id);
      deletedCodigos.push(item.codigo_barras);
    }

    await enqueueOfflineOp("activos:deletePorCodigos", entidadId, { codigos });

    return {
      data: {
        eliminados: preview.encontrados.length,
        codigos: deletedCodigos,
        foto_paths: fotoPaths,
        comprobante_paths: comprobantePaths,
      },
    };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("delete_activos_por_codigos", {
    p_entidad_id: entidadId,
    p_codigos: codigos,
  });

  if (error) return { error: error.message };

  const result = data as {
    eliminados?: number;
    codigos?: string[];
    foto_paths?: string[];
    comprobante_paths?: string[];
  };

  try {
    await removeActivoStoragePaths(
      (result.foto_paths as string[] | undefined) ?? [],
      (result.comprobante_paths as string[] | undefined) ?? [],
    );
  } catch {
    // La eliminación en BD ya se aplicó.
  }

  return {
    data: {
      eliminados: result.eliminados ?? 0,
      codigos: result.codigos ?? [],
      foto_paths: result.foto_paths ?? [],
      comprobante_paths: result.comprobante_paths ?? [],
    },
  };
}

export async function deleteActivosPreregistrados(
  entidadId: string,
  activoIds: string[],
): Promise<{ data?: DeleteActivosPreregistradosResult; error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR" && profile.rol !== "ADMIN_ENTIDAD") {
    return { error: "No autorizado." };
  }
  if (!entidadId) return { error: "Entidad no válida." };

  const uniqueIds = [...new Set(activoIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { error: "Seleccione al menos un preregistro." };

  if (profile.rol === "ADMIN_ENTIDAD" && profile.entidad_id !== entidadId) {
    return { error: "No autorizado." };
  }

  if (!isOnline()) {
    const { listCachedActivos, removeCachedActivo } = await import("./offline");
    const cached = await listCachedActivos(entidadId);
    const fotoPaths: string[] = [];
    const comprobantePaths: string[] = [];
    const deletedIds: string[] = [];

    for (const id of uniqueIds) {
      const activo = cached.find((a) => a.id === id);
      if (!activo) {
        return { error: "Uno o más activos no fueron encontrados" };
      }
      if (activo.estado_registro !== "PREREGISTRADO") {
        return {
          error: `Solo se pueden eliminar activos preregistrados (${activo.nombre}: ${activo.estado_registro})`,
        };
      }
      if (activo.foto_path && !fotoPaths.includes(activo.foto_path)) {
        fotoPaths.push(activo.foto_path);
      }
      if (activo.comprobante_path && !comprobantePaths.includes(activo.comprobante_path)) {
        comprobantePaths.push(activo.comprobante_path);
      }
      await removeCachedActivo(entidadId, id);
      deletedIds.push(id);
    }

    await enqueueOfflineOp("activos:deletePreregistrados", entidadId, { activoIds: uniqueIds });

    return {
      data: {
        eliminados: deletedIds.length,
        activo_ids: deletedIds,
        foto_paths: fotoPaths,
        comprobante_paths: comprobantePaths,
      },
    };
  }

  const supabase = getSupabaseClient();

  let eliminados = 0;
  const fotoPaths: string[] = [];
  const comprobantePaths: string[] = [];
  const deletedIds: string[] = [];

  for (let i = 0; i < uniqueIds.length; i += MAX_ELIMINAR_ACTIVOS_PREREGISTRADOS_POR_LOTE) {
    const chunk = uniqueIds.slice(i, i + MAX_ELIMINAR_ACTIVOS_PREREGISTRADOS_POR_LOTE);
    const { data, error } = await supabase.rpc("delete_activos_preregistrados", {
      p_entidad_id: entidadId,
      p_activo_ids: chunk,
    });
    if (error) return { error: error.message };

    const result = data as {
      eliminados?: number;
      activo_ids?: string[];
      foto_paths?: string[];
      comprobante_paths?: string[];
    };

    eliminados += result.eliminados ?? 0;
    deletedIds.push(...(result.activo_ids ?? []));
    for (const path of result.foto_paths ?? []) {
      if (path && !fotoPaths.includes(path)) fotoPaths.push(path);
    }
    for (const path of result.comprobante_paths ?? []) {
      if (path && !comprobantePaths.includes(path)) comprobantePaths.push(path);
    }
  }

  try {
    await removeActivoStoragePaths(fotoPaths, comprobantePaths);
  } catch {
    // La eliminación en BD ya se aplicó.
  }

  return {
    data: {
      eliminados,
      activo_ids: deletedIds,
      foto_paths: fotoPaths,
      comprobante_paths: comprobantePaths,
    },
  };
}

export async function deleteActivoPreregistrado(
  activoId: string,
): Promise<{ data?: DeleteActivosPreregistradosResult; error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };

  if (!isOnline()) {
    const found = await findCachedActivoAcrossEntidades(activoId);
    if (!found) return { error: "Activo no encontrado." };
    return deleteActivosPreregistrados(found.entidadId, [activoId]);
  }

  const supabase = getSupabaseClient();
  const { data: existing, error: fetchError } = await supabase
    .from("activos")
    .select("entidad_id")
    .eq("id", activoId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Activo no encontrado." };
  }

  return deleteActivosPreregistrados(existing.entidad_id, [activoId]);
}
