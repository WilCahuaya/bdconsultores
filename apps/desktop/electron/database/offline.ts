import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";
import { randomUUID } from "crypto";

let db: Database.Database | null = null;

function getDbPath(): string {
  return path.join(app.getPath("userData"), "inventario.db");
}

export function getOfflineDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma("journal_mode = WAL");
    initOfflineSchema(db);
  }
  return db;
}

export function initOfflineSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL,
      entidad_id TEXT NOT NULL,
      activo_id TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entidad ON sync_queue(entidad_id);

    CREATE TABLE IF NOT EXISTS activos_cache (
      id TEXT PRIMARY KEY NOT NULL,
      entidad_id TEXT NOT NULL,
      codigo_barras TEXT,
      codigo_catalogo TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activos_cache_entidad ON activos_cache(entidad_id);
    CREATE INDEX IF NOT EXISTS idx_activos_cache_barras ON activos_cache(entidad_id, codigo_barras);
    CREATE INDEX IF NOT EXISTS idx_activos_cache_catalogo ON activos_cache(entidad_id, codigo_catalogo);

    CREATE TABLE IF NOT EXISTS master_cache (
      domain TEXT NOT NULL,
      entidad_id TEXT NOT NULL DEFAULT '',
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (domain, entidad_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_master_cache_domain_entidad
      ON master_cache(domain, entidad_id);
  `);
}

export interface SyncQueueRow {
  id: string;
  operation: string;
  entidad_id: string;
  activo_id: string | null;
  payload: string;
  created_at: string;
  last_error: string | null;
}

export function enqueueSyncItem(item: {
  operation: string;
  entidad_id: string;
  activo_id?: string | null;
  payload: unknown;
}): SyncQueueRow {
  const database = getOfflineDb();
  const row: SyncQueueRow = {
    id: randomUUID(),
    operation: item.operation,
    entidad_id: item.entidad_id,
    activo_id: item.activo_id ?? null,
    payload: JSON.stringify(item.payload),
    created_at: new Date().toISOString(),
    last_error: null,
  };

  database
    .prepare(
      `INSERT INTO sync_queue (id, operation, entidad_id, activo_id, payload, created_at, last_error)
       VALUES (@id, @operation, @entidad_id, @activo_id, @payload, @created_at, @last_error)`,
    )
    .run(row);

  return row;
}

export function listSyncQueue(): SyncQueueRow[] {
  const database = getOfflineDb();
  return database
    .prepare("SELECT * FROM sync_queue ORDER BY created_at ASC")
    .all() as SyncQueueRow[];
}

export function syncQueueCount(): number {
  const database = getOfflineDb();
  const row = database.prepare("SELECT COUNT(*) AS c FROM sync_queue").get() as { c: number };
  return row?.c ?? 0;
}

export function removeSyncItem(id: string): void {
  getOfflineDb().prepare("DELETE FROM sync_queue WHERE id = @id").run({ id });
}

export function setSyncItemError(id: string, error: string): void {
  getOfflineDb()
    .prepare("UPDATE sync_queue SET last_error = @error WHERE id = @id")
    .run({ id, error });
}

export function replaceActivosCache(entidadId: string, items: unknown[]): number {
  const database = getOfflineDb();
  const now = new Date().toISOString();
  const del = database.prepare("DELETE FROM activos_cache WHERE entidad_id = @entidadId");
  const ins = database.prepare(`
    INSERT INTO activos_cache (id, entidad_id, codigo_barras, codigo_catalogo, data, updated_at)
    VALUES (@id, @entidad_id, @codigo_barras, @codigo_catalogo, @data, @updated_at)
  `);

  const tx = database.transaction((rows: unknown[]) => {
    del.run({ entidadId });
    for (const raw of rows) {
      const a = raw as Record<string, unknown>;
      ins.run({
        id: String(a.id),
        entidad_id: entidadId,
        codigo_barras: (a.codigo_barras as string | null) ?? null,
        codigo_catalogo: String(a.codigo_catalogo ?? ""),
        data: JSON.stringify(raw),
        updated_at: now,
      });
    }
  });

  tx(items);
  return items.length;
}

export function findCachedActivo(entidadId: string, codigo: string): unknown | null {
  const trimmed = codigo.trim();
  if (!trimmed) return null;

  const database = getOfflineDb();
  const row = database
    .prepare(
      `SELECT data FROM activos_cache
       WHERE entidad_id = @entidadId
         AND (codigo_barras = @codigo OR codigo_catalogo = @codigo)
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get({ entidadId, codigo: trimmed }) as { data: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.data) as unknown;
}

export function upsertCachedActivo(entidadId: string, activo: unknown): void {
  const a = activo as Record<string, unknown>;
  const database = getOfflineDb();
  database
    .prepare(
      `INSERT OR REPLACE INTO activos_cache (id, entidad_id, codigo_barras, codigo_catalogo, data, updated_at)
       VALUES (@id, @entidad_id, @codigo_barras, @codigo_catalogo, @data, @updated_at)`,
    )
    .run({
      id: String(a.id),
      entidad_id: entidadId,
      codigo_barras: (a.codigo_barras as string | null) ?? null,
      codigo_catalogo: String(a.codigo_catalogo ?? ""),
      data: JSON.stringify(activo),
      updated_at: new Date().toISOString(),
    });
}

export function removeCachedActivo(entidadId: string, activoId: string): boolean {
  const database = getOfflineDb();
  const result = database
    .prepare("DELETE FROM activos_cache WHERE entidad_id = @entidadId AND id = @id")
    .run({ entidadId, id: activoId });
  return result.changes > 0;
}

export function listCachedActivos(entidadId: string): unknown[] {
  const database = getOfflineDb();
  const rows = database
    .prepare(
      `SELECT data FROM activos_cache
       WHERE entidad_id = @entidadId
       ORDER BY json_extract(data, '$.nombre') COLLATE NOCASE`,
    )
    .all({ entidadId }) as { data: string }[];

  return rows.map((row) => JSON.parse(row.data) as unknown);
}

export function cacheMeta(entidadId: string): { count: number; updatedAt: string | null } {
  const database = getOfflineDb();
  const countRow = database
    .prepare("SELECT COUNT(*) AS c FROM activos_cache WHERE entidad_id = @entidadId")
    .get({ entidadId }) as { c: number };
  const updatedRow = database
    .prepare("SELECT MAX(updated_at) AS u FROM activos_cache WHERE entidad_id = @entidadId")
    .get({ entidadId }) as { u: string | null };
  return { count: countRow?.c ?? 0, updatedAt: updatedRow?.u ?? null };
}

export type MasterCacheDomain =
  | "entidades"
  | "sedes"
  | "ambientes"
  | "espacios"
  | "edificios"
  | "pisos"
  | "responsables"
  | "visitas"
  | "visita_ambientes";

export function replaceMasterCache(
  domain: MasterCacheDomain,
  entidadId: string,
  items: unknown[],
): number {
  const database = getOfflineDb();
  const now = new Date().toISOString();
  const scope = entidadId || "";
  const del = database.prepare(
    "DELETE FROM master_cache WHERE domain = @domain AND entidad_id = @entidadId",
  );
  const ins = database.prepare(`
    INSERT INTO master_cache (domain, entidad_id, id, data, updated_at)
    VALUES (@domain, @entidad_id, @id, @data, @updated_at)
  `);

  const tx = database.transaction((rows: unknown[]) => {
    del.run({ domain, entidadId: scope });
    for (const raw of rows) {
      const a = raw as Record<string, unknown>;
      const id = String(a.id ?? "");
      if (!id) continue;
      ins.run({
        domain,
        entidad_id: scope,
        id,
        data: JSON.stringify(raw),
        updated_at: now,
      });
    }
  });

  tx(items);
  return items.length;
}

export function listMasterCache(domain: MasterCacheDomain, entidadId = ""): unknown[] {
  const database = getOfflineDb();
  const rows = database
    .prepare(
      `SELECT data FROM master_cache
       WHERE domain = @domain AND entidad_id = @entidadId
       ORDER BY updated_at DESC`,
    )
    .all({ domain, entidadId: entidadId || "" }) as { data: string }[];
  return rows.map((row) => JSON.parse(row.data) as unknown);
}

export function upsertMasterCacheItem(
  domain: MasterCacheDomain,
  entidadId: string,
  item: unknown,
): void {
  const a = item as Record<string, unknown>;
  const id = String(a.id ?? "");
  if (!id) return;
  const database = getOfflineDb();
  database
    .prepare(
      `INSERT OR REPLACE INTO master_cache (domain, entidad_id, id, data, updated_at)
       VALUES (@domain, @entidad_id, @id, @data, @updated_at)`,
    )
    .run({
      domain,
      entidad_id: entidadId || "",
      id,
      data: JSON.stringify(item),
      updated_at: new Date().toISOString(),
    });
}

export function removeMasterCacheItem(
  domain: MasterCacheDomain,
  entidadId: string,
  id: string,
): void {
  getOfflineDb()
    .prepare(
      `DELETE FROM master_cache
       WHERE domain = @domain AND entidad_id = @entidadId AND id = @id`,
    )
    .run({ domain, entidadId: entidadId || "", id });
}

export function masterCacheMeta(
  domain: MasterCacheDomain,
  entidadId = "",
): { count: number; updatedAt: string | null } {
  const database = getOfflineDb();
  const countRow = database
    .prepare(
      `SELECT COUNT(*) AS c FROM master_cache
       WHERE domain = @domain AND entidad_id = @entidadId`,
    )
    .get({ domain, entidadId: entidadId || "" }) as { c: number };
  const updatedRow = database
    .prepare(
      `SELECT MAX(updated_at) AS u FROM master_cache
       WHERE domain = @domain AND entidad_id = @entidadId`,
    )
    .get({ domain, entidadId: entidadId || "" }) as { u: string | null };
  return { count: countRow?.c ?? 0, updatedAt: updatedRow?.u ?? null };
}

export function findMasterCacheById(
  domain: MasterCacheDomain,
  id: string,
): { entidadId: string; data: unknown } | null {
  const database = getOfflineDb();
  const row = database
    .prepare(
      `SELECT entidad_id, data FROM master_cache
       WHERE domain = @domain AND id = @id
       LIMIT 1`,
    )
    .get({ domain, id }) as { entidad_id: string; data: string } | undefined;
  if (!row) return null;
  return { entidadId: row.entidad_id, data: JSON.parse(row.data) as unknown };
}
