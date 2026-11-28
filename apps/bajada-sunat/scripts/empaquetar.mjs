import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const raiz = join(app, "../..");
const planillas = join(raiz, "apps", "planillas");

function claveDe(texto, nombre) {
  const match = texto.match(new RegExp(`^${nombre}=(.*)$`, "m"));
  const valor = match?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  if (!valor) throw new Error(`Falta ${nombre} en apps/planillas/.env.local.`);
  return valor;
}

function escribirConfig() {
  const archivo = join(planillas, ".env.local");
  if (!existsSync(archivo)) throw new Error("Falta apps/planillas/.env.local en esta PC.");
  const texto = readFileSync(archivo, "utf8");
  const lineas = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ENCRYPTION_KEY"].map(
    (nombre) => `${nombre}=${claveDe(texto, nombre)}`,
  );
  writeFileSync(join(app, "embebido.env"), `${lineas.join("\n")}\n`, "utf8");
}

function pnpm(args, cwd) {
  execFileSync("pnpm", args, { cwd, stdio: "inherit", shell: true, env: process.env });
}

function resolverPaquete(nombre) {
  const salida = execFileSync(
    "pnpm",
    ["--filter", "@bd/planillas", "exec", "node", "-e", `process.stdout.write(require.resolve('${nombre}/package.json'))`],
    { cwd: raiz, encoding: "utf8", shell: true },
  ).trim();
  return dirname(salida);
}

function copiarPaquete(nombre, destino) {
  if (existsSync(join(destino, "package.json"))) return;
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(dirname(destino), { recursive: true });
  cpSync(resolverPaquete(nombre), destino, { recursive: true, dereference: true });
}

function copiarNavegador() {
  const origen = join(process.env.LOCALAPPDATA ?? "", "ms-playwright", "chromium-1255");
  const chrome = join(origen, "chrome-win64", "chrome.exe");
  if (!existsSync(chrome)) {
    throw new Error(
      "No está el navegador de Playwright. En esta PC ejecuta: pnpm --filter @bd/planillas exec playwright install chromium",
    );
  }
  const destino = join(app, "browsers", "chromium-1255");
  const chromeDestino = join(destino, "chrome-win64", "chrome.exe");
  if (existsSync(chromeDestino)) return;
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(join(app, "browsers"), { recursive: true });
  cpSync(origen, destino, { recursive: true, dereference: true });
}

function empaquetarScript(entrada, salida) {
  pnpm(
    [
      "exec",
      "esbuild",
      entrada,
      "--bundle",
      "--platform=node",
      "--format=cjs",
      `--outfile=${salida}`,
      "--external:playwright",
    ],
    app,
  );
}

escribirConfig();
pnpm(["exec", "tsc", "-p", "tsconfig.json"], app);
mkdirSync(join(app, "bundle"), { recursive: true });
for (const viejo of ["escuchar.mjs", "bajar.mjs", "escuchar.cjs", "bajar.cjs", "probe.cjs"]) {
  rmSync(join(app, "bundle", viejo), { force: true });
}
empaquetarScript(join(planillas, "scripts", "escuchar-compras.ts"), join(app, "bundle", "escuchar.cjs"));
empaquetarScript(join(planillas, "scripts", "bajar-compras.ts"), join(app, "bundle", "bajar.cjs"));
writeFileSync(
  join(app, "bundle", "probe-entrada.mjs"),
  `import ws from "ws";
import { createClient } from "@supabase/supabase-js";
createClient("https://example.supabase.co", "clave-publica", { realtime: { transport: ws } });
console.log("probe-ok", process.versions.node);
`,
);
empaquetarScript(join(app, "bundle", "probe-entrada.mjs"), join(app, "bundle", "probe.cjs"));
rmSync(join(app, "bundle", "probe-entrada.mjs"), { force: true });
execFileSync("pnpm", ["exec", "electron", join(app, "bundle", "probe.cjs")], {
  cwd: app,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
});
rmSync(join(app, "bundle", "probe.cjs"), { force: true });
copiarPaquete("playwright", join(app, "vendor", "node_modules", "playwright"));
copiarPaquete("playwright-core", join(app, "vendor", "node_modules", "playwright-core"));
copiarNavegador();
execFileSync("pnpm", ["exec", "electron-builder"], {
  cwd: app,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
});
