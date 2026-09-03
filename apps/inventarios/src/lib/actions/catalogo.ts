"use server";

import type {
  CatalogoNacional,
  CatalogoCampoOpciones,
  CatalogoOpcionTipo,
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
import { createClient } from "@/lib/supabase/server";
import { getProfile, requireProfile } from "@/lib/auth/profile";

async function ensureCuentaContableForCatalogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

export async function searchCatalogo(query: string, limit = 20): Promise<CatalogoNacional[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const trimmed = query.trim();
  if (trimmed.length < minCatalogoQueryLength(trimmed)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_catalogo_nacional", {
    p_query: trimmed,
    p_limit: limit,
  });

  if (error) {
    console.error("search_catalogo_nacional:", error.message);
    return [];
  }

  return (data ?? []) as CatalogoNacional[];
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
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_nacional")
    .select("*")
    .eq("codigo", codigo.trim())
    .maybeSingle();

  if (error || !data) return null;
  return data as CatalogoNacional;
}

export async function listCatalogoPropio(): Promise<CatalogoNacional[]> {
  await requireProfile("CONTADOR");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_nacional")
    .select("*")
    .eq("origen", "PROPIO")
    .order("codigo");

  if (error) {
    console.error("listCatalogoPropio:", error.message);
    return [];
  }

  return (data ?? []) as CatalogoNacional[];
}

export async function getNextCodigoCatalogoPropio(): Promise<string> {
  await requireProfile("CONTADOR");

  const supabase = await createClient();
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
  const supabase = await createClient();
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

async function distinctPropioValores(
  campo: "grupo" | "clase",
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_nacional")
    .select(campo)
    .eq("origen", "PROPIO");

  if (error) {
    console.error(`distinctPropioValores(${campo}):`, error.message);
    return [];
  }

  const rows = (data ?? []) as Array<{ grupo: string | null } | { clase: string | null }>;

  return [
    ...new Set(
      rows
        .map((row) => {
          const valor =
            campo === "grupo"
              ? "grupo" in row
                ? row.grupo
                : null
              : "clase" in row
                ? row.clase
                : null;
          return typeof valor === "string" ? valor.trim() : "";
        })
        .filter(Boolean),
    ),
  ];
}

export async function registerCatalogoOpcionPersonalizada(
  tipo: CatalogoOpcionTipo,
  valor: string,
): Promise<{ error?: string }> {
  await requireProfile("CONTADOR");

  const texto = valor.trim();
  if (!shouldRegistrarCatalogoOpcionPersonalizada(tipo, texto)) {
    return {};
  }

  const supabase = await createClient();
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
  await requireProfile("CONTADOR");

  const texto = valor.trim();
  if (!texto) return { error: "Valor inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_catalogo_opcion_personalizada", {
    p_tipo: tipo,
    p_valor: texto,
  });

  if (error) return { error: error.message };
  return {};
}

export async function listCatalogoGrupos(): Promise<CatalogoCampoOpciones> {
  await requireProfile("CONTADOR");

  const supabase = await createClient();
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
  await requireProfile("CONTADOR");

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
  await requireProfile("CONTADOR");

  const validationError = validarCreateCatalogoCuentaOrdenInput(input);
  if (validationError) return { error: validationError };

  const payload = buildCreateCatalogoCuentaOrdenPayload(input);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("catalogo_nacional")
    .select("codigo")
    .eq("codigo", payload.codigo)
    .maybeSingle();

  if (existing) {
    return { error: `El código ${payload.codigo} ya existe en el catálogo.` };
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
  await registrarOpcionesDesdeCatalogoInput(input);
  return { data: data as CatalogoNacional };
}

export async function createCatalogoNacionalExtension(
  input: CreateCatalogoNacionalInput,
): Promise<{ data?: CatalogoNacional; error?: string }> {
  await requireProfile("CONTADOR");

  const validationError = validarCreateCatalogoNacionalExtensionInput(input);
  if (validationError) return { error: validationError };

  const payload = buildCreateCatalogoNacionalExtensionPayload(input);
  const supabase = await createClient();

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
  await registrarOpcionesDesdeCatalogoInput(input);
  return { data: data as CatalogoNacional };
}

export async function updateCatalogoPropio(
  codigo: string,
  input: UpdateCatalogoPropioInput,
): Promise<{ data?: CatalogoNacional; error?: string }> {
  await requireProfile("CONTADOR");

  const trimmed = codigo.trim();
  if (!CATALOGO_PROPIO_CODIGO_RE.test(trimmed)) {
    return { error: "Solo se pueden editar ítems del catálogo propio (BD…)." };
  }

  const validationError = validarUpdateCatalogoPropioInput(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
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
  await registrarOpcionesDesdeCatalogoInput(input);
  return { data: data as CatalogoNacional };
}

export async function updateCatalogoNacionalContabilidad(
  codigo: string,
  input: UpdateCatalogoNacionalContabilidadInput,
): Promise<{ data?: CatalogoNacional; error?: string }> {
  await requireProfile("CONTADOR");

  const trimmed = codigo.trim();
  if (CATALOGO_PROPIO_CODIGO_RE.test(trimmed)) {
    return { error: "Use el catálogo propio para ítems BD…" };
  }

  const payload = buildUpdateCatalogoNacionalContabilidadPayload(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_catalogo_nacional_contabilidad", {
    p_codigo: trimmed,
    p_cuenta_codigo: payload.cuenta_codigo ?? "",
    p_contabilidad: payload.contabilidad ?? "",
    p_depreciacion: payload.depreciacion ?? "",
  });

  if (error) return { error: error.message };
  if (!data) return { error: "No se pudo actualizar el ítem." };

  return { data: data as CatalogoNacional };
}

export async function deleteCatalogoPropio(
  codigo: string,
): Promise<{ error?: string }> {
  await requireProfile("CONTADOR");

  const trimmed = codigo.trim();
  if (!CATALOGO_PROPIO_CODIGO_RE.test(trimmed)) {
    return { error: "Solo se pueden eliminar ítems del catálogo propio (BD…)." };
  }

  const supabase = await createClient();
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
  return {};
}

export async function searchCuentasContables(
  query = "",
  limit = 30,
): Promise<CuentaContable[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
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
  await requireProfile("CONTADOR");

  const validationError = validarUpsertCuentaContableInput(input);
  if (validationError) return { error: validationError };

  const codigo = normalizeCuentaCodigo(input.codigo);
  if (!codigo) return { error: "Código de cuenta contable inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_cuenta_contable", {
    p_codigo: codigo,
    p_nombre: input.nombre.trim(),
  });

  if (error) return { error: error.message };
  return { data: data as CuentaContable };
}

export async function deleteCuentaContable(codigo: string): Promise<{ error?: string }> {
  await requireProfile("CONTADOR");

  const trimmed = codigo.trim();
  const normalizado = normalizeCuentaCodigo(trimmed);
  if (!normalizado || !/^\d{1,6}$/.test(normalizado)) {
    return { error: "Código de cuenta contable inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_cuenta_contable", {
    p_codigo: normalizado,
  });

  if (error) return { error: error.message };
  return {};
}
