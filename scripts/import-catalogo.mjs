#!/usr/bin/env node
/**
 * Importa el catálogo desde la primera hoja de un .xlsx
 * (o desde docs/Catalogo nacional de activos.ods si no se pasa archivo).
 *
 *   pnpm import:catalogo -- "ruta.xlsx"     → genera supabase/seed/catalogo_nacional.sql
 *   pnpm import:catalogo -- "ruta.xlsx" --push
 *     reemplaza catalogo_nacional en Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEED_PATH = join(ROOT, "supabase/seed/catalogo_nacional.sql");

function sqlVal(value) {
  if (value == null || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function writeSeedSql(rows) {
  mkdirSync(dirname(SEED_PATH), { recursive: true });
  const lines = [
    "-- Catálogo nacional y propio — generado por scripts/import-catalogo.mjs",
    "-- Requiere 20260926190000_activos_codigo_catalogo_sin_fk.sql (el bien no apunta al catálogo).",
    "-- Reemplaza cuentas contables, catálogo nacional y catálogo propio.",
    "BEGIN;",
    "DELETE FROM public.cuentas_contables;",
    "DELETE FROM public.catalogo_nacional;",
  ];

  const onConflict = `
ON CONFLICT (codigo) DO UPDATE SET
  denominacion = EXCLUDED.denominacion,
  grupo = EXCLUDED.grupo,
  clase = EXCLUDED.clase,
  cuenta_codigo = EXCLUDED.cuenta_codigo,
  contabilidad = EXCLUDED.contabilidad,
  depreciacion = EXCLUDED.depreciacion,
  resolucion = EXCLUDED.resolucion,
  estado = EXCLUDED.estado,
  origen = EXCLUDED.origen`;

  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    lines.push(
      "INSERT INTO public.catalogo_nacional (codigo, denominacion, grupo, clase, cuenta_codigo, contabilidad, depreciacion, resolucion, estado, origen) VALUES",
    );
    lines.push(
      batch
        .map(
          (r) =>
            `  (${[
              sqlVal(r.codigo),
              sqlVal(r.denominacion),
              sqlVal(r.grupo),
              sqlVal(r.clase),
              sqlVal(r.cuenta_codigo),
              sqlVal(r.contabilidad),
              sqlVal(r.depreciacion),
              sqlVal(r.resolucion),
              sqlVal(r.estado),
              sqlVal(r.origen || "NACIONAL"),
            ].join(", ")})`,
        )
        .join(",\n") + onConflict + ";",
    );
  }

  lines.push("COMMIT;");
  writeFileSync(SEED_PATH, lines.join("\n"), "utf8");
  console.log(`Seed SQL: ${SEED_PATH} (${rows.length} filas)`);
}

function parseCatalogo(sourcePath) {
  const script = join(__dirname, "parse-catalogo-ods.py");
  const args = sourcePath ? [script, sourcePath] : [script];
  let lastError = "Python no encontrado";
  for (const bin of ["python", "python3"]) {
    const result = spawnSync(bin, args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error?.code === "ENOENT") continue;
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `python salió con ${result.status}`);
    }
    return JSON.parse(result.stdout);
  }
  throw new Error(lastError);
}

async function pushToSupabase(rows) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Defina SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para --push");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: deleteError } = await supabase.from("catalogo_nacional").delete().not("codigo", "is", null);
  if (deleteError) throw deleteError;

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("catalogo_nacional").upsert(batch, { onConflict: "codigo" });
    if (error) throw error;
    console.log(`Cargados ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
  }

  console.log("Catálogo reemplazado en Supabase.");
}

async function main() {
  const sourcePath = process.argv.find((arg) => arg.toLowerCase().endsWith(".xlsx") || arg.toLowerCase().endsWith(".ods"));
  const rows = parseCatalogo(sourcePath);
  console.log(`Fuente: ${rows.length} ítems`);
  writeSeedSql(rows);

  if (process.argv.includes("--push")) {
    await pushToSupabase(rows);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
