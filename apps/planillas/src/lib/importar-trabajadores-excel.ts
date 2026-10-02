import { parseFechaFlexible } from "@inventario/types";
import type { ClasificacionTrabajador, JornadaLaboral } from "@inventario/types";
import { cargoCanonico, type CargoTrabajador } from "@/lib/cargos-funciones";
import {
  DIAS_SEMANA,
  horarioEstructuraValida,
  serializeHorario,
  type DiaSemana,
  type HorarioCompleto,
  type HorarioParcial,
  type HorarioTramo,
} from "@/lib/horario-laboral";
import { armarDireccionPersona, montoAsignacionFamiliar, parseNumeroTrabajador } from "@/lib/planillas-labels";

const SIGLA_CARGO: Record<string, CargoTrabajador> = {
  ADM: "Administrador",
  TES: "Responsable de tesorería, logística y almacén",
  SEC: "Responsable de procesos administrativos y comunicaciones del participante",
  CORD: "Coordinador de implementación programática y monitoreo",
  FEE: "Formador educativo y espiritual",
  FDE: "Formador educativo y espiritual",
};

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y"]);

const DIA_TOKEN: Record<string, DiaSemana> = {
  l: "LUNES",
  lu: "LUNES",
  lun: "LUNES",
  lunes: "LUNES",
  m: "MARTES",
  ma: "MARTES",
  mar: "MARTES",
  martes: "MARTES",
  mi: "MIERCOLES",
  mie: "MIERCOLES",
  miercoles: "MIERCOLES",
  j: "JUEVES",
  ju: "JUEVES",
  jue: "JUEVES",
  jueves: "JUEVES",
  v: "VIERNES",
  vi: "VIERNES",
  vie: "VIERNES",
  viernes: "VIERNES",
  s: "SABADO",
  sa: "SABADO",
  sab: "SABADO",
  sabado: "SABADO",
  d: "DOMINGO",
  do: "DOMINGO",
  dom: "DOMINGO",
  domingo: "DOMINGO",
};

export type DireccionImportada = {
  direccion: string | null;
  tipo_via: string | null;
  via_nombre: string | null;
  via_numero: string | null;
  distrito: string | null;
  provincia: string | null;
  region: string | null;
};

export type VidaLeyImportada = {
  estado: string | null;
  poliza: string | null;
  inicio: string | null;
  fin: string | null;
};

export type FilaLeida = {
  fila: number;
  numero: number | null;
  numeroTexto: string;
  dni: string;
  nombreCompleto: string;
  nombres: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  cargo: string | null;
  clasificacion: ClasificacionTrabajador | null;
  jornada: JornadaLaboral | null;
  fechaIngreso: string | null;
  remuneracion: number | null;
  recibeAsignacion: boolean | null;
  horario: string | null;
  nacimiento: string | null;
  celular: string | null;
  correo: string | null;
  direccion: DireccionImportada;
  vidaLey: VidaLeyImportada | null;
  errores: string[];
  avisos: string[];
  vacia: boolean;
};

type Columnas = {
  numero: number;
  cargo: number;
  centro: number;
  dni: number;
  nombre: number;
  ingreso: number;
  tiempo: number;
  rem: number;
  af: number;
  bruta: number;
  horasTexto: number;
  dias: number[];
  vida: number;
  poliza: number;
  inicio: number;
  fin: number;
  nacimiento: number;
  direccion: number;
  celular: number;
  correo: number;
};

function vacioCol(): Columnas {
  return {
    numero: -1,
    cargo: -1,
    centro: -1,
    dni: -1,
    nombre: -1,
    ingreso: -1,
    tiempo: -1,
    rem: -1,
    af: -1,
    bruta: -1,
    horasTexto: -1,
    dias: [],
    vida: -1,
    poliza: -1,
    inicio: -1,
    fin: -1,
    nacimiento: -1,
    direccion: -1,
    celular: -1,
    correo: -1,
  };
}

export function normHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[º°]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function celda(row: string[], index: number): string {
  if (index < 0) return "";
  return (row[index] ?? "").trim();
}

function indiceEncabezado(rows: string[][]): number {
  const tope = Math.min(rows.length, 25);
  for (let i = 0; i < tope; i++) {
    const headers = rows[i].map(normHeader);
    const tieneDni = headers.includes("dni");
    const tieneNombre = headers.some(
      (h) => h === "nombre completo" || h === "denominacion" || h === "nombre" || h === "item",
    );
    if (tieneDni && tieneNombre) return i;
  }
  return -1;
}

