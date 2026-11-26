import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import type { Download, Frame, Page } from "playwright";

const LOGIN = "https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm";
const MENU = ["Empresas", "Comprobantes de pago"];

export type TipoSol = "01" | "02" | "03";

export interface FacturaSol {
  tipo: TipoSol;
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
      log(`${i + 1}/${facturas.length} ${factura.tipo} ${factura.serie}-${factura.numero}`);
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
  let volvioAlMenu = false;
  while (Date.now() < vence) {
    await cerrarAvisos(page);
    const direccion = page.url();
    const titulo = await page.title().catch(() => "");
    if (!volvioAlMenu && (/api-seguridad\.sunat\.gob\.pe/i.test(direccion) || /bienvenid/i.test(titulo))) {
      volvioAlMenu = true;
      await page.goto(LOGIN, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(1_500);
      continue;
    }
    for (const frame of page.frames()) {
      const texto = await frame.locator("body").innerText().catch(() => "");
      if (/\bEmpresas\b/.test(texto) && !/valida tus datos de contacto/i.test(texto)) return;
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error("No se pudo entrar a Operaciones en Línea. Revisa el captcha, el usuario y la clave SOL.");
}

async function abrirConsulta(page: Page, log: (mensaje: string) => void): Promise<void> {
  await cerrarAvisos(page);
  for (const texto of MENU) {
    const ok = await clickVisible(page, texto, true);
    if (!ok) throw new Error(`No encontré «${texto}» en el menú de SUNAT.`);
    await page.waitForTimeout(1_000);
  }
  const consulta =
    (await clickQueContiene(page, "Nueva Consulta de comprobantes de pago")) ||
    (await clickQueContiene(page, "Consulta de Comprobantes de Pago")) ||
    (await clickVisible(page, "Consulta de", true));
  if (!consulta) throw new Error("No encontré la consulta de comprobantes en el menú de SUNAT.");
  await page.waitForTimeout(1_000);
  if (!(await esperarFrame(page, 4_000))) {
    const nueva = await clickQueContiene(page, "Nueva Consulta de comprobantes de pago");
    if (!nueva) throw new Error("No encontré «Nueva Consulta de comprobantes de pago» en el menú de SUNAT.");
    await page.waitForTimeout(1_000);
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
    const aviso = await buscar(page, frame, factura);
    if (aviso === "servidor" && intento === 0) {
      await page.waitForTimeout(20_000);
      continue;
    }
    if (aviso === "vacio") {
      return { xml: null, cdr: null, aviso: "SUNAT no tiene el XML de este comprobante para quien lo recibió." };
    }
    if (aviso) return { xml: null, cdr: null, aviso };
    const xmlBytes = await bajar(page, frame, "XML");
    const cdrBytes = await bajar(page, frame, "CDR");
    await page.keyboard.press("Escape").catch(() => undefined);
    const xml = xmlBytes ? xmlDeArchivo(xmlBytes) : null;
    if (!xml && !cdrBytes) {
      return { xml: null, cdr: null, aviso: "SUNAT no entregó el XML ni el CDR de este comprobante." };
    }
    return { xml, cdr: cdrBytes, aviso: xml ? null : "SUNAT entregó el CDR y no el XML." };
  }
  return { xml: null, cdr: null, aviso: "SUNAT no respondió la consulta de este comprobante." };
}

async function buscar(page: Page, frame: Frame, factura: FacturaSol): Promise<string | null> {
  const recibido = frame.getByText("Recibido", { exact: true }).first();
  if (await recibido.count()) await recibido.click();
  const ruc = frame.locator("input[name*='ruc' i]:not([disabled]), input[id*='ruc' i]:not([disabled])").last();
  if (!(await ruc.count())) return "No encontré el campo del RUC del proveedor.";
  await ruc.fill(factura.rucEmisor);
  if (!(await elegirTipo(page, frame, factura.tipo))) {
    return `SUNAT no dejó elegir ${NOMBRE_TIPO[factura.tipo]} en el tipo de comprobante.`;
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
  const obligatorio = frame.getByText(/tipo de comprobante es obligatorio/i).first();
  const resultado = frame.getByText(/no hay resultados|no se encontr|error del servidor/i).first();
  const icono = frame.locator("[title*='XML' i], [aria-label*='XML' i], img[alt*='XML' i]").first();
  await Promise.race([
    obligatorio.waitFor({ state: "visible", timeout: 25_000 }),
    resultado.waitFor({ timeout: 25_000 }),
    icono.waitFor({ timeout: 25_000 }),
  ]).catch(() => undefined);
  if (await obligatorio.isVisible().catch(() => false)) {
    return `SUNAT no dejó elegir ${NOMBRE_TIPO[factura.tipo]} en el tipo de comprobante.`;
  }
  const texto = await frame.locator("body").innerText().catch(() => "");
  if (/error del servidor/i.test(texto)) return "servidor";
  if (/no hay resultados|no se encontr|sin resultado/i.test(texto)) return "vacio";
  return null;
}

const NOMBRE_TIPO: Record<TipoSol, string> = {
  "01": "Factura",
  "02": "Recibo por honorarios",
  "03": "Boleta de venta",
};

const ETIQUETA_TIPO: Record<TipoSol, RegExp> = {
  "01": /^(?:\d{2}\s*[-–.]?\s*)?factura(?:\s+electr[oó]nica)?$/i,
  "02": /^(?:\d{2}\s*[-–.]?\s*)?recibo(?:\s+por\s+honorarios)?(?:\s+electr[oó]nico)?$/i,
  "03": /^(?:\d{2}\s*[-–.]?\s*)?boleta(?:\s+de\s+venta)?(?:\s+electr[oó]nica)?$/i,
};

function esEtiquetaTipo(texto: string, tipo: TipoSol): boolean {
  return ETIQUETA_TIPO[tipo].test(texto.replace(/\s+/g, " ").trim());
}

async function elegirTipo(page: Page, frame: Frame, tipo: TipoSol): Promise<boolean> {
  if (await tipoYaElegido(frame, tipo)) return true;
  if (await elegirTipoEnSelect(frame, tipo)) return true;
  const zona = frame.locator("div, tr, section").filter({ hasText: /Tipo de comprobante/i }).last();
  const disparador = ((await zona.count()) ? zona : frame)
    .getByText(/^(?:Seleccionar|Factura|Boleta(?: de venta)?|Recibo(?: por honorarios)?)$/i)
    .last();
  if (!(await disparador.count())) return false;
  await disparador.click();
  const etiqueta = ETIQUETA_TIPO[tipo];
  const opcion = frame
    .getByRole("option", { name: etiqueta })
    .or(page.getByRole("option", { name: etiqueta }))
    .or(frame.locator("[role='option'], .ng-option, li").filter({ hasText: etiqueta }))
    .first();
  const aparecio = await opcion.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false);
  if (!aparecio) {
    await page.keyboard.press("Escape").catch(() => undefined);
    return false;
  }
  await opcion.click();
  await page.waitForTimeout(300);
  return true;
}

async function tipoYaElegido(frame: Frame, tipo: TipoSol): Promise<boolean> {
  const zona = frame.locator("div, tr, section").filter({ hasText: /Tipo de comprobante/i }).last();
  if (!(await zona.count())) return false;
  const lineas = ((await zona.innerText().catch(() => "")) || "").split(/\n/);
  return lineas.some((linea) => esEtiquetaTipo(linea, tipo));
}

async function elegirTipoEnSelect(frame: Frame, tipo: TipoSol): Promise<boolean> {
  const selects = frame.locator("select");
  const total = await selects.count();
  for (let i = 0; i < total; i++) {
    const lista = selects.nth(i);
    if (!(await lista.isVisible().catch(() => false))) continue;
    const opciones = await lista.locator("option").evaluateAll((nodos) =>
      nodos.map((nodo) => ({
        value: (nodo as HTMLOptionElement).value,
        text: (nodo.textContent ?? "").replace(/\s+/g, " ").trim(),
      })),
    );
    const elegida = opciones.find((opcion) => esEtiquetaTipo(opcion.text, tipo));
    if (!elegida) continue;
    if (elegida.value) await lista.selectOption({ value: elegida.value });
    else await lista.selectOption({ label: elegida.text });
    const actual = ((await lista.locator("option:checked").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
    if (esEtiquetaTipo(actual, tipo)) return true;
  }
  return false;
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

async function cerrarAvisos(page: Page): Promise<void> {
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    let cerro = false;
    for (const frame of page.frames()) {
      for (const nombre of [/Finalizar/i, /Continuar sin confirmar/i]) {
        const boton = frame.getByRole("button", { name: nombre }).first();
        if (!(await boton.isVisible().catch(() => false))) continue;
        cerro = await boton.click({ timeout: 4_000 }).then(() => true).catch(() => false);
        if (cerro) await page.waitForTimeout(600);
      }
    }
    if (!cerro) break;
  }
  for (const frame of page.frames()) {
    await frame
      .evaluate(() => {
        const modal = document.querySelector("#divModalCampana");
        if (modal instanceof HTMLElement) modal.remove();
      })
      .catch(() => undefined);
  }
}

async function clickQueContiene(page: Page, frase: string): Promise<boolean> {
  const vence = Date.now() + 8_000;
  const meta = etiquetaMenu(frase);
  while (Date.now() < vence) {
    for (const frame of page.frames()) {
      const ok = await frame
        .evaluate((buscado) => {
          const normal = (valor: string | null) => (valor ?? "").replace(/\s+/g, " ").trim().toLowerCase();
          const candidatos = Array.from(document.querySelectorAll("a, button, span, div, li, td")).filter((el) =>
            normal(el.innerText).includes(buscado),
          );
          candidatos.sort((a, b) => normal(a.innerText).length - normal(b.innerText).length);
          const elegido = candidatos.find((el) => {
            const caja = el.getBoundingClientRect();
            const estilo = window.getComputedStyle(el);
            return caja.width > 2 && caja.height > 2 && estilo.visibility !== "hidden" && estilo.display !== "none";
          });
          if (!(elegido instanceof HTMLElement)) return false;
          const destino = elegido.closest("a, button");
          (destino instanceof HTMLElement ? destino : elegido).click();
          return true;
        }, meta)
        .catch(() => false);
      if (ok) {
        console.log(`Clic en «${frase}».`);
        return true;
      }
    }
    await page.waitForTimeout(400);
  }
  return false;
}

function etiquetaMenu(texto: string): string {
  return texto
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim()
    .toLowerCase();
}

async function clickVisible(page: Page, texto: string, exact: boolean): Promise<boolean> {
  void exact;
  const vence = Date.now() + 8_000;
  while (Date.now() < vence) {
    for (const frame of page.frames()) {
      const loc = frame.getByText(texto, { exact: false });
      const total = await loc.count().catch(() => 0);
      const buscado = etiquetaMenu(texto);
      const visibles: number[] = [];
      for (let i = 0; i < total; i++) {
        const item = loc.nth(i);
        const propio = etiquetaMenu((await item.innerText().catch(() => "")) || "");
        if (propio !== buscado) continue;
        if (!(await item.isVisible().catch(() => false))) continue;
        visibles.push(i);
      }
      const indice = visibles[visibles.length - 1];
      if (indice === undefined) continue;
      const item = loc.nth(indice);
      console.log(`Clic en «${texto}».`);
      if (await item.click({ timeout: 5_000 }).then(() => true).catch(() => false)) return true;
      if (await item.click({ force: true, timeout: 3_000 }).then(() => true).catch(() => false)) return true;
    }
    await page.waitForTimeout(400);
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
