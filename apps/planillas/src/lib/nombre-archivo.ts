import type { JornadaLaboral } from "@inventario/types";
import { cargoSigla } from "@/lib/cargos-funciones";
import { MES_ABREV, partesMes } from "@/lib/horario-asistencia";
import { formatNumeroTrabajador } from "@/lib/planillas-labels";

export function tokenNombreArchivo(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** `02 ` si el trabajador tiene número. Vacío si no. */
export function prefijoNumeroArchivo(numero: number | null | undefined): string {
  const n = formatNumeroTrabajador(numero);
  return n ? `${n} ` : "";
}

/** Inicial del apellido paterno y primer nombre: `H MARLENI`. */
export function personaNombreArchivo(nombres: string, apellidoPaterno: string | null | undefined): string {
  const nombre = tokenNombreArchivo(nombres.trim().split(/\s+/)[0] ?? "");
  const inicial = tokenNombreArchivo(apellidoPaterno ?? "").charAt(0);
  return [inicial, nombre].filter(Boolean).join(" ");
}

/** `19 ENE 2026`. */
export function fechaNombreArchivo(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  const abrev = MES_ABREV[Number(month) - 1] ?? month ?? "";
  return `${day ?? ""} ${abrev.toUpperCase()} ${year ?? ""}`.replace(/\s+/g, " ").trim();
}

export function nombreBaseContrato(d: {
  numero?: number | null;
  jornada: JornadaLaboral;
  cargo: string;
  nombres: string;
  apellidoPaterno: string | null;
  fecha: string;
}): string {
  const jornada = d.jornada === "TIEMPO_PARCIAL" ? "TP" : "TC";
  const cargo = (cargoSigla(d.cargo) || tokenNombreArchivo(d.cargo)).slice(0, 40);
  const persona = personaNombreArchivo(d.nombres, d.apellidoPaterno).slice(0, 50);
  const fecha = fechaNombreArchivo(d.fecha);
  return `${prefijoNumeroArchivo(d.numero)}CONT ${jornada} - ${cargo} - ${persona} - ${fecha}`;
}

export function nombreBaseAdenda(d: {
  numero?: number | null;
  tipo: string;
  nombres: string;
  apellidoPaterno: string | null;
  fecha: string;
}): string {
  const tipo = tokenNombreArchivo(d.tipo === "REMUNERACION" ? "SUELDO" : d.tipo);
  const persona = personaNombreArchivo(d.nombres, d.apellidoPaterno).slice(0, 50);
  return `${prefijoNumeroArchivo(d.numero)}ADENDA ${tipo} - ${persona} - ${fechaNombreArchivo(d.fecha)}`;
}

/** `02 ASISTENCIA - H MARLENI - MAR 2026`. */
export function nombreBaseAsistencia(d: {
  numero?: number | null;
  nombres: string;
  apellidoPaterno?: string | null;
  mes: string;
}): string {
  const partes = partesMes(d.mes);
  const abrev = partes ? MES_ABREV[partes.month - 1].toUpperCase() : "MES";
  const year = partes ? String(partes.year) : "";
  const persona = personaNombreArchivo(d.nombres, d.apellidoPaterno) || "TRABAJADOR";
  const fecha = `${abrev} ${year}`.trim();
  return `${prefijoNumeroArchivo(d.numero)}ASISTENCIA - ${persona} - ${fecha}`;
}

/** Primer nombre tal cual en ficha, seguro para archivo: `Sheyla`. */
export function primerNombreArchivo(nombres: string | null | undefined): string {
  const primero = (nombres ?? "").trim().split(/\s+/)[0] ?? "";
  return primero
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Solicitud de registro compartida: `Cargo MT - Sheyla - Maria`.
 * Prefijo fijo + primer nombre de cada trabajador.
 */
export function nombreBaseSolicitudRegistro(
  trabajadores: Array<{ nombres?: string | null }>,
): string {
  const nombres: string[] = [];
  const vistosNombre = new Set<string>();
  for (const item of trabajadores) {
    const nombre = primerNombreArchivo(item.nombres);
    const clave = nombre.toLocaleLowerCase("es");
    if (nombre && !vistosNombre.has(clave)) {
      vistosNombre.add(clave);
      nombres.push(nombre);
    }
  }
  const personas = nombres.join(" - ") || "TRABAJADOR";
  return `Cargo MT - ${personas}`;
}

/** Números de ficha, sin repetir, en el orden recibido: `02 05 08`. */
export function numerosArchivo(numeros: Array<number | null | undefined>): string {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const numero of numeros) {
    const texto = formatNumeroTrabajador(numero);
    if (!texto || vistos.has(texto)) continue;
    vistos.add(texto);
    lista.push(texto);
  }
  return lista.join(" ");
}

/** `02 05 ` al inicio del archivo. Si son muchos, se corta para que el nombre quepa. */
export function prefijoNumerosArchivo(numeros: Array<number | null | undefined>): string {
  const texto = numerosArchivo(numeros);
  if (!texto) return "";
  if (texto.length <= 80) return `${texto} `;
  const corte = texto.slice(0, 80).replace(/\s\d*$/, "");
  return corte ? `${corte} ` : "";
}