function mapearColumnas(header: string[]): Columnas | { error: string } {
  const headers = header.map(normHeader);
  const cols = vacioCol();
  const buscar = (pred: (h: string, index: number) => boolean, desde = 0) =>
    headers.findIndex((h, index) => index >= desde && pred(h, index));

  cols.dni = buscar((h) => h === "dni");
  cols.numero = buscar((h) => h === "item" || h === "numero" || h === "nro");
  if (cols.numero < 0) cols.numero = buscar((h) => h === "n");
  cols.nombre = buscar((h) => h === "nombre completo" || h === "denominacion" || h === "nombre");
  cols.centro = buscar((h) => h === "centro" || h === "clasificacion");
  cols.ingreso = buscar((h) => h === "fecha ingreso" || h === "ingreso");
  cols.tiempo = buscar((h) => h === "tiempo" || h === "jornada");
  cols.rem = buscar((h) => h === "rem" || h === "remuneracion");
  cols.af = buscar((h) => h.includes("familiar") && (h.includes("asig") || h.includes("asigan")));
  cols.bruta = buscar((h) => h.includes("bruta"));
  cols.horasTexto = buscar((h) => h === "horas de atencion" || h === "horario");
  cols.vida = buscar((h) => h === "vida ley" || h === "vidaley");
  cols.poliza = buscar((h) => h === "poliza" || h === "n poliza", cols.vida >= 0 ? cols.vida : 0);
  cols.inicio = buscar((h) => h === "inicio", Math.max(cols.poliza, cols.vida, 0));
  cols.fin = buscar((h) => h === "fin", cols.inicio >= 0 ? cols.inicio + 1 : 0);
  cols.nacimiento = buscar((h) => h === "fecha nac" || h === "fecha nacimiento" || h === "nacimiento");
  cols.direccion = buscar((h) => h === "direccion");
  cols.celular = buscar((h) => h === "celular" || h === "cel");
  cols.correo = buscar((h) => h === "correo electronico" || h === "correo" || h === "email");

  const cargos = headers
    .map((h, index) => (h === "cargo" ? index : -1))
    .filter((index) => index >= 0);
  if (cols.centro > 0 && headers[cols.centro - 1] === "") cols.cargo = cols.centro - 1;
  else if (cargos.length > 0) cols.cargo = cargos[0];

  const limiteDias = cols.horasTexto >= 0 ? cols.horasTexto : headers.length;
  for (let i = 0; i < limiteDias; i++) {
    if (["l", "m", "mi", "j", "v", "s", "d"].includes(headers[i])) cols.dias.push(i);
  }
  if (cols.dias.length > 0 && headers[cols.dias[0]] !== "l") {
    const previo = cols.dias[0] - 1;
    if (previo >= 0 && headers[previo] === "") cols.dias.unshift(previo);
  }

  if (cols.dni < 0) return { error: "No encuentro la columna DNI." };
  if (cols.nombre < 0) return { error: "No encuentro la columna Nombre completo." };
  if (cols.numero < 0) return { error: "No encuentro la columna Ítem." };
  return cols;
}

function parseMonto(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") return null;
  let text = trimmed.replace(/\s/g, "");
  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(".") > text.lastIndexOf(",")) text = text.replace(/,/g, "");
    else text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",")) {
    const parts = text.split(",");
    if (parts.length === 2 && parts[1].length <= 2) text = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    else text = text.replace(/,/g, "");
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function parseFechaImport(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4,5}(\.0+)?$/.test(trimmed)) {
    const serial = Math.floor(Number(trimmed));
    const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    const year = utc.getUTCFullYear();
    const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
    const day = String(utc.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) return parseFechaFlexible(trimmed);
  let year = match[3];
  if (year.length === 2) year = Number(year) >= 50 ? `19${year}` : `20${year}`;
  const directa = parseFechaFlexible(`${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${year}`);
  if (directa) return directa;
  return parseFechaFlexible(`${match[2].padStart(2, "0")}/${match[1].padStart(2, "0")}/${year}`);
}

function dniDe(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d+\.0$/.test(trimmed)) return trimmed.slice(0, -2);
  return trimmed.replace(/\D/g, "");
}

