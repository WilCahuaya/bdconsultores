import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import type { Download, Frame, Page } from "playwright";

const LOGIN = "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm";
const MENU = [
  "Empresas",
  "Comprobantes de pago",
  "Comprobantes de Pago",
  "Consulta de Comprobantes de Pago",
  "Nueva Consulta de comprobantes de pago",
];

export interface FacturaSol {
  rucEmisor: string;
  serie: string;
  numero: string;
}

export interface ArchivosSol {
  xml: string | null;
  cdr: Uint8Array | null;
  aviso: string | null;
}

export async function bajarFacturasSol(
  cred: { ruc: string; usuario: string; clave: string },
  facturas: FacturaSol[],
  onUna: (factura: FacturaSol, archivos: ArchivosSol) => Promise<void>,
  log: (mensaje: string) => void,
): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    log("Abro Operaciones en Línea. Si SUNAT pide un captcha, resuélvelo en esa ventana.");
    await page.goto(LOGIN, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await entrar(page, cred, log);
    await abrirConsulta(page, log);
    for (let i = 0; i < facturas.length; i++) {
      const factura = facturas[i];
      log(`${i + 1}/${facturas.length} ${factura.serie}-${factura.numero}`);
      const archivos = await consultarUna(page, factura);
      await onUna(factura, archivos);
      await page.waitForTimeout(2_000);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function entrar(page: Page, cred: { ruc: string; usuario: string; clave: string }, log: (mensaje: string) => void): Promise<void> {
  const ruc = await campo(page, ["#txtRuc", "input[name='txtRuc']", "input[id*='ruc' i]"]);
  const usuario = await campo(page, ["#txtUsuario", "input[name='txtUsuario']", "input[id*='usuario' i]"]);
  const clave = await campo(page, ["#txtContrasena", "input[name='txtContrasena']", "input[type='password']"]);
  if (!ruc || !usuario || !clave) {
    throw new Error("SUNAT no mostró el formulario de la clave SOL.");
  }
  await ruc.fill(cred.ruc);
  await usuario.fill(cred.usuario);
  await clave.fill(cred.clave);
  const captcha = await campo(page, ["#txtCaptcha", "input[name*='aptcha' i]"]);
  if (captcha && (await captcha.isVisible().catch(() => false))) {
    log("SUNAT mostró un captcha. Escríbelo y pulsa Aceptar en la ventana.");
  } else {
    const aceptar = await campo(page, ["#btnAceptar", "button:has-text('Aceptar')", "input[value='Aceptar']"]);
    if (aceptar) await aceptar.click();
  }
  const vence = Date.now() + 180_000;
  while (Date.now() < vence) {
    for (const frame of page.frames()) {
      const texto = await frame.locator("body").innerText().catch(() => "");
      if (/\bEmpresas\b/.test(texto)) return;
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error("No se pudo entrar a Operaciones en Línea. Revisa el captcha, el usuario y la clave SOL.");
}

async function abrirConsulta(page: Page, log: (mensaje: string) => void): Promise<void> {
  for (const texto of MENU) {
    const ok = await clickVisible(page, texto, true);
    if (!ok) throw new Error(`No encontré «${texto}» en el menú de SUNAT.`);
    await page.waitForTimeout(700);
  }
  const listo = await esperarFrame(page, 25_000);
  if (!listo) {
    log("El menú no abrió la consulta. Ábrela a mano en la ventana: Nueva Consulta de comprobantes de pago.");
    const manual = await esperarFrame(page, 120_000);
    if (!manual) throw new Error("No apareció la consulta de comprobantes.");
  }
}

async function consultarUna(page: Page, factura: FacturaSol): Promise<ArchivosSol> {
  for (let intento = 0; intento < 2; intento++) {
    const frame = await esperarFrame(page, 15_000);
    if (!frame) return { xml: null, cdr: null, aviso: "No está abierta la consulta de comprobantes." };
    const aviso = await buscar(frame, factura);
    if (aviso === "servidor" && intento === 0) {
      await page.waitForTimeout(20_000);
      continue;
    }
    if (aviso === "vacio") {
      return { xml: null, cdr: null, aviso: "SUNAT no tiene el XML de esta factura para quien la recibió." };
    }
    if (aviso) return { xml: null, cdr: null, aviso };
    const xmlBytes = await bajar(page, frame, "XML");
    const cdrBytes = await bajar(page, frame, "CDR");
    await page.keyboard.press("Escape").catch(() => undefined);
    const xml = xmlBytes ? xmlDeArchivo(xmlBytes) : null;
    if (!xml && !cdrBytes) {
      return { xml: null, cdr: null, aviso: "SUNAT no entregó el XML ni el CDR de esta factura." };
    }
    return { xml, cdr: cdrBytes, aviso: xml ? null : "SUNAT entregó el CDR y no el XML." };
  }
  return { xml: null, cdr: null, aviso: "SUNAT no respondió la consulta de esta factura." };
}

async function buscar(frame: Frame, factura: FacturaSol): Promise<string | null> {
  const recibido = frame.getByText("Recibido", { exact: true }).first();
  if (await recibido.count()) await recibido.click();
  const ruc = frame.locator("input[name*='ruc' i]:not([disabled]), input[id*='ruc' i]:not([disabled])").last();
  if (!(await ruc.count())) return "No encontré el campo del RUC del proveedor.";
  await ruc.fill(factura.rucEmisor);
  const tipo = frame.locator("select").first();
  if (await tipo.count()) {
    await tipo.selectOption({ value: "01" }).catch(async () => {
      const opciones = await tipo.locator("option").allTextContents();
      const factura = opciones.find((item) => /factura/i.test(item) && !/nota/i.test(item));
      if (factura) await tipo.selectOption({ label: factura });
    });
  }
  const serie = frame.locator("input[name*='serie' i], input[id*='serie' i]").first();
  const numero = frame.locator("input[name*='numero' i], input[id*='numero' i], input[name*='num' i]").first();
  if (!(await serie.count()) || !(await numero.count())) {
    return "La consulta de SUNAT cambió y no están los campos de serie y número.";
  }
  await serie.fill(factura.serie.toUpperCase());
  await numero.fill(factura.numero.replace(/^0+(?=\d)/, ""));
  const consultar = frame
    .locator("button:has-text('Consultar'), input[type='button'][value*='onsultar' i], input[type='submit'][value*='onsultar' i]")
    .first();
  if (!(await consultar.count())) return "No encontré el botón Consultar.";
  await consultar.click();
  const resultado = frame.getByText(/no hay resultados|no se encontr|error del servidor/i).first();
  const icono = frame.locator("[title*='XML' i], [aria-label*='XML' i], img[alt*='XML' i]").first();
  await Promise.race([
    resultado.waitFor({ timeout: 25_000 }),
    icono.waitFor({ timeout: 25_000 }),
  ]).catch(() => undefined);
  const texto = await frame.locator("body").innerText().catch(() => "");
  if (/error del servidor/i.test(texto)) return "servidor";
  if (/no hay resultados|no se encontr|sin resultado/i.test(texto)) return "vacio";
  return null;
}

async function bajar(page: Page, frame: Frame, etiqueta: "XML" | "CDR"): Promise<Uint8Array | null> {
  const boton = frame
    .locator(`[title*='${etiqueta}' i], [aria-label*='${etiqueta}' i], img[alt*='${etiqueta}' i], a:has-text('${etiqueta}')`)
    .first();
  if (!(await boton.count())) return null;
  const espera = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
  await boton.click().catch(() => undefined);
  const descarga = await espera;
  if (!descarga) return null;
  return leerDescarga(descarga);
}

async function leerDescarga(descarga: Download): Promise<Uint8Array> {
  const dir = mkdtempSync(join(tmpdir(), "sunat-"));
  const destino = join(dir, "archivo");
  try {
    await descarga.saveAs(destino);
    return readFileSync(destino);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function xmlDeArchivo(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x3c) {
    const texto = new TextDecoder().decode(bytes);
    return texto.includes("<") ? texto : null;
  }
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return null;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return null;
  }
  const nombres = Object.keys(files);
  const nombre =
    nombres.find((item) => item.toLowerCase().endsWith(".xml") && !item.toLowerCase().includes("cdr")) ??
    nombres.find((item) => item.toLowerCase().endsWith(".xml"));
  if (!nombre) return null;
  const texto = strFromU8(files[nombre]);
  return texto.includes("<") ? texto : null;
}

async function campo(page: Page, selectores: string[]) {
  for (const frame of page.frames()) {
    for (const selector of selectores) {
      const loc = frame.locator(selector).first();
      if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return loc;
    }
  }
  return null;
}

async function clickVisible(page: Page, texto: string, exact: boolean): Promise<boolean> {
  for (const frame of page.frames()) {
    const loc = frame.getByText(texto, { exact });
    const total = await loc.count();
    for (let i = 0; i < total; i++) {
      const item = loc.nth(i);
      if (await item.isVisible().catch(() => false)) {
        await item.click();
        return true;
      }
    }
  }
  return false;
}

async function esperarFrame(page: Page, timeout: number): Promise<Frame | null> {
  const vence = Date.now() + timeout;
  while (Date.now() < vence) {
    for (const frame of page.frames()) {
      const texto = await frame.locator("body").innerText().catch(() => "");
      if (/recibido/i.test(texto) && /consultar/i.test(texto)) return frame;
    }
    await page.waitForTimeout(500);
  }
  return null;
}
