import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SunatCredencialSecreto } from "../src/lib/sunat/auth";
import { decryptString } from "../src/lib/sunat/crypto";
import { SunatError, SunatTicketPendienteError } from "../src/lib/sunat/errors";
import { guardarPropuesta, marcarArchivo, registrarDescarga, subirCdr, subirXml } from "../src/lib/sunat/persistir";
import { bajarFacturasSol, type FacturaSol } from "../src/lib/sunat/portal-sol";
import { descargarPropuestaRce } from "../src/lib/sunat/sire";

const envFile = new URL("../.env.local", import.meta.url);
const sesionFile = new URL("../.sunat-session.json", import.meta.url);

cargarEnv(envFile);

const args = leerArgs(process.argv.slice(2));
if (args.help || !args.ruc || !args.periodo) {
  console.log(`Baja la lista del SIRE y después el XML y el CDR de las facturas.

  pnpm sunat:bajar -- --ruc 20609090180 --periodo 202610

  --solo-sire   solo la lista del mes
  --solo-xml    solo el XML, con la lista ya guardada
  --portal URL  portal donde entras con Google. Por defecto, el de NEXT_PUBLIC_PORTAL_ORIGIN`);
  process.exit(args.help ? 0 : 1);
}

const ruc = typeof args.ruc === "string" ? args.ruc : "";
const periodo = typeof args.periodo === "string" ? args.periodo : "";
if (!/^\d{11}$/.test(ruc) || !/^\d{6}$/.test(periodo)) {
  console.error("El RUC tiene 11 dígitos y el periodo es AAAAMM, por ejemplo 202610.");
  process.exit(1);
}

const url = requerido("NEXT_PUBLIC_SUPABASE_URL");
const anon = requerido("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const portalFlag = typeof args.portal === "string" ? args.portal : "";
const portal = (portalFlag || process.env.NEXT_PUBLIC_PORTAL_ORIGIN || "http://127.0.0.1:3010").replace(/\/$/, "");
const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo bajar las compras.");
  process.exit(1);
});

async function main(): Promise<void> {
  await entrar(supabase, portal);
  const credencial = await credencialDe(supabase, ruc);
  const secreto = secretoDe(credencial);
  if (!args["solo-xml"]) await bajarSire(supabase, secreto, periodo);
  if (args["solo-sire"]) {
    console.log("Lista guardada. El XML no se pidió.");
    return;
  }
  const facturas = await facturasPendientes(supabase, credencial.entidad_id as string, periodo);
  if (facturas.length === 0) {
    console.log("No hay facturas pendientes de XML en ese mes.");
    return;
  }
  console.log(`${facturas.length} facturas por bajar. Se abre SUNAT en una ventana.`);
  const clave = decryptString(credencial.clave_sol_cifrada as string, credencial.entidad_id as string);
  await bajarFacturasSol(
    { ruc, usuario: credencial.usuario_sol as string, clave },
    facturas,
    async (factura, archivos) => {
      const compra = {
        entidadId: credencial.entidad_id as string,
        periodo,
        tipo: "01",
        serie: factura.serie,
        numero: factura.numero,
      };
      if (archivos.xml) await subirXml(supabase, compra, archivos.xml);
      if (archivos.cdr) await subirCdr(supabase, compra, archivos.cdr);
      await marcarArchivo(supabase, compra, {
        xmlEstado: archivos.xml ? "LISTO" : archivos.aviso?.includes("no tiene el XML") ? "SIN_XML" : "ERROR",
        cdrEstado: archivos.cdr ? "LISTO" : "SIN_XML",
        mensaje: archivos.aviso,
      });
      console.log(archivos.xml ? "  XML guardado" : `  ${archivos.aviso ?? "Sin XML"}`);
    },
    (mensaje) => console.log(mensaje),
  );
  console.log("Listo. En Planillas ya se puede abrir el detalle.");
}

