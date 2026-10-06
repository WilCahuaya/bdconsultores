import type { Activo, CategoriaBien, RolUsuario } from "@inventario/types";

export type ReporteId =
  | "inventario_ambiente_sin_valores"
  | "inventario_ambiente_activos_fijos"
  | "inventario_ambiente_activo"
  | "inventario_ambiente_cuenta_orden"
  | "inventario_entidad_sin_valores"
  | "inventario_entidad_acta_activo"
  | "inventario_entidad_acta_cuenta_orden"
  | "inventario_entidad_activos_fijos"
  | "inventario_entidad_activo"
  | "inventario_entidad_cuenta_orden"
  | "inventario_ambiente_valorizado"
  | "inventario_ambiente_valorizado_activo"
  | "inventario_ambiente_valorizado_cuenta_orden"
  | "inventario_entidad_valorizado"
  | "inventario_entidad_valorizado_activo"
  | "inventario_entidad_valorizado_cuenta_orden"
  | "reporte_bajas"
  | "reporte_activos_estado_malo"
  | "reporte_faltantes"
  | "reporte_adquiridos_ejercicio_actual"
  | "reporte_adquiridos_ejercicio_anterior";

/** Formato del documento. Las variantes por categoría comparten plantilla. */
export type ReportePlantilla =
  | "ficha_ambiente"
  | "inventario_ambiente"
  | "acta_entidad"
  | "inventario_entidad"
  | "valorizado_ambiente"
  | "valorizado_entidad"
  | "bajas"
  | "estado_malo"
  | "faltantes"
  | "ejercicio_actual"
  | "ejercicio_anterior";

export type ReporteFormato = "pdf" | "excel";

export type ReporteScope = "ambiente" | "entidad";

export type ReporteGrupo = "ambiente" | "entidad" | "situacion";

export interface ReporteDefinicion {
  id: ReporteId;
  label: string;
  descripcion: string;
  scope: ReporteScope;
  valorizado: boolean;
  formatos: ReporteFormato[];
  soloContador?: boolean;
  grupo: ReporteGrupo;
  plantilla: ReportePlantilla;
  /** Título del PDF y del Excel, en mayúsculas. */
  titulo: string;
  /** Prefijo del archivo descargado. */
  archivo: string;
  /** Si se omite, el reporte incluye activos fijos y cuenta de orden. */
  categoria?: CategoriaBien;
}

