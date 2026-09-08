import type {
  ClasificacionTrabajador,
  EstadoContratoPlanilla,
  EstadoDocumentoPlanilla,
  EstadoRelacionLaboral,
  EstadoTramitePension,
  JornadaLaboral,
  TipoDocumentoPlanilla,
  TipoPension,
  TipoTRegistro,
} from "@inventario/types";

export const CLASIFICACION_LABEL: Record<ClasificacionTrabajador, string> = {
  PATROCINADO: "Patrocinado",
  SUPERVIVENCIA: "Supervivencia",
};

export const JORNADA_LABEL: Record<JornadaLaboral, string> = {
  TIEMPO_COMPLETO: "Tiempo completo",
  TIEMPO_PARCIAL: "Tiempo parcial",
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