function cargoDe(raw: string): { value: string | null; error?: string } {
  const text = raw.trim();
  if (!text) return { value: null, error: "Falta el cargo." };
  const sigla = SIGLA_CARGO[text.toUpperCase()];
  if (sigla) return { value: sigla };
  const canon = cargoCanonico(text);
  if (canon) return { value: canon };
  return { value: null, error: `No reconozco el cargo "${text}". Use ADM, TES, SEC, FEE o CORD.` };
}

function clasificacionDe(raw: string): { value: ClasificacionTrabajador | null; aviso?: string } {
  const text = normHeader(raw);
  if (!text) return { value: null };
  if (text.startsWith("patrocin")) return { value: "PATROCINADO" };
  if (text.startsWith("superviv")) return { value: "SUPERVIVENCIA" };
  return { value: null, aviso: `No reconozco la clasificación "${raw.trim()}".` };
}

function jornadaDe(raw: string): { value: JornadaLaboral | null; aviso?: string } {
  const text = normHeader(raw);
  if (!text) return { value: null };
  if (text.startsWith("complet")) return { value: "TIEMPO_COMPLETO" };
  if (text.startsWith("parcial")) return { value: "TIEMPO_PARCIAL" };
  return { value: null, aviso: `No reconozco el tiempo "${raw.trim()}".` };
}

function estadoVidaLey(raw: string): string | null {
  const text = normHeader(raw);
  if (!text) return null;
  if (text === "registrado") return "Registrado";
  if (text === "recepcionado") return "Recepcionado";
  if (text === "elaborado") return "Elaborado";
  if (text === "no ubicado") return "No ubicado";
  return raw.trim();
}

export function partirNombreCompleto(completo: string): {
  nombres: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
} {
  const palabras = completo.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const grupos: string[] = [];
  let buffer: string[] = [];
  for (const palabra of palabras) {
    if (PARTICULAS.has(palabra.toLowerCase())) {
      buffer.push(palabra);
      continue;
    }
    buffer.push(palabra);
    grupos.push(buffer.join(" "));
    buffer = [];
  }
  if (buffer.length > 0) grupos.push(buffer.join(" "));
  if (grupos.length === 0) return { nombres: "", apellidoPaterno: null, apellidoMaterno: null };
  if (grupos.length === 1) return { nombres: grupos[0], apellidoPaterno: null, apellidoMaterno: null };
  if (grupos.length === 2) return { nombres: grupos[0], apellidoPaterno: grupos[1], apellidoMaterno: null };
  return {
    nombres: grupos.slice(0, -2).join(" "),
    apellidoPaterno: grupos[grupos.length - 2],
    apellidoMaterno: grupos[grupos.length - 1],
  };
}

function tipoViaDe(via: string): { tipo: string | null; resto: string } {
  const spaced = via.replace(/^(av|jr|psje|psj|pj|urb|mz)\.(?=\S)/i, "$& ");
  const match = spaced.match(/^(av\.?|avenida|jr\.?|jiron|calle|psje\.?|psj\.?|pj\.?|pasaje|urb\.?|urbanizacion|mz\.?|manzana|carretera)\b\.?\s*/i);
  if (!match) return { tipo: null, resto: spaced.trim() };
  const token = normHeader(match[1]);
  const tipo = token.startsWith("av")
    ? "Av."
    : token.startsWith("jr") || token.startsWith("jiron")
      ? "Jr."
      : token.startsWith("calle")
        ? "Calle"
        : token.startsWith("urb")
          ? "Urb."
          : token.startsWith("mz") || token.startsWith("manzana")
            ? "Mz."
            : token.startsWith("carretera")
              ? "Carretera"
              : "Psje.";
  return { tipo, resto: spaced.slice(match[0].length).trim() };
}

