import {
  CODIGO_BARRAS_CATALOGO_DIGITS,
  decodeCatalogoPropioDesdeSimbolo,
} from "./codigo-barras";

type CategoriaBien = "ACTIVO" | "CUENTA_ORDEN";
type EstadoBien = "BUENO" | "REGULAR" | "MALO";
type EstadoRegistroImport = "PREREGISTRADO" | "REGISTRADO";

const IMPORT_CUENTA_CODIGO_RE = /^\d{1,6}$/;
const CATALOGO_PROPIO_IMPORT_RE = /^BD(\d{1,6})$/i;

function parseFechaDDMMYYYY(text: string): string | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function validarFechaDDMMYYYY(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!parseFechaDDMMYYYY(trimmed)) {
    return "Fecha de adquisición inválida (use DD/MM/AAAA).";
  }
  return null;
}

function parsePorcentajeDepreciacion(text: string): number | null {
  const normalized = text.replace(/\u00a0/g, " ").trim();
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Normaliza % Deprec. desde Excel (0.2 → "20 %") o texto ("10", "10 %").
 *  0 / 0 % → vacío (opcional). Número sin % → se le agrega " %".
 */
export function normalizeImportDepreciacionRaw(raw: string): string {
  const trimmed = raw.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return "";

  const hasPct = trimmed.includes("%");
  const numMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*%?$/);
  if (!numMatch) return trimmed;

  let value = Number(numMatch[1]!.replace(",", "."));
  if (!Number.isFinite(value)) return trimmed;
  // 0 (o 0 %) = sin depreciación → no guardar nada
  if (value <= 0) return "";

  // Excel almacena 20 % como 0.2 cuando la celda tiene formato Porcentaje.
  if (!hasPct && value > 0 && value <= 1) {
    value = value * 100;
  }

  const rounded = Math.round(value * 100) / 100;
  const texto = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
  // Si venía sin %, se agrega
  return `${texto} %`;
}

function vidaUtilMesesFromPorcentaje(porcentajeAnual: number): number {
  if (porcentajeAnual <= 0) return 0;
  return Math.round(1200 / porcentajeAnual);
}

function normalizeImportCuentaCodigo(value: string): string | null {
  const digits = value.trim().replace(/\D/g, "");
  return IMPORT_CUENTA_CODIGO_RE.test(digits) ? digits : null;
}

function normalizeImportNombreCuenta(cuentaCodigo: string, nombre: string): string | null {
  let texto = nombre.trim().replace(/\s+/g, " ");
  if (!texto) return null;
  if (texto === cuentaCodigo || texto.startsWith(`${cuentaCodigo} `)) {
    texto = texto.slice(cuentaCodigo.length).trim();
  }
  return texto.length >= 2 ? texto : null;
}

export const MAX_IMPORT_ACTIVOS_FILAS = 1000;

export const IMPORT_ACTIVOS_COLUMN_ERROR = "Error" as const;

export const IMPORT_ACTIVOS_HEADERS = [
  "Categoría",
  "Código catálogo",
  "Marca",
  "Modelo",
  "Serie",
  "Color",
  "Medidas",
  "Detalle",
  "Estado",
  "Fecha de adquisición",
  "Precio de adquisición (S/)",
  "Valor de mercado (S/)",
  "% Deprec.",
  "Observaciones",
  "Código cuenta contable",
  "Nombre cuenta contable",
  "Sucursal",
  "Ambiente",
  "Comprobante de adquisición",
] as const;

export type ImportActivoHeader = (typeof IMPORT_ACTIVOS_HEADERS)[number];

export type ImportActivoFila = Record<ImportActivoHeader, string>;

export type ImportActivoErrorFila = ImportActivoFila & {
  [IMPORT_ACTIVOS_COLUMN_ERROR]: string;
};

export interface ImportUbicacionRef {
  sedeId: string;
  sedeNombre: string;
  ambienteId: string;
  ambienteNombre: string;
  responsable?: string | null;
  esPreregistro?: boolean;
}

export interface ImportActivoCatalogoItem {
  denominacion: string;
  cuenta_codigo: string | null;
  contabilidad: string | null;
  depreciacion: string | null;
}

export interface ImportActivoCatalogoContabilidadUpdate {
  codigo_catalogo: string;
  cuenta_codigo: string;
  contabilidad: string;
  depreciacion: string | null;
}

