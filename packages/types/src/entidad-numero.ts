/** Número de archivo del estudio: 7, 11.1, 11.1.2. */

const NUMERO_INTERNO_RE = /^[0-9]+(\.[0-9]+)*$/;

/** Patrón HTML: dígitos y puntos, p. ej. 7 o 11.1 */
export const NUMERO_INTERNO_INPUT_PATTERN = "[0-9]+(\\.[0-9]+)*";

/** Código de proyecto, p. ej. PE356 */
export const PE_CODIGO_INPUT_PATTERN = "[Pp][Ee][0-9]+";

const PE_CODIGO_RE = /^PE[0-9]+$/;

export function normalizePeCodigo(raw: string | null | undefined): string | null {
  const value = raw?.trim().replace(/\s+/g, "").toUpperCase() ?? "";
  return value || null;
}

export function validarPeCodigo(
  raw: string | null | undefined,
  required = true,
): string | null {
  const value = normalizePeCodigo(raw);
  if (!value) {
    return required ? "El código de proyecto es obligatorio." : null;
  }
  if (!PE_CODIGO_RE.test(value)) {
    return "Use un código como PE356 (PE seguido de números).";
  }
  return null;
}

export function normalizeNumeroInterno(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  return value || null;
}

export function validarNumeroInterno(
  raw: string | null | undefined,
  required = true,
): string | null {
  const value = normalizeNumeroInterno(raw);
  if (!value) {
    return required ? "El número de proyecto es obligatorio." : null;
  }
  if (!NUMERO_INTERNO_RE.test(value)) {
    return "Use un número como 7 o 11.1 (solo dígitos y puntos).";
  }
  return null;
}

export function compareNumeroInterno(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const left = normalizeNumeroInterno(a);
  const right = normalizeNumeroInterno(b);
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const len = Math.max(leftParts.length, rightParts.length);
  for (let i = 0; i < len; i++) {
    if (i >= leftParts.length) return -1;
    if (i >= rightParts.length) return 1;
    if (leftParts[i] !== rightParts[i]) return leftParts[i] - rightParts[i];
  }
  return 0;
}

export function entidadEtiqueta(entidad: {
  nombre: string;
  numero_interno?: string | null;
  pe_codigo?: string | null;
}): string {
  const numero = normalizeNumeroInterno(entidad.numero_interno);
  const base = numero ? `${numero} ${entidad.nombre}` : entidad.nombre;
  const codigo = normalizePeCodigo(entidad.pe_codigo);
  return codigo ? `${base} · ${codigo}` : base;
}

export function compareEntidadesByNumero<
  T extends {
    activo?: boolean;
    nombre: string;
    numero_interno?: string | null;
  },
>(a: T, b: T): number {
  if (a.activo !== b.activo) {
    if (a.activo === false) return 1;
    if (b.activo === false) return -1;
  }
  const byNumero = compareNumeroInterno(a.numero_interno, b.numero_interno);
  if (byNumero !== 0) return byNumero;
  return a.nombre.localeCompare(b.nombre, "es");
}

export function sortEntidadesByNumero<
  T extends {
    activo?: boolean;
    nombre: string;
    numero_interno?: string | null;
  },
>(items: T[]): T[] {
  return [...items].sort(compareEntidadesByNumero);
}

export function mensajeErrorNumeroInterno(
  error: { code?: string; message?: string } | null | undefined,
): string | null {
  if (!error) return null;
  const message = error.message ?? "";
  if (error.code === "23505" && message.includes("numero_interno")) {
    return "Ya existe un proyecto con ese número.";
  }
  if (error.code === "23505" && message.includes("pe_codigo")) {
    return "Ya existe un proyecto con ese código.";
  }
  if (error.code === "23514" && message.includes("numero_interno")) {
    return "Use un número como 7 o 11.1 (solo dígitos y puntos).";
  }
  if (error.code === "23514" && message.includes("pe_codigo")) {
    return "Use un código como PE356 (PE seguido de números).";
  }
  return null;
}
