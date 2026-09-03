"use server";

import { revalidatePath } from "next/cache";
import type { Activo, CategoriaBien, EstadoBien, EstadoRegistro } from "@inventario/types";
import {
  MAX_ACTIVOS_SIMILARES_CANTIDAD,
  applyCuentaContableToPayloadIfProvided,
  resolveCuentaContableActivo,
  resolveObservacionAdmin,
  mergeObservacionActivo,
  splitObservacionActivo,
  type ActivosSimilaresPreview,
  type CreateActivosSimilaresResult,
  type EjemplaresSimilaresResumen,
  type UpdateActivosSimilaresInput,
  type UpdateActivosSimilaresResult,
  type PreviewDeleteActivosPorCodigosResult,
  type DeleteActivosPorCodigosResult,
  type DeleteActivosPreregistradosResult,
  MAX_ELIMINAR_ACTIVOS_PREREGISTRADOS_POR_LOTE,
  MAX_ELIMINAR_ACTIVOS_POR_CODIGOS,
  parseCodigosBarrasInputDetailed,
} from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { getProfile, requireProfile } from "@/lib/auth/profile";

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
  medida_largo?: number;
  medida_ancho?: number;
  medida_altura?: number;
  depreciacion?: string;
  observacion?: string;
  responsable?: string;
  valor_adquisicion?: number;
  valor_es_mercado?: boolean;
  fecha_adquisicion?: string;
  fecha_inicio_depreciacion?: string;
  incremento_detalle?: string | null;
  valor_incremento?: number | null;
  vida_util_meses?: number;
  sede_id?: string;
  ambiente_id?: string;
  posible_ambiente_id?: string | null;
  /** Solo contador: REGISTRADO = alta directa; omitir o PREREGISTRADO = preregistrar */
  estado_registro?: EstadoRegistro;
  comprobante_serie?: string;
  cuenta_contable_codigo?: string | null;
  cuenta_contable_nombre?: string | null;
  /** Admin en bien REGISTRADO: observación del administrador (reemplaza la anterior). */
  observacion_admin?: string;
}

export type UpdateActivoInput = Omit<CreateActivoInput, "entidad_id">;

export interface ListActivosFilters {
  entidadId?: string;
  sedeId?: string;
  ambienteId?: string;
  estadoRegistro?: EstadoRegistro;
}

export interface ActivoListRow {
  entidad_nombre?: string;
  sede_nombre?: string;
  ambiente_nombre?: string;
  posible_ambiente_nombre?: string;
  /** Sede del posible ambiente (sugerencia de preregistro). */
  posible_sede_nombre?: string;
  posible_sede_id?: string | null;
  cuenta_codigo?: string | null;
  contabilidad?: string | null;
  catalogo_grupo?: string | null;
  catalogo_clase?: string | null;
}

const CATALOGO_ACTIVO_SELECT =
  "catalogo_nacional:codigo_catalogo(cuenta_codigo, contabilidad, grupo, clase)";

const POSIBLE_AMBIENTE_SELECT = "posible_ambiente:posible_ambiente_id(nombre, sede_id)";

const ACTIVO_SELECT =
  `*, entidades(nombre), sedes:sede_id(nombre), ambientes:ambiente_id(nombre), ${POSIBLE_AMBIENTE_SELECT}, ${CATALOGO_ACTIVO_SELECT}`;

const ACTIVO_SELECT_SIN_ENTIDAD =
  `*, sedes:sede_id(nombre), ambientes:ambiente_id(nombre), ${POSIBLE_AMBIENTE_SELECT}, ${CATALOGO_ACTIVO_SELECT}`;

export async function previewCodigoBarras(entidadId: string, codigoCatalogo: string) {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_codigo_barras", {
    p_entidad_id: entidadId,
    p_catalogo: codigoCatalogo.trim(),
  });

  if (error) return null;
  return data as string;
}

