"use server";

import { revalidatePath } from "next/cache";
import {
  normalizeImportCodigoCatalogoRaw,
  validateImportActivoFila,
  type ImportActivoCatalogoItem,
  type ImportActivoErrorItem,
  type ImportActivoFila,
  type ImportActivosResult,
  type ImportActivoInsertPayload,
  type ImportUbicacionRef,
} from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/profile";
import { listAmbientesPorEntidad } from "@/lib/actions/ubicacion";
import { upsertCuentaContable } from "@/lib/actions/catalogo";

export async function getImportActivosUbicaciones(entidadId: string): Promise<ImportUbicacionRef[]> {
  await requireProfile("CONTADOR");
  const ambientes = await listAmbientesPorEntidad(entidadId);
  return ambientes.map((a) => ({
    sedeId: a.sede_id,
    sedeNombre: a.sede_nombre,
    ambienteId: a.id,
    ambienteNombre: a.nombre,
    responsable: a.responsable,
    esPreregistro: a.es_preregistro,
  }));
}

async function loadCatalogoForImport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  codigos: string[],
): Promise<Map<string, ImportActivoCatalogoItem>> {
  const unique = [...new Set(codigos)];
  const map = new Map<string, ImportActivoCatalogoItem>();
  if (unique.length === 0) return map;

  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data } = await supabase
      .from("catalogo_nacional")
      .select("codigo, denominacion, cuenta_codigo, contabilidad, depreciacion")
      .in("codigo", chunk);
    for (const row of data ?? []) {
      map.set(row.codigo as string, {
        denominacion: String(row.denominacion ?? ""),
        cuenta_codigo: (row.cuenta_codigo as string | null) ?? null,
        contabilidad: (row.contabilidad as string | null) ?? null,
        depreciacion: (row.depreciacion as string | null) ?? null,
      });
    }
  }
  return map;
}

async function loadCuentasContablesLookup(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data } = await supabase.from("cuentas_contables").select("codigo, nombre");
  for (const row of data ?? []) {
    const codigo = String(row.codigo ?? "").trim();
    if (!codigo) continue;
    map.set(codigo, String(row.nombre ?? "").trim() || codigo);
  }
  return map;
}

function collectImportCatalogoCodigos(filas: ImportActivoFila[]): string[] {
  const codes = new Set<string>();
  for (const fila of filas) {
    for (const code of normalizeImportCodigoCatalogoRaw(fila["Código catálogo"])) {
      codes.add(code);
    }
  }
  return [...codes];
}

function responsableForImportPayload(
  payload: ImportActivoInsertPayload,
  ubicaciones: ImportUbicacionRef[],
): string | null {
  const ambienteId =
    payload.estado_registro === "REGISTRADO"
      ? payload.ambiente_id
      : payload.posible_ambiente_id;
  if (!ambienteId) return null;
  const ref = ubicaciones.find((u) => u.ambienteId === ambienteId);
  return ref?.responsable?.trim() || null;
}

function buildActivosInsertFromImport(
  payload: ImportActivoInsertPayload,
  responsable: string | null,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    entidad_id: payload.entidad_id,
    codigo_catalogo: payload.codigo_catalogo,
    nombre: payload.nombre,
    caracteristicas: payload.caracteristicas,
    categoria: payload.categoria,
    estado_bien: payload.estado_bien,
    marca: payload.marca,
    modelo: payload.modelo,
    serie: payload.serie,
    color: payload.color,
    medidas: payload.medidas,
    fecha_adquisicion: payload.fecha_adquisicion,
    fecha_inicio_depreciacion: payload.fecha_inicio_depreciacion ?? undefined,
    valor_adquisicion: payload.valor_adquisicion,
    valor_es_mercado: payload.valor_es_mercado,
    depreciacion: payload.depreciacion,
    vida_util_meses: payload.vida_util_meses,
    observacion: payload.observacion,
    responsable,
    cuenta_contable_codigo: payload.cuenta_contable_codigo,
    cuenta_contable_nombre: payload.cuenta_contable_nombre,
  };

  if (payload.estado_registro === "REGISTRADO") {
    return {
      ...base,
      sede_id: payload.sede_id,
      ambiente_id: payload.ambiente_id,
      estado_registro: "REGISTRADO",
    };
  }

  return {
    ...base,
    estado_registro: "PREREGISTRADO",
    posible_ambiente_id: payload.posible_ambiente_id,
  };
}

export async function importActivos(
  entidadId: string,
  filas: ImportActivoFila[],
  options?: { filaOffset?: number },
): Promise<{ data?: ImportActivosResult; error?: string }> {
  await requireProfile("CONTADOR");
  if (!entidadId) return { error: "Seleccione una entidad." };
  if (filas.length === 0) return { error: "No hay filas para importar." };

  const supabase = await createClient();

  const { data: entidad } = await supabase
    .from("entidades")
    .select("id")
    .eq("id", entidadId)
    .eq("activo", true)
    .maybeSingle();
  if (!entidad) return { error: "Entidad no encontrada." };

  const ubicaciones = await getImportActivosUbicaciones(entidadId);
  const codigos = collectImportCatalogoCodigos(filas);
  const [catalogoByCodigo, cuentaLookupSeed] = await Promise.all([
    loadCatalogoForImport(supabase, codigos),
    loadCuentasContablesLookup(supabase),
  ]);

  const errores: ImportActivoErrorItem[] = [];
  let importados = 0;
  let cuentaLookup = cuentaLookupSeed;
  const filaOffset = options?.filaOffset ?? 0;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const filaExcel = filaOffset + i + 2;
    const validated = validateImportActivoFila(
      fila,
      entidadId,
      ubicaciones,
      catalogoByCodigo,
      cuentaLookup,
    );
    if (!validated.ok) {
      errores.push({ fila: filaExcel, datos: fila, motivo: validated.motivo });
      continue;
    }

    cuentaLookup = validated.cuentaLookup;
    if (validated.cuentaToCreate) {
      const created = await upsertCuentaContable(validated.cuentaToCreate);
      if (created.error) {
        errores.push({ fila: filaExcel, datos: fila, motivo: created.error });
        continue;
      }
    }

    const payload = validated.payload;
    const responsable = responsableForImportPayload(payload, ubicaciones);

    const { error } = await supabase
      .from("activos")
      .insert(buildActivosInsertFromImport(payload, responsable));

    if (error) {
      errores.push({ fila: filaExcel, datos: fila, motivo: error.message });
      continue;
    }

    importados += 1;
  }

  revalidatePath("/contador/inventario");
  revalidatePath("/contador/entidades");
  revalidatePath("/admin/activos");
  revalidatePath("/admin");

  return {
    data: {
      totalFilas: filas.length,
      importados,
      errores,
    },
  };
}