export interface ImportActivoInsertPayload {
  entidad_id: string;
  codigo_catalogo: string;
  nombre: string;
  categoria: CategoriaBien;
  estado_bien: EstadoBien | null;
  caracteristicas: string | null;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  color: string | null;
  medidas: string | null;
  fecha_adquisicion: string | null;
  /** Derivado del mes siguiente a la adquisición al importar. */
  fecha_inicio_depreciacion: string | null;
  valor_adquisicion: number | null;
  valor_es_mercado: boolean;
  depreciacion: string | null;
  vida_util_meses: number | null;
  observacion: string | null;
  estado_registro: EstadoRegistroImport;
  sede_id: string | null;
  ambiente_id: string | null;
  posible_ambiente_id: string | null;
  cuenta_contable_codigo: string | null;
  cuenta_contable_nombre: string | null;
  comprobante_serie: string | null;
  /** @deprecated Ya no actualiza catálogo; conservado por compatibilidad interna. */
  catalogo_contabilidad?: ImportActivoCatalogoContabilidadUpdate | null;
}

export interface ImportActivoErrorItem {
  fila: number;
  datos: ImportActivoFila;
  motivo: string;
}

export interface ImportActivosResult {
  totalFilas: number;
  importados: number;
  errores: ImportActivoErrorItem[];
}

const HEADER_ALIASES: Record<string, ImportActivoHeader> = {
  sucursal: "Sucursal",
  sede: "Sucursal",
  ambiente: "Ambiente",
  "codigo catalogo": "Código catálogo",
  "código catálogo": "Código catálogo",
  "codigo catálogo": "Código catálogo",
  catalogo: "Código catálogo",
  cat: "Código catálogo",
  categoria: "Categoría",
  categoría: "Categoría",
  estado: "Estado",
  "estado bien": "Estado",
  marca: "Marca",
  modelo: "Modelo",
  serie: "Serie",
  color: "Color",
  medidas: "Medidas",
  detalle: "Detalle",
  descripcion: "Detalle",
  descripción: "Detalle",
  "fecha adq": "Fecha de adquisición",
  "fecha adq.": "Fecha de adquisición",
  "fecha de adquisicion": "Fecha de adquisición",
  "fecha de adquisición": "Fecha de adquisición",
  "precio adq": "Precio de adquisición (S/)",
  "precio adq.": "Precio de adquisición (S/)",
  "precio de adquisicion": "Precio de adquisición (S/)",
  "precio de adquisición": "Precio de adquisición (S/)",
  "valor mercado": "Valor de mercado (S/)",
  "valor de mercado": "Valor de mercado (S/)",
  "valor mercado (s/)": "Valor de mercado (S/)",
  "% deprec": "% Deprec.",
  "% deprec.": "% Deprec.",
  depreciacion: "% Deprec.",
  depreciación: "% Deprec.",
  observacion: "Observaciones",
  observación: "Observaciones",
  observaciones: "Observaciones",
  "codigo cuenta contable": "Código cuenta contable",
  "código cuenta contable": "Código cuenta contable",
  "cuenta contable": "Código cuenta contable",
  "codigo cuenta": "Código cuenta contable",
  "nombre cuenta contable": "Nombre cuenta contable",
  "nombre de cuenta contable": "Nombre cuenta contable",
  contabilidad: "Nombre cuenta contable",
  "comprobante de adquisicion": "Comprobante de adquisición",
  "comprobante de adquisición": "Comprobante de adquisición",
  comprobante: "Comprobante de adquisición",
  "serie de comprobante": "Comprobante de adquisición",
  "serie del comprobante": "Comprobante de adquisición",
};

const PREREGISTRO_AMBIENTE_ALIASES = new Set([
  "preregistro",
  "preregistros",
  "pre registro",
  "pre-registro",
  "preregistrado",
  "preregistrados",
  "preregistrar",
]);

/** Alias o nombre del ambiente sistema de preregistros (ej. «preregistros», «Adquisicion 2026»). */
export function isImportPreregistroAmbienteAlias(text: string): boolean {
  const key = normalizeImportKey(text);
  if (!key) return false;
  if (PREREGISTRO_AMBIENTE_ALIASES.has(key)) return true;
  if (/^adquisicion \d{4}$/.test(key)) return true;
  return key === normalizeImportKey(`Adquisicion ${new Date().getFullYear()}`);
}

/** Misma regla que el formulario: mayúsculas; letras, números, guión, barra y espacios. */
function parseImportComprobanteSerie(
  raw: string,
): { ok: true; value: string | null } | { ok: false; motivo: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const normalized = trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9/ -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return { ok: false, motivo: "Comprobante de adquisición inválido." };
  }
  return { ok: true, value: normalized };
}