export async function createActivo(input: CreateActivoInput) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };

  const supabase = await createClient();

  const esAdminEntidad = profile.rol === "ADMIN_ENTIDAD";
  const esPreregistro = esAdminEntidad || input.estado_registro !== "REGISTRADO";

  let responsable = input.responsable?.trim() || null;
  const ambienteResponsableId = esPreregistro
    ? input.posible_ambiente_id
    : input.ambiente_id;
  if (!responsable && ambienteResponsableId) {
    const { data: ambiente } = await supabase
      .from("ambientes")
      .select("responsable")
      .eq("id", ambienteResponsableId)
      .maybeSingle();
    responsable = ambiente?.responsable?.trim() || null;
  }

  let payload: Record<string, unknown> = {
    entidad_id: esAdminEntidad ? profile.entidad_id! : input.entidad_id,
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
    medida_largo: input.medida_largo ?? null,
    medida_ancho: input.medida_ancho ?? null,
    medida_altura: input.medida_altura ?? null,
    observacion: input.observacion?.trim() || null,
    responsable,
    valor_adquisicion: input.valor_adquisicion ?? null,
    valor_es_mercado: input.valor_es_mercado ?? false,
    fecha_adquisicion: input.fecha_adquisicion || null,
    fecha_inicio_depreciacion: input.fecha_inicio_depreciacion || null,
    incremento_detalle: input.incremento_detalle?.trim() || null,
    valor_incremento: input.valor_incremento ?? null,
  };

  if (esPreregistro) {
    payload.posible_ambiente_id = input.posible_ambiente_id || null;
    if (profile.rol === "CONTADOR") {
      payload.estado_registro = "PREREGISTRADO";
    }
  } else {
    payload.estado_registro = "REGISTRADO";
    payload.sede_id = input.sede_id || null;
    payload.ambiente_id = input.ambiente_id || null;
    if (!payload.sede_id || !payload.ambiente_id) {
      return { error: "Seleccione sede y ambiente para registrar el activo." };
    }
  }

  if (esAdminEntidad) {
    payload.depreciacion = null;
    payload.vida_util_meses = null;
  } else {
    payload.depreciacion = input.depreciacion?.trim() || null;
    payload.vida_util_meses = input.vida_util_meses ?? null;
  }
  const comprobanteSerie = input.comprobante_serie?.trim();
  if (comprobanteSerie) payload.comprobante_serie = comprobanteSerie;

  if (!esAdminEntidad) {
    payload = applyCuentaContableToPayloadIfProvided(payload, input);
  }

  if (!payload.codigo_catalogo || !payload.nombre) {
    return { error: "Código catálogo y nombre son obligatorios." };
  }

  const { data, error } = await supabase.from("activos").insert(payload).select().single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/contador/inventario");
  revalidatePath("/contador/entidades");
  if (payload.ambiente_id) {
    revalidatePath(`/contador/entidades/${payload.entidad_id}/ambientes/${payload.ambiente_id}`);
  }
  revalidatePath("/admin/activos");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
  if (payload.ambiente_id) {
    revalidatePath(`/admin/ambientes/${payload.ambiente_id}`);
  }
  return { success: true, data };
}

function revalidateActivoPaths(entidadId: string, ambienteId: string | null) {
  revalidatePath("/contador/inventario");
  revalidatePath("/contador/entidades");
  if (ambienteId) {
    revalidatePath(`/contador/entidades/${entidadId}/ambientes/${ambienteId}`);
    revalidatePath(`/admin/ambientes/${ambienteId}`);
  }
  revalidatePath("/admin/activos");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
}