export function partirDireccion(raw: string): DireccionImportada {
  const original = raw.trim().replace(/\s+/g, " ").replace(/[,;]+$/g, "");
  const vacia: DireccionImportada = {
    direccion: original || null,
    tipo_via: null,
    via_nombre: null,
    via_numero: null,
    distrito: null,
    provincia: null,
    region: null,
  };
  if (!original) return { ...vacia, direccion: null };

  let viaTexto = original;
  let distrito: string | null = null;
  let provincia: string | null = null;
  let region: string | null = null;
  const spaced = original.split(/\s+[–—-]\s+/).map((parte) => parte.trim()).filter(Boolean);
  if (spaced.length >= 4) {
    region = spaced[spaced.length - 1];
    provincia = spaced[spaced.length - 2];
    distrito = spaced[spaced.length - 3];
    viaTexto = spaced.slice(0, -3).join(" - ");
  } else {
    const compacto = original.match(/^(.*?)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+)-([A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+)-([A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+)\s*$/);
    if (compacto?.[1]) {
      viaTexto = compacto[1].trim();
      region = compacto[2];
      provincia = compacto[3];
      distrito = compacto[4];
    }
  }

  const { tipo, resto } = tipoViaDe(viaTexto);
  const numeroMatch = resto.match(/^(.*?)(?:\s+)(\d+|s\/n)$/i);
  const viaNombre = (numeroMatch ? numeroMatch[1] : resto).trim() || null;
  const viaNumero = numeroMatch ? numeroMatch[2].toUpperCase() : null;
  if (!tipo || (!viaNombre && !viaNumero)) return vacia;

  const partes: DireccionImportada = {
    direccion: null,
    tipo_via: tipo,
    via_nombre: viaNombre,
    via_numero: viaNumero,
    distrito,
    provincia,
    region,
  };
  partes.direccion = armarDireccionPersona(partes) ?? original;
  return partes;
}

function tokenDia(raw: string): DiaSemana | null {
  return DIA_TOKEN[normHeader(raw)] ?? null;
}

function parseListaDias(texto: string): DiaSemana[] | null {
  const dias: DiaSemana[] = [];
  for (const parte of texto.split(",")) {
    const token = parte.trim();
    if (!token) continue;
    const rango = token.split(/\s*[–—-]\s*/).filter(Boolean);
    if (rango.length === 2) {
      const inicio = tokenDia(rango[0]);
      const fin = tokenDia(rango[1]);
      if (!inicio || !fin) return null;
      const desde = DIAS_SEMANA.indexOf(inicio);
      const hasta = DIAS_SEMANA.indexOf(fin);
      if (desde < 0 || hasta < desde) return null;
      for (let i = desde; i <= hasta; i++) dias.push(DIAS_SEMANA[i]);
      continue;
    }
    const dia = tokenDia(token);
    if (!dia) return null;
    dias.push(dia);
  }
  return dias.length > 0 ? dias : null;
}

function parseHora(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function parseTramos(texto: string): HorarioTramo[] | null {
  const tramos: HorarioTramo[] = [];
  for (const parte of texto.split("/")) {
    const token = parte.trim();
    if (!token) continue;
    const lados = token.split(/\s*[–—-]\s*/).filter(Boolean);
    if (lados.length !== 2) return null;
    const desde = parseHora(lados[0]);
    const hasta = parseHora(lados[1]);
    if (!desde || !hasta) return null;
    tramos.push({ desde, hasta });
  }
  return tramos.length > 0 ? tramos : null;
}

export function parseHorarioAtencion(texto: string): HorarioParcial | null {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  const bloques: HorarioParcial["bloques"] = [];
  for (const trozo of limpio.split("]")) {
    const abierto = trozo.trim().replace(/^,\s*/, "");
    if (!abierto) continue;
    const corte = abierto.lastIndexOf("[");
    if (corte < 0) return null;
    const dias = parseListaDias(abierto.slice(0, corte));
    const tramos = parseTramos(abierto.slice(corte + 1));
    if (!dias || !tramos) return null;
    bloques.push({ dias, tramos });
  }
  if (bloques.length === 0) return null;
  return { tipo: "PARCIAL", bloques };
}

function horarioCompletoDe(parcial: HorarioParcial): HorarioCompleto | null {
  if (parcial.bloques.length !== 1) return null;
  const bloque = parcial.bloques[0];
  if (bloque.tramos.length !== 2 || bloque.dias.length === 0) return null;
  const indices = bloque.dias.map((dia) => DIAS_SEMANA.indexOf(dia));
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) return null;
  }
  return {
    tipo: "COMPLETO",
    diaInicio: bloque.dias[0],
    diaFin: bloque.dias[bloque.dias.length - 1],
    desde: bloque.tramos[0].desde,
    hasta: bloque.tramos[1].hasta,
    refrigerioDesde: bloque.tramos[0].hasta,
    refrigerioHasta: bloque.tramos[1].desde,
  };
}