async function bajarSire(supabase: SupabaseClient, secreto: SunatCredencialSecreto, periodo: string): Promise<void> {
  const { data: previa } = await supabase
    .from("sunat_descargas")
    .select("num_ticket, estado")
    .eq("entidad_id", secreto.entidadId)
    .eq("periodo", periodo)
    .maybeSingle();
  const ticket = previa?.estado === "EN_PROCESO" && previa.num_ticket ? (previa.num_ticket as string) : undefined;
  console.log(ticket ? "Retomo el ticket del SIRE." : "Pido la lista del mes al SIRE.");
  try {
    const propuesta = await descargarPropuestaRce(secreto, periodo, {
      numTicket: ticket,
      maxIntentos: 40,
      esperaMs: 5_000,
      onEspera: (intento) => console.log(`SUNAT sigue preparando el archivo (${intento}).`),
    });
    const { total } = await guardarPropuesta(supabase, secreto.entidadId, periodo, propuesta);
    console.log(`Lista guardada: ${total} comprobantes.`);
  } catch (error) {
    if (error instanceof SunatTicketPendienteError) {
      await registrarDescarga(supabase, secreto.entidadId, periodo, {
        numTicket: error.numTicket,
        estado: "EN_PROCESO",
        mensaje: error.message,
      });
    } else if (error instanceof SunatError) {
      await registrarDescarga(supabase, secreto.entidadId, periodo, { estado: "ERROR", mensaje: error.message });
    }
    throw error;
  }
}

async function facturasPendientes(supabase: SupabaseClient, entidadId: string, periodo: string): Promise<FacturaSol[]> {
  const { data, error } = await supabase
    .from("sunat_compras")
    .select("serie, numero, ruc_emisor")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .eq("tipo", "01")
    .order("fecha_emision", { ascending: true });
  if (error) throw new Error(error.message);
  const { data: estados } = await supabase
    .from("sunat_compra_archivos")
    .select("serie, numero, xml_estado")
    .eq("entidad_id", entidadId)
    .eq("periodo", periodo)
    .eq("tipo", "01");
  const listos = new Set(
    (estados ?? [])
      .filter((fila) => fila.xml_estado === "LISTO")
      .map((fila) => `${fila.serie}|${fila.numero}`),
  );
  const pendientes: FacturaSol[] = [];
  for (const fila of data ?? []) {
    if (listos.has(`${fila.serie}|${fila.numero}`)) continue;
    if (!/^\d{11}$/.test(String(fila.ruc_emisor ?? ""))) {
      await marcarArchivo(
        supabase,
        { entidadId, periodo, tipo: "01", serie: fila.serie as string, numero: fila.numero as string },
        { xmlEstado: "ERROR", mensaje: "El registro no trae el RUC del proveedor." },
      );
      continue;
    }
    pendientes.push({
      rucEmisor: fila.ruc_emisor as string,
      serie: fila.serie as string,
      numero: fila.numero as string,
    });
  }
  return pendientes;
}

async function credencialDe(supabase: SupabaseClient, ruc: string) {
  const { data, error } = await supabase
    .from("sunat_credenciales")
    .select("entidad_id, ruc, usuario_sol, client_id, clave_sol_cifrada, client_secret_cifrado")
    .eq("ruc", ruc)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No hay credencial para ese RUC, o esta cuenta no es del estudio.");
  return data;
}

function secretoDe(credencial: { entidad_id: string; ruc: string; usuario_sol: string; client_id: string; clave_sol_cifrada: string; client_secret_cifrado: string }): SunatCredencialSecreto {
  return {
    entidadId: credencial.entidad_id,
    ruc: credencial.ruc,
    usuarioSol: credencial.usuario_sol,
    clientId: credencial.client_id,
    claveSolCifrada: credencial.clave_sol_cifrada,
    clientSecretCifrado: credencial.client_secret_cifrado,
  };
}

async function entrar(supabase: SupabaseClient, portal: string): Promise<void> {
  const guardada = leerSesion();
  if (guardada) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: guardada.refresh_token });
    if (!error && data.session) {
      writeFileSync(sesionFile, JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }));
      return;
    }
  }
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();
    console.log(`Entra con Google en la ventana. ${portal}/login`);
    await page.goto(`${portal}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {
      throw new Error(`No pude abrir ${portal}/login. Si el portal es local, inícialo con pnpm dev:portal.`);
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

function tokensDeCookies(
  cookies: { name: string; value: string }[],
  ref: string,
): { access_token: string; refresh_token: string } | null {
  const key = `sb-${ref}-auth-token`;
  const partes = cookies.filter((cookie) => cookie.name === key || cookie.name.startsWith(`${key}.`));
  const trozos = partes.filter((cookie) => cookie.name.startsWith(`${key}.`));
  const lista = (trozos.length > 0 ? trozos : partes).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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

function leerArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function cargarEnv(file: URL): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

function requerido(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) throw new Error(`Falta ${nombre} en apps/planillas/.env.local.`);
  return valor;
}