export async function updateActivo(activoId: string, input: UpdateActivoInput) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("activos")
    .select("entidad_id, ambiente_id, posible_ambiente_id, estado_registro, estado_bien, observacion")
    .eq("id", activoId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Activo no encontrado." };
  }

  if (profile.rol === "ADMIN_ENTIDAD" && existing.entidad_id !== profile.entidad_id) {
    return { error: "No autorizado." };
  }

  const ambienteId = input.ambiente_id ?? existing.ambiente_id;
  let responsable: string | null = null;

  const responsableAmbienteId =
    profile.rol === "ADMIN_ENTIDAD" && existing.estado_registro === "PREREGISTRADO"
      ? input.posible_ambiente_id ?? existing.posible_ambiente_id
      : ambienteId;

  if (responsableAmbienteId) {
    const { data: ambiente } = await supabase
      .from("ambientes")
      .select("responsable")
      .eq("id", responsableAmbienteId)
      .maybeSingle();
    responsable = ambiente?.responsable?.trim() || null;
  }

  let payload: Record<string, unknown>;

  if (profile.rol === "ADMIN_ENTIDAD") {
    if (existing.estado_registro === "PREREGISTRADO") {
      const codigo = input.codigo_catalogo.trim();
      const nombre = input.nombre.trim();
      if (!codigo || !nombre) {
        return { error: "Código catálogo y nombre son obligatorios." };
      }

      payload = {
        codigo_catalogo: codigo,
        nombre,
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
        medida_largo: input.medida_largo ?? null,
        medida_ancho: input.medida_ancho ?? null,
        medida_altura: input.medida_altura ?? null,
        depreciacion: null,
        observacion: input.observacion?.trim() || null,
        responsable,
        valor_adquisicion: input.valor_adquisicion ?? null,
        valor_es_mercado: input.valor_es_mercado ?? false,
        fecha_adquisicion: input.fecha_adquisicion || null,
        fecha_inicio_depreciacion: input.fecha_inicio_depreciacion || null,
        incremento_detalle: input.incremento_detalle?.trim() || null,
        valor_incremento: input.valor_incremento ?? null,
        vida_util_meses: null,
        comprobante_serie: input.comprobante_serie?.trim() || null,
        posible_ambiente_id: input.posible_ambiente_id ?? null,
        updated_by: profile.id,
      };
    } else {
      if (!input.sede_id || !ambienteId) {
        return { error: "Seleccione sede y ambiente." };
      }

      const { data: sede } = await supabase
        .from("sedes")
        .select("entidad_id")
        .eq("id", input.sede_id)
        .maybeSingle();

      if (!sede || sede.entidad_id !== profile.entidad_id) {
        return { error: "La sede seleccionada no pertenece a su entidad." };
      }

      const { data: ambiente } = await supabase
        .from("ambientes")
        .select("sede_id")
        .eq("id", ambienteId)
        .maybeSingle();

      if (!ambiente || ambiente.sede_id !== input.sede_id) {
        return { error: "El ambiente no pertenece a la sede seleccionada." };
      }

      const estadoAnterior = existing.estado_bien as EstadoBien | null;
      const estadoNuevo =
        input.estado_bien !== undefined ? input.estado_bien : estadoAnterior;
      const { contador, admin } = splitObservacionActivo(existing.observacion as string | null);
      const adminActualizado = resolveObservacionAdmin(
        input.observacion_admin ?? admin,
        estadoAnterior,
        estadoNuevo,
      );
      const observacion = mergeObservacionActivo(contador, adminActualizado);

      payload = {
        sede_id: input.sede_id,
        ambiente_id: ambienteId,
        responsable,
        estado_bien: estadoNuevo,
        observacion,
        updated_by: profile.id,
      };
    }
  } else {
    responsable = input.responsable?.trim() || responsable;

    if (existing.estado_registro === "PREREGISTRADO") {
      payload = {
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
        medida_largo: input.medida_largo ?? null,
        medida_ancho: input.medida_ancho ?? null,
        medida_altura: input.medida_altura ?? null,
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
        posible_ambiente_id: input.posible_ambiente_id ?? null,
        updated_by: profile.id,
      };
      payload = applyCuentaContableToPayloadIfProvided(payload, {
        ...input,
        categoria: input.categoria ?? "ACTIVO",
      });
    } else {
      payload = {
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
        medida_largo: input.medida_largo ?? null,
        medida_ancho: input.medida_ancho ?? null,
        medida_altura: input.medida_altura ?? null,
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
        sede_id: input.sede_id || null,
        ambiente_id: ambienteId,
        comprobante_serie: input.comprobante_serie?.trim() || null,
        updated_by: profile.id,
      };

      payload = applyCuentaContableToPayloadIfProvided(payload, {
        ...input,
        categoria: input.categoria ?? "ACTIVO",
      });

      const codigo = payload.codigo_catalogo as string;
      const nombre = payload.nombre as string;
      if (!codigo || !nombre) {
        return { error: "Código catálogo y nombre son obligatorios." };
      }
    }
  }

  const { data, error } = await supabase
    .from("activos")
    .update(payload)
    .eq("id", activoId)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidateActivoPaths(existing.entidad_id, existing.ambiente_id);
  const nuevoAmbienteId = (payload.ambiente_id as string | null) ?? existing.ambiente_id;
  if (nuevoAmbienteId && nuevoAmbienteId !== existing.ambiente_id) {
    revalidateActivoPaths(existing.entidad_id, nuevoAmbienteId);
  }
  return { success: true, data };
}

