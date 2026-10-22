import type {
  CatalogoNacional,
  CatalogoCampoOpciones,
  CatalogoOpcionTipo,
  CatalogoOrigen,
  CreateCatalogoNacionalInput,
  CuentaContable,
  UpdateCatalogoPropioInput,
  UpdateCatalogoNacionalContabilidadInput,
  UpsertCuentaContableInput,
} from "@inventario/types";
import {
  buildCatalogoCampoOpciones,
  buildCreateCatalogoCuentaOrdenPayload,
  buildCreateCatalogoNacionalExtensionPayload,
  buildUpdateCatalogoPropioPayload,
  buildUpdateCatalogoNacionalContabilidadPayload,
  CATALOGO_CONSULTA_MAX_RESULTS,
  CATALOGO_SEARCH_MAX_RESULTS,
  CATALOGO_PROPIO_CODIGO_RE,
  isCatalogoNacionalOficial,
  isCatalogoPropio,
  minCatalogoQueryLength,
  nextCodigoCatalogoPropioFromMax,
  normalizeCuentaCodigo,
  shouldRegistrarCatalogoOpcionPersonalizada,
  suggestGrupoForDenominacion,
  validarCreateCatalogoCuentaOrdenInput,
  validarCreateCatalogoNacionalExtensionInput,
  validarUpdateCatalogoPropioInput,
  validarUpsertCuentaContableInput,
} from "@inventario/types";
import { fetchProfile } from "./profile";
import { getSupabaseClient } from "./supabase";
import { enqueueOfflineOp, isOnline, listMasterDomain } from "./master-cache";
import { listCachedActivos } from "./offline";

const CATALOGO_SYNC_ENTIDAD = "";

async function ensureCuentaContableForCatalogo(
  supabase: ReturnType<typeof getSupabaseClient>,
  cuenta_codigo: string | null,
  nombre: string | null,
): Promise<{ error?: string }> {
  if (!cuenta_codigo) return {};

  const nombreTrim = nombre?.trim() || null;
  const { data: existing, error: fetchError } = await supabase
    .from("cuentas_contables")
    .select("codigo, nombre")
    .eq("codigo", cuenta_codigo)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };

  if (!existing) {
    if (!nombreTrim) {
      return {
        error: `La cuenta contable ${cuenta_codigo} no existe. Indique el nombre para crearla.`,
      };
    }
    const { error } = await supabase.rpc("upsert_cuenta_contable", {
      p_codigo: cuenta_codigo,
      p_nombre: nombreTrim,
    });
    if (error) return { error: error.message };
    return {};
  }

  if (nombreTrim && nombreTrim !== existing.nombre) {
    const { error } = await supabase.rpc("upsert_cuenta_contable", {
      p_codigo: cuenta_codigo,
      p_nombre: nombreTrim,
    });
    if (error) return { error: error.message };
  }

  return {};
}

type LocalCatalogRow = {
  codigo: string;
  denominacion: string;
  grupo: string | null;
  clase: string | null;
  cuenta_codigo?: string | null;
  contabilidad?: string | null;
  depreciacion?: string | null;
  resolucion?: string | null;
  estado?: string | null;
  origen?: string | null;
};

function mapLocalRow(row: LocalCatalogRow): CatalogoNacional {
  const origen: CatalogoOrigen = row.origen === "PROPIO" ? "PROPIO" : "NACIONAL";
  return {
    codigo: row.codigo,
    denominacion: row.denominacion,
    grupo: row.grupo,
    clase: row.clase,
    cuenta_codigo: row.cuenta_codigo ?? null,
    contabilidad: row.contabilidad ?? null,
    depreciacion: row.depreciacion ?? null,
    resolucion: row.resolucion ?? null,
    estado: row.estado ?? null,
    origen,
  };
}

function syncLocalRow(row: CatalogoNacional) {
  void window.electronAPI?.upsertCatalogRow?.({
    codigo: row.codigo,
    denominacion: row.denominacion,
    grupo: row.grupo,
    clase: row.clase,
    cuenta_codigo: row.cuenta_codigo,
    contabilidad: row.contabilidad,
    depreciacion: row.depreciacion,
    resolucion: row.resolucion,
    estado: row.estado,
    origen: row.origen,
  });
}