function horarioDe(
  texto: string,
  horasDias: Array<number | "libre" | null>,
  jornada: JornadaLaboral | null,
): { horario: string | null; avisos: string[] } {
  const avisos: string[] = [];
  const limpio = texto.trim();
  if (!limpio) {
    if (horasDias.some((hora) => typeof hora === "number")) {
      avisos.push("Hay horas por día, pero falta HORAS DE ATENCION.");
    }
    return { horario: null, avisos };
  }
  const parcial = parseHorarioAtencion(limpio);
  if (!parcial || !horarioEstructuraValida(parcial)) {
    avisos.push("El horario quedó como texto porque no se pudo armar por días.");
    return { horario: limpio, avisos };
  }

  if (horasDias.length === DIAS_SEMANA.length) {
    const cubiertos = new Set(parcial.bloques.flatMap((bloque) => bloque.dias));
    for (let i = 0; i < DIAS_SEMANA.length; i++) {
      const marca = horasDias[i];
      const dia = DIAS_SEMANA[i];
      if (marca == null) continue;
      if (marca === "libre" && cubiertos.has(dia)) {
        avisos.push("Un día marcado con X aparece en el horario.");
        break;
      }
      if (typeof marca === "number" && !cubiertos.has(dia)) {
        avisos.push("Un día con horas no aparece en HORAS DE ATENCION.");
        break;
      }
    }
  }

  if (jornada === "TIEMPO_COMPLETO") {
    const completo = horarioCompletoDe(parcial);
    if (completo && horarioEstructuraValida(completo)) return { horario: serializeHorario(completo), avisos };
    avisos.push("Tiempo completo no tiene un solo rango; el horario se guardó por días.");
  }
  return { horario: serializeHorario(parcial), avisos };
}

function horasDia(raw: string): number | "libre" | null {
  const text = raw.trim();
  if (!text || text === "-" || text === "—" || /^x$/i.test(text)) return "libre";
  const monto = parseMonto(text);
  if (monto == null) return null;
  if (monto === 0) return "libre";
  return monto;
}

function filaVacia(row: string[], cols: Columnas): boolean {
  const claves: Array<keyof Columnas> = ["numero", "cargo", "dni", "nombre", "ingreso", "rem"];
  return claves.every((clave) => {
    const index = cols[clave];
    return typeof index === "number" && celda(row, index) === "";
  });
}

