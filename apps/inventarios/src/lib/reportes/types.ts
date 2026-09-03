import type { Activo, RolUsuario } from "@inventario/types";

export type ReporteId =
  | "inventario_ambiente_sin_valores"
  | "inventario_ambiente_activos_fijos"
  | "inventario_entidad_sin_valores"
  | "inventario_entidad_activos_fijos"
  | "inventario_ambiente_valorizado"
  | "inventario_entidad_valorizado"
  | "reporte_bajas"
  | "reporte_activos_estado_malo"
  | "reporte_adquiridos_ejercicio_actual"
  | "reporte_adquiridos_ejercicio_anterior";

export type ReporteFormato = "pdf" | "excel";

export type ReporteScope = "ambiente" | "entidad";

export interface ReporteDefinicion {
  id: ReporteId;
  label: string;
  descripcion: string;
  scope: ReporteScope;
  valorizado: boolean;
  formatos: ReporteFormato[];
  soloContador?: boolean;
}

export const REPORTES: ReporteDefinicion[] = [
  {
    id: "inventario_ambiente_sin_valores",
    label: "Ficha de asignación por ambiente",
    descripcion: "Ficha de asignación de bienes al usuario responsable, sin valores.",
    scope: "ambiente",
    valorizado: false,
    formatos: ["pdf", "excel"],
  },
  {
    id: "inventario_ambiente_activos_fijos",
    label: "Inventario de activos fijos por ambiente",
    descripcion: "Listado físico del ambiente sin valores ni firmas.",
    scope: "ambiente",
    valorizado: false,
    formatos: ["pdf", "excel"],
  },
  {
    id: "inventario_entidad_sin_valores",
    label: "Acta de inventario de activos fijos general",
    descripcion: "Acta con todos los activos de la entidad sin valores y firmas de conformidad.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    soloContador: true,
  },
  {
    id: "inventario_entidad_activos_fijos",
    label: "Inventario de activos fijos general",
    descripcion: "Listado completo de la entidad sin valores ni firmas.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
  },
  {
    id: "inventario_ambiente_valorizado",
    label: "Inventario de activos valorizados por ambiente",
    descripcion: "Listado del ambiente con precio, depreciación y valor neto, sin firmas.",
    scope: "ambiente",
    valorizado: true,
    formatos: ["pdf", "excel"],
    soloContador: true,
  },
  {
    id: "inventario_entidad_valorizado",
    label: "Inventario de activos valorizados general",
    descripcion: "Inventario completo de la entidad con valores, sin firmas.",
    scope: "entidad",
    valorizado: true,
    formatos: ["pdf", "excel"],
    soloContador: true,
  },
  {
    id: "reporte_bajas",
    label: "Reporte de bajas",
    descripcion: "Activos dados de baja con motivo y fecha, sin firmas.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
  },
  {
    id: "reporte_activos_estado_malo",
    label: "Reporte de activos en estado malo",
    descripcion: "Activos registrados en estado malo con ubicación (sede y ambiente).",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
  },
  {
    id: "reporte_adquiridos_ejercicio_actual",
    label: "Adquiridos en el ejercicio actual",
    descripcion:
      "Activos registrados cuya fecha de adquisición corresponde al año en curso.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
  },
  {
    id: "reporte_adquiridos_ejercicio_anterior",
    label: "Adquiridos en el ejercicio anterior",
    descripcion:
      "Activos registrados cuya fecha de adquisición corresponde al año anterior al actual.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
  },
];

export function reportesDisponiblesParaRol(rol: RolUsuario): ReporteDefinicion[] {
  if (rol === "ADMIN_ENTIDAD") {
    return REPORTES.filter((r) => !r.soloContador && !r.valorizado);
  }
  return REPORTES;
}

export function reportesAmbienteParaRol(rol: RolUsuario): ReporteDefinicion[] {
  return reportesDisponiblesParaRol(rol).filter((r) => r.scope === "ambiente");
}

export function reportePermitidoParaRol(reporteId: ReporteId, rol: RolUsuario): boolean {
  return reportesDisponiblesParaRol(rol).some((r) => r.id === reporteId);
}

export interface ActivoReporte extends Activo {
  entidad_nombre?: string;
  sede_nombre?: string;
  ambiente_nombre?: string;
  cuenta_contable?: string | null;
  contabilidad?: string | null;
  grupo_contable?: string | null;
}

export interface ReporteContexto {
  reporteId: ReporteId;
  entidadNombre: string;
  ambienteNombre?: string | null;
  sedeNombre?: string | null;
  responsable?: string | null;
  responsableDni?: string | null;
  adminNombre?: string | null;
  adminDni?: string | null;
  usuarioNombre: string;
  usuarioEmail: string;
  fechaGeneracion: Date;
  /** AAAA-MM-DD; omitir en reportes por ejercicio de adquisición. */
  fechaCorte?: string | null;
}

export type { ClasificacionResumen, ValorizacionTotales } from "@inventario/types";