function removeLocalRow(codigo: string) {
  void window.electronAPI?.deleteCatalogRow?.(codigo);
}

async function countActivosUsingCodigoCatalogo(codigo: string): Promise<number> {
  const entidades = await listMasterDomain<{ id: string }>("entidades", "");
  let count = 0;
  for (const entidad of entidades) {
    const activos = await listCachedActivos(entidad.id);
    count += activos.filter((activo) => activo.codigo_catalogo === codigo).length;
  }
  return count;
}

async function enqueueCuentaContableIfNeeded(
  cuentaCodigo: string | null | undefined,
  nombre: string | null | undefined,
): Promise<void> {
  const codigo = cuentaCodigo?.trim();
  const nombreTrim = nombre?.trim();
  if (!codigo || !nombreTrim) return;
  await enqueueOfflineOp("cuenta:upsert", CATALOGO_SYNC_ENTIDAD, {
    codigo,
    nombre: nombreTrim,
  });
}

export async function searchCatalogo(query: string, limit = 20): Promise<CatalogoNacional[]> {
  const trimmed = query.trim();
  if (trimmed.length < minCatalogoQueryLength(trimmed)) return [];

  if (window.electronAPI?.searchCatalogLocal && window.electronAPI.getCatalogMeta) {
    const meta = await window.electronAPI.getCatalogMeta();
    if (meta.count > 0) {
      const rows = await window.electronAPI.searchCatalogLocal(trimmed, limit);
      return rows.map((row) => mapLocalRow(row));
    }
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("search_catalogo_bien", {
    p_query: trimmed,
    p_limit: Math.min(Math.max(limit, 1), 50),
  });

  if (!error) return (data ?? []) as CatalogoNacional[];

  console.error("search_catalogo_bien:", error.message);
  const fallback = await supabase.rpc("search_catalogo_nacional", {
    p_query: trimmed,
    p_limit: limit,
  });
  if (fallback.error) {
    console.error("search_catalogo_nacional:", fallback.error.message);
    return [];
  }
  return (fallback.data ?? []) as CatalogoNacional[];
}

export async function searchCatalogoNacionalOficial(
  query: string,
  limit = CATALOGO_CONSULTA_MAX_RESULTS,
): Promise<CatalogoNacional[]> {
  const items = await searchCatalogo(query, limit);
  return items.filter(isCatalogoNacionalOficial);
}

export async function searchCatalogoPropio(
  query: string,
  limit = CATALOGO_SEARCH_MAX_RESULTS,
): Promise<CatalogoNacional[]> {
  const items = await searchCatalogo(query, limit);
  return items.filter(isCatalogoPropio);
}

export async function getCatalogoByCodigo(codigo: string): Promise<CatalogoNacional | null> {
  const trimmed = codigo.trim();
  if (!trimmed) return null;

  if (window.electronAPI?.getCatalogByCodigo) {
    const row = await window.electronAPI.getCatalogByCodigo(trimmed);
    if (row) return mapLocalRow(row);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("catalogo_nacional")
    .select("*")
    .eq("codigo", trimmed)
    .maybeSingle();

  if (error || !data) return null;
  return data as CatalogoNacional;
}

export async function listCatalogoPropio(): Promise<CatalogoNacional[]> {
  const profile = await fetchProfile();
  if (!profile || profile.rol !== "CONTADOR") return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("catalogo_nacional")
    .select("*")
    .eq("origen", "PROPIO")
    .order("codigo");

  if (!error && data) {
    return data as CatalogoNacional[];
  }

  if (error) console.error("listCatalogoPropio:", error.message);

  if (window.electronAPI?.listCatalogoPropioLocal) {
    const rows = await window.electronAPI.listCatalogoPropioLocal();
    return rows.map((row) => mapLocalRow(row));
  }

  return [];
}

export async function getNextCodigoCatalogoPropio(): Promise<string> {
  const profile = await fetchProfile();
  if (!profile || profile.rol !== "CONTADOR") {
    return nextCodigoCatalogoPropioFromMax(null);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("catalogo_nacional")
    .select("codigo")
    .like("codigo", "BD%")
    .order("codigo", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getNextCodigoCatalogoPropio:", error.message);
    return nextCodigoCatalogoPropioFromMax(null);
  }

  return nextCodigoCatalogoPropioFromMax(data?.codigo ?? null);
}

async function listCatalogoOpcionesPersonalizadas(tipo: CatalogoOpcionTipo): Promise<string[]> {
  const profile = await fetchProfile();
  if (!profile || profile.rol !== "CONTADOR") return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("list_catalogo_opciones_personalizadas", {
    p_tipo: tipo,
  });

  if (error) {
    console.error("list_catalogo_opciones_personalizadas:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row: { valor: string }) => row.valor?.trim())
    .filter((v: string | undefined): v is string => Boolean(v));
}

async function distinctPropioValores(campo: "grupo" | "clase"): Promise<string[]> {
  const items = await listCatalogoPropio();
  return [
    ...new Set(
      items
        .map((item) => {
          const valor = campo === "grupo" ? item.grupo : item.clase;
          return valor?.trim() ?? "";
        })
        .filter(Boolean),
    ),
  ];
}

export async function registerCatalogoOpcionPersonalizada(
  tipo: CatalogoOpcionTipo,
  valor: string,
): Promise<{ error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "No autorizado." };

  const texto = valor.trim();
  if (!shouldRegistrarCatalogoOpcionPersonalizada(tipo, texto)) {
    return {};
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("catalogo_opciones_personalizadas").upsert(
    { tipo, valor: texto },
    { onConflict: "tipo,valor" },
  );

  if (error) return { error: error.message };
  return {};
}

export async function deleteCatalogoOpcionPersonalizada(
  tipo: CatalogoOpcionTipo,
  valor: string,
): Promise<{ error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "No autorizado." };

  const texto = valor.trim();
  if (!texto) return { error: "Valor inválido." };

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("delete_catalogo_opcion_personalizada", {
    p_tipo: tipo,
    p_valor: texto,
  });

  if (error) return { error: error.message };
  return {};
}

export async function listCatalogoGrupos(): Promise<CatalogoCampoOpciones> {
  const profile = await fetchProfile();
  if (!profile || profile.rol !== "CONTADOR") {
    return buildCatalogoCampoOpciones("grupo", [], []);
  }

  const supabase = getSupabaseClient();
  const [personalizadas, gruposRpc, propioGrupos] = await Promise.all([
    listCatalogoOpcionesPersonalizadas("grupo"),
    supabase.rpc("list_catalogo_grupos"),
    distinctPropioValores("grupo"),
  ]);

  if (gruposRpc.error) {
    console.error("listCatalogoGrupos:", gruposRpc.error.message);
    return buildCatalogoCampoOpciones("grupo", personalizadas, propioGrupos);
  }

  const extraRpc = (gruposRpc.data ?? [])
    .map((row: { grupo: string }) => row.grupo?.trim())
    .filter((g: string | undefined): g is string => Boolean(g));

  return buildCatalogoCampoOpciones("grupo", personalizadas, [...extraRpc, ...propioGrupos]);
}

export async function listCatalogoClases(): Promise<CatalogoCampoOpciones> {
  const profile = await fetchProfile();
  if (!profile || profile.rol !== "CONTADOR") {
    return buildCatalogoCampoOpciones("clase", [], []);
  }

  const [personalizadas, propioClases] = await Promise.all([
    listCatalogoOpcionesPersonalizadas("clase"),
    distinctPropioValores("clase"),
  ]);

  return buildCatalogoCampoOpciones("clase", personalizadas, propioClases);
}

async function registrarOpcionesDesdeCatalogoInput(input: {
  grupo?: string;
  clase?: string;
}): Promise<void> {
  if (input.grupo && shouldRegistrarCatalogoOpcionPersonalizada("grupo", input.grupo)) {
    await registerCatalogoOpcionPersonalizada("grupo", input.grupo);
  }
  if (input.clase && shouldRegistrarCatalogoOpcionPersonalizada("clase", input.clase)) {
    await registerCatalogoOpcionPersonalizada("clase", input.clase);
  }
}

export async function suggestCatalogoGrupo(denominacion: string): Promise<string | null> {
  const [items, grupos] = await Promise.all([
    searchCatalogo(denominacion, 15),
    listCatalogoGrupos(),
  ]);
  return suggestGrupoForDenominacion(denominacion, items, grupos.opciones);
}

export async function createCatalogoNacional(
  input: CreateCatalogoNacionalInput,
): Promise<{ data?: CatalogoNacional; error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "No autorizado." };

  const validationError = validarCreateCatalogoCuentaOrdenInput(input);
  if (validationError) return { error: validationError };

  const payload = buildCreateCatalogoCuentaOrdenPayload(input);

  if (!isOnline()) {
    let codigo = payload.codigo;
    for (let intento = 0; intento < 5; intento++) {
      const existing = await getCatalogoByCodigo(codigo);
      if (!existing) {
        const row: CatalogoNacional = {
          ...payload,
          codigo,
          created_at: new Date().toISOString(),
        };
        syncLocalRow(row);
        await enqueueCuentaContableIfNeeded(payload.cuenta_codigo, payload.contabilidad);
        await enqueueOfflineOp("catalogo:create", CATALOGO_SYNC_ENTIDAD, {
          payload: { ...payload, codigo },
        });
        return { data: row };
      }

      const locales = window.electronAPI?.listCatalogoPropioLocal
        ? await window.electronAPI.listCatalogoPropioLocal()
        : [];
      const maximo = locales
        .map((item) => item.codigo)
        .sort((a, b) => b.localeCompare(a))[0];
      const siguiente = nextCodigoCatalogoPropioFromMax(maximo ?? null);
      if (siguiente === codigo) {
        return {
          error: "Ese código ya fue usado y no se pudo asignar el siguiente. Intente de nuevo.",
        };
      }
      codigo = siguiente;
    }
    return { error: "No se pudo asignar un código de catálogo propio libre. Intente de nuevo." };
  }

  const supabase = getSupabaseClient();

  const cuentaError = await ensureCuentaContableForCatalogo(
    supabase,
    payload.cuenta_codigo,
    payload.contabilidad,
  );
  if (cuentaError.error) return { error: cuentaError.error };

  let codigo = payload.codigo;
  let row: CatalogoNacional | null = null;
  for (let intento = 0; intento < 5; intento++) {
    const { data, error } = await supabase
      .from("catalogo_nacional")
      .insert({ ...payload, codigo })
      .select()
      .single();

    if (!error && data) {
      row = data as CatalogoNacional;
      break;
    }

    const message = (error?.message ?? "").toLowerCase();
    const duplicado =
      error?.code === "23505" ||
      message.includes("duplicate") ||
      message.includes("llave duplicada") ||
      message.includes("unique");
    if (!duplicado) return { error: error?.message ?? "No se pudo crear el ítem del catálogo." };

    const { data: maxRow, error: maxError } = await supabase
      .from("catalogo_nacional")
      .select("codigo")
      .like("codigo", "BD%")
      .order("codigo", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) return { error: maxError.message };

    const siguiente = nextCodigoCatalogoPropioFromMax(maxRow?.codigo ?? null);
    if (siguiente === codigo) {
      return {
        error: "Ese código ya fue usado y no se pudo asignar el siguiente. Intente de nuevo.",
      };
    }
    codigo = siguiente;
  }

  if (!row) {
    return { error: "No se pudo asignar un código de catálogo propio libre. Intente de nuevo." };
  }

  syncLocalRow(row);
  await registrarOpcionesDesdeCatalogoInput(input);
  return { data: row };
}

export async function createCatalogoNacionalExtension(
  input: CreateCatalogoNacionalInput,
): Promise<{ data?: CatalogoNacional; error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "No autorizado." };

  const validationError = validarCreateCatalogoNacionalExtensionInput(input);
  if (validationError) return { error: validationError };

  const payload = buildCreateCatalogoNacionalExtensionPayload(input);

  if (!isOnline()) {
    const existing = await getCatalogoByCodigo(payload.codigo);
    if (existing) {
      return { error: `El código ${payload.codigo} ya existe en el catálogo nacional.` };
    }

    const row: CatalogoNacional = { ...payload, created_at: new Date().toISOString() };
    syncLocalRow(row);
    await enqueueCuentaContableIfNeeded(payload.cuenta_codigo, payload.contabilidad);
    await enqueueOfflineOp("catalogo:create", CATALOGO_SYNC_ENTIDAD, { payload });
    return { data: row };
  }

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from("catalogo_nacional")
    .select("codigo")
    .eq("codigo", payload.codigo)
    .maybeSingle();

  if (existing) {
    return { error: `El código ${payload.codigo} ya existe en el catálogo nacional.` };
  }

  const cuentaError = await ensureCuentaContableForCatalogo(
    supabase,
    payload.cuenta_codigo,
    payload.contabilidad,
  );
  if (cuentaError.error) return { error: cuentaError.error };

  const { data, error } = await supabase
    .from("catalogo_nacional")
    .insert(payload)
    .select()
    .single();

  if (error) return { error: error.message };

  const row = data as CatalogoNacional;
  syncLocalRow(row);
  await registrarOpcionesDesdeCatalogoInput(input);
  return { data: row };
}

export async function updateCatalogoPropio(
  codigo: string,
  input: UpdateCatalogoPropioInput,
): Promise<{ data?: CatalogoNacional; error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "No autorizado." };

  const trimmed = codigo.trim();
  if (!CATALOGO_PROPIO_CODIGO_RE.test(trimmed)) {
    return { error: "Solo se pueden editar ítems del catálogo propio (BD…)." };
  }

  const validationError = validarUpdateCatalogoPropioInput(input);
  if (validationError) return { error: validationError };

  if (!isOnline()) {
    const existing = await getCatalogoByCodigo(trimmed);
    if (!existing || existing.origen !== "PROPIO") {
      return { error: "El ítem no existe en el catálogo propio." };
    }

    const payload = buildUpdateCatalogoPropioPayload(input);
    const row: CatalogoNacional = {
      ...existing,
      ...payload,
      codigo: trimmed,
      origen: "PROPIO",
    };
    syncLocalRow(row);
    await enqueueCuentaContableIfNeeded(payload.cuenta_codigo, payload.contabilidad);
    await enqueueOfflineOp("catalogo:update", CATALOGO_SYNC_ENTIDAD, {
      codigo: trimmed,
      mode: "propio",
      payload,
    });
    return { data: row };
  }

  const supabase = getSupabaseClient();
  const { data: existing, error: fetchError } = await supabase
    .from("catalogo_nacional")
    .select("codigo, origen")
    .eq("codigo", trimmed)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing || existing.origen !== "PROPIO") {
    return { error: "El ítem no existe en el catálogo propio." };
  }

  const payload = buildUpdateCatalogoPropioPayload(input);
  const cuentaError = await ensureCuentaContableForCatalogo(
    supabase,
    payload.cuenta_codigo,
    payload.contabilidad,
  );
  if (cuentaError.error) return { error: cuentaError.error };

  const { data, error } = await supabase
    .from("catalogo_nacional")
    .update(payload)
    .eq("codigo", trimmed)
    .eq("origen", "PROPIO")
    .select()
    .single();

  if (error) return { error: error.message };

  const row = data as CatalogoNacional;
  syncLocalRow(row);
  await registrarOpcionesDesdeCatalogoInput(input);
  return { data: row };
}

