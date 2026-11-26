import { unzipSync, strFromU8 } from "fflate";
import { getAccessToken, type SunatCredencialSecreto } from "./auth";
import { SunatError, SunatTicketPendienteError } from "./errors";
import { sunatFetch } from "./http";

const SIRE = "https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros";
const COD_LIBRO_RCE = "080000";
const EN_PROCESO = new Set(["01", "02", "05", "10"]);
const LISTO = new Set(["03", "04", "06"]);
const FALLO = new Set(["07", "08", "09"]);

interface ArchivoReporte {
  codTipoAchivoReporte?: string;
  nomArchivoReporte?: string;
}

interface RegistroTicket {
  perTributario?: string;
  numTicket?: string;
  codProceso?: string;
  codEstadoProceso?: string;
  desEstadoProceso?: string;
  archivoReporte?: ArchivoReporte[];
  detalleTicket?: { nomArchivoReporte?: string | null };
}

interface ConsultaTicketResponse {
  registros?: RegistroTicket[];
  numTicket?: string;
  cod?: string;
  msg?: string;
  message?: string;
}

export interface PropuestaRce {
  numTicket: string;
  nombreArchivo: string;
  contenido: Buffer;
  texto: string;
}

export async function descargarPropuestaRce(
  cred: SunatCredencialSecreto,
  periodo: string,
  options?: { numTicket?: string; maxIntentos?: number; esperaMs?: number; onEspera?: (intento: number, codigo: string) => void },
): Promise<PropuestaRce> {
  if (!/^[0-9]{6}$/.test(periodo)) {
    throw new SunatError("El periodo debe ser AAAAMM.", "PERIODO");
  }
  const maxIntentos = options?.maxIntentos ?? 8;
  const esperaMs = options?.esperaMs ?? 4_000;
  const numTicket = options?.numTicket ?? (await solicitar(cred, periodo));
  for (let intento = 0; intento < maxIntentos; intento++) {
    const registro = await consultar(cred, periodo, numTicket);
    const codigo = registro.codEstadoProceso ?? "";
    const descripcion = registro.desEstadoProceso ?? "";
    if (LISTO.has(codigo) || /termin/i.test(descripcion)) {
      return leerArchivo(cred, periodo, registro, numTicket);
    }
    if (FALLO.has(codigo) || /error/i.test(descripcion)) {
      throw new SunatError(`SUNAT no generó el archivo: ${codigo} ${descripcion}`.trim(), codigo);
    }
    if (intento < maxIntentos - 1 && (EN_PROCESO.has(codigo) || !codigo)) {
      options?.onEspera?.(intento + 1, codigo);
      await new Promise((resolve) => setTimeout(resolve, esperaMs));
      continue;
    }
    throw new SunatTicketPendienteError(numTicket, codigo, descripcion);
  }
  throw new SunatTicketPendienteError(numTicket, "", "sin estado");
}

async function solicitar(cred: SunatCredencialSecreto, periodo: string): Promise<string> {
  const token = await getAccessToken(cred);
  const { ini, fin } = rangoMes(periodo);
  const qs = new URLSearchParams({
    codTipoArchivo: "0",
    codOrigenEnvio: "2",
    fecEmisionIni: ini,
    fecEmisionFin: fin,
  });
  const url = `${SIRE}/rce/propuesta/web/propuesta/${periodo}/exportacioncomprobantepropuesta?${qs}`;
  const json = await getJson<{ numTicket?: string }>(url, token, 45_000);
  if (!json.numTicket) throw new SunatError("SUNAT no devolvió el número de ticket.", "SIN_TICKET");
  return json.numTicket;
}

async function consultar(cred: SunatCredencialSecreto, periodo: string, numTicket: string): Promise<RegistroTicket> {
  const token = await getAccessToken(cred);
  const qs = new URLSearchParams({
    perIni: periodo,
    perFin: periodo,
    page: "1",
    perPage: "20",
    numTicket,
    codLibro: COD_LIBRO_RCE,
    codOrigenEnvio: "2",
  });
  const url = `${SIRE}/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets?${qs}`;
  const json = await getJson<ConsultaTicketResponse>(url, token, 20_000);
  const registro = json.registros?.find((item) => item.numTicket === numTicket) ?? json.registros?.[0];
  if (!registro) throw new SunatError(`El ticket ${numTicket} todavía no aparece en SUNAT.`, "TICKET_AUSENTE");
  return registro;
}

async function leerArchivo(
  cred: SunatCredencialSecreto,
  periodo: string,
  registro: RegistroTicket,
  numTicket: string,
): Promise<PropuestaRce> {
  const reporte = registro.archivoReporte?.[0];
  const nombre = reporte?.nomArchivoReporte || registro.detalleTicket?.nomArchivoReporte;
  if (!nombre || !registro.codProceso) {
    throw new SunatError("El ticket figura listo y SUNAT no indicó el archivo.", "SIN_ARCHIVO");
  }
  const token = await getAccessToken(cred);
  const qs = new URLSearchParams({
    nomArchivoReporte: nombre,
    codTipoArchivoReporte: reporte?.codTipoAchivoReporte || "0",
    codLibro: COD_LIBRO_RCE,
    perTributario: periodo,
    codProceso: registro.codProceso,
    numTicket,
  });
  const url = `${SIRE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte?${qs}`;
  const res = await sunatFetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json, application/zip, application/octet-stream" },
    timeoutMs: 120_000,
  });
  if (!res.ok) throw new SunatError(`SUNAT rechazó la descarga (${res.status}).`, "DESCARGA", res.status);

  const tipo = res.headers.get("content-type") ?? "";
  const contenido = tipo.includes("json") ? await zipDesdeJson(res) : Buffer.from(await res.arrayBuffer());
  return { numTicket, nombreArchivo: nombre, contenido, texto: textoDeArchivo(contenido) };
}

export function textoDeArchivo(contenido: Buffer): string {
  if (contenido.length >= 2 && contenido[0] === 0x50 && contenido[1] === 0x4b) {
    const files = unzipSync(new Uint8Array(contenido));
    const name = Object.keys(files).find((item) => /\.(txt|csv)$/i.test(item)) ?? Object.keys(files)[0];
    if (!name) throw new SunatError("El ZIP de SUNAT llegó vacío.", "ZIP_VACIO");
    return strFromU8(files[name]);
  }
  return contenido.toString("utf8");
}

async function zipDesdeJson(res: Response): Promise<Buffer> {
  const json = (await res.json()) as { valArchivo?: string; msg?: string; cod?: string };
  if (!json.valArchivo) throw new SunatError(json.msg || "SUNAT no envió el archivo.", json.cod);
  return Buffer.from(json.valArchivo, "base64");
}

async function getJson<T>(url: string, token: string, timeoutMs: number): Promise<T> {
  const res = await sunatFetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    timeoutMs,
  });
  const json = (await res.json().catch(() => ({}))) as T & { msg?: string; cod?: string; message?: string; errors?: Array<{ msg?: string }> };
  const negocio = json.cod && json.cod !== "200" && !("numTicket" in (json as object)) && !("registros" in (json as object));
  if (!res.ok || negocio) {
    const detalle = json.errors?.map((item) => item.msg).filter(Boolean).join(" ");
    throw new SunatError(detalle || json.msg || json.message || `SIRE respondió ${res.status}.`, json.cod, res.status);
  }
  return json;
}

function rangoMes(periodo: string): { ini: string; fin: string } {
  const year = Number(periodo.slice(0, 4));
  const month = Number(periodo.slice(4, 6));
  const ini = `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const fin = `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}-${String(last).padStart(2, "0")}`;
  return { ini, fin };
}
