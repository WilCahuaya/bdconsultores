export const BD_PORTAL_ESTUDIO = "Estudio Contable B&D Consultores Global E.I.R.L." as const;

export const BD_PORTAL_RAZON_SOCIAL = "B & D CONSULTORES GLOBAL E.I.R.L." as const;

export const BD_PORTAL_INTRO =
  "Brindamos servicios con rigor técnico y solidez legal, acompañando a instituciones y empresas en su gestión contable y patrimonial." as const;

export const BD_PORTAL_LOGIN_HINT = "Haz clic en el botón para ingresar" as const;

export const BD_PORTAL_FOOTER_INSTITUCIONAL =
  "Respaldamos su éxito institucional con transparencia, seguridad corporativa y confidencialidad para una gerencia de primer nivel." as const;

export const BD_PORTAL_HERO_LIGHT = "/images/login-hero-light.png" as const;
export const BD_PORTAL_HERO_DARK = "/images/login-hero-dark.png" as const;

export const BD_PORTAL_CONTACTO = {
  direccion: "Jr. Jorge Chavez s/n - Sapallanga",
  telefono: "Cel. 954008717-971599075",
  email: "b&destudiocontable80@gmail.com",
} as const;

export function adminPortalPath(): string {
  return "/admin/portal";
}

/** Portal institucional del contador (sin entidad preseleccionada). */
export function contadorPortalHomePath(): string {
  return "/contador/portal";
}

/** Página inicial de inventarios del contador. */
export function contadorGestionInventariosPath(): string {
  return "/contador/entidades";
}

/** @deprecated Use contadorPortalHomePath — redirige al portal del contador. */
export function contadorPortalPath(_entidadId?: string): string {
  return contadorPortalHomePath();
}

const GENERIC_CONTADOR_NOMBRE =
  /^(contador|administrador)(\s+b\s*&\s*d|\s+b&d)?(\s+consultores?)?(\s+global)?(\s+e\.?i\.?r\.?l\.?)?$/i;

/** Detecta nombres de perfil que en realidad son el rol o la marca, no una persona. */
export function isGenericContadorNombre(nombre: string): boolean {
  const trimmed = nombre.trim();
  if (!trimmed) return true;
  if (GENERIC_CONTADOR_NOMBRE.test(trimmed)) return true;
  if (/^contador\b/i.test(trimmed) && trimmed.length <= 28) return true;
  return false;
}

/** Nombre legible para el portal del contador (con fallback si el perfil es genérico). */
export function displayContadorNombre(nombre: string, email: string): string {
  const trimmed = nombre.trim();
  if (trimmed && !isGenericContadorNombre(trimmed)) return trimmed;

  const local = email.split("@")[0]?.trim() ?? "";
  if (local && /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(local)) {
    return local.replace(/[._+-]/g, " ").replace(/\s+/g, " ").trim();
  }

  return trimmed || "Contador";
}

/** Validación al invitar un contador. */
export function validarNombreContador(nombre: string): string | null {
  const trimmed = nombre.trim();
  if (trimmed.length < 3) return "El nombre es obligatorio.";
  if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(trimmed)) {
    return "El nombre debe incluir letras.";
  }
  if (isGenericContadorNombre(trimmed)) {
    return "Ingrese el nombre completo de la persona, no el rol ni «Contador B&D».";
  }
  return null;
}