export async function updateCatalogoNacionalContabilidad(
  codigo: string,
  input: UpdateCatalogoNacionalContabilidadInput,
): Promise<{ data?: CatalogoNacional; error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "No autorizado." };

  const trimmed = codigo.trim();
  if (CATALOGO_PROPIO_CODIGO_RE.test(trimmed)) {
    return { error: "Use el catálogo propio para ítems BD…" };
  }

  const payload = buildUpdateCatalogoNacionalContabilidadPayload(input);

  if (!isOnline()) {
    const existing = await getCatalogoByCodigo(trimmed);
    if (!existing) return { error: "No se pudo actualizar el ítem." };
    if (existing.origen === "PROPIO") {
      return { error: "Use el catálogo propio para ítems BD…" };
    }

    const row: CatalogoNacional = {
      ...existing,
      cuenta_codigo: payload.cuenta_codigo ?? null,
      contabilidad: payload.contabilidad ?? null,
      depreciacion: payload.depreciacion ?? null,
    };
    syncLocalRow(row);
    await enqueueCuentaContableIfNeeded(payload.cuenta_codigo, payload.contabilidad);
    await enqueueOfflineOp("catalogo:update", CATALOGO_SYNC_ENTIDAD, {
      codigo: trimmed,
      mode: "contabilidad",
      payload,
    });
    return { data: row };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("update_catalogo_nacional_contabilidad", {
    p_codigo: trimmed,
    p_cuenta_codigo: payload.cuenta_codigo ?? "",
    p_contabilidad: payload.contabilidad ?? "",
    p_depreciacion: payload.depreciacion ?? "",
  });

  if (error) return { error: error.message };
  if (!data) return { error: "No se pudo actualizar el ítem." };

  const row = data as CatalogoNacional;
  syncLocalRow(row);
  return { data: row };
}

