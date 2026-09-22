import {
  tiposDocumentosAltaRequeridos,
  type EstadoContratoPlanilla,
  type EstadoDocumentoPlanilla,
  type EstadoTramitePension,
  type EstadoValidacionAltaPlanilla,
  type TipoDocumentoPlanilla,
  type TipoPension,
  type TipoTRegistro,
} from "@inventario/types";
import { horarioEstaCompleto } from "@/lib/horario-laboral";
import { trabajadorActivoEnMes } from "@/lib/horario-asistencia";
import { ESTADO_CONTRATO_LABEL, TIPO_DOCUMENTO_LABEL, resolverEtapaVidaLey } from "@/lib/planillas-labels";
import { saldoVacaciones, tieneDerechoVacaciones } from "@/lib/vacaciones";

export const PASOS_ALTA = [
  { id: "documentos", n: 1, label: "Documentos" },
  { id: "persona", n: 2, label: "Persona" },
  { id: "puesto", n: 3, label: "Puesto" },
  { id: "contratos", n: 4, label: "Contrato" },
  { id: "alta", n: 5, label: "Dar de alta" },
] as const;

export type PasoAltaId = (typeof PASOS_ALTA)[number]["id"];
export type PasoFichaId = Exclude<PasoAltaId, "contratos" | "alta">;
export const PASOS_FICHA = [PASOS_ALTA[0], PASOS_ALTA[1], PASOS_ALTA[2]] as const;
export type FlujoTab = PasoAltaId | "firma" | "pensiones" | "t-registro" | "vida-ley" | "asistencia" | "vacaciones";
export type EnlaceProceso = { href: string; etiqueta: string };

export function esTabFicha(tab: FlujoTab): tab is PasoFichaId {
  return tab === "documentos" || tab === "persona" || tab === "puesto";
}

export function esPasoAltaSistemas(tab: FlujoTab): boolean {
  return tab === "alta" || tab === "pensiones" || tab === "t-registro";
}

export function tabFichaInicial(completados: Record<PasoAltaId, boolean>): PasoFichaId {
  if (!completados.persona) return "persona";
  if (!completados.puesto) return "puesto";
  return "documentos";
}

export function pasoAltaInicial(completados: Record<PasoAltaId, boolean>): PasoAltaId {
  if (!completados.persona) return "persona";
  if (!completados.puesto) return "puesto";
  if (!completados.contratos) return "contratos";
  if (!completados.alta) return "alta";
  if (!completados.documentos) return "documentos";
  return "contratos";
}

export function parseContratoPaso(value: string | undefined): PasoAltaId {
  if (value === "documentos" || value === "persona" || value === "puesto" || value === "contratos" || value === "alta") {
    return value;
  }
  if (value === "pensiones" || value === "t-registro") return "alta";
  return "contratos";
}

export type FlujoDocumento = {
  tipo: TipoDocumentoPlanilla;
  estado: EstadoDocumentoPlanilla;
  storage_path: string | null;
};

export type FlujoContrato = {
  estado: EstadoContratoPlanilla;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  remuneracion: number | null;
  es_vigente: boolean;
  datos_confirmados?: boolean;
};

export type FlujoPension = {
  tipo: TipoPension | null;
  afp_nombre: string | null;
  cuspp: string | null;
  tramite_estado: EstadoTramitePension | null;
  fecha_tramite: string | null;
};

export type FlujoTRegistro = {
  tipo: TipoTRegistro;
  realizado: boolean;
};

export type FlujoFichaInput = {
  nombres: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  fechaNacimiento: string | null;
  celular: string | null;
  correo: string | null;
  direccion: string | null;
  tipoVia: string | null;
  viaNombre: string | null;
  region: string | null;
  provincia: string | null;
  distrito: string | null;
  cargo: string | null;
  clasificacion: string | null;
  jornada: string | null;
  horario: string | null;
  fechaIngreso: string | null;
  recibeAsignacionFamiliar: boolean | null;
  validacion: EstadoValidacionAltaPlanilla;
  contratos: FlujoContrato[];
  documentos: FlujoDocumento[];
  pension: FlujoPension | null;
  tRegistro: FlujoTRegistro[];
};