function resolveImportEstadoRegistroFromAmbiente(
  matchFisico: { sede_id: string; ambiente_id: string } | null,
  matchTodos: { sede_id: string; ambiente_id: string } | null,
  ambienteEsAliasPreregistro: boolean,
): EstadoRegistroImport {
  if (ambienteEsAliasPreregistro || (matchTodos && !matchFisico)) {
    return "PREREGISTRADO";
  }
  return "REGISTRADO";
}

export function normalizeImportKey(text: string): string {
  return text
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function emptyImportActivoFila(): ImportActivoFila {
  return Object.fromEntries(IMPORT_ACTIVOS_HEADERS.map((h) => [h, ""])) as ImportActivoFila;
}

export function mapImportHeaders(headers: string[]): Map<number, ImportActivoHeader> {
  const map = new Map<number, ImportActivoHeader>();
  headers.forEach((raw, index) => {
    const key = normalizeImportKey(raw);
    if (!key || key === normalizeImportKey(IMPORT_ACTIVOS_COLUMN_ERROR)) return;
    const canonical = HEADER_ALIASES[key] ?? (IMPORT_ACTIVOS_HEADERS as readonly string[]).find(
      (h) => normalizeImportKey(h) === key,
    );
    if (canonical) map.set(index, canonical as ImportActivoHeader);
  });
  return map;
}

export function buildUbicacionLookup(
  refs: ImportUbicacionRef[],
): Map<string, { sede_id: string; ambiente_id: string }> {
  const map = new Map<string, { sede_id: string; ambiente_id: string }>();
  for (const ref of refs) {
    const key = `${normalizeImportKey(ref.sedeNombre)}|${normalizeImportKey(ref.ambienteNombre)}`;
    map.set(key, { sede_id: ref.sedeId, ambiente_id: ref.ambienteId });
  }
  return map;
}

export function buildCuentaContableLookup(
  rows: Array<{ cuenta_codigo: string | null; contabilidad: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const codigo = row.cuenta_codigo?.trim();
    if (!codigo || !IMPORT_CUENTA_CODIGO_RE.test(codigo)) continue;
    const nombre = normalizeImportNombreCuenta(codigo, row.contabilidad ?? "");
    if (!nombre) continue;
    const existing = map.get(codigo);
    if (!existing) {
      map.set(codigo, nombre);
      continue;
    }
    if (normalizeImportKey(existing) !== normalizeImportKey(nombre)) {
      map.set(codigo, existing);
    }
  }
  return map;
}

function parseCategoria(text: string): CategoriaBien | null {
  const key = normalizeImportKey(text)
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!key) return null;
  if (key === "activo" || key === "act") return "ACTIVO";
  if (
    key === "cuenta de orden" ||
    key === "cuenta orden" ||
    key === "cuenta_orden" ||
    key === "orden" ||
    key === "cta orden"
  ) {
    return "CUENTA_ORDEN";
  }
  return null;
}

/** Vacío → null; bueno/Bueno/etc. case-insensitive. */
function parseEstadoBien(text: string): EstadoBien | null | undefined {
  const key = normalizeImportKey(text);
  if (!key) return null;
  if (key === "bueno") return "BUENO";
  if (key === "regular") return "REGULAR";
  if (key === "malo") return "MALO";
  return undefined;
}

function parsePrecio(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s/g, "").replace(/,/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Código catálogo nacional: dígitos; permite más de 8; rellena si tiene menos. */
export function normalizeImportCodigoCatalogoNacional(text: string): string {
  const digits = text.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < CODIGO_BARRAS_CATALOGO_DIGITS) {
    return digits.padStart(CODIGO_BARRAS_CATALOGO_DIGITS, "0");
  }
  return digits;
}

/**
 * Código catálogo propio: BD000001, dígitos (1→BD000001) o símbolo 24000001.
 */
