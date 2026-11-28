import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { abrirNavegador } from "../src/lib/sunat/navegador";

function carpetaDeEsteArchivo(): string {
  if (typeof __dirname === "string") return __dirname;
  return dirname(fileURLToPath(import.meta.url));
}

const envFile = join(carpetaDeEsteArchivo(), "..", ".env.local");

function archivoSesion(): string {
  const marcada = process.env.SUNAT_SESION_FILE?.trim();
  if (marcada) return marcada;
  return join(carpetaDeEsteArchivo(), "..", ".sunat-session.json");
}

function guardarSesion(tokens: { access_token: string; refresh_token: string }): void {
  const archivo = archivoSesion();
  mkdirSync(dirname(archivo), { recursive: true });
  writeFileSync(archivo, JSON.stringify(tokens));
}

export function cargarEnv(): void {
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

export function requerido(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) throw new Error(`Falta ${nombre} en apps/planillas/.env.local.`);
  return valor;
}

const PORTAL_PUBLICO = "https://www.bdconsultores.org";

export function portalDe(pedido?: string): string {
  const explicito = pedido?.trim();
  if (explicito) return explicito.replace(/\/$/, "");
  const configurado = process.env.NEXT_PUBLIC_PORTAL_ORIGIN?.trim() ?? "";
  if (configurado && !esLocal(configurado)) return configurado.replace(/\/$/, "");
  return PORTAL_PUBLICO;
}

function esLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function crearCliente(): SupabaseClient {
  return createClient(requerido("NEXT_PUBLIC_SUPABASE_URL"), requerido("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: true },
    realtime: { transport: ws as never },
  });
}

export async function renovarSesion(supabase: SupabaseClient): Promise<boolean> {
  const guardada = leerSesion();
  if (!guardada) return false;
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: guardada.refresh_token });
  if (error || !data.session) return false;
  guardarSesion({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  return true;
}

export async function entrar(supabase: SupabaseClient, portal: string): Promise<void> {
  const guardada = leerSesion();
  if (guardada) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: guardada.refresh_token });
    if (!error && data.session) {
      guardarSesion({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      return;
    }
  }
  const browser = await abrirNavegador();
  try {
    const page = await browser.newPage();
    console.log("Se abrió el navegador. Entra con la cuenta de Google del estudio. Cuando termines, se cierra solo.");
    await page.goto(`${portal}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {
      throw new Error(`No pude abrir ${portal}/login. Revisa la conexión de esta PC.`);
    });
    const ref = new URL(requerido("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0];
    const vence = Date.now() + 5 * 60_000;
    let tokens: { access_token: string; refresh_token: string } | null = null;
    while (Date.now() < vence && !tokens) {
      tokens = tokensDeCookies(await page.context().cookies(), ref);
      if (!tokens) await page.waitForTimeout(1_000);
    }
    if (!tokens) throw new Error("No se inició la sesión. Entra con la cuenta del estudio.");
    const { error } = await supabase.auth.setSession(tokens);
    if (error) throw new Error(error.message);
    guardarSesion(tokens);
  } finally {
    await browser.close();
  }
}

function leerSesion(): { access_token: string; refresh_token: string } | null {
  const archivo = archivoSesion();
  if (!existsSync(archivo)) return null;
  try {
    const json = JSON.parse(readFileSync(archivo, "utf8")) as { access_token?: string; refresh_token?: string };
    if (!json.access_token || !json.refresh_token) return null;
    return { access_token: json.access_token, refresh_token: json.refresh_token };
  } catch {
    return null;
  }
}

function tokensDeCookies(
  cookies: { name: string; value: string }[],
  ref: string,
): { access_token: string; refresh_token: string } | null {
  const key = `sb-${ref}-auth-token`;
  const partes = cookies.filter((cookie) => cookie.name === key || cookie.name.startsWith(`${key}.`));
  const trozos = partes.filter((cookie) => cookie.name.startsWith(`${key}.`));
  const lista = (trozos.length > 0 ? trozos : partes).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  if (lista.length === 0) return null;
  let raw = lista.map((cookie) => cookie.value).join("");
  if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8");
  try {
    const json = JSON.parse(raw) as { access_token?: string; refresh_token?: string };
    if (!json.access_token || !json.refresh_token) return null;
    return { access_token: json.access_token, refresh_token: json.refresh_token };
  } catch {
    return null;
  }
}
