import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webEnv = path.join(root, "apps/web/.env.local");

if (!fs.existsSync(webEnv)) {
  console.error("Falta apps/web/.env.local. Cópielo desde .env.example y ponga las keys de Supabase.");
  process.exit(1);
}

const src = fs.readFileSync(webEnv, "utf8");

function pick(key) {
  const match = src.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

const url = pick("NEXT_PUBLIC_SUPABASE_URL");
const anon = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const service = pick("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !anon) {
  console.error("apps/web/.env.local no tiene NEXT_PUBLIC_SUPABASE_URL o ANON_KEY.");
  process.exit(1);
}

function existingEnvValue(app, key) {
  const dest = path.join(root, "apps", app, ".env.local");
  if (!fs.existsSync(dest)) return "";
  const text = fs.readFileSync(dest, "utf8");
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function writeEnv(app, extraLines) {
  const sunatToken = existingEnvValue(app, "SUNAT_RUC_API_TOKEN") || pick("SUNAT_RUC_API_TOKEN");
  const dniToken = existingEnvValue(app, "RENIEC_DNI_API_TOKEN") || pick("RENIEC_DNI_API_TOKEN");
  const lines = [
    "NEXT_PUBLIC_PORTAL_ORIGIN=http://127.0.0.1:3010",
    "NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3010",
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    service ? `SUPABASE_SERVICE_ROLE_KEY=${service}` : null,
    sunatToken ? `SUNAT_RUC_API_TOKEN=${sunatToken}` : null,
    dniToken ? `RENIEC_DNI_API_TOKEN=${dniToken}` : null,
    ...extraLines,
  ].filter(Boolean);

  const dest = path.join(root, "apps", app, ".env.local");
  fs.writeFileSync(dest, `${lines.join("\n")}\n`);
  console.log(`OK  apps/${app}/.env.local`);
}

writeEnv("portal", [
  "INVENTARIOS_ORIGIN=http://127.0.0.1:3011",
  "PLANILLAS_ORIGIN=http://127.0.0.1:3012",
]);
writeEnv("inventarios", []);
writeEnv("planillas", []);