export type FaltaPaso = { id: string; etiqueta: string };
export type FaltasPasosAlta = Record<PasoAltaId, FaltaPaso[]>;

export type SiguientePaso = {
  paso: PasoAltaId | "listo";
  tab: FlujoTab;
  etiqueta: string;
  rol: "empresa" | "estudio" | "hecho" | "alerta";
};

export function documentoCargado(docs: FlujoDocumento[], tipo: TipoDocumentoPlanilla): boolean {
  return docs.some((d) => d.tipo === tipo && d.estado === "SI" && Boolean(d.storage_path));
}

export function documentosAltaFaltantes(
  input: Pick<FlujoFichaInput, "documentos" | "recibeAsignacionFamiliar">,
): TipoDocumentoPlanilla[] {
  return tiposDocumentosAltaRequeridos(input.recibeAsignacionFamiliar).filter(
    (tipo) => !documentoCargado(input.documentos, tipo),
  );
}

export function etiquetaAlertaDocumentos(
  input: Pick<FlujoFichaInput, "documentos" | "recibeAsignacionFamiliar">,
): string | null {
  const faltantes = documentosAltaFaltantes(input);
  if (faltantes.length === 0) return null;
  const nombres = faltantes.map((tipo) => TIPO_DOCUMENTO_LABEL[tipo]);
  if (nombres.length === 1) return `Alerta: falta ${nombres[0]}`;
  return `Alerta: faltan ${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

export function pensionAltaLista(input: Pick<FlujoFichaInput, "pension">): boolean {
  const pension = input.pension;
  if (pension?.tipo === "ONP") return true;
  if (pension?.tipo !== "AFP") return false;
  return (
    pension.tramite_estado === "TRAMITADO" &&
    Boolean(pension.afp_nombre?.trim()) &&
    Boolean(pension.cuspp?.trim()) &&
    Boolean(pension.fecha_tramite)
  );
}

export function tRegistroAltaLista(input: Pick<FlujoFichaInput, "documentos" | "tRegistro">): boolean {
  return (
    input.tRegistro.some((item) => item.tipo === "ALTA" && item.realizado) &&
    documentoCargado(input.documentos, "TR_ALTA")
  );
}

export function altasAfiliacionListas(
  input: Pick<FlujoFichaInput, "pension" | "tRegistro" | "documentos">,
): boolean {
  return pensionAltaLista(input) && tRegistroAltaLista(input);
}

export function contratoVigente(contratos: FlujoContrato[]): FlujoContrato | null {
  if (contratos.length === 0) return null;
  return contratos.find((c) => c.es_vigente) ?? contratos[0];
}

export function contratoBorrador(contratos: FlujoContrato[]): FlujoContrato | null {
  return (
    contratos.find(
      (c) =>
        !c.datos_confirmados &&
        c.estado !== "RECOGIDO" &&
        c.estado !== "BAJA" &&
        c.estado !== "COMPLETO",
    ) ?? null
  );
}

export function contratoConfirmado(contratos: FlujoContrato[]): FlujoContrato | null {
  return contratos.find((c) => c.datos_confirmados && c.es_vigente) ?? contratos.find((c) => c.datos_confirmados) ?? null;
}

function campoVacio(value: string | null | undefined): boolean {
  return !value?.trim();
}

function faltaSiVacio(id: string, etiqueta: string, value: string | null | undefined): FaltaPaso | null {
  return campoVacio(value) ? { id, etiqueta } : null;
}

export function faltasPorPaso(input: FlujoFichaInput): FaltasPasosAlta {
  const documentos = tiposDocumentosAltaRequeridos(input.recibeAsignacionFamiliar)
    .filter((tipo) => !documentoCargado(input.documentos, tipo))
    .map((tipo) => ({ id: tipo, etiqueta: TIPO_DOCUMENTO_LABEL[tipo] }));

  const persona = [
    faltaSiVacio("nombres", "Nombres", input.nombres),
    faltaSiVacio("apellido_paterno", "Apellido paterno", input.apellidoPaterno),
    faltaSiVacio("apellido_materno", "Apellido materno", input.apellidoMaterno),
    faltaSiVacio("fecha_nacimiento", "Fecha de nacimiento", input.fechaNacimiento),
    faltaSiVacio("celular", "Celular", input.celular),
    faltaSiVacio("correo", "Correo", input.correo),
    faltaSiVacio("region", "Región", input.region),
    faltaSiVacio("provincia", "Provincia", input.provincia),
    faltaSiVacio("distrito", "Distrito", input.distrito),
    faltaSiVacio("tipo_via", "Tipo de vía", input.tipoVia),
    faltaSiVacio("via_nombre", "Nombre de avenida, calle o jirón", input.viaNombre),
  ].filter((item): item is FaltaPaso => item !== null);

  const puesto = [
    faltaSiVacio("cargo", "Cargo", input.cargo),
    faltaSiVacio("jornada", "Jornada", input.jornada),
    horarioEstaCompleto(input.horario) ? null : { id: "horario", etiqueta: "Horario laboral" },
    faltaSiVacio("fecha_ingreso", "Fecha de ingreso a la empresa", input.fechaIngreso),
  ].filter((item): item is FaltaPaso => item !== null);

  const confirmado = contratoConfirmado(input.contratos);
  const borrador = contratoBorrador(input.contratos);
  const firmado = documentoCargado(input.documentos, "CONTRATO_FIRMADO");
  const contratos: FaltaPaso[] = [];
  if (!confirmado) {
    if (!borrador) contratos.push({ id: "generar", etiqueta: "Generar contrato" });
    if (!firmado) contratos.push({ id: "firmar", etiqueta: "Subir contrato firmado" });
    contratos.push({ id: "confirmar", etiqueta: "Confirmar datos del firmado" });
  }

  const alta: FaltaPaso[] = [];
  if (!pensionAltaLista(input)) {
    alta.push({
      id: "afp",
      etiqueta: input.pension?.tipo === "AFP" ? "Completar alta AFP" : "AFP u ONP",
    });
  }
  if (!tRegistroAltaLista(input)) {
    alta.push({ id: "t-registro", etiqueta: "Alta T-Registro" });
  }

  return { documentos, persona, puesto, contratos, alta };
}

export function estadoPasosAlta(input: FlujoFichaInput): Record<PasoAltaId, boolean> {
  const faltas = faltasPorPaso(input);
  return {
    documentos: faltas.documentos.length === 0,
    persona: faltas.persona.length === 0,
    puesto: faltas.puesto.length === 0,
    contratos: faltas.contratos.length === 0,
    alta: faltas.alta.length === 0,
  };
}

export function textoListaFaltas(etiquetas: string[]): string {
  if (etiquetas.length === 0) return "";
  if (etiquetas.length === 1) return etiquetas[0];
  if (etiquetas.length === 2) return `${etiquetas[0]} y ${etiquetas[1]}`;
  return `${etiquetas.slice(0, -1).join(", ")} y ${etiquetas[etiquetas.length - 1]}`;
}

export function resolverSiguientePaso(input: FlujoFichaInput, esEstudio: boolean): SiguientePaso {
  const borrador = contratoBorrador(input.contratos);
  const confirmado = contratoConfirmado(input.contratos);
  const vigente = confirmado ?? contratoVigente(input.contratos);
  const firmado = documentoCargado(input.documentos, "CONTRATO_FIRMADO");
  const pasos = estadoPasosAlta(input);

  if (!pasos.persona) {
    return { paso: "persona", tab: "persona", etiqueta: "Completar persona", rol: "empresa" };
  }
  if (!pasos.puesto) {
    return { paso: "puesto", tab: "puesto", etiqueta: "Completar puesto", rol: "empresa" };
  }
  if (!borrador && !confirmado) {
    return { paso: "contratos", tab: "contratos", etiqueta: "Generar contrato", rol: "empresa" };
  }
  if (borrador && !firmado) {
    return { paso: "contratos", tab: "contratos", etiqueta: "Subir contrato firmado", rol: "empresa" };
  }
  if (borrador && firmado) {
    return { paso: "contratos", tab: "contratos", etiqueta: "Confirmar datos del firmado", rol: "empresa" };
  }
  if (input.validacion === "PENDIENTE") {
    return esEstudio
      ? { paso: "contratos", tab: "contratos", etiqueta: "Validar alta", rol: "estudio" }
      : { paso: "contratos", tab: "contratos", etiqueta: "En revisión del estudio", rol: "empresa" };
  }
  if (vigente?.estado === "ELABORADO" && firmado) {
    return esEstudio
      ? { paso: "contratos", tab: "contratos", etiqueta: "Marcar recogido", rol: "estudio" }
      : { paso: "contratos", tab: "contratos", etiqueta: "En revisión del estudio", rol: "empresa" };
  }
  if (!pensionAltaLista(input)) {
    return esEstudio
      ? { paso: "alta", tab: "alta", etiqueta: "Dar de alta AFP y T-Registro", rol: "estudio" }
      : { paso: "alta", tab: "alta", etiqueta: "En alta AFP y T-Registro del estudio", rol: "empresa" };
  }
  if (!tRegistroAltaLista(input)) {
    return esEstudio
      ? { paso: "alta", tab: "alta", etiqueta: "Dar de alta T-Registro", rol: "estudio" }
      : { paso: "alta", tab: "alta", etiqueta: "En alta T-Registro del estudio", rol: "empresa" };
  }
  if (vigente?.estado === "RECOGIDO" || vigente?.estado === "COMPLETO") {
    const alertaDocs = etiquetaAlertaDocumentos(input);
    if (alertaDocs) {
      return { paso: "documentos", tab: "documentos", etiqueta: alertaDocs, rol: "alerta" };
    }
    return { paso: "listo", tab: "contratos", etiqueta: "Recogido", rol: "hecho" };
  }
  return { paso: "contratos", tab: "contratos", etiqueta: "Revisar contrato", rol: "empresa" };
}

export function hrefFichaTrabajador(relacionId: string): string {
  return `/trabajadores/${relacionId}`;
}

export function hrefAltaTrabajador(relacionId: string, paso?: PasoAltaId): string {
  return `/contratos/${relacionId}?paso=${paso ?? "contratos"}`;
}

export function hrefPasoTrabajador(relacionId: string, tab: FlujoTab): string {
  if (tab === "contratos" || tab === "firma") return hrefAltaTrabajador(relacionId);
  if (tab === "documentos" || tab === "persona" || tab === "puesto") return hrefAltaTrabajador(relacionId, tab);
  if (esPasoAltaSistemas(tab)) return hrefAltaTrabajador(relacionId, "alta");
  return `/trabajadores/${relacionId}?tab=${tab}`;
}

export function hrefSiguientePaso(relacionId: string, siguiente: SiguientePaso): string {
  if (siguiente.paso === "listo") return hrefFichaTrabajador(relacionId);
  if (siguiente.paso === "alta" || esPasoAltaSistemas(siguiente.tab)) {
    return hrefAltaTrabajador(relacionId, "alta");
  }
  if (siguiente.paso === "contratos" || siguiente.tab === "contratos" || siguiente.tab === "firma") {
    return hrefAltaTrabajador(relacionId);
  }
  if (esTabFicha(siguiente.tab)) return hrefAltaTrabajador(relacionId, siguiente.tab);
  return hrefPasoTrabajador(relacionId, siguiente.tab);
}

export function hrefListaProceso(tab: FlujoTab, entidadId: string): string | null {
  if (tab === "vida-ley") return `/vida-ley?entidadId=${entidadId}`;
  if (tab === "asistencia") return `/asistencias?entidadId=${entidadId}`;
  if (tab === "vacaciones") return `/vacaciones?entidadId=${entidadId}`;
  if (tab === "contratos" || tab === "firma" || esPasoAltaSistemas(tab)) return `/contratos?entidadId=${entidadId}`;
  return null;
}

export function enlaceProcesoPendiente(relacionId: string, siguiente: SiguientePaso): EnlaceProceso | null {
  if (siguiente.paso === "listo") return null;
  return { href: hrefSiguientePaso(relacionId, siguiente), etiqueta: siguiente.etiqueta };
}

export function enlaceProcesoOperativo(input: {
  entidadId: string;
  relacionId?: string;
  esEstudio: boolean;
  estado: string;
  validacion: EstadoValidacionAltaPlanilla;
  fechaIngreso: string | null;
  fechaCese: string | null;
  pension?: FlujoPension | null;
  tRegistro?: FlujoTRegistro[];
  documentos?: FlujoDocumento[];
  contratoCerrado?: boolean;
  vidaLey: { estado?: string | null; fecha_fin?: string | null } | null;
  pdfAsistenciaMes: boolean;
  diasVacacionPeriodo: number;
  mes: string;
  periodo: number;
  hoy: string;
  limite: string;
}): EnlaceProceso | null {
  if (input.estado !== "ACTIVA") return null;
  if (input.esEstudio && input.validacion !== "PENDIENTE") {
    const afiliacionCargada =
      input.pension !== undefined || input.tRegistro !== undefined || input.documentos !== undefined;
    const afiliacion = {
      pension: input.pension ?? null,
      tRegistro: input.tRegistro ?? [],
      documentos: input.documentos ?? [],
    };
    if (afiliacionCargada && input.contratoCerrado && input.relacionId && !pensionAltaLista(afiliacion)) {
      return { href: hrefAltaTrabajador(input.relacionId, "alta"), etiqueta: "Dar de alta AFP y T-Registro" };
    }
    if (afiliacionCargada && input.contratoCerrado && input.relacionId && !tRegistroAltaLista(afiliacion)) {
      return { href: hrefAltaTrabajador(input.relacionId, "alta"), etiqueta: "Dar de alta T-Registro" };
    }
    if (!afiliacionCargada || altasAfiliacionListas(afiliacion)) {
      const etapa = resolverEtapaVidaLey(input.vidaLey, { hoy: input.hoy, limite: input.limite });
      if (etapa.pendiente) {
        return { href: `/vida-ley?entidadId=${input.entidadId}`, etiqueta: etapa.etiqueta };
      }
    }
  }
  if (trabajadorActivoEnMes(input.mes, input.fechaIngreso, input.fechaCese) && !input.pdfAsistenciaMes) {
    return { href: `/asistencias?entidadId=${input.entidadId}`, etiqueta: "Falta PDF firmado del mes" };
  }
  if (tieneDerechoVacaciones(input.fechaIngreso)) {
    const saldo = saldoVacaciones(input.diasVacacionPeriodo);
    if (saldo > 0) {
      return {
        href: `/vacaciones?entidadId=${input.entidadId}`,
        etiqueta:
          input.diasVacacionPeriodo === 0
            ? `Sin vacaciones registradas en ${input.periodo}`
            : `Quedan ${saldo} día${saldo === 1 ? "" : "s"} de goce en ${input.periodo}`,
      };
    }
  }
  return null;
}

export const HORIZONTE_VENCIMIENTO_DIAS = 30;

export const ETAPAS_CONTRATO = [
  "alta",
  "generar",
  "firmar",
  "confirmar",
  "validar",
  "recoger",
  "afp",
  "t-registro",
  "vence",
  "revisar",
  "listo",
] as const;

export type EtapaContratoId = (typeof ETAPAS_CONTRATO)[number];

export type EtapaContrato = {
  id: EtapaContratoId;
  etiqueta: string;
  tab: FlujoTab;
  rol: SiguientePaso["rol"];
  pendiente: boolean;
};

export const ETAPA_CONTRATO_FILTRO_LABEL: Record<EtapaContratoId | "pendientes", string> = {
  pendientes: "Pendientes",
  alta: "Alta incompleta",
  generar: "Generar",
  firmar: "Subir firmado",
  confirmar: "Confirmar datos",
  validar: "Validar alta",
  recoger: "Marcar recogido",
  afp: "Dar de alta",
  "t-registro": "Alta T-Registro",
  vence: "Por vencer",
  revisar: "Revisar",
  listo: "Recogido",
};

export function parseEtapaContratoFiltro(value: string | undefined): EtapaContratoId | "pendientes" | "todos" {
  if (value === "pendientes") return "pendientes";
  return ETAPAS_CONTRATO.some((etapa) => etapa === value) ? (value as EtapaContratoId) : "todos";
}

export function resolverEtapaContrato(
  trabajador: Parameters<typeof flujoDesdeTrabajador>[0],
  esEstudio: boolean,
  opts?: { hoy?: string; limite?: string },
): EtapaContrato {
  const flujo = flujoDesdeTrabajador(trabajador);
  const pasos = estadoPasosAlta(flujo);
  const borrador = contratoBorrador(flujo.contratos);
  const confirmado = contratoConfirmado(flujo.contratos);
  const vigente = confirmado ?? contratoVigente(flujo.contratos);
  const firmado = documentoCargado(flujo.documentos, "CONTRATO_FIRMADO");

  if (!pasos.persona) {
    return { id: "alta", etiqueta: "Falta completar persona para generar el contrato", tab: "persona", rol: "empresa", pendiente: true };
  }
  if (!pasos.puesto) {
    return { id: "alta", etiqueta: "Falta completar puesto para generar el contrato", tab: "puesto", rol: "empresa", pendiente: true };
  }
  if (!borrador && !confirmado) {
    return { id: "generar", etiqueta: "Falta generar el documento de contrato", tab: "contratos", rol: "empresa", pendiente: true };
  }
  if (borrador && !firmado) {
    return { id: "firmar", etiqueta: "Contrato generado: falta subir el firmado", tab: "contratos", rol: "empresa", pendiente: true };
  }
  if (borrador && firmado) {
    return { id: "confirmar", etiqueta: "Falta confirmar datos del contrato firmado", tab: "contratos", rol: "empresa", pendiente: true };
  }
  if (flujo.validacion === "PENDIENTE") {
    return esEstudio
      ? { id: "validar", etiqueta: "Alta pendiente de validación", tab: "contratos", rol: "estudio", pendiente: true }
      : { id: "validar", etiqueta: "Contrato en revisión del estudio", tab: "contratos", rol: "empresa", pendiente: true };
  }
  if (vigente?.estado === "ELABORADO" && firmado) {
    return esEstudio
      ? { id: "recoger", etiqueta: "Contrato firmado: falta marcar recogido", tab: "contratos", rol: "estudio", pendiente: true }
      : { id: "recoger", etiqueta: "Contrato en revisión del estudio", tab: "contratos", rol: "empresa", pendiente: true };
  }
  if (!pensionAltaLista(flujo)) {
    return esEstudio
      ? { id: "afp", etiqueta: "Falta dar de alta AFP y T-Registro", tab: "alta", rol: "estudio", pendiente: true }
      : { id: "afp", etiqueta: "En alta AFP y T-Registro del estudio", tab: "alta", rol: "empresa", pendiente: true };
  }
  if (!tRegistroAltaLista(flujo)) {
    return esEstudio
      ? { id: "t-registro", etiqueta: "Falta dar de alta T-Registro", tab: "alta", rol: "estudio", pendiente: true }
      : { id: "t-registro", etiqueta: "En alta T-Registro del estudio", tab: "alta", rol: "empresa", pendiente: true };
  }

  const hoy = opts?.hoy ?? new Date().toISOString().slice(0, 10);
  if (vigente?.fecha_fin && opts?.limite && vigente.fecha_fin <= opts.limite && vigente.estado !== "BAJA") {
    return {
      id: "vence",
      etiqueta: vigente.fecha_fin < hoy ? `Contrato vencido el ${vigente.fecha_fin}` : `Contrato vence el ${vigente.fecha_fin}`,
      tab: "contratos",
      rol: "empresa",
      pendiente: true,
    };
  }
  if (vigente && vigente.estado !== "RECOGIDO" && vigente.estado !== "COMPLETO") {
    return {
      id: "revisar",
      etiqueta: `Contrato: ${ESTADO_CONTRATO_LABEL[vigente.estado]}`,
      tab: "contratos",
      rol: "empresa",
      pendiente: true,
    };
  }
  const alertaDocs = etiquetaAlertaDocumentos(flujo);
  if (alertaDocs) {
    return { id: "alta", etiqueta: alertaDocs, tab: "documentos", rol: "alerta", pendiente: true };
  }
  return { id: "listo", etiqueta: "Recogido", tab: "contratos", rol: "hecho", pendiente: false };
}

export function claseBadgePaso(rol: SiguientePaso["rol"]): string {
  if (rol === "alerta") return "bg-amber-100 text-amber-950 ring-1 ring-amber-400";
  if (rol === "estudio") return "bg-amber-100 text-amber-950";
  if (rol === "hecho") return "bg-emerald-100 text-emerald-950";
  return "bg-sky-100 text-sky-950";
}

export function flujoDesdeTrabajador(input: {
  cargo: string | null;
  clasificacion?: string | null;
  jornada?: string | null;
  horario: string | null;
  fecha_ingreso?: string | null;
  recibe_asignacion_familiar?: boolean | null;
  persona: {
    nombres: string;
    apellido_paterno?: string | null;
    apellido_materno?: string | null;
    fecha_nacimiento?: string | null;
    celular?: string | null;
    correo?: string | null;
    direccion: string | null;
    tipo_via?: string | null;
    via_nombre?: string | null;
    region?: string | null;
    provincia?: string | null;
    distrito?: string | null;
  };
  validacion: EstadoValidacionAltaPlanilla;
  contratos: FlujoContrato[];
  documentos: FlujoDocumento[];
  pension?: FlujoPension | null;
  tRegistro?: FlujoTRegistro[];
}): FlujoFichaInput {
  return {
    nombres: input.persona.nombres,
    apellidoPaterno: input.persona.apellido_paterno ?? null,
    apellidoMaterno: input.persona.apellido_materno ?? null,
    fechaNacimiento: input.persona.fecha_nacimiento ?? null,
    celular: input.persona.celular ?? null,
    correo: input.persona.correo ?? null,
    direccion: input.persona.direccion,
    tipoVia: input.persona.tipo_via ?? null,
    viaNombre: input.persona.via_nombre ?? null,
    region: input.persona.region ?? null,
    provincia: input.persona.provincia ?? null,
    distrito: input.persona.distrito ?? null,
    cargo: input.cargo,
    clasificacion: input.clasificacion ?? null,
    jornada: input.jornada ?? null,
    horario: input.horario,
    fechaIngreso: input.fecha_ingreso ?? null,
    recibeAsignacionFamiliar: input.recibe_asignacion_familiar ?? null,
    validacion: input.validacion,
    contratos: input.contratos,
    documentos: input.documentos,
    pension: input.pension ?? null,
    tRegistro: input.tRegistro ?? [],
  };
}
