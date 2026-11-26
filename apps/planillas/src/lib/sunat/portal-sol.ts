import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import type { BrowserContext, Download, Frame, Locator, Page } from "playwright";
import { abrirNavegador } from "./navegador";

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
  pdf: Uint8Array | null;
  aviso: string | null;
}

export async function bajarFacturasSol(
  cred: { ruc: string; usuario: string; clave: string },
  facturas: FacturaSol[],
  onUna: (factura: FacturaSol, archivos: ArchivosSol) => Promise<void>,
  log: (mensaje: string) => void,
): Promise<void> {
  const browser = await abrirNavegador();
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const noop = () => undefined;
      const bloquear = (ventana: Window) => {
        try {
          Object.defineProperty(ventana, "print", { configurable: true, writable: true, value: noop });
        } catch {
          ventana.print = noop;
        }
      };
      bloquear(window);
      const abrir = window.open.bind(window);
      window.open = (...args: Parameters<Window["open"]>) => {
        const hija = abrir(...args);
        if (hija) bloquear(hija);
        return hija;
      };
    });
    const page = await context.newPage();
    vigilarImpresion(context, page);
    page.setDefaultTimeout(20_000);
    log("Abro Operaciones en Línea. Si SUNAT pide un captcha, resuélvelo en esa ventana.");
    await page.goto(LOGIN, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await entrar(page, cred, log);
    await abrirConsulta(page, log);
    for (let i = 0; i < facturas.length; i++) {
      const factura = facturas[i];
      log(`${i + 1}/${facturas.length} ${factura.tipo} ${factura.serie}-${factura.numero}`);
      try {
        const archivos = await consultarUna(page, factura);
        await onUna(factura, archivos);
      } catch (error) {
        const aviso = error instanceof Error ? error.message : "No se pudo consultar este comprobante.";
        await onUna(factura, { xml: null, cdr: null, pdf: null, aviso });
      }
      await page.waitForTimeout(2_000).catch(() => undefined);
      if (page.isClosed()) break;
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}

function esFormularioClave(url: string): boolean {
  return /loginMenuSol|oauth2\/login/i.test(url);
}

function esPantallaBienvenida(url: string, titulo: string): boolean {
  if (esFormularioClave(url)) return false;
  if (/api-seguridad\.sunat\.gob\.pe/i.test(url) && /[?&]code=/i.test(url)) return true;
  return /bienvenid/i.test(titulo);
}

async function entrar(page: Page, cred: { ruc: string; usuario: string; clave: string }, log: (mensaje: string) => void): Promise<void> {
  const venceFormulario = Date.now() + 30_000;
  let ruc = null as Awaited<ReturnType<typeof campo>>;
  let usuario = null as Awaited<ReturnType<typeof campo>>;
  let clave = null as Awaited<ReturnType<typeof campo>>;
  let salioDeBienvenida = false;
  while (Date.now() < venceFormulario) {
    await cerrarAvisos(page);
    if (await menuVisible(page)) return;
    const rucVisible = await campo(page, ["#txtRuc", "input[placeholder='RUC' i]"]);
    if (!rucVisible) {
      const porRuc = await campo(page, ["#btnPorRuc"]);
      if (porRuc) await porRuc.click().catch(() => undefined);
    }
    ruc = await campo(page, ["#txtRuc", "input[name='txtRuc']", "input[placeholder='RUC' i]"]);
    usuario = await campo(page, ["#txtUsuario", "input[name='txtUsuario']", "input[placeholder='Usuario' i]"]);
    clave = await campo(page, ["#txtContrasena", "input[name='txtContrasena']", "input[placeholder='Contraseña' i]", "input[type='password']"]);
    if (ruc && usuario && clave) break;
    const titulo = await page.title().catch(() => "");
    if (!salioDeBienvenida && esPantallaBienvenida(page.url(), titulo)) {
      salioDeBienvenida = true;
      await page.goto(LOGIN, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(1_500);
      continue;
    }
    await page.waitForTimeout(1_000);
  }
  if (await menuVisible(page)) return;
  if (!ruc || !usuario || !clave) {
    throw new Error("SUNAT no mostró el formulario de la clave SOL.");
  }
  log("Completo la clave SOL.");
  await escribir(ruc, cred.ruc);
  await escribir(usuario, cred.usuario);
  await escribir(clave, cred.clave);
  const captcha = await campo(page, ["#txtCaptcha", "input[name*='aptcha' i]"]);
  if (captcha && (await captcha.isVisible().catch(() => false))) {
    log("SUNAT mostró un captcha. Escríbelo y pulsa Aceptar en la ventana.");
  } else {
    await pulsarIngreso(page);
  }
  const vence = Date.now() + 180_000;
  let volvioAlMenu = false;
  let repitioClave = false;
  let cerroSesion = false;
  while (Date.now() < vence) {
    await cerrarAvisos(page);
    if (await menuVisible(page)) return;
    const direccion = page.url();
    const titulo = await page.title().catch(() => "");
    if (!volvioAlMenu && esPantallaBienvenida(direccion, titulo)) {
      volvioAlMenu = true;
      await page.goto(LOGIN, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(1_500);
      continue;
    }
    if (!repitioClave && esFormularioClave(direccion)) {
      const aviso = await textoCorto(page);
      if (!cerroSesion && /sesi[oó]n (?:activa|anterior|abierta)|ya (?:tiene|se encuentra)|cerrar la sesi[oó]n/i.test(aviso)) {
        cerroSesion = true;
        log("SUNAT indica que ya hay una sesión. Confirmo para entrar de nuevo.");
        const confirmar = await campo(page, ["#btnAceptar", "button:has-text('Aceptar')", "button:has-text('Sí')"]);
        if (confirmar) await confirmar.click().catch(() => undefined);
        await page.waitForTimeout(1_000);
        continue;
      }
      const rucVisible = await campo(page, ["#txtRuc", "input[placeholder='RUC' i]"]);
      const usuarioVisible = await campo(page, ["#txtUsuario", "input[placeholder='Usuario' i]"]);
      const claveVisible = await campo(page, ["#txtContrasena", "input[placeholder='Contraseña' i]", "input[type='password']"]);
      if (rucVisible && usuarioVisible && claveVisible && (await rucVisible.inputValue().catch(() => "")) === "") {
        repitioClave = true;
        log("SUNAT volvió a pedir la clave SOL.");
        await escribir(rucVisible, cred.ruc);
        await escribir(usuarioVisible, cred.usuario);
        await escribir(claveVisible, cred.clave);
        await pulsarIngreso(page);
        continue;
      }
    }
    await page.waitForTimeout(1_000);
  }
  const aviso = await textoCorto(page);
  if (aviso) log(aviso);
  throw new Error("No se pudo entrar a Operaciones en Línea. Revisa el captcha, el usuario y la clave SOL.");
}

async function textoCorto(page: Page): Promise<string> {
  const partes: string[] = [];
  for (const frame of page.frames()) {
    const texto = ((await frame.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (texto) partes.push(texto);
  }
  return partes.join(" ").replace(/\s+/g, " ").trim().slice(0, 220);
}

async function escribir(caja: NonNullable<Awaited<ReturnType<typeof campo>>>, valor: string): Promise<void> {
  await caja.click({ force: true }).catch(() => undefined);
  await caja.fill(valor);
  if ((await caja.inputValue().catch(() => "")) === valor) return;
  await caja.fill("");
  await caja.pressSequentially(valor, { delay: 15 });
}

async function pulsarIngreso(page: Page): Promise<void> {
  const aceptar = await campo(page, ["#btnAceptar", "button:has-text('Iniciar sesión')", "button:has-text('Aceptar')"]);
  if (aceptar) await aceptar.click().catch(() => undefined);
}

async function menuVisible(page: Page): Promise<boolean> {
  for (const frame of page.frames()) {
    const texto = await frame.locator("body").innerText().catch(() => "");
    if (/\bEmpresas\b/.test(texto) && !/valida tus datos de contacto/i.test(texto)) return true;
  }
  return false;
}

async function abrirConsulta(page: Page, log: (mensaje: string) => void): Promise<void> {
  await cerrarAvisos(page);
  for (const texto of MENU) {
    const ok = await clickVisible(page, texto, true);
    if (!ok) throw new Error(`No encontré «${texto}» en el menú de SUNAT.`);
    await page.waitForTimeout(1_000);
  }
  const consulta = await clickConsultaComprobantes(page);
  if (!consulta) {
    const lineas = await lineasDe(page, /comprobante|consulta/i);
    await page.screenshot({ path: "C:/Users/Willl/AppData/Local/Temp/sunat-menu.png", fullPage: true }).catch(() => undefined);
    log(`Opciones vistas: ${lineas || "(ninguna con la palabra comprobante o consulta)"}`);
    throw new Error("No encontré la consulta de comprobantes en el menú de SUNAT.");
  }
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
    if (!frame) return { xml: null, cdr: null, pdf: null, aviso: "No está abierta la consulta de comprobantes." };
    const aviso = await buscar(page, frame, factura);
    if (aviso === "servidor" && intento === 0) {
      await page.waitForTimeout(20_000);
      continue;
    }
    if (aviso === "vacio") {
      return { xml: null, cdr: null, pdf: null, aviso: "SUNAT no tiene el XML de este comprobante para quien lo recibió." };
    }
    if (aviso) return { xml: null, cdr: null, pdf: null, aviso };
    const xmlBajada = await bajar(page, frame, "XML");
    const cdrBajada = await bajar(page, frame, "CDR");
    const xml = xmlBajada.bytes ? xmlDeArchivo(xmlBajada.bytes) : null;
    const cdrBytes = cdrBajada.bytes;
    const pdf = xml || cdrBytes ? null : await bajarRepresentacion(page, frame);
    await cerrarRepresentacionesAbiertas(page);
    await page.keyboard.press("Escape").catch(() => undefined);
    await cerrarResultado(frame);
    if (!xml && !cdrBytes && !pdf) {
      if (xmlBajada.previo || cdrBajada.previo) {
        return {
          xml: null,
          cdr: null,
          pdf: null,
          aviso: "SUNAT ya había descargado este archivo y no lo volvió a enviar.",
        };
      }
      const texto = ((await frame.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
      console.log(`Resultado: ${texto.slice(0, 280)}`);
      await page.screenshot({ path: "C:/Users/Willl/AppData/Local/Temp/sunat-resultado.png" }).catch(() => undefined);
      if (/no hay resultados|no se encontr|sin resultado/i.test(texto)) {
        return { xml: null, cdr: null, pdf: null, aviso: "SUNAT no tiene el XML de este comprobante para quien lo recibió." };
      }
      return { xml: null, cdr: null, pdf: null, aviso: "No encontré el XML en la respuesta de SUNAT." };
    }
    return { xml, cdr: cdrBytes, pdf, aviso: xml ? null : pdf ? null : "SUNAT entregó el CDR y no el XML." };
  }
  return { xml: null, cdr: null, pdf: null, aviso: "SUNAT no respondió la consulta de este comprobante." };
}

async function quitarEspera(frame: Frame): Promise<void> {
  await frame
    .evaluate(() => {
      for (const nodo of document.querySelectorAll("ngx-spinner, .overlay")) {
        if (nodo instanceof HTMLElement) nodo.remove();
      }
    })
    .catch(() => undefined);
}

async function cerrarResultado(frame: Frame): Promise<void> {
  const aspa = frame.locator("button, a, span").filter({ hasText: /^[×x]$/ }).last();
  if (await aspa.count().catch(() => 0)) await aspa.click({ force: true }).catch(() => undefined);
}

async function buscar(page: Page, frame: Frame, factura: FacturaSol): Promise<string | null> {
  await cerrarResultado(frame);
  const recibido = frame.getByText("Recibido", { exact: true }).first();
  if (await recibido.count()) {
    await cerrarAvisos(page);
    if (!(await recibido.click({ timeout: 5_000 }).then(() => true).catch(() => false))) {
      await recibido.click({ force: true }).catch(() => undefined);
    }
  }
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
  await quitarEspera(frame);
  if (!(await consultar.click({ timeout: 8_000 }).then(() => true).catch(() => false))) {
    await quitarEspera(frame);
    await consultar.click({ force: true }).catch(() => undefined);
  }
  const obligatorio = frame.getByText(/tipo de comprobante es obligatorio/i).first();
  const resultado = frame.getByText(/no hay resultados|no se encontr|error del servidor/i).first();
  const panel = frame.getByText("Resultado", { exact: true }).first();
  await Promise.race([
    obligatorio.waitFor({ state: "visible", timeout: 25_000 }),
    resultado.waitFor({ timeout: 25_000 }),
    panel.waitFor({ timeout: 25_000 }),
  ]).catch(() => undefined);
  if (await obligatorio.isVisible().catch(() => false)) {
    return `SUNAT no dejó elegir ${NOMBRE_TIPO[factura.tipo]} en el tipo de comprobante.`;
  }
  const texto = await frame.locator("body").innerText().catch(() => "");
  if (/error del servidor/i.test(texto)) return "servidor";
  if (/no hay resultados|no se encontr|sin resultado/i.test(texto)) return "vacio";
  if (!new RegExp(factura.serie.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(texto)) {
    return "SUNAT dejó en pantalla el resultado de otro comprobante.";
  }
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
  const palabra = tipo === "01" ? /factura/i : tipo === "02" ? /recibo/i : /boleta/i;
  const noEs = /nota|declaracion|valor|tributari|aduaner/i;
  const fila = frame
    .locator("div, tr, section")
    .filter({ hasText: /Tipo de comprobante/i })
    .filter({ has: frame.locator("ng-select, .ng-select, [role='combobox'], select") })
    .last();
  const combo = ((await fila.count()) ? fila : frame).locator("ng-select, .ng-select, [role='combobox']").first();
  if (await combo.count()) await combo.click({ force: true }).catch(() => undefined);
  else {
    const disparador = frame.getByText(/seleccionar/i).last();
    if (!(await disparador.count())) {
      const texto = await frame.locator("body").innerText().catch(() => "");
      const lineas = texto
        .split(/\n/)
        .map((linea) => linea.replace(/\s+/g, " ").trim())
        .filter((linea) => /tipo|factur|seleccion|boleta|recibo/i.test(linea))
        .slice(0, 15);
      console.log(`Formulario: ${lineas.join(" | ") || "(sin tipo)"}`);
      await page.screenshot({ path: "C:/Users/Willl/AppData/Local/Temp/sunat-tipo.png" }).catch(() => undefined);
      return false;
    }
    await disparador.click({ force: true }).catch(() => undefined);
  }
  await page.waitForTimeout(400);
  const grupos = [
    frame.locator(".ng-option, [role='option']"),
    page.locator(".ng-dropdown-panel .ng-option, [role='option']"),
  ];
  for (const opciones of grupos) {
    const total = await opciones.count().catch(() => 0);
    for (let i = 0; i < total; i++) {
      const item = opciones.nth(i);
      const texto = ((await item.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
      if (!palabra.test(texto) || noEs.test(texto) || texto.length > 60) continue;
      if (!(await item.isVisible().catch(() => false))) continue;
      await item.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
      return true;
    }
  }
  const muestras = await frame
    .locator(".ng-option, [role='option']")
    .allInnerTexts()
    .catch(() => [] as string[]);
  console.log(
    `Opciones de tipo: ${muestras.map((texto) => texto.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 12).join(" | ") || "(ninguna)"}`,
  );
  await page.screenshot({ path: "C:/Users/Willl/AppData/Local/Temp/sunat-tipo.png" }).catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);
  return false;
}

async function tipoYaElegido(frame: Frame, tipo: TipoSol): Promise<boolean> {
  const texto = await frame.locator("body").innerText().catch(() => "");
  return texto.split(/\n/).some((linea) => esEtiquetaTipo(linea, tipo));
}

async function elegirTipoEnSelect(frame: Frame, tipo: TipoSol): Promise<boolean> {
  const selects = frame.locator("select");
  const total = await selects.count();
  for (let i = 0; i < total; i++) {
    const lista = selects.nth(i);
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

async function bajar(
  page: Page,
  frame: Frame,
  etiqueta: "XML" | "CDR",
): Promise<{ bytes: Uint8Array | null; previo: boolean }> {
  const marcado = await pulsarIcono(frame, etiqueta, false);
  if (marcado === "sin-cdr") return { bytes: null, previo: false };
  if (marcado) {
    const bajada = await clicDescarga(page, () => pulsarIcono(frame, etiqueta, true));
    if (bajada.previo) return bajada;
    if (bajada.bytes && etiqueta === "XML" && !xmlDeArchivo(bajada.bytes)) return { bytes: null, previo: false };
    return bajada;
  }
  const selector = [
    `[title*='${etiqueta}' i]`,
    `[aria-label*='${etiqueta}' i]`,
    `img[alt*='${etiqueta}' i]`,
    `img[src*='${etiqueta}' i]`,
    `[onclick*='${etiqueta}' i]`,
    `a:has-text('${etiqueta}')`,
    `button:has-text('${etiqueta}')`,
  ].join(", ");
  for (const lugar of [frame, ...page.frames().filter((otro) => otro !== frame)]) {
    const botones = lugar.locator(selector);
    const total = await botones.count().catch(() => 0);
    for (let i = 0; i < total; i++) {
      const boton = botones.nth(i);
      if (!(await boton.isVisible().catch(() => false))) continue;
      if (await esIconoDeImpresion(boton)) continue;
      const bajada = await clicDescarga(page, () => boton.click({ force: true }));
      if (bajada.previo) return bajada;
      if (bajada.bytes && (etiqueta === "CDR" || xmlDeArchivo(bajada.bytes))) return bajada;
    }
  }
  return { bytes: null, previo: false };
}

async function esIconoDeImpresion(boton: Locator): Promise<boolean> {
  const pista = await boton
    .evaluate((nodo) => {
      const el = nodo as HTMLElement;
      return [el.getAttribute("title"), el.getAttribute("aria-label"), el.getAttribute("alt"), el.getAttribute("src"), el.getAttribute("onclick"), el.textContent]
        .filter(Boolean)
        .join(" ");
    })
    .catch(() => "");
  return /imprim|print|pdf|representa/i.test(pista) && !/\b(?:xml|cdr)\b/i.test(pista);
}

async function pulsarIcono(frame: Frame, etiqueta: "XML" | "CDR", pulsar: boolean): Promise<string> {
  const info = await frame
    .evaluate(
      ({ buscado, hacerClic }) => {
        const titulo = [...document.querySelectorAll("div, span, h1, h2, h3, h4, p, strong, label, a")].find((nodo) => {
          if (!(nodo instanceof HTMLElement)) return false;
          const propio = [...nodo.childNodes]
            .filter((hijo) => hijo.nodeType === Node.TEXT_NODE)
            .map((hijo) => hijo.textContent ?? "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (propio !== "Resultado") return false;
          const caja = nodo.getBoundingClientRect();
          return caja.height > 0 && caja.height < 48 && caja.width < 240;
        });
        if (!(titulo instanceof HTMLElement)) return "";
        const techo = titulo.getBoundingClientRect().bottom;
        const vistos = new Set<HTMLElement>();
        const iconos: HTMLElement[] = [];
        for (const nodo of document.querySelectorAll("a, button, img")) {
          if (!(nodo instanceof HTMLElement)) continue;
          const caja = nodo.getBoundingClientRect();
          if (caja.top < techo - 4 || caja.top > techo + 90) continue;
          if (caja.width < 8 || caja.width > 64 || caja.height < 8 || caja.height > 64) continue;
          const estilo = window.getComputedStyle(nodo);
          if (estilo.display === "none" || estilo.visibility === "hidden" || Number(estilo.opacity) === 0) continue;
          const destino = nodo.closest("a, button");
          const icono = destino instanceof HTMLElement ? destino : nodo;
          if (/\bopacidad-60\b|disabled/i.test(String(icono.className)) || icono.getAttribute("disabled") !== null) continue;
          if (vistos.has(icono)) continue;
          vistos.add(icono);
          iconos.push(icono);
        }
        iconos.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        if (iconos.length !== 4 && iconos.length !== 5) return "";
        if (buscado === "CDR" && iconos.length === 4) return "sin-cdr";
        const icono = iconos[buscado === "XML" ? 1 : 2];
        if (!(icono instanceof HTMLElement)) return "";
        if (hacerClic) icono.click();
        const puesto = buscado === "XML" ? 2 : 3;
        return `${iconos.length} iconos, puesto ${puesto}. Los dos últimos son imprimir y correo.`;
      },
      { buscado: etiqueta, hacerClic: pulsar },
    )
    .catch(() => "");
  if (pulsar && info && info !== "sin-cdr") console.log(`Icono ${etiqueta}: ${info}`);
  if (!pulsar && info === "sin-cdr") console.log("Resultado tiene 4 iconos: XML y no CDR.");
  return info;
}

async function clicDescarga(
  page: Page,
  pulsar: () => Promise<unknown>,
): Promise<{ bytes: Uint8Array | null; previo: boolean }> {
  const espera = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
  await pulsar().catch(() => undefined);
  const vence = Date.now() + 15_000;
  let previo = false;
  let descarga: Download | null = null;
  while (Date.now() < vence) {
    if (await aceptarSiDescargaPrevia(page)) {
      if (!previo) console.log("SUNAT avisó que el archivo ya se había descargado. Pulso Aceptar.");
      previo = true;
    }
    await cerrarRepresentacionesAbiertas(page);
    const llegado = await Promise.race([
      espera.then((archivo) => archivo ?? "agotado"),
      page.waitForTimeout(350).then(() => null),
    ]);
    if (llegado === "agotado") break;
    if (llegado) {
      descarga = llegado;
      break;
    }
  }
  if (await aceptarSiDescargaPrevia(page)) {
    if (!previo) console.log("SUNAT avisó que el archivo ya se había descargado. Pulso Aceptar.");
    previo = true;
  }
  await cerrarRepresentacionesAbiertas(page);
  if (!descarga) {
    if (previo) console.log("SUNAT ya había entregado este archivo y no volvió a bajarlo.");
    return { bytes: null, previo };
  }
  return { bytes: await leerDescarga(descarga), previo };
}

async function aceptarSiDescargaPrevia(page: Page): Promise<boolean> {
  for (const frame of page.frames()) {
    const pulso = await frame
      .evaluate(() => {
        for (const boton of document.querySelectorAll("button, a, input[type='button'], input[type='submit']")) {
          if (!(boton instanceof HTMLElement)) continue;
          const rotulo = (boton.innerText || (boton as HTMLInputElement).value || "").replace(/\s+/g, " ").trim();
          if (!/^aceptar$/i.test(rotulo)) continue;
          let nodo: HTMLElement | null = boton.parentElement;
          while (nodo) {
            const texto = (nodo.innerText || "").replace(/\s+/g, " ").trim();
            if (/descargado previamente/i.test(texto) && texto.length < 500) {
              const estilo = window.getComputedStyle(boton);
              if (estilo.display === "none" || estilo.visibility === "hidden") return false;
              boton.click();
              return true;
            }
            if (texto.length > 800) break;
            nodo = nodo.parentElement;
          }
        }
        return false;
      })
      .catch(() => false);
    if (pulso) return true;
  }
  return false;
}

function vigilarImpresion(context: BrowserContext, principal: Page): void {
  context.on("page", (popup) => {
    if (popup === principal) return;
    void popup.waitForLoadState("domcontentloaded", { timeout: 8_000 }).catch(() => undefined);
  });
}

async function bajarRepresentacion(page: Page, frame: Frame): Promise<Uint8Array | null> {
  console.log("SUNAT no dio CDR. Armo el PDF con la factura que ya está en Resultado, sin pulsar Imprimir.");
  await taparImpresion(page);
  const delPanel = await pdfDeResultado(page, frame);
  if (delPanel) return delPanel;
  if (await hayIconoPdf(frame)) {
    const bajada = await clicDescarga(page, async () => {
      await taparImpresion(page);
      await hayIconoPdf(frame, true);
    });
    await taparImpresion(page);
    if (bajada.bytes && esPdf(bajada.bytes)) return bajada.bytes;
  }
  return null;
}

async function taparImpresion(page: Page): Promise<void> {
  for (const frame of page.frames()) {
    await frame
      .evaluate(() => {
        const noop = () => undefined;
        try {
          Object.defineProperty(window, "print", { configurable: true, writable: true, value: noop });
        } catch {
          window.print = noop;
        }
      })
      .catch(() => undefined);
  }
  await page.keyboard.press("Escape").catch(() => undefined);
}

function escalaParaA4(anchoPx: number): number {
  const hoja = (210 / 25.4) * 96;
  const margenes = (12 / 25.4) * 96;
  const cabe = Math.max(1, hoja - margenes);
  return Math.min(1, Math.max(0.1, cabe / Math.max(anchoPx, 1)));
}

async function pdfDeResultado(page: Page, frame: Frame): Promise<Uint8Array | null> {
  const html = await frame
    .evaluate(() => {
      const nodos = [...document.querySelectorAll("div, section, table")].filter((el) => {
        const texto = el.textContent ?? "";
        return /FACTURA ELECTR|BOLETA DE VENTA|RECIBO POR HONORARIOS/i.test(texto) && /SON:/i.test(texto);
      });
      nodos.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
      const nodo = nodos[0];
      if (!nodo) return "";
      const estilos = [...document.querySelectorAll("style")].map((n) => n.outerHTML).join("");
      return `<!DOCTYPE html><html><head><meta charset="utf-8">${estilos}<style>html,body{margin:0;padding:8px;width:max-content !important;overflow:visible !important;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000}body *{overflow:visible !important}table{border-collapse:collapse}</style></head><body>${nodo.outerHTML}</body></html>`;
    })
    .catch(() => "");
  if (!html) return null;
  const hoja = await page.context().newPage();
  try {
    await hoja.setViewportSize({ width: 1800, height: 2400 });
    await hoja.setContent(html, { waitUntil: "load" });
    const ancho = await hoja.evaluate(() => {
      const range = document.createRange();
      let right = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let nodo: Node | null = walker.nextNode();
      while (nodo) {
        if (nodo.textContent?.trim()) {
          range.selectNodeContents(nodo);
          const box = range.getBoundingClientRect();
          if (box.right > right) right = box.right;
        }
        nodo = walker.nextNode();
      }
      return Math.ceil(Math.max(right, document.body.scrollWidth) + 16);
    });
    const bytes = await hoja.pdf({
      format: "A4",
      printBackground: true,
      scale: escalaParaA4(ancho),
      margin: { top: "8mm", bottom: "8mm", left: "6mm", right: "6mm" },
    });
    return esPdf(bytes) ? bytes : null;
  } catch {
    return null;
  } finally {
    await hoja.close().catch(() => undefined);
  }
}

async function hayIconoPdf(frame: Frame, pulsar = false): Promise<boolean> {
  return frame
    .evaluate((hacerClic) => {
      for (const nodo of document.querySelectorAll("a, button, img")) {
        if (!(nodo instanceof HTMLElement)) continue;
        const destino = nodo.closest("a, button");
        const icono = destino instanceof HTMLElement ? destino : nodo;
        const pista = [
          icono.getAttribute("title"),
          icono.getAttribute("aria-label"),
          icono.getAttribute("alt"),
          icono.getAttribute("href"),
          icono.getAttribute("src"),
          icono.getAttribute("onclick"),
          String(icono.className),
        ]
          .filter(Boolean)
          .join(" ");
        if (/imprim|print|correo|mail|e-?mail/i.test(pista)) continue;
        if (!/\bpdf\b|acrobat|\.pdf/i.test(pista)) continue;
        if (hacerClic) icono.click();
        return true;
      }
      return false;
    }, pulsar)
    .catch(() => false);
}

function esPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

async function cerrarRepresentacionesAbiertas(page: Page): Promise<void> {
  for (const otra of page.context().pages()) {
    if (otra === page || otra.isClosed()) continue;
    await cerrarRepresentacion(otra);
  }
}

async function cerrarRepresentacion(popup: Page): Promise<void> {
  if (popup.isClosed()) return;
  await popup.waitForLoadState("domcontentloaded", { timeout: 8_000 }).catch(() => undefined);
  if (popup.isClosed()) return;
  const titulo = await popup.title().catch(() => "");
  const texto = await popup.locator("body").innerText().catch(() => "");
  if (!/representaci[oó]n impresa|imprimir/i.test(`${titulo}\n${texto}`.slice(0, 1500))) return;
  console.log("Cierro la representación impresa de SUNAT.");
  await popup.close().catch(() => undefined);
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
  const directo = textoXml(bytes);
  if (directo) return directo;
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return null;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return null;
  }
  const nombres = Object.keys(files).filter((item) => !item.endsWith("/"));
  const ordenados = [
    ...nombres.filter((item) => item.toLowerCase().endsWith(".xml") && !/cdr/i.test(item)),
    ...nombres.filter((item) => item.toLowerCase().endsWith(".xml")),
    ...nombres,
  ];
  for (const nombre of ordenados) {
    const texto = textoXml(files[nombre]);
    if (texto) return texto;
  }
  return null;
}

function textoXml(bytes: Uint8Array): string | null {
  let inicio = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) inicio = 3;
  const texto = new TextDecoder().decode(bytes.subarray(inicio)).replace(/^\uFEFF/, "").trim();
  if (!texto.startsWith("<")) return null;
  return /<(?:[\w.-]+:)?(?:Invoice|CreditNote|DebitNote)\b/.test(texto) ? texto : null;
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
        for (const modal of document.querySelectorAll("[id^='divModalCampana']")) {
          if (modal instanceof HTMLElement) modal.remove();
        }
      })
      .catch(() => undefined);
  }
}

async function lineasDe(page: Page, filtro: RegExp): Promise<string> {
  const vistas: string[] = [];
  for (const frame of page.frames()) {
    const texto = await frame.locator("body").innerText().catch(() => "");
    for (const linea of texto.split(/\n/)) {
      const limpia = linea.replace(/\s+/g, " ").trim();
      if (!limpia || limpia.length > 140 || !filtro.test(limpia)) continue;
      if (!vistas.includes(limpia)) vistas.push(limpia);
    }
  }
  return vistas.slice(0, 30).join(" | ");
}

async function clickConsultaComprobantes(page: Page): Promise<boolean> {
  return (
    (await clickTexto(page, "Consulta de", true, true)) ||
    (await clickEnDom(page, "Consulta de")) ||
    (await clickTexto(page, "Nueva Consulta de comprobantes de pago", true, true)) ||
    (await clickEnDom(page, "Nueva Consulta de comprobantes de pago")) ||
    (await clickTexto(page, "Consulta de Comprobantes de Pago", true, true)) ||
    (await clickEnDom(page, "Consulta de Comprobantes de Pago"))
  );
}

async function clickQueContiene(page: Page, frase: string): Promise<boolean> {
  return clickTexto(page, frase, false, true);
}

async function clickTexto(page: Page, frase: string, exacto: boolean, forzar = false): Promise<boolean> {
  const vence = Date.now() + 8_000;
  const meta = etiquetaMenu(frase);
  const otra = /facturas|declaraciones|valores|tributarias|aduaneras/i;
  while (Date.now() < vence) {
    for (const frame of page.frames()) {
      const loc = frame.getByText(frase, { exact: exacto });
      const total = await loc.count().catch(() => 0);
      let visible = -1;
      let oculto = -1;
      let largoVisible = Number.POSITIVE_INFINITY;
      let largoOculto = Number.POSITIVE_INFINITY;
      for (let i = 0; i < total; i++) {
        const item = loc.nth(i);
        const crudo =
          ((await item.innerText().catch(() => "")) || "").trim() ||
          ((await item.textContent().catch(() => "")) || "");
        const propio = etiquetaMenu(crudo);
        if (!propio || otra.test(propio)) continue;
        if (exacto ? propio !== meta : !propio.includes(meta)) continue;
        if (propio.length > 90) continue;
        if (await item.isVisible().catch(() => false)) {
          if (propio.length < largoVisible) {
            visible = i;
            largoVisible = propio.length;
          }
          continue;
        }
        if (forzar && propio.length < largoOculto) {
          oculto = i;
          largoOculto = propio.length;
        }
      }
      const elegido = visible >= 0 ? visible : oculto;
      if (elegido < 0) continue;
      const item = loc.nth(elegido);
      if (visible >= 0 && (await item.click({ timeout: 5_000 }).then(() => true).catch(() => false))) {
        console.log(`Clic en «${frase}».`);
        return true;
      }
      const detalle = await item
        .evaluate((el) => {
          const nodo = el instanceof HTMLElement ? el : null;
          if (!nodo) return "";
          const destino = nodo.closest("a, button");
          const enlace = destino instanceof HTMLAnchorElement ? destino : nodo.closest("a");
          const href = enlace instanceof HTMLAnchorElement ? enlace.href : "";
          const limpio = href.startsWith("javascript:") ? "js" : href.split("?")[0];
          (destino instanceof HTMLElement ? destino : nodo).click();
          return `${nodo.tagName} ${limpio}`.trim().slice(0, 160);
        })
        .catch(() => "");
      if (!detalle) continue;
      console.log(`Clic en «${frase}». ${detalle}`);
      return true;
    }
    await page.waitForTimeout(400);
  }
  return false;
}

async function clickEnDom(page: Page, frase: string): Promise<boolean> {
  const meta = etiquetaMenu(frase);
  for (const frame of page.frames()) {
    const ok = await frame
      .evaluate((buscado) => {
        const normal = (valor: string | null) =>
          (valor ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^[^\p{L}\p{N}]+/u, "")
            .trim()
            .toLowerCase();
        const otra = /facturas|declaraciones|valores|tributarias|aduaneras/;
        const vistos: HTMLElement[] = [];
        const visitar = (raiz: ParentNode) => {
          for (const nodo of raiz.querySelectorAll("a, button, span, li, td, div")) {
            if (!(nodo instanceof HTMLElement)) continue;
            const limpio = normal(nodo.textContent);
            if (limpio === buscado && !otra.test(limpio)) vistos.push(nodo);
            if (nodo.shadowRoot) visitar(nodo.shadowRoot);
          }
        };
        visitar(document);
        vistos.sort((a, b) => (a.textContent ?? "").length - (b.textContent ?? "").length);
        const elegido = vistos[0];
        if (!elegido) return false;
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
