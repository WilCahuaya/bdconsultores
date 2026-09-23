"use server";

import { revalidatePath } from "next/cache";
import { entidadEtiqueta, type Entidad, type TipoDocumentoPlanilla } from "@inventario/types";
import { puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { listEntidadesPlanillas } from "@/lib/actions/entidades";
import { planillasDb } from "@/lib/supabase/planillas";
import { trabajadorActivoEnMes } from "@/lib/horario-asistencia";
import {
  contratoTieneFirmado,
  documentoCargado,
  tRegistroAltaLista,
  type FlujoDocumento,
  type FlujoTRegistro,
} from "@/lib/flujo-ficha";
import {
  calendarioTablero,
  celdasTableroEntidad,
  esMarcaTablero,
  esMesTablero,
  type TableroCalendario,
  type TableroCeldas,
  type TableroMarcaClave,
  type TableroTrabajadorInput,
} from "@/lib/tablero";

export type TableroFila = {
  entidadId: string;
  etiqueta: string;
  peCodigo: string | null;
  ruc: string | null;
  celdas: TableroCeldas;
};

export type TableroMando = {
  mes: string;
  calendario: TableroCalendario;
  filas: TableroFila[];
};

function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function selectIn<T>(table: string, columns: string, column: string, ids: string[]): Promise<T[]> {
  if (ids.length === 0) return [];
  const db = await planillasDb();
  const rows: T[] = [];
  for (const grupo of chunk(ids)) {
    const { data, error } = await db.from(table).select(columns).in(column, grupo);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

async function selectInMes<T>(
  table: string,
  columns: string,
  ids: string[],
  mes: string,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const db = await planillasDb();
  const rows: T[] = [];
  for (const grupo of chunk(ids)) {
    const { data, error } = await db.from(table).select(columns).eq("mes", mes).in("entidad_id", grupo);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

function pushMap<T>(map: Map<string, T[]>, key: string, value: T) {
  const lista = map.get(key) ?? [];
  lista.push(value);
  map.set(key, lista);
}

export async function listTableroMando(mes: string): Promise<TableroMando> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile) || !esMesTablero(mes)) {
    return { mes, calendario: calendarioTablero(mes), filas: [] };
  }

  const entidades = await listEntidadesPlanillas();
  const calendario = calendarioTablero(mes);
  if (entidades.length === 0) return { mes, calendario, filas: [] };

  const entidadIds = entidades.map((e) => e.id);
  const [relaciones, contratos, documentos, pensiones, tRegistros, vidaLey, marcasMes, excelMes] = await Promise.all([
    selectIn<{
      id: string;
      entidad_id: string;
      estado: string;
      fecha_ingreso: string | null;
      fecha_cese: string | null;
    }>("relaciones_laborales", "id, entidad_id, estado, fecha_ingreso, fecha_cese", "entidad_id", entidadIds),
    selectIn<{
      relacion_id: string;
      estado: string | null;
      fecha_fin: string | null;
      created_at: string | null;
      documento_id: string | null;
      es_vigente: boolean;
    }>("contratos", "relacion_id, estado, fecha_fin, created_at, documento_id, es_vigente", "entidad_id", entidadIds),
    selectIn<{
      id: string;
      relacion_id: string;
      tipo: string;
      estado: string;
      storage_path: string | null;
      updated_at: string | null;
    }>("documentos", "id, relacion_id, tipo, estado, storage_path, updated_at", "entidad_id", entidadIds),
    selectIn<{ relacion_id: string; tipo: string | null }>("pensiones", "relacion_id, tipo", "entidad_id", entidadIds),
    selectIn<{ relacion_id: string; tipo: string; realizado: boolean }>(
      "t_registro",
      "relacion_id, tipo, realizado",
      "entidad_id",
      entidadIds,
    ),
    selectIn<{ relacion_id: string; fecha_fin: string | null }>("vida_ley", "relacion_id, fecha_fin", "entidad_id", entidadIds),
    selectInMes<{ entidad_id: string; clave: string; hecho: boolean }>(
      "tablero_marcas",
      "entidad_id, clave, hecho",
      entidadIds,
      mes,
    ),
    selectInMes<{ relacion_id: string }>("asistencia_excel", "relacion_id", entidadIds, mes),
  ]);

  const docsPorRelacion = new Map<string, FlujoDocumento[]>();
  const docUpdated = new Map<string, string | null>();
  for (const doc of documentos) {
    pushMap(docsPorRelacion, doc.relacion_id, {
      id: doc.id,
      tipo: doc.tipo as TipoDocumentoPlanilla,
      estado: doc.estado as FlujoDocumento["estado"],
      storage_path: doc.storage_path,
    });
    docUpdated.set(doc.id, doc.updated_at);
  }

  const contratosPorRelacion = new Map<string, typeof contratos>();
  for (const c of contratos) pushMap(contratosPorRelacion, c.relacion_id, c);

  const pensionPorRelacion = new Map(pensiones.map((p) => [p.relacion_id, p.tipo]));
  const tRegPorRelacion = new Map<string, FlujoTRegistro[]>();
  for (const row of tRegistros) {
    pushMap(tRegPorRelacion, row.relacion_id, {
      tipo: row.tipo === "BAJA" ? "BAJA" : "ALTA",
      realizado: Boolean(row.realizado),
    });
  }
  const vidaLeyPorRelacion = new Map(vidaLey.map((v) => [v.relacion_id, v.fecha_fin]));
  const excelSet = new Set(excelMes.map((row) => row.relacion_id));
  const marcasPorEntidad = new Map<string, Partial<Record<TableroMarcaClave, boolean>>>();
  for (const row of marcasMes) {
    if (!esMarcaTablero(row.clave)) continue;
    const actual = marcasPorEntidad.get(row.entidad_id) ?? {};
    actual[row.clave] = Boolean(row.hecho);
    marcasPorEntidad.set(row.entidad_id, actual);
  }

  const trabajadoresPorEntidad = new Map<string, TableroTrabajadorInput[]>();
  for (const rel of relaciones) {
    const flujoDocs = docsPorRelacion.get(rel.id) ?? [];
    const tRegistro = tRegPorRelacion.get(rel.id) ?? [];
    const lista = trabajadoresPorEntidad.get(rel.entidad_id) ?? [];
    lista.push({
      id: rel.id,
      fechaIngreso: rel.fecha_ingreso,
      fechaCese: rel.fecha_cese,
      estado: rel.estado,
      pensionTipo: pensionPorRelacion.get(rel.id) ?? null,
      tRegistroOk: tRegistroAltaLista({ documentos: flujoDocs, tRegistro }),
      afpDocOk: documentoCargado(flujoDocs, "TRAMITE_AFP"),
      vidaLeyComprobanteOk: documentoCargado(flujoDocs, "VIDA_LEY_COMPROBANTE"),
      excelGenerado: excelSet.has(rel.id),
      vidaLeyFechaFin: vidaLeyPorRelacion.get(rel.id) ?? null,
      contratos: (contratosPorRelacion.get(rel.id) ?? []).map((c) => ({
        estado: c.estado,
        fechaFin: c.fecha_fin,
        createdAt: c.created_at,
        firmado: contratoTieneFirmado({ documento_id: c.documento_id }, flujoDocs),
        docUpdatedAt: c.documento_id ? (docUpdated.get(c.documento_id) ?? null) : null,
        esVigente: Boolean(c.es_vigente),
      })),
    });
    trabajadoresPorEntidad.set(rel.entidad_id, lista);
  }

  const filas: TableroFila[] = entidades.map((entidad) => ({
    entidadId: entidad.id,
    etiqueta: entidadEtiqueta(entidad as Entidad),
    peCodigo: entidad.pe_codigo ?? null,
    ruc: entidad.ruc ?? null,
    celdas: celdasTableroEntidad(
      {
        id: entidad.id,
        trabajadores: trabajadoresPorEntidad.get(entidad.id) ?? [],
        marcas: marcasPorEntidad.get(entidad.id) ?? {},
      },
      calendario,
      {
        contratos: `/contratos?entidadId=${entidad.id}`,
        asistencias: `/asistencias?entidadId=${entidad.id}&mes=${mes}`,
        vidaLey: `/vida-ley?entidadId=${entidad.id}`,
        alta: `/contratos?entidadId=${entidad.id}`,
      },
      (t) => trabajadorActivoEnMes(mes, t.fechaIngreso, t.fechaCese),
    ),
  }));

  return { mes, calendario, filas };
}

export async function marcarTablero(
  entidadId: string,
  mes: string,
  clave: string,
  hecho: boolean,
): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) return { error: "Solo el estudio puede marcar el tablero." };
  if (!esMesTablero(mes) || !esMarcaTablero(clave) || !entidadId) {
    return { error: "Datos incompletos." };
  }

  const db = await planillasDb();
  const { data: existente, error: loadError } = await db
    .from("tablero_marcas")
    .select("id")
    .eq("entidad_id", entidadId)
    .eq("mes", mes)
    .eq("clave", clave)
    .maybeSingle();
  if (loadError) return { error: loadError.message };

  const campos = {
    hecho,
    hecho_en: hecho ? new Date().toISOString() : null,
    hecho_por: hecho ? profile.id : null,
  };

  if (existente) {
    const { error } = await db.from("tablero_marcas").update(campos).eq("id", existente.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("tablero_marcas").insert({
      entidad_id: entidadId,
      mes,
      clave,
      ...campos,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/tablero");
  return {};
}
