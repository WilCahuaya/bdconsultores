import "server-only";
import { unzipSync, strFromU8 } from "fflate";
import { getAccessToken, type SunatCredencialSecreto } from "./auth";
import { sunatFetch } from "./http";

const SCOPE_CPE = "https://api-cpe.sunat.gob.pe";
const SCOPE_SIRE = "https://api-sire.sunat.gob.pe";

export async function descargarXmlRecibido(
  cred: SunatCredencialSecreto,
  compra: { rucEmisor: string; tipo: string; serie: string; numero: string },
): Promise<{ xml: string | null; aviso: string | null }> {
  if (!/^\d{11}$/.test(compra.rucEmisor)) {
    return { xml: null, aviso: "El registro no trae el RUC del proveedor, así que no se puede pedir el detalle." };
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
  const urls = [
    `https://api-cpe.sunat.gob.pe/v1/contribuyente/${cred.ruc}/consultacpe/${compra.rucEmisor}/${compra.tipo}/${serie}/${numero}/02`,
    `https://api-cpe.sunat.gob.pe/consultacpe/${cred.ruc}/RCE/${compra.rucEmisor}/${compra.tipo}/${serie}/${numero}/02`,
  ];

  let ultimoEstado = 0;
  for (const url of urls) {
    const res = await pedir(url, token);
    ultimoEstado = res.status;
    if (res.status === 401 || res.status === 403) {
      return {
        xml: null,
        aviso: "SUNAT no entregó el detalle de la compra. Hay que habilitar el recurso consultacpe en la aplicación de esta empresa.",
      };
    }
    if (res.status === 404) continue;
    if (!res.ok) continue;
    const xml = extraerXml(Buffer.from(await res.arrayBuffer()));
    if (xml) return { xml, aviso: null };
  }

  if (ultimoEstado === 404) {
    return { xml: null, aviso: "SUNAT no tiene el XML de este comprobante para quien lo recibió." };
  }
  return { xml: null, aviso: "SUNAT no entregó el XML de este comprobante." };
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

async function pedir(url: string, token: string): Promise<Response> {
  const init = {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/xml, application/zip, application/octet-stream, application/json",
    },
    timeoutMs: 25_000,
  };
  const primero = await sunatFetch(url, init);
  if (primero.status < 500) return primero;
  return sunatFetch(url, init);
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
      const json = JSON.parse(text) as { valArchivo?: string; archivo?: string; xml?: string };
      if (json.xml && json.xml.includes("<")) return json.xml;
      const b64 = json.valArchivo || json.archivo;
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