export async function cambiarUbicacionActivo(
  activoId: string,
  sedeId: string,
  ambienteId: string,
) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };

  if (!sedeId || !ambienteId) {
    return { error: "Seleccione sede y ambiente." };
  }

  const supabase = await createClient();

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

  if (profile.rol === "ADMIN_ENTIDAD") {
    if (existing.entidad_id !== profile.entidad_id) {
      return { error: "No autorizado." };
    }
  } else if (profile.rol !== "CONTADOR") {
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

  if (error) {
    return { error: error.message };
  }

  revalidateActivoPaths(existing.entidad_id, existing.ambiente_id);
  if (ambienteId !== existing.ambiente_id) {
    revalidateActivoPaths(existing.entidad_id, ambienteId);
  }
  return { success: true };
}

export async function darDeBajaActivo(activoId: string, motivo: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") {
    return { error: "Solo el contador puede dar de baja activos." };
  }

  const motivoBaja = motivo.trim();
  if (!motivoBaja) {
    return { error: "Indique el motivo de baja." };
  }

  const supabase = await createClient();

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

  if (error) {
    return { error: error.message };
  }

  revalidateActivoPaths(existing.entidad_id, existing.ambiente_id);
  return { success: true };
}

export async function recuperarActivo(activoId: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") {
    return { error: "Solo el contador puede recuperar activos dados de baja." };
  }

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("activos")
    .select("entidad_id, ambiente_id, estado_registro, codigo_barras")
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

  if (error) {
    return { error: error.message };
  }

  revalidateActivoPaths(existing.entidad_id, existing.ambiente_id);
  return { success: true, estado_registro: nuevoEstado };
}

export async function previewActivosSimilares(
  entidadId: string,
  codigoCatalogo: string,
  cantidad: number,
): Promise<ActivosSimilaresPreview | null> {
  const profile = await getProfile();
  if (!profile) return null;

  const qty = Math.floor(cantidad);
  if (qty < 1 || qty > MAX_ACTIVOS_SIMILARES_CANTIDAD) return null;

  const supabase = await createClient();
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
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };

  const qty = Math.floor(cantidad);
  if (qty < 1 || qty > MAX_ACTIVOS_SIMILARES_CANTIDAD) {
    return { error: `La cantidad debe estar entre 1 y ${MAX_ACTIVOS_SIMILARES_CANTIDAD}.` };
  }

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("activos")
    .select("entidad_id, ambiente_id, estado_registro")
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

  const result = data as CreateActivosSimilaresResult & {
    ambiente_id?: string | null;
  };
  revalidateActivoPaths(existing.entidad_id, existing.ambiente_id);
  const destinoAmbienteId = result.ambiente_id ?? ubicacion?.ambienteId ?? existing.ambiente_id;
  if (destinoAmbienteId && destinoAmbienteId !== existing.ambiente_id) {
    revalidateActivoPaths(existing.entidad_id, destinoAmbienteId);
  }
  return { data: result };
}