export function normalizeImportCodigoCatalogoPropio(text: string): string | null {
  const trimmed = text.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return null;

  const bdMatch = trimmed.match(CATALOGO_PROPIO_IMPORT_RE);
  if (bdMatch) {
    return `BD${bdMatch[1]!.padStart(6, "0")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  const fromSymbol = decodeCatalogoPropioDesdeSimbolo(digits);
  if (fromSymbol) return fromSymbol;

  if (digits.length <= 6) {
    return `BD${digits.padStart(6, "0")}`;
  }

  return null;
}

/**
 * Normaliza código de catálogo según categoría (para precargar lookups).
 * Cuenta de orden acepta propio (BD…) y nacional.
 * Sin categoría válida intenta nacional y propio.
 */
export function normalizeImportCodigoCatalogoRaw(
  text: string,
  categoria?: CategoriaBien | null,
): string[] {
  const candidates: string[] = [];
  const pushUnique = (code: string | null | undefined) => {
    if (code && !candidates.includes(code)) candidates.push(code);
  };

  if (categoria === "ACTIVO") {
    pushUnique(normalizeImportCodigoCatalogoNacional(text));
    return candidates;
  }

  if (categoria === "CUENTA_ORDEN") {
    const trimmed = text.replace(/\u00a0/g, " ").trim();
    if (!trimmed) return candidates;

    const bdMatch = trimmed.match(CATALOGO_PROPIO_IMPORT_RE);
    const digits = trimmed.replace(/\D/g, "");
    const fromSymbol = digits ? decodeCatalogoPropioDesdeSimbolo(digits) : null;

    if (bdMatch || fromSymbol) {
      pushUnique(normalizeImportCodigoCatalogoPropio(text));
      return candidates;
    }

    if (digits.length > 6) {
      pushUnique(normalizeImportCodigoCatalogoNacional(text));
      return candidates;
    }

    // Códigos cortos: conservar compatibilidad con propio y permitir nacional.
    pushUnique(normalizeImportCodigoCatalogoPropio(text));
    pushUnique(normalizeImportCodigoCatalogoNacional(text));
    return candidates;
  }

  pushUnique(normalizeImportCodigoCatalogoNacional(text));
  pushUnique(normalizeImportCodigoCatalogoPropio(text));
  return candidates;
}

/**
 * Resuelve cuenta contable del Excel contra `cuentas_contables`.
 * - Vacío o solo nombre → SKIP (usar catálogo del ítem)
 * - Solo código → debe existir
 * - Código + nombre inexistente → create
 * - Código existente → nombre de BD gana
 */
function resolveImportCuentaContable(
  codigoRaw: string,
  nombreRaw: string,
  cuentaLookup: Map<string, string>,
):
  | {
      ok: true;
      mode: "override";
      cuenta_codigo: string;
      contabilidad: string;
      lookup: Map<string, string>;
      create?: { codigo: string; nombre: string };
    }
  | { ok: false; motivo: "SKIP" }
  | { ok: false; motivo: string } {
  const codigoInput = codigoRaw.trim();
  const nombreInput = nombreRaw.trim();

  if (!codigoInput) {
    // Solo nombre o ambos vacíos → heredar del catálogo
    return { ok: false, motivo: "SKIP" };
  }

  const codigo = normalizeImportCuentaCodigo(codigoInput);
  if (!codigo) {
    return { ok: false, motivo: "Código cuenta contable inválido (1 a 6 dígitos)." };
  }

  const nombreExplicito = nombreInput ? normalizeImportNombreCuenta(codigo, nombreInput) : null;
  if (nombreInput && !nombreExplicito) {
    return { ok: false, motivo: "Nombre cuenta contable inválido." };
  }

  const nombreBd = cuentaLookup.get(codigo) ?? null;

  if (!nombreExplicito) {
    if (!nombreBd) {
      return {
        ok: false,
        motivo: `Cuenta contable "${codigo}" no registrada. Indique también el nombre para crearla.`,
      };
    }
    return {
      ok: true,
      mode: "override",
      cuenta_codigo: codigo,
      contabilidad: nombreBd,
      lookup: cuentaLookup,
    };
  }

  if (nombreBd) {
    return {
      ok: true,
      mode: "override",
      cuenta_codigo: codigo,
      contabilidad: nombreBd,
      lookup: cuentaLookup,
    };
  }

  const nextLookup = new Map(cuentaLookup);
  nextLookup.set(codigo, nombreExplicito);
  return {
    ok: true,
    mode: "override",
    cuenta_codigo: codigo,
    contabilidad: nombreExplicito,
    lookup: nextLookup,
    create: { codigo, nombre: nombreExplicito },
  };
}

export function validateImportActivoFila(
  fila: ImportActivoFila,
  entidadId: string,
  ubicacionRefs: ImportUbicacionRef[],
  catalogoByCodigo: Map<string, ImportActivoCatalogoItem>,
  cuentaLookup: Map<string, string>,
):
  | {
      ok: true;
      payload: ImportActivoInsertPayload;
      cuentaLookup: Map<string, string>;
      cuentaToCreate?: { codigo: string; nombre: string };
    }
  | { ok: false; motivo: string } {
  const categoria = parseCategoria(fila.Categoría);
  if (!categoria) {
    return {
      ok: false,
      motivo: 'Categoría es obligatoria. Use "Activo", "Act.", "Cuenta de orden" o "Cta. Orden".',
    };
  }

  const codigoCandidates = normalizeImportCodigoCatalogoRaw(
    fila["Código catálogo"],
    categoria,
  );
  if (codigoCandidates.length === 0) {
    return {
      ok: false,
      motivo:
        categoria === "CUENTA_ORDEN"
          ? 'Código catálogo inválido para cuenta de orden (ej. BD000001 o código nacional).'
          : "Código catálogo inválido.",
    };
  }

  let codigoCatalogo: string | null = null;
  let catalogoItem: ImportActivoCatalogoItem | undefined;
  for (const code of codigoCandidates) {
    const item = catalogoByCodigo.get(code);
    if (item) {
      codigoCatalogo = code;
      catalogoItem = item;
      break;
    }
  }
  if (!catalogoItem || !codigoCatalogo) {
    const shown = codigoCandidates[0]!;
    if (categoria === "CUENTA_ORDEN") {
      return {
        ok: false,
        motivo: `Código catálogo "${shown}" no existe en el catálogo nacional ni propio.`,
      };
    }
    return {
      ok: false,
      motivo: `Código catálogo "${shown}" no existe en el catálogo nacional.`,
    };
  }

  const estadoParsed = parseEstadoBien(fila.Estado);
  if (estadoParsed === undefined) {
    return { ok: false, motivo: 'Estado inválido. Use "Bueno", "Regular" o "Malo".' };
  }
  const estadoBien: EstadoBien | null = estadoParsed;

  const precioRaw = fila["Precio de adquisición (S/)"].trim();
  const mercadoRaw = fila["Valor de mercado (S/)"].trim();
  const tienePrecio = Boolean(precioRaw);
  const tieneMercado = Boolean(mercadoRaw);

  if (tienePrecio && tieneMercado) {
    return {
      ok: false,
      motivo: "Indique solo precio de adquisición o valor de mercado, no ambos.",
    };
  }

  let valorAdquisicion: number | null = null;
  let valorEsMercado = false;

  if (tienePrecio) {
    valorAdquisicion = parsePrecio(precioRaw);
    if (valorAdquisicion == null) {
      return { ok: false, motivo: "Precio de adquisición inválido." };
    }
  } else if (tieneMercado) {
    valorAdquisicion = parsePrecio(mercadoRaw);
    if (valorAdquisicion == null) {
      return { ok: false, motivo: "Valor de mercado inválido." };
    }
    valorEsMercado = true;
  }

  const fechaRaw = fila["Fecha de adquisición"].trim();
  let fechaAdquisicion: string | null = null;
  if (fechaRaw) {
    const fechaError = validarFechaDDMMYYYY(fechaRaw);
    if (fechaError) {
      return { ok: false, motivo: fechaError };
    }
    fechaAdquisicion = parseFechaDDMMYYYY(fechaRaw);
  }

  const deprecRaw = normalizeImportDepreciacionRaw(fila["% Deprec."].trim());
  let depreciacion: string | null = null;
  let vidaUtilMeses: number | null = null;

  if (deprecRaw && categoria !== "CUENTA_ORDEN") {
    const pct = parsePorcentajeDepreciacion(deprecRaw.includes("%") ? deprecRaw : `${deprecRaw} %`);
    if (pct == null) {
      return { ok: false, motivo: "% Deprec. inválido (ej. 10 %)." };
    }
    depreciacion = `${pct} %`;
    vidaUtilMeses = vidaUtilMesesFromPorcentaje(pct);
  }

  let nextCuentaLookup = cuentaLookup;
  let cuentaActivoCodigo: string | null = null;
  let cuentaActivoNombre: string | null = null;
  let cuentaToCreate: { codigo: string; nombre: string } | undefined;
  const cuentaResolved = resolveImportCuentaContable(
    fila["Código cuenta contable"],
    fila["Nombre cuenta contable"],
    cuentaLookup,
  );

  if (!cuentaResolved.ok) {
    if (cuentaResolved.motivo !== "SKIP") {
      return { ok: false, motivo: cuentaResolved.motivo };
    }
    // Vacío / solo nombre → sin override; al mostrar se usa la del catálogo
  } else {
    nextCuentaLookup = cuentaResolved.lookup;
    cuentaActivoCodigo = cuentaResolved.cuenta_codigo;
    cuentaActivoNombre = cuentaResolved.contabilidad;
    cuentaToCreate = cuentaResolved.create;
  }

  const sucursal = fila.Sucursal.trim();
  const ambiente = fila.Ambiente.trim();
  const ambienteEsAliasPreregistro = ambiente ? isImportPreregistroAmbienteAlias(ambiente) : false;

  const fisicoLookup = buildUbicacionLookup(
    ubicacionRefs.filter((ref) => !ref.esPreregistro),
  );
  const todoLookup = buildUbicacionLookup(ubicacionRefs);
  const ubicacionKey =
    sucursal && ambiente
      ? `${normalizeImportKey(sucursal)}|${normalizeImportKey(ambiente)}`
      : "";
  const matchFisico = ubicacionKey ? fisicoLookup.get(ubicacionKey) : null;
  const matchTodos = ubicacionKey ? todoLookup.get(ubicacionKey) : null;

  const comprobante = parseImportComprobanteSerie(fila["Comprobante de adquisición"]);
  if (!comprobante.ok) return comprobante;
  if (valorEsMercado && comprobante.value) {
    return {
      ok: false,
      motivo: "El comprobante de adquisición no aplica cuando indica valor de mercado.",
    };
  }

  const estadoRegistro = resolveImportEstadoRegistroFromAmbiente(
    matchFisico ?? null,
    matchTodos ?? null,
    ambienteEsAliasPreregistro,
  );

  let sedeId: string | null = null;
  let ambienteId: string | null = null;
  let posibleAmbienteId: string | null = null;

  if (estadoRegistro === "REGISTRADO") {
    if (!sucursal) {
      return { ok: false, motivo: "Sucursal es obligatoria." };
    }
    if (!ambiente) {
      return { ok: false, motivo: "Ambiente es obligatorio." };
    }
    if (!matchFisico) {
      return {
        ok: false,
        motivo: `Ambiente "${ambiente}" no encontrado en sucursal "${sucursal}".`,
      };
    }
    sedeId = matchFisico.sede_id;
    ambienteId = matchFisico.ambiente_id;
  } else {
    if (matchFisico) {
      posibleAmbienteId = matchFisico.ambiente_id;
    } else if (sucursal || ambiente) {
      if (!ambienteEsAliasPreregistro && !matchTodos) {
        return {
          ok: false,
          motivo: `Posible ambiente "${ambiente}" no encontrado en sucursal "${sucursal}".`,
        };
      }
    }
  }

  return {
    ok: true,
    cuentaLookup: nextCuentaLookup,
    ...(cuentaToCreate ? { cuentaToCreate } : {}),
    payload: {
      entidad_id: entidadId,
      codigo_catalogo: codigoCatalogo,
      nombre: catalogoItem.denominacion.trim(),
      categoria,
      estado_bien: estadoBien,
      caracteristicas: fila.Detalle.trim() || null,
      marca: fila.Marca.trim() || null,
      modelo: fila.Modelo.trim() || null,
      serie: fila.Serie.trim() || null,
      color: fila.Color.trim() || null,
      medidas: fila.Medidas.trim() || null,
      fecha_adquisicion: fechaAdquisicion,
      fecha_inicio_depreciacion: fechaAdquisicion
        ? (() => {
            const [y, m] = fechaAdquisicion.split("-").map(Number);
            if (!y || !m || m < 1 || m > 12) return null;
            const next = new Date(y, m, 1);
            return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
          })()
        : null,
      valor_adquisicion: valorAdquisicion,
      valor_es_mercado: valorEsMercado,
      depreciacion,
      vida_util_meses: vidaUtilMeses,
      observacion: fila.Observaciones.trim() || null,
      estado_registro: estadoRegistro,
      sede_id: sedeId,
      ambiente_id: ambienteId,
      posible_ambiente_id: posibleAmbienteId,
      cuenta_contable_codigo: cuentaActivoCodigo,
      cuenta_contable_nombre: cuentaActivoNombre,
      comprobante_serie: valorEsMercado ? null : comprobante.value,
    },
  };
}

export function importErrorFilaFromItem(item: ImportActivoErrorItem): ImportActivoErrorFila {
  return { ...item.datos, [IMPORT_ACTIVOS_COLUMN_ERROR]: item.motivo };
}