function leerFila(row: string[], cols: Columnas, fila: number): FilaLeida {
  const errores: string[] = [];
  const avisos: string[] = [];
  const nombreCompleto = celda(row, cols.nombre).replace(/\s+/g, " ").trim();
  const dniCrudo = celda(row, cols.dni);
  const dni = dniDe(dniCrudo);
  const nombre = partirNombreCompleto(nombreCompleto);
  const numeroRaw = celda(row, cols.numero).replace(/\.0$/, "");
  const numero = parseNumeroTrabajador(numeroRaw);
  const cargo = cargoDe(celda(row, cols.cargo));
  const clasificacion = clasificacionDe(celda(row, cols.centro));
  const jornada = jornadaDe(celda(row, cols.tiempo));
  const ingresoRaw = celda(row, cols.ingreso);
  const fechaIngreso = ingresoRaw ? parseFechaImport(ingresoRaw) : null;
  const nacimientoRaw = celda(row, cols.nacimiento);
  const nacimiento = nacimientoRaw ? parseFechaImport(nacimientoRaw) : null;
  const remuneracion = parseMonto(celda(row, cols.rem));
  const asignacionRaw = celda(row, cols.af);
  const asignacion = asignacionRaw ? parseMonto(asignacionRaw) : null;
  const bruta = parseMonto(celda(row, cols.bruta));
  const correoRaw = celda(row, cols.correo);
  const celularRaw = celda(row, cols.celular);
  const horasDias = cols.dias.map((index) => horasDia(celda(row, index)));
  const horario = horarioDe(celda(row, cols.horasTexto), horasDias, jornada.value);
  const vidaEstado = estadoVidaLey(celda(row, cols.vida));
  const poliza = celda(row, cols.poliza) || null;
  const inicioRaw = celda(row, cols.inicio);
  const finRaw = celda(row, cols.fin);
  const inicio = inicioRaw ? parseFechaImport(inicioRaw) : null;
  const fin = finRaw ? parseFechaImport(finRaw) : null;

  if (/^pe\s*\d/i.test(celda(row, cols.cargo)) || normHeader(dniCrudo) === "dni") {
    return filaOmitida(fila, true);
  }
  if (!nombreCompleto && dni.length !== 8 && dni.length !== 9) return filaOmitida(fila, true);

  if (!nombreCompleto) errores.push("Falta el nombre completo.");
  if (dni.length !== 8 && dni.length !== 9) {
    errores.push("Indique el DNI (8 dígitos) o el carné de extranjería (9 dígitos).");
  }
  if (numero.error || numero.value == null) errores.push(numero.error ?? "Falta el número.");
  if (cargo.error || !cargo.value) errores.push(cargo.error ?? "Falta el cargo.");
  if (clasificacion.aviso) avisos.push(clasificacion.aviso);
  if (jornada.aviso) avisos.push(jornada.aviso);
  if (ingresoRaw && !fechaIngreso) errores.push("La fecha de ingreso no es válida.");
  if (nacimientoRaw && !nacimiento) avisos.push("La fecha de nacimiento no es válida y no se guardará.");
  if (correoRaw && !correoRaw.includes("@")) avisos.push("El correo no tiene un formato válido y no se guardará.");
  if (asignacion != null && asignacion > 0 && asignacion !== montoAsignacionFamiliar(true)) {
    avisos.push("La asignación familiar de la ficha es S/ 113.");
  }
  if (remuneracion != null && bruta != null) {
    const suma = remuneracion + (asignacion != null && asignacion > 0 ? asignacion : 0);
    if (Math.abs(suma - bruta) > 0.05) avisos.push("La remuneración bruta no cuadra con la suma.");
  }
  if (inicioRaw && !inicio) avisos.push("La fecha de inicio de Vida Ley no es válida.");
  if (finRaw && !fin) avisos.push("La fecha de fin de Vida Ley no es válida.");
  avisos.push(...horario.avisos);

  const vidaLey =
    vidaEstado || poliza || inicio || fin
      ? { estado: vidaEstado, poliza, inicio, fin }
      : null;

  return {
    fila,
    numero: numero.value,
    numeroTexto: numero.value != null ? String(numero.value).padStart(2, "0") : numeroRaw,
    dni,
    nombreCompleto,
    nombres: nombre.nombres,
    apellidoPaterno: nombre.apellidoPaterno,
    apellidoMaterno: nombre.apellidoMaterno,
    cargo: cargo.value,
    clasificacion: clasificacion.value,
    jornada: jornada.value,
    fechaIngreso,
    remuneracion: remuneracion != null && remuneracion > 0 ? remuneracion : null,
    recibeAsignacion: asignacion == null ? null : asignacion > 0,
    horario: horario.horario,
    nacimiento,
    celular: celularRaw || null,
    correo: correoRaw.includes("@") ? correoRaw : null,
    direccion: partirDireccion(celda(row, cols.direccion)),
    vidaLey,
    errores,
    avisos,
    vacia: false,
  };
}

function filaOmitida(fila: number, vacia: boolean): FilaLeida {
  return {
    fila,
    numero: null,
    numeroTexto: "",
    dni: "",
    nombreCompleto: "",
    nombres: "",
    apellidoPaterno: null,
    apellidoMaterno: null,
    cargo: null,
    clasificacion: null,
    jornada: null,
    fechaIngreso: null,
    remuneracion: null,
    recibeAsignacion: null,
    horario: null,
    nacimiento: null,
    celular: null,
    correo: null,
    direccion: {
      direccion: null,
      tipo_via: null,
      via_nombre: null,
      via_numero: null,
      distrito: null,
      provincia: null,
      region: null,
    },
    vidaLey: null,
    errores: [],
    avisos: [],
    vacia,
  };
}

export function leerTrabajadoresExcel(rows: string[][]): { error?: string; filas: FilaLeida[] } {
  const headerIndex = indiceEncabezado(rows);
  if (headerIndex < 0) return { error: "No encuentro la fila de títulos (DNI, Ítem, Nombre completo).", filas: [] };
  const columnas = mapearColumnas(rows[headerIndex] ?? []);
  if ("error" in columnas) return { error: columnas.error, filas: [] };
  const filas: FilaLeida[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (filaVacia(row, columnas)) continue;
    const leida = leerFila(row, columnas, i + 1);
    if (!leida.vacia) filas.push(leida);
  }
  return { filas };
}