export async function getEjemplaresSimilaresResumen(
  activoId: string,
): Promise<EjemplaresSimilaresResumen | null> {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
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

export async function updateActivosSimilares(
  activoId: string,
  input: UpdateActivosSimilaresInput,
): Promise<{ data?: UpdateActivosSimilaresResult; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };

  const patch = buildActivosSimilaresPatch(input);
  if (Object.keys(patch).length === 0) {
    return { error: "No hay cambios para aplicar." };
  }

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("activos")
    .select("entidad_id, ambiente_id")
    .eq("id", activoId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Activo no encontrado." };
  }

  if (profile.rol === "ADMIN_ENTIDAD" && existing.entidad_id !== profile.entidad_id) {
    return { error: "No autorizado." };
  }

  const { data, error } = await supabase.rpc("update_activos_similares", {
    p_activo_id: activoId,
    p_patch: patch,
  });

  if (error) return { error: error.message };

  const result = data as { actualizados?: number };
  revalidateActivoPaths(existing.entidad_id, existing.ambiente_id);
  const nuevoAmbienteId = (patch.ambiente_id as string | null | undefined) ?? existing.ambiente_id;
  if (nuevoAmbienteId && nuevoAmbienteId !== existing.ambiente_id) {
    revalidateActivoPaths(existing.entidad_id, nuevoAmbienteId);
  }

  return { data: { actualizados: result.actualizados ?? 0 } };
}

export async function listActivosPorAmbiente(ambienteId: string) {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activos")
    .select(ACTIVO_SELECT_SIN_ENTIDAD)
    .eq("ambiente_id", ambienteId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return enrichPosibleSedeNombres(
    supabase,
    mapActivoRows(data as Record<string, unknown>[]),
  );
}

export type ActivoConUbicacion = Activo & ActivoListRow;

function mapActivoRows(data: Record<string, unknown>[] | null): ActivoConUbicacion[] {
  return (data ?? []).map((row) => {
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
  });
}

async function enrichPosibleSedeNombres(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

  const { data } = await supabase.from("sedes").select("id, nombre").in("id", sedeIds);
  const nombreById = new Map((data ?? []).map((s) => [s.id as string, s.nombre as string]));

  return rows.map((row) => {
    if (!row.posible_sede_id) return row;
    const sedeNombre = nombreById.get(row.posible_sede_id);
    if (!sedeNombre) return row;
    return { ...row, posible_sede_nombre: sedeNombre };
  });
}

export async function listActivos(entidadId?: string, filters?: ListActivosFilters) {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase.from("activos").select(ACTIVO_SELECT).order("created_at", { ascending: false });

  if (profile.rol === "ADMIN_ENTIDAD") {
    query = query.eq("entidad_id", profile.entidad_id!);
  } else if (entidadId) {
    query = query.eq("entidad_id", entidadId);
  }

  const entidadFilter = filters?.entidadId;
  if (profile.rol === "CONTADOR" && entidadFilter) {
    query = query.eq("entidad_id", entidadFilter);
  }
  if (filters?.sedeId) {
    query = query.eq("sede_id", filters.sedeId);
  }
  if (filters?.ambienteId) {
    query = query.eq("ambiente_id", filters.ambienteId);
  }
  if (filters?.estadoRegistro) {
    query = query.eq("estado_registro", filters.estadoRegistro);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return enrichPosibleSedeNombres(supabase, mapActivoRows(data as Record<string, unknown>[]));
}

export async function registrarActivo(
  activoId: string,
  destino: { sedeId: string; ambienteId: string },
) {
  await requireProfile("CONTADOR");
  const supabase = await createClient();

  if (!destino.sedeId || !destino.ambienteId) {
    return { error: "Seleccione sede y ambiente destino." };
  }

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

  const { data: existing } = await supabase
    .from("activos")
    .select("entidad_id, ambiente_id")
    .eq("id", activoId)
    .eq("estado_registro", "PREREGISTRADO")
    .maybeSingle();

  if (!existing) {
    return { error: "Preregistro no encontrado o ya fue registrado." };
  }

  const { error } = await supabase
    .from("activos")
    .update({
      estado_registro: "REGISTRADO" as EstadoRegistro,
      sede_id: destino.sedeId,
      ambiente_id: destino.ambienteId,
      posible_ambiente_id: null,
      responsable: ambienteDestino.responsable?.trim() || null,
    })
    .eq("id", activoId)
    .eq("estado_registro", "PREREGISTRADO");

  if (error) {
    return { error: error.message };
  }

  revalidateActivoPaths(existing.entidad_id, existing.ambiente_id);
  revalidateActivoPaths(existing.entidad_id, destino.ambienteId);

  return { success: true };
}

export async function updateActivoPaths(
  activoId: string,
  paths: {
    foto_path?: string | null;
    comprobante_path?: string | null;
    comprobante_serie?: string | null;
  },
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("activos")
    .select("entidad_id, ambiente_id")
    .eq("id", activoId)
    .maybeSingle();

  const { error } = await supabase.from("activos").update(paths).eq("id", activoId);

  if (error) {
    return { error: error.message };
  }

  if (existing) {
    revalidateActivoPaths(existing.entidad_id, existing.ambiente_id);
  } else {
    revalidatePath("/contador/inventario");
    revalidatePath("/admin/activos");
  }
  return { success: true };
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

async function removeActivoStoragePaths(fotoPaths: string[], comprobantePaths: string[]) {
  const supabase = await createClient();
  if (fotoPaths.length > 0) {
    await supabase.storage.from("fotos-activos").remove(fotoPaths);
  }
  if (comprobantePaths.length > 0) {
    await supabase.storage.from("comprobantes-activos").remove(comprobantePaths);
  }
}

export async function previewDeleteActivosPorCodigos(entidadId: string, codigosText: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "Solo el contador puede eliminar activos." };
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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_delete_activos_por_codigos", {
    p_entidad_id: entidadId,
    p_codigos: codigos,
  });

  if (error) return { error: error.message };
  return { data: mapPreviewDeleteActivos(data) };
}

