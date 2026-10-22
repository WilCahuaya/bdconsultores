import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";
import { minCatalogoQueryLength } from "@inventario/types";
import { initOfflineSchema } from "./offline";

export interface CatalogoRow {
  codigo: string;
  denominacion: string;
  grupo: string | null;
  clase: string | null;
  cuenta_codigo: string | null;
  contabilidad: string | null;
  depreciacion: string | null;
  resolucion: string | null;
  estado: string | null;
  origen: string;
}

function ensureCatalogoOrigenColumn(database: Database.Database): void {
  const cols = database
    .prepare("PRAGMA table_info(catalogo_nacional)")
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "origen")) {
    database.exec(
      `ALTER TABLE catalogo_nacional ADD COLUMN origen TEXT NOT NULL DEFAULT 'NACIONAL'`,
    );
  }
}

export interface CatalogoMeta {
  count: number;
  syncedAt: string | null;
}

let db: Database.Database | null = null;

function getDbPath(): string {
  return path.join(app.getPath("userData"), "inventario.db");
}

export function initCatalogDatabase(): void {
  if (db) return;

  db = new Database(getDbPath());
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalogo_nacional (
      codigo TEXT PRIMARY KEY NOT NULL,
      denominacion TEXT NOT NULL,
      grupo TEXT,
      clase TEXT,
      cuenta_codigo TEXT,
      contabilidad TEXT,
      depreciacion TEXT,
      resolucion TEXT,
      estado TEXT,
      origen TEXT NOT NULL DEFAULT 'NACIONAL'
    );
    CREATE INDEX IF NOT EXISTS idx_catalogo_denominacion
      ON catalogo_nacional (denominacion);
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  ensureCatalogoOrigenColumn(db);
  initOfflineSchema(db);
}

export function getCatalogDb(): Database.Database {
  if (!db) initCatalogDatabase();
  if (!db) throw new Error("Base de datos no inicializada");
  return db;
}

export function replaceCatalog(rows: CatalogoRow[]): CatalogoMeta {
  if (!db) throw new Error("Base de datos no inicializada");

  const insert = db.prepare(`
    INSERT OR REPLACE INTO catalogo_nacional (
      codigo, denominacion, grupo, clase, cuenta_codigo,
      contabilidad, depreciacion, resolucion, estado, origen
    ) VALUES (
      @codigo, @denominacion, @grupo, @clase, @cuenta_codigo,
      @contabilidad, @depreciacion, @resolucion, @estado, @origen
    )
  `);

  const syncedAt = new Date().toISOString();
  const tx = db.transaction((items: CatalogoRow[]) => {
    db!.exec("DELETE FROM catalogo_nacional");
    for (const row of items) {
      insert.run({ ...row, origen: row.origen || "NACIONAL" });
    }
    db!.prepare(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('catalogo_synced_at', @value)",
    ).run({ value: syncedAt });
  });

  tx(rows);

  return { count: rows.length, syncedAt };
}

export function upsertCatalogRow(row: CatalogoRow): void {
  if (!db) throw new Error("Base de datos no inicializada");

  db.prepare(
    `
    INSERT OR REPLACE INTO catalogo_nacional (
      codigo, denominacion, grupo, clase, cuenta_codigo,
      contabilidad, depreciacion, resolucion, estado, origen
    ) VALUES (
      @codigo, @denominacion, @grupo, @clase, @cuenta_codigo,
      @contabilidad, @depreciacion, @resolucion, @estado, @origen
    )
  `,
  ).run({ ...row, origen: row.origen || "NACIONAL" });
}

export function getCatalogByCodigo(codigo: string): CatalogoRow | null {
  if (!db) throw new Error("Base de datos no inicializada");

  const trimmed = codigo.trim();
  if (!trimmed) return null;

  const row = db
    .prepare("SELECT * FROM catalogo_nacional WHERE codigo = @codigo LIMIT 1")
    .get({ codigo: trimmed }) as CatalogoRow | undefined;

  return row ?? null;
}

export function searchCatalog(query: string, limit = 20): CatalogoRow[] {
  if (!db) throw new Error("Base de datos no inicializada");

  const trimmed = query.trim();
  if (trimmed.length < minCatalogoQueryLength(trimmed)) return [];

  const up = trimmed.toUpperCase();
  const origen = up.startsWith("BD") ? "PROPIO" : /^\d+$/.test(trimmed) ? "NACIONAL" : null;
  const origenClause =
    origen === "PROPIO"
      ? "AND (origen = 'PROPIO' OR upper(trim(codigo)) LIKE 'BD%')"
      : origen === "NACIONAL"
        ? "AND COALESCE(origen, '') <> 'PROPIO' AND upper(trim(codigo)) NOT LIKE 'BD%'"
        : "";

  return db
    .prepare(
      `
      SELECT *
      FROM catalogo_nacional
      WHERE (
        upper(trim(codigo)) LIKE @prefix
        OR denominacion LIKE @pattern
      )
      ${origenClause}
      ORDER BY
        CASE WHEN upper(trim(codigo)) = @exact THEN 0 ELSE 1 END,
        CASE WHEN upper(trim(codigo)) LIKE @prefix THEN 0 ELSE 1 END,
        length(denominacion),
        denominacion
      LIMIT @limit
    `,
    )
    .all({
      exact: up,
      prefix: `${up}%`,
      pattern: `%${trimmed}%`,
      limit: Math.min(Math.max(limit, 1), 500),
    }) as CatalogoRow[];
}

export function getCatalogMeta(): CatalogoMeta {
  if (!db) throw new Error("Base de datos no inicializada");

  const countRow = db.prepare("SELECT COUNT(*) AS count FROM catalogo_nacional").get() as {
    count: number;
  };
  const syncedRow = db
    .prepare("SELECT value FROM meta WHERE key = 'catalogo_synced_at'")
    .get() as { value: string } | undefined;

  return {
    count: countRow?.count ?? 0,
    syncedAt: syncedRow?.value ?? null,
  };
}

export function deleteCatalogRow(codigo: string): void {
  if (!db) throw new Error("Base de datos no inicializada");
  db.prepare("DELETE FROM catalogo_nacional WHERE codigo = @codigo").run({
    codigo: codigo.trim(),
  });
}

export function listCatalogoPropioLocal(): CatalogoRow[] {
  if (!db) throw new Error("Base de datos no inicializada");
  return db
    .prepare(
      `
      SELECT *
      FROM catalogo_nacional
      WHERE origen = 'PROPIO' OR codigo LIKE 'BD%'
      ORDER BY codigo
    `,
    )
    .all() as CatalogoRow[];
}

export function closeCatalogDatabase(): void {
  db?.close();
  db = null;
}
