import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const envFile = new URL("../.env.local", import.meta.url);
const sesionFile = new URL("../.sunat-session.json", import.meta.url);

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
  });
}

export async function renovarSesion(supabase: SupabaseClient): Promise<boolean> {
  const guardada = leerSesion();
  if (!guardada) return false;
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: guardada.refresh_token });
  if (error || !data.session) return false;
  writeFileSync(
    sesionFile,
    JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }),
  );
  return true;
}

export async function entrar(supabase: SupabaseClient, portal: string): Promise<void> {
  const guardada = leerSesion();
  if (guardada) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: guardada.refresh_token });
    if (!error && data.session) {
      writeFileSync(
        sesionFile,
        JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }),
      );
      return;
    }
  }
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();
    console.log(`Entra con Google en la ventana. ${portal}/login`);
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
    writeFileSync(sesionFile, JSON.stringify(tokens));
  } finally {
    await browser.close();
  }
}

function leerSesion(): { access_token: string; refresh_token: string } | null {
  if (!existsSync(sesionFile)) return null;
  try {
    const json = JSON.parse(readFileSync(sesionFile, "utf8")) as { access_token?: string; refresh_token?: string };
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