export async function deleteCatalogoPropio(codigo: string): Promise<{ error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "No autorizado." };

  const trimmed = codigo.trim();
  if (!CATALOGO_PROPIO_CODIGO_RE.test(trimmed)) {
    return { error: "Solo se pueden eliminar ítems del catálogo propio (BD…)." };
  }

  if (!isOnline()) {
    const existing = await getCatalogoByCodigo(trimmed);
    if (!existing || existing.origen !== "PROPIO") {
      return { error: "El ítem no existe en el catálogo propio." };
    }

    const count = await countActivosUsingCodigoCatalogo(trimmed);
    if (count > 0) {
      return {
        error: `No se puede eliminar: ${count} activo(s) usan el código ${trimmed}.`,
      };
    }

    removeLocalRow(trimmed);
    await enqueueOfflineOp("catalogo:delete", CATALOGO_SYNC_ENTIDAD, { codigo: trimmed });
    return {};
  }

  const supabase = getSupabaseClient();
  const { data: existing, error: fetchError } = await supabase
    .from("catalogo_nacional")
    .select("codigo, origen")
    .eq("codigo", trimmed)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing || existing.origen !== "PROPIO") {
    return { error: "El ítem no existe en el catálogo propio." };
  }

  const { count, error: countError } = await supabase
    .from("activos")
    .select("id", { count: "exact", head: true })
    .eq("codigo_catalogo", trimmed);

  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    return {
      error: `No se puede eliminar: ${count} activo(s) usan el código ${trimmed}.`,
    };
  }

  const { error } = await supabase
    .from("catalogo_nacional")
    .delete()
    .eq("codigo", trimmed)
    .eq("origen", "PROPIO");

  if (error) return { error: error.message };

  removeLocalRow(trimmed);
  return {};
}