export async function deleteActivosPorCodigos(entidadId: string, codigosText: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "Solo el contador puede eliminar activos." };
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

  const supabase = await createClient();

  const { data: ambienteRows } = await supabase
    .from("activos")
    .select("ambiente_id")
    .eq("entidad_id", entidadId)
    .in("codigo_barras", codigos);

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
    // La eliminación en BD ya se aplicó; archivos huérfanos son secundarios.
  }

  revalidatePath("/contador/inventario");
  revalidatePath("/contador/entidades");
  const ambienteIds = new Set(
    (ambienteRows ?? [])
      .map((r) => r.ambiente_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );
  for (const ambienteId of ambienteIds) {
    revalidateActivoPaths(entidadId, ambienteId);
  }
  if (ambienteIds.size === 0) {
    revalidateActivoPaths(entidadId, null);
  }

  return {
    data: {
      eliminados: result.eliminados ?? 0,
      codigos: result.codigos ?? [],
      foto_paths: result.foto_paths ?? [],
      comprobante_paths: result.comprobante_paths ?? [],
    } satisfies DeleteActivosPorCodigosResult,
  };
}

export async function deleteActivosPreregistrados(entidadId: string, activoIds: string[]) {
  const profile = await getProfile();
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

  const supabase = await createClient();

  const { data: activoRows, error: fetchError } = await supabase
    .from("activos")
    .select("id, ambiente_id")
    .eq("entidad_id", entidadId)
    .in("id", uniqueIds);

  if (fetchError) return { error: fetchError.message };

  const ambienteIds = new Set<string>();
  for (const row of activoRows ?? []) {
    if (row.ambiente_id) ambienteIds.add(row.ambiente_id as string);
  }

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

  revalidatePath("/contador/inventario");
  revalidatePath("/contador/entidades");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin/activos");
  for (const ambienteId of ambienteIds) {
    revalidateActivoPaths(entidadId, ambienteId);
  }
  if (ambienteIds.size === 0) {
    revalidateActivoPaths(entidadId, null);
  }

  return {
    data: {
      eliminados,
      activo_ids: deletedIds,
      foto_paths: fotoPaths,
      comprobante_paths: comprobantePaths,
    } satisfies DeleteActivosPreregistradosResult,
  };
}

export async function deleteActivoPreregistrado(activoId: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Sesión no válida." };

  const supabase = await createClient();
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
