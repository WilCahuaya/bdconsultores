import type {
  ClasificacionTrabajador,
  EstadoContratoPlanilla,
  EstadoDocumentoPlanilla,
  EstadoRelacionLaboral,
  EstadoTramitePension,
  EstadoValidacionAltaPlanilla,
  JornadaLaboral,
  TipoDocumentoPlanilla,
  TipoPension,
  TipoTRegistro,
} from "@inventario/types";
import { parseFechaFlexible } from "@inventario/types";

export const CLASIFICACION_LABEL: Record<ClasificacionTrabajador, string> = {
  PATROCINADO: "Patrocinado",
  SUPERVIVENCIA: "Supervivencia",
};

export const JORNADA_LABEL: Record<JornadaLaboral, string> = {
  TIEMPO_COMPLETO: "Tiempo completo",
  TIEMPO_PARCIAL: "Tiempo parcial",
};

export const CARGOS_TRABAJADOR = [
  "Administrador",
  "Tesorero",
  "Secretario",
  "Coordinador",
  "Formador educativo espiritual",
] as const;

export type CargoTrabajador = (typeof CARGOS_TRABAJADOR)[number];

export function esCargoTrabajador(value: string): value is CargoTrabajador {
  return (CARGOS_TRABAJADOR as readonly string[]).includes(value);
}

export function opcionesCargo(actual?: string | null): { value: string; label: string }[] {
  const options = CARGOS_TRABAJADOR.map((cargo) => ({ value: cargo, label: cargo }));
  const extra = actual?.trim();
  if (extra && !esCargoTrabajador(extra)) {
    return [{ value: extra, label: extra }, ...options];
  }
  return options;
}

export function parseCargoCampo(raw: string, actual?: string | null): { error?: string; value: string | null } {
  const cargo = raw.trim() || null;
  if (!cargo) return { value: null };
  if (esCargoTrabajador(cargo)) return { value: cargo };
  if (actual?.trim() === cargo) return { value: cargo };
  return { error: "Elija un cargo de la lista.", value: null };
}

/** Columna Tiempo del Excel de control (Completo / Parcial). */
export const TIEMPO_LABEL: Record<JornadaLaboral, string> = {
  TIEMPO_COMPLETO: "Completo",
  TIEMPO_PARCIAL: "Parcial",
};

export const ESTADO_RELACION_LABEL: Record<EstadoRelacionLaboral, string> = {
  ACTIVA: "Activa",
  CESADA: "Cesada",
};

export const ESTADO_CONTRATO_LABEL: Record<EstadoContratoPlanilla, string> = {
  PENDIENTE_DOCS: "Pendiente de documentos",
  ELABORADO: "Elaborado",
  ENVIADO_FIRMA: "Enviado a firma",
  FIRMADO: "Firmado",
  PRESENTADO_MTPE: "Presentado al MTPE",
  RECEPCIONADO: "Recepcionado",
  RECOGIDO: "Recogido",
  REGISTRADO: "Registrado",
  ALTA_TR: "Alta T-Registro",
  COMPLETO: "Completo",
  BAJA: "Baja",
  NO_UBICADO: "No ubicado",
};

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoPlanilla, string> = {
  DNI: "DNI",
  FICHA_DATOS: "Ficha de datos personales",
  PENSIONES_FIRMADO: "Sistema de pensiones firmado",
  ASIGNACION_FAMILIAR: "Asignación familiar",
  CONTRATO_FIRMADO: "Contrato firmado",
  TR_ALTA: "T-Registro alta",
  TR_BAJA: "T-Registro baja",
  CARTA_RENUNCIA: "Carta de renuncia",
  VIDA_LEY: "Vida Ley",
  OTRO: "Otro",
};

export const ESTADO_DOCUMENTO_LABEL: Record<EstadoDocumentoPlanilla, string> = {
  SI: "Sí",
  NO: "No",
  NA: "No aplica",
  PENDIENTE: "Pendiente",
};

export const TIPO_PENSION_LABEL: Record<TipoPension, string> = {
  AFP: "AFP",
  ONP: "ONP",
};

export const TRAMITE_PENSION_LABEL: Record<EstadoTramitePension, string> = {
  PENDIENTE: "Pendiente",
  TRAMITADO: "Tramitado",
  NO_APLICA: "No aplica",
};

export const TIPO_T_REGISTRO_LABEL: Record<TipoTRegistro, string> = {
  ALTA: "Alta",
  BAJA: "Baja",
};

export const ESTADO_VALIDACION_ALTA_LABEL: Record<EstadoValidacionAltaPlanilla, string> = {
  PENDIENTE: "Por validar",
  ACEPTADA: "Aceptada",
};

export const PENDIENTE_TIPOS = ["validacion", "contrato", "documento", "afp", "t-registro", "vida-ley", "vencimiento"] as const;
export type PendienteTipo = (typeof PENDIENTE_TIPOS)[number];

export type PendienteItem = {
  id: string;
  relacionId: string;
  dni: string;
  nombre: string;
  tipo: PendienteTipo;
  detalle: string;
  tab: "datos" | "contratos" | "documentos" | "firma" | "pensiones" | "t-registro" | "vida-ley";
};

export const PENDIENTE_TIPO_LABEL: Record<PendienteTipo, string> = {
  validacion: "Validación",
  contrato: "Contrato",
  documento: "Documento",
  afp: "AFP",
  "t-registro": "T-Registro",
  "vida-ley": "Vida Ley",
  vencimiento: "Vencimiento",
};

export function parsePendienteTipo(value: string | undefined): PendienteTipo | "todos" {
  return PENDIENTE_TIPOS.some((t) => t === value) ? (value as PendienteTipo) : "todos";
}

export function nombreCompleto(persona: {
  nombres: string;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
}): string {
  return [persona.nombres, persona.apellido_paterno, persona.apellido_materno]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

export function formatFechaPlanilla(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = value.slice(0, 10);
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/** Lee una fecha del formulario (DD/MM/AAAA o ISO) y la deja en YYYY-MM-DD. */
export function parseFechaCampo(raw: string, label: string): { error?: string; value: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  const iso = parseFechaFlexible(trimmed);
  if (!iso) return { error: `${label} inválida. Escriba o pegue DD/MM/AAAA.`, value: null };
  return { value: iso };
}

export function formatRemuneracion(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