export async function searchCuentasContables(
  query = "",
  limit = 30,
): Promise<CuentaContable[]> {
  const profile = await fetchProfile();
  if (!profile) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("search_cuentas_contables", {
    p_query: query.trim(),
    p_limit: limit,
  });

  if (error) {
    console.error("search_cuentas_contables:", error.message);
    return [];
  }

  return (data ?? []) as CuentaContable[];
}

export async function listCuentasContables(query = ""): Promise<CuentaContable[]> {
  return searchCuentasContables(query, 100);
}

export async function upsertCuentaContable(
  input: UpsertCuentaContableInput,
): Promise<{ data?: CuentaContable; error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "No autorizado." };

  const validationError = validarUpsertCuentaContableInput(input);
  if (validationError) return { error: validationError };

  const codigo = normalizeCuentaCodigo(input.codigo);
  if (!codigo) return { error: "Código de cuenta contable inválido." };

  if (!isOnline()) {
    const row: CuentaContable = {
      codigo,
      nombre: input.nombre.trim(),
    };
    await enqueueOfflineOp("cuenta:upsert", CATALOGO_SYNC_ENTIDAD, row);
    return { data: row };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_cuenta_contable", {
    p_codigo: codigo,
    p_nombre: input.nombre.trim(),
  });

  if (error) return { error: error.message };
  return { data: data as CuentaContable };
}

export async function deleteCuentaContable(codigo: string): Promise<{ error?: string }> {
  const profile = await fetchProfile();
  if (!profile) return { error: "Sesión no válida." };
  if (profile.rol !== "CONTADOR") return { error: "No autorizado." };

  const normalizado = normalizeCuentaCodigo(codigo.trim());
  if (!normalizado || !/^\d{1,6}$/.test(normalizado)) {
    return { error: "Código de cuenta contable inválido." };
  }

  if (!isOnline()) {
    await enqueueOfflineOp("cuenta:delete", CATALOGO_SYNC_ENTIDAD, { codigo: normalizado });
    return {};
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("delete_cuenta_contable", {
    p_codigo: normalizado,
  });

  if (error) return { error: error.message };
  return {};
}