export const REPORTES: ReporteDefinicion[] = [
  {
    id: "inventario_ambiente_sin_valores",
    label: "Ficha de asignación por ambiente",
    descripcion: "Ficha de asignación de bienes al usuario responsable, sin valores.",
    scope: "ambiente",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "ambiente",
    plantilla: "ficha_ambiente",
    titulo: "FICHA DE ASIGNACION DE BIENES AL USUARIO",
    archivo: "ficha-asignacion",
  },
  {
    id: "inventario_ambiente_activos_fijos",
    label: "Inventario de bienes por ambiente",
    descripcion: "Listado del ambiente con activos fijos y cuenta de orden, sin valores.",
    scope: "ambiente",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "ambiente",
    plantilla: "inventario_ambiente",
    titulo: "INVENTARIO DE BIENES POR AMBIENTE",
    archivo: "inventario-bienes-ambiente",
  },
  {
    id: "inventario_ambiente_activo",
    label: "Inventario de activos fijos por ambiente",
    descripcion: "Listado del ambiente solo con activos fijos, sin valores.",
    scope: "ambiente",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "ambiente",
    plantilla: "inventario_ambiente",
    titulo: "INVENTARIO DE ACTIVOS FIJOS POR AMBIENTE",
    archivo: "inventario-activos-fijos-ambiente",
    categoria: "ACTIVO",
  },
  {
    id: "inventario_ambiente_cuenta_orden",
    label: "Inventario de cuenta de orden por ambiente",
    descripcion: "Listado del ambiente solo con bienes de cuenta de orden, sin valores.",
    scope: "ambiente",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "ambiente",
    plantilla: "inventario_ambiente",
    titulo: "INVENTARIO DE CUENTA DE ORDEN POR AMBIENTE",
    archivo: "inventario-cuenta-orden-ambiente",
    categoria: "CUENTA_ORDEN",
  },
  {
    id: "inventario_ambiente_valorizado",
    label: "Inventario valorizado de bienes por ambiente",
    descripcion:
      "Listado del ambiente con precio, depreciación y valor neto. Incluye activos fijos y cuenta de orden.",
    scope: "ambiente",
    valorizado: true,
    formatos: ["pdf", "excel"],
    soloContador: true,
    grupo: "ambiente",
    plantilla: "valorizado_ambiente",
    titulo: "INVENTARIO VALORIZADO DE BIENES POR AMBIENTE",
    archivo: "inventario-valorizado-bienes-ambiente",
  },
  {
    id: "inventario_ambiente_valorizado_activo",
    label: "Inventario valorizado de activos fijos por ambiente",
    descripcion: "Listado valorizado del ambiente solo con activos fijos.",
    scope: "ambiente",
    valorizado: true,
    formatos: ["pdf", "excel"],
    soloContador: true,
    grupo: "ambiente",
    plantilla: "valorizado_ambiente",
    titulo: "INVENTARIO VALORIZADO DE ACTIVOS FIJOS POR AMBIENTE",
    archivo: "inventario-valorizado-activos-fijos-ambiente",
    categoria: "ACTIVO",
  },
  {
    id: "inventario_ambiente_valorizado_cuenta_orden",
    label: "Inventario valorizado de cuenta de orden por ambiente",
    descripcion:
      "Listado valorizado del ambiente solo con cuenta de orden. Esos bienes no se deprecian.",
    scope: "ambiente",
    valorizado: true,
    formatos: ["pdf", "excel"],
    soloContador: true,
    grupo: "ambiente",
    plantilla: "valorizado_ambiente",
    titulo: "INVENTARIO VALORIZADO DE CUENTA DE ORDEN POR AMBIENTE",
    archivo: "inventario-valorizado-cuenta-orden-ambiente",
    categoria: "CUENTA_ORDEN",
  },
  {
    id: "inventario_entidad_sin_valores",
    label: "Acta de inventario de bienes",
    descripcion:
      "Acta de la entidad con activos fijos y cuenta de orden, sin valores y con firmas.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    soloContador: true,
    grupo: "entidad",
    plantilla: "acta_entidad",
    titulo: "ACTA DE INVENTARIO DE BIENES",
    archivo: "acta-inventario-bienes",
  },
  {
    id: "inventario_entidad_acta_activo",
    label: "Acta de inventario de activos fijos",
    descripcion: "Acta de la entidad solo con activos fijos, sin valores y con firmas.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    soloContador: true,
    grupo: "entidad",
    plantilla: "acta_entidad",
    titulo: "ACTA DE INVENTARIO DE ACTIVOS FIJOS",
    archivo: "acta-inventario-activos-fijos",
    categoria: "ACTIVO",
  },
  {
    id: "inventario_entidad_acta_cuenta_orden",
    label: "Acta de inventario de cuenta de orden",
    descripcion: "Acta de la entidad solo con cuenta de orden, sin valores y con firmas.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    soloContador: true,
    grupo: "entidad",
    plantilla: "acta_entidad",
    titulo: "ACTA DE INVENTARIO DE CUENTA DE ORDEN",
    archivo: "acta-inventario-cuenta-orden",
    categoria: "CUENTA_ORDEN",
  },
  {
    id: "inventario_entidad_activos_fijos",
    label: "Inventario de bienes",
    descripcion: "Listado de la entidad con activos fijos y cuenta de orden, sin valores.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "entidad",
    plantilla: "inventario_entidad",
    titulo: "INVENTARIO DE BIENES",
    archivo: "inventario-bienes",
  },
  {
    id: "inventario_entidad_activo",
    label: "Inventario de activos fijos",
    descripcion: "Listado de la entidad solo con activos fijos, sin valores.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "entidad",
    plantilla: "inventario_entidad",
    titulo: "INVENTARIO DE ACTIVOS FIJOS",
    archivo: "inventario-activos-fijos",
    categoria: "ACTIVO",
  },
  {
    id: "inventario_entidad_cuenta_orden",
    label: "Inventario de cuenta de orden",
    descripcion: "Listado de la entidad solo con bienes de cuenta de orden, sin valores.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "entidad",
    plantilla: "inventario_entidad",
    titulo: "INVENTARIO DE CUENTA DE ORDEN",
    archivo: "inventario-cuenta-orden",
    categoria: "CUENTA_ORDEN",
  },
  {
    id: "inventario_entidad_valorizado",
    label: "Inventario valorizado de bienes",
    descripcion:
      "Inventario de la entidad con valores. Incluye activos fijos y cuenta de orden.",
    scope: "entidad",
    valorizado: true,
    formatos: ["pdf", "excel"],
    soloContador: true,
    grupo: "entidad",
    plantilla: "valorizado_entidad",
    titulo: "INVENTARIO VALORIZADO DE BIENES",
    archivo: "inventario-valorizado-bienes",
  },
  {
    id: "inventario_entidad_valorizado_activo",
    label: "Inventario valorizado de activos fijos",
    descripcion: "Inventario valorizado de la entidad solo con activos fijos.",
    scope: "entidad",
    valorizado: true,
    formatos: ["pdf", "excel"],
    soloContador: true,
    grupo: "entidad",
    plantilla: "valorizado_entidad",
    titulo: "INVENTARIO VALORIZADO DE ACTIVOS FIJOS",
    archivo: "inventario-valorizado-activos-fijos",
    categoria: "ACTIVO",
  },
  {
    id: "inventario_entidad_valorizado_cuenta_orden",
    label: "Inventario valorizado de cuenta de orden",
    descripcion:
      "Inventario valorizado de la entidad solo con cuenta de orden. Esos bienes no se deprecian.",
    scope: "entidad",
    valorizado: true,
    formatos: ["pdf", "excel"],
    soloContador: true,
    grupo: "entidad",
    plantilla: "valorizado_entidad",
    titulo: "INVENTARIO VALORIZADO DE CUENTA DE ORDEN",
    archivo: "inventario-valorizado-cuenta-orden",
    categoria: "CUENTA_ORDEN",
  },
  {
    id: "reporte_bajas",
    label: "Reporte de bajas",
    descripcion: "Bienes dados de baja, activos fijos y cuenta de orden, con motivo y fecha.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "situacion",
    plantilla: "bajas",
    titulo: "REPORTE DE BAJAS",
    archivo: "reporte-bajas",
  },
  {
    id: "reporte_activos_estado_malo",
    label: "Bienes en estado malo",
    descripcion: "Bienes registrados en estado malo, con sede y ambiente.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "situacion",
    plantilla: "estado_malo",
    titulo: "BIENES EN ESTADO MALO",
    archivo: "bienes-estado-malo",
  },
  {
    id: "reporte_faltantes",
    label: "Bienes en Faltantes",
    descripcion: "Bienes que están en Faltantes, con el ambiente del que salieron.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "situacion",
    plantilla: "faltantes",
    titulo: "BIENES EN FALTANTES",
    archivo: "bienes-faltantes",
  },
  {
    id: "reporte_adquiridos_ejercicio_actual",
    label: "Bienes adquiridos en el ejercicio actual",
    descripcion: "Bienes registrados cuya fecha de adquisición corresponde al año en curso.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "situacion",
    plantilla: "ejercicio_actual",
    titulo: "BIENES ADQUIRIDOS EN EL EJERCICIO",
    archivo: "bienes-adquiridos-ejercicio-actual",
  },
  {
    id: "reporte_adquiridos_ejercicio_anterior",
    label: "Bienes adquiridos en el ejercicio anterior",
    descripcion:
      "Bienes registrados cuya fecha de adquisición corresponde al año anterior al actual.",
    scope: "entidad",
    valorizado: false,
    formatos: ["pdf", "excel"],
    grupo: "situacion",
    plantilla: "ejercicio_anterior",
    titulo: "BIENES ADQUIRIDOS EN EL EJERCICIO",
    archivo: "bienes-adquiridos-ejercicio-anterior",
  },
];

export function definicionReporte(reporteId: ReporteId): ReporteDefinicion {
  const def = REPORTES.find((reporte) => reporte.id === reporteId);
  if (!def) throw new Error(`Reporte no definido: ${reporteId}`);
  return def;
}

export function plantillaReporte(reporteId: ReporteId): ReportePlantilla {
  return definicionReporte(reporteId).plantilla;
}

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
  /** Ambiente del que salió el bien al pasar a Faltantes. */
  procedencia?: string | null;
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
