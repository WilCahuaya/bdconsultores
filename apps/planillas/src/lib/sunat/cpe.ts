import "server-only";
import { unzipSync, strFromU8 } from "fflate";
import { getAccessToken, type SunatCredencialSecreto } from "./auth";

const SCOPE_CPE = "https://api-cpe.sunat.gob.pe";
const SCOPE_SIRE = "https://api-sire.sunat.gob.pe";
const AVISO_SIN_XML =
  "El registro de compras no incluye lo que se compró. La consulta del XML no está disponible para la aplicación registrada en SUNAT.";

let plantillaOk: number | null = null;
let sinXmlHasta = 0;

export async function descargarXmlRecibido(
  cred: SunatCredencialSecreto,
  compra: { rucEmisor: string; tipo: string; serie: string; numero: string },
): Promise<{ xml: string | null; aviso: string | null }> {
  if (!/^\d{11}$/.test(compra.rucEmisor)) {
    return { xml: null, aviso: "El registro no trae el RUC del proveedor, así que no se puede pedir el detalle." };
  }
  if (plantillaOk == null && sinXmlHasta > Date.now()) {
    return { xml: null, aviso: AVISO_SIN_XML };
  }

  const token = await tokenDeConsulta(cred);
  if (!token) {
    return {
      xml: null,
      aviso: "SUNAT no autorizó la consulta del XML. La aplicación de esta empresa no tiene habilitado ese recurso.",
    };
  }

  const numero = compra.numero.replace(/^0+(?=\d)/, "");
  const serie = encodeURIComponent(compra.serie);
  const id = `${compra.rucEmisor}-${compra.tipo}-${serie}-${numero}`;
  const base = "https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe";
  const urls = [
    `${base}/${compra.rucEmisor}/${compra.tipo}/${serie}/${numero}/2/02`,
    `${base}/${compra.rucEmisor}/${compra.tipo}/${serie}/${numero}/11/02`,
    `${base}/comprobantes/${id}/02`,
    `${base}/comprobantes/${id}`,
    `${base}/${compra.rucEmisor}/${compra.tipo}/${serie}/${numero}`,
  ];
  const orden = plantillaOk == null ? urls.map((_, index) => index) : [plantillaOk];

  let aviso = AVISO_SIN_XML;
  let soloNoEncontrado = true;
  for (const index of orden) {
    const url = urls[index];
    if (!url) continue;
    const res = await pedirUna(url, token);
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.status === 401 || res.status === 403) {
      sinXmlHasta = Date.now() + 10 * 60_000;
      return {
        xml: null,
        aviso: "SUNAT no entregó el detalle. Hay que habilitar el recurso consultacpe en la aplicación de esta empresa.",
      };
    }
    if (res.ok) {
      const xml = extraerXml(buf) ?? xmlDesdeDetalle(buf.toString("utf8"));
      if (xml) {
        plantillaOk = index;
        sinXmlHasta = 0;
        return { xml, aviso: null };
      }
    }
    if (res.status !== 404) soloNoEncontrado = false;
    const mensaje = mensajeSunat(buf.toString("utf8"));
    if (mensaje) aviso = mensaje;
  }

  if (plantillaOk == null && soloNoEncontrado) sinXmlHasta = Date.now() + 10 * 60_000;
  return { xml: null, aviso };
}

function mensajeSunat(texto: string): string | null {
  const body = texto.trim();
  if (!body.startsWith("{")) return null;
  try {
    const json = JSON.parse(body) as { msg?: string; message?: string; error_description?: string };
    const mensaje = json.msg || json.message || json.error_description;
    if (!mensaje) return null;
    return `SUNAT respondió: ${mensaje}`.slice(0, 220);
  } catch {
    return null;
  }
}

function xmlDesdeDetalle(texto: string): string | null {
  const body = texto.trim();
  if (!body.startsWith("{")) return null;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const lineas = buscarLineas(json);
  if (lineas.length === 0) return null;
  const items = lineas
    .map((linea, index) => {
      const descripcion = textoDe(linea, ["descripcion", "description", "desItem"]);
      if (!descripcion) return "";
      const cantidad = textoDe(linea, ["cantidad", "cntItems", "quantity"]) || "1";
      const importe = textoDe(linea, ["mtoValorVenta", "mtoImporte", "importe", "lineExtensionAmount"]) || "0";
      const precio = textoDe(linea, ["mtoPrecioUnitario", "precioUnitario", "priceAmount"]) || importe;
      return `<cac:InvoiceLine><cbc:ID>${index + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="NIU">${cantidad}</cbc:InvoicedQuantity><cbc:LineExtensionAmount>${importe}</cbc:LineExtensionAmount><cac:Item><cbc:Description>${escapar(descripcion)}</cbc:Description></cac:Item><cac:Price><cbc:PriceAmount>${precio}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`;
    })
    .filter(Boolean)
    .join("");
  if (!items) return null;
  return `<Invoice>${items}</Invoice>`;
}

function buscarLineas(value: unknown, profundidad = 0): Array<Record<string, unknown>> {
  if (profundidad > 4 || !value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    const objetos = value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>;
    if (objetos.some((item) => textoDe(item, ["descripcion", "description", "desItem"]))) return objetos;
    for (const item of objetos) {
      const halladas = buscarLineas(item, profundidad + 1);
      if (halladas.length > 0) return halladas;
    }
    return [];
  }
  for (const item of Object.values(value)) {
    const halladas = buscarLineas(item, profundidad + 1);
    if (halladas.length > 0) return halladas;
  }
  return [];
}

function textoDe(row: Record<string, unknown>, claves: string[]): string {
  for (const clave of claves) {
    const valor = row[clave] ?? row[clave.toUpperCase()];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
    if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  }
  return "";
}

function escapar(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function tokenDeConsulta(cred: SunatCredencialSecreto): Promise<string | null> {
  try {
    return await getAccessToken(cred, SCOPE_CPE);
  } catch {
    try {
      return await getAccessToken(cred, SCOPE_SIRE);
    } catch {
      return null;
    }
  }
}

async function pedirUna(url: string, token: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/xml, application/zip, application/octet-stream, application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return new Response(null, { status: 504 });
  }
}

function extraerXml(buf: Buffer): string | null {
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(new Uint8Array(buf));
    const name =
      Object.keys(files).find((item) => /\.xml$/i.test(item) && !/cdr/i.test(item)) ??
      Object.keys(files).find((item) => /\.xml$/i.test(item));
    return name ? strFromU8(files[name]) : null;
  }
  const text = buf.toString("utf8").trim();
  if (!text) return null;
  if (text.startsWith("{")) {
    try {
      const json = JSON.parse(text) as {
        valArchivo?: string;
        archivo?: string;
        xml?: string;
        arcXml?: string;
        archivoXml?: string;
      };
      const directo = json.xml || json.arcXml || json.archivoXml;
      if (directo && directo.includes("<")) return directo;
      const b64 = json.valArchivo || json.archivo || (directo && !directo.includes("<") ? directo : undefined);
      if (b64) return extraerXml(Buffer.from(b64, "base64"));
    } catch {
      return null;
    }
    return null;
  }
  if (text.includes("<")) return text;
  if (/^[A-Za-z0-9+/=\s]+$/.test(text) && text.length > 80) {
    try {
      return extraerXml(Buffer.from(text.replace(/\s/g, ""), "base64"));
    } catch {
      return null;
    }
  }
  return null;
}
