"use server";

import { entidadAlcance, puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { listTrabajadores, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { cargoSigla } from "@/lib/cargos-funciones";
import { esMesAsistencia, hoyIsoLima, MES_ABREV, mesActualLima, trabajadorActivoEnMes } from "@/lib/horario-asistencia";
import {
  ASIGNACION_FAMILIAR_SOLES,
  formatFechaPlanilla,
  formatRemuneracion,
  nombreCompleto,
  remuneracionBruta,
  resolverEtapaVidaLey,
  TIEMPO_LABEL,
  type PendienteItem,
} from "@/lib/planillas-labels";
import {
  altasAfiliacionListas,
  contratoMasReciente,
  documentoCargado,
  estadoVisibleContrato,
  flujoDesdeTrabajador,
  hrefPasoTrabajador,
  resolverEtapaContrato,
  tRegistroAltaLista,
  HORIZONTE_VENCIMIENTO_DIAS,
  type EtiquetaEstadoContratoTabla,
  type FlujoContrato,
  type FlujoDocumento,
  type FlujoTab,
} from "@/lib/flujo-ficha";
import { planillasDb } from "@/lib/supabase/planillas";
import { contratoFueGenerado } from "@/lib/tablero";
import { anioActualLima, saldoVacaciones, tieneDerechoVacaciones } from "@/lib/vacaciones";

const HORIZONTE_DIAS = HORIZONTE_VENCIMIENTO_DIAS;

export type ControlEmpresa = {
  contratos: PendienteItem[];
  vidaLey: PendienteItem[];
  asistencia: PendienteItem[];
  vacaciones: PendienteItem[];
};

export type ColorPendiente = "gris" | "ambar" | "rojo" | "verde" | "azul";

export type MarcaPendiente = {
  color: ColorPendiente;
  texto: string;
  titulo: string;
};

export type CeldaPendiente = {
  color: ColorPendiente;
  texto: string;
  titulo: string;
  href?: string;
  marcas?: MarcaPendiente[];
};

export type ColumnaPendienteId = "contrato" | "vidaLey" | "asistencia" | "vacaciones";

export type ContratoGeneradoAviso = {
  inicio: string;
  fin: string;
};

export type DatosLaboralesFila = {
  cargoSigla: string;
  cargoTitulo: string;
  mesInicio: string;
  fechaIngreso: string;
  fechaCese: string;
  ceseAlerta: boolean;
  ceseTitulo: string;
  contratoGenerado: ContratoGeneradoAviso | null;
  tiempo: string;
  remuneracion: string;
  asignacion: string;
  bruta: string;
};

export type FilaPendienteTrabajador = {
  id: string;
  dni: string;
  numero: number | null;
  nombre: string;
  cargo: string | null;
  cesada: boolean;
  laboral: DatosLaboralesFila;
  celdas: Record<ColumnaPendienteId, CeldaPendiente>;
};

const TITULO_ESTADO_CONTRATO: Record<EtiquetaEstadoContratoTabla, string> = {
  Elaborado: "Contrato elaborado. Falta el PDF firmado o la solicitud de registro.",
  Validado: "Contrato validado con PDF firmado o solicitud de registro.",
  Alta: "Alta en T-Registro.",
};

function celdaPendiente(
  color: ColorPendiente,
  texto: string,
  titulo: string,
  href?: string,
  marcas?: MarcaPendiente[],
): CeldaPendiente {
  return href ? { color, texto, titulo, href, marcas } : { color, texto, titulo, marcas };
}

function celdaVidaLeyTrabajador(
  trabajador: TrabajadorListItem,
  registro: { estado?: string | null; fecha_fin?: string | null } | undefined,
  href: string,
  hoy: string,
  limite: string,
): CeldaPendiente {
  const estado = registro?.estado?.trim() ?? "";
  const elaborado = estado.length > 0;
  const alta = estado === "Registrado" || estado === "Tramitado";
  const certificado = documentoCargado(trabajador.documentos, "VIDA_LEY");
  const fin = registro?.fecha_fin ?? null;
  const vencida = alta && Boolean(fin && fin <= limite);
  if (!elaborado && !certificado && !alta) {
    return celdaPendiente("ambar", "Falta", "Vida Ley sin elaborar.", href);
  }
  const marcas: MarcaPendiente[] = [];
  if (elaborado && !alta) {
    marcas.push({ color: "ambar", texto: "Elaborado", titulo: "Trámite de Vida Ley elaborado." });
  }
  if (certificado) {
    marcas.push({ color: "verde", texto: "Certificado", titulo: "Certificado de seguro subido." });
  }
  if (vencida && fin) {
    marcas.push({
      color: "rojo",
      texto: "Alta vencida",
      titulo:
        fin < hoy
          ? `Alta vencida el ${formatFechaPlanilla(fin)}.`
          : `Alta vence el ${formatFechaPlanilla(fin)}.`,
    });
  } else if (alta) {
    marcas.push({ color: "azul", texto: "Alta", titulo: "Dado de alta en el comprobante de envío." });
  }
  const color: ColorPendiente = vencida ? "rojo" : alta ? "verde" : "ambar";
  return celdaPendiente(
    color,
    marcas.map((marca) => marca.texto).join(" · "),
    marcas.map((marca) => marca.titulo).join(" "),
    href,
    marcas,
  );
}

function celdaEstadoContrato(trabajador: TrabajadorListItem): CeldaPendiente {
  const flujo = flujoDesdeTrabajador(trabajador);
  const href = hrefPasoTrabajador(trabajador.id, "contratos");
  const ultimo = contratoMasReciente(flujo.contratos);
  if (!ultimo) return celdaPendiente("ambar", "Falta", "Sin contrato elaborado.", href);
  const visible = estadoVisibleContrato(ultimo, flujo.documentos, tRegistroAltaLista(flujo));
  const color: ColorPendiente =
    visible.etiqueta === "Alta" ? "azul" : visible.etiqueta === "Validado" ? "verde" : "ambar";
  return celdaPendiente(color, visible.etiqueta, TITULO_ESTADO_CONTRATO[visible.etiqueta], href);
}

function mesInicioEmpresa(iso: string | null | undefined): string {
  if (!iso) return "—";
  const month = Number(iso.slice(5, 7));
  const abrev = MES_ABREV[month - 1];
  return abrev ? abrev.toUpperCase() : "—";
}

function contratoConRespaldo(contrato: FlujoContrato, docs: FlujoDocumento[]): boolean {
  if (contrato.solicitud_storage_path) return true;
  if (!contrato.documento_id) return false;
  return docs.some((d) => d.id === contrato.documento_id && d.estado === "SI" && Boolean(d.storage_path));
}

function resumenCese(trabajador: TrabajadorListItem, hoy: string) {
  const vivos = trabajador.contratos
    .filter((c) => c.estado !== "BAJA")
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  const conRespaldo = vivos.find((c) => contratoConRespaldo(c, trabajador.documentos));
  const generado = vivos.find((c) => contratoFueGenerado(c.estado) && !contratoConRespaldo(c, trabajador.documentos));
  const avisarGenerado = Boolean(generado && (!conRespaldo || (generado.version ?? 0) > (conRespaldo.version ?? 0)));
  const iso = conRespaldo?.fecha_fin?.slice(0, 10) ?? null;
  const alerta = Boolean(iso && iso.slice(0, 7) <= hoy.slice(0, 7));
  const fecha = formatFechaPlanilla(iso);
  let ceseTitulo = "Fin del último contrato firmado o con solicitud de registro.";
  if (!iso) ceseTitulo = "Sin contrato firmado ni solicitud de registro.";
  else if (iso < hoy) ceseTitulo = `Vencido el ${fecha}.`;
  else if (alerta) ceseTitulo = `Vence este mes, el ${fecha}.`;
  return {
    fechaCese: fecha,
    ceseAlerta: alerta,
    ceseTitulo,
    contratoGenerado:
      generado && avisarGenerado
        ? {
            inicio: formatFechaPlanilla(generado.fecha_inicio),
            fin: formatFechaPlanilla(generado.fecha_fin),
          }
        : null,
  };
}

function datosLaborales(trabajador: TrabajadorListItem, hoy: string): DatosLaboralesFila {
  const bruta = remuneracionBruta(trabajador.remuneracion, trabajador.recibe_asignacion_familiar);
  const asignacion = trabajador.recibe_asignacion_familiar === true ? ASIGNACION_FAMILIAR_SOLES : null;
  return {
    cargoSigla: cargoSigla(trabajador.cargo) || "—",
    cargoTitulo: trabajador.cargo?.trim() || "Sin cargo",
    mesInicio: mesInicioEmpresa(trabajador.fecha_ingreso),
    fechaIngreso: formatFechaPlanilla(trabajador.fecha_ingreso),
    ...resumenCese(trabajador, hoy),
    tiempo: trabajador.jornada ? TIEMPO_LABEL[trabajador.jornada] : "—",
    remuneracion: formatRemuneracion(trabajador.remuneracion),
    asignacion: formatRemuneracion(asignacion),
    bruta: formatRemuneracion(bruta),
  };
}

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function baseDe(trabajador: {
  id: string;
  numero: number | null;
  persona: { dni: string; nombres: string; apellido_paterno: string | null; apellido_materno: string | null };
}) {
  return {
    relacionId: trabajador.id,
    dni: trabajador.persona.dni,
    numero: trabajador.numero,
    nombre: nombreCompleto(trabajador.persona),
  };
}

async function cargarPendientes(entidadId: string): Promise<{
  control: ControlEmpresa;
  filas: FilaPendienteTrabajador[];
}> {
  const profile = await requirePlanillasProfile();
  const alcance = entidadAlcance(profile);
  const vacio: ControlEmpresa = { contratos: [], vidaLey: [], asistencia: [], vacaciones: [] };
  if (alcance !== "todas" && alcance !== entidadId) return { control: vacio, filas: [] };

  const esEstudio = puedeEscribirPlanillas(profile);
  const trabajadores = await listTrabajadores(entidadId);
  if (trabajadores.length === 0) return { control: vacio, filas: [] };

  const ids = trabajadores.map((t) => t.id);
  const mes = mesActualLima();
  const periodo = anioActualLima();
  const hoy = hoyIsoLima();
  const limite = plusDays(hoy, HORIZONTE_DIAS);
  const db = await planillasDb();

  const [vidaLeyRes, asistenciaRes, vacacionesRes] = await Promise.all([
    db.from("vida_ley").select("relacion_id, estado, fecha_fin").in("relacion_id", ids),
    esMesAsistencia(mes)
      ? db
          .from("documentos")
          .select("relacion_id, storage_path")
          .eq("tipo", "ASISTENCIA")
          .eq("observaciones", mes)
          .in("relacion_id", ids)
      : Promise.resolve({ data: [] as { relacion_id: string; storage_path: string | null }[], error: null }),
    db.from("vacaciones").select("relacion_id, dias").eq("periodo", periodo).in("relacion_id", ids),
  ]);

  for (const res of [vidaLeyRes, asistenciaRes, vacacionesRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const vidaLeyPorId = new Map((vidaLeyRes.data ?? []).map((row) => [row.relacion_id as string, row]));
  const pdfAsistencia = new Set(
    (asistenciaRes.data ?? [])
      .filter((row) => Boolean(row.storage_path))
      .map((row) => row.relacion_id as string),
  );
  const diasVacacion = new Map<string, number>();
  for (const row of vacacionesRes.data ?? []) {
    const id = row.relacion_id as string;
    diasVacacion.set(id, (diasVacacion.get(id) ?? 0) + Number(row.dias ?? 0));
  }

  const contratos: PendienteItem[] = [];
  const vidaLey: PendienteItem[] = [];
  const asistencia: PendienteItem[] = [];
  const vacaciones: PendienteItem[] = [];
  const filas: FilaPendienteTrabajador[] = [];

  for (const trabajador of trabajadores) {
    const base = baseDe(trabajador);
    const activa = trabajador.estado === "ACTIVA";
    const paso = (tab: FlujoTab) => hrefPasoTrabajador(trabajador.id, tab);

    if (!activa) {
      const titulo = trabajador.fecha_cese
        ? `De baja el ${formatFechaPlanilla(trabajador.fecha_cese)}`
        : "De baja";
      filas.push({
        id: trabajador.id,
        dni: base.dni,
        numero: base.numero,
        nombre: base.nombre,
        cargo: trabajador.cargo,
        cesada: true,
        laboral: datosLaborales(trabajador, hoy),
        celdas: {
          contrato: celdaPendiente("gris", "Baja", titulo),
          vidaLey: celdaPendiente("gris", "—", titulo),
          asistencia: celdaPendiente("gris", "—", titulo),
          vacaciones: celdaPendiente("gris", "—", titulo),
        },
      });
      continue;
    }

    const contrato = resolverEtapaContrato(trabajador, esEstudio, { hoy, limite });
    if (contrato.pendiente) {
      contratos.push({
        ...base,
        id: `${trabajador.id}:contrato:${contrato.id}`,
        tipo: "contrato",
        detalle: contrato.etiqueta,
        tab: contrato.tab as PendienteItem["tab"],
      });
    }
    const celdaContrato = celdaEstadoContrato(trabajador);

    let celdaVida: CeldaPendiente;
    if (
      esEstudio &&
      trabajador.validacion !== "PENDIENTE" &&
      altasAfiliacionListas(flujoDesdeTrabajador(trabajador))
    ) {
      const etapa = resolverEtapaVidaLey(vidaLeyPorId.get(trabajador.id), { hoy, limite });
      if (etapa.pendiente) {
        vidaLey.push({
          ...base,
          id: `${trabajador.id}:vidaley:${etapa.id}`,
          tipo: "vida-ley",
          detalle: etapa.etiqueta,
          tab: "vida-ley",
        });
      }
      celdaVida = celdaVidaLeyTrabajador(trabajador, vidaLeyPorId.get(trabajador.id), paso("vida-ley"), hoy, limite);
    } else {
      celdaVida = celdaPendiente("gris", "—", "Aún no corresponde.");
    }

    const activoMes = trabajadorActivoEnMes(mes, trabajador.fecha_ingreso, trabajador.fecha_cese);
    let celdaAsistencia: CeldaPendiente;
    if (!activoMes) {
      celdaAsistencia = celdaPendiente("gris", "—", "No laboró este mes.");
    } else if (pdfAsistencia.has(trabajador.id)) {
      celdaAsistencia = celdaPendiente("verde", "Listo", "PDF firmado del mes.", paso("asistencia"));
    } else {
      asistencia.push({
        ...base,
        id: `${trabajador.id}:asistencia:${mes}`,
        tipo: "asistencia",
        detalle: "Falta PDF firmado del mes",
        tab: "asistencia",
      });
      celdaAsistencia = celdaPendiente("ambar", "Falta", "Falta PDF firmado del mes.", paso("asistencia"));
    }

    let celdaVacaciones: CeldaPendiente;
    if (!tieneDerechoVacaciones(trabajador.fecha_ingreso)) {
      celdaVacaciones = celdaPendiente("gris", "—", "Aún no cumple el año para vacaciones.");
    } else {
      const tomados = diasVacacion.get(trabajador.id) ?? 0;
      const saldo = saldoVacaciones(tomados);
      if (saldo > 0) {
        const detalle =
          tomados === 0
            ? `Sin vacaciones registradas en ${periodo}`
            : `Quedan ${saldo} día${saldo === 1 ? "" : "s"} de goce en ${periodo}`;
        vacaciones.push({
          ...base,
          id: `${trabajador.id}:vacaciones:${periodo}`,
          tipo: "vacaciones",
          detalle,
          tab: "vacaciones",
        });
        celdaVacaciones = celdaPendiente("ambar", `${saldo}d`, detalle, paso("vacaciones"));
      } else {
        celdaVacaciones = celdaPendiente("verde", "Listo", `Vacaciones de ${periodo} al día.`, paso("vacaciones"));
      }
    }

    filas.push({
      id: trabajador.id,
      dni: base.dni,
      numero: base.numero,
      nombre: base.nombre,
      cargo: trabajador.cargo,
      cesada: false,
      laboral: datosLaborales(trabajador, hoy),
      celdas: {
        contrato: celdaContrato,
        vidaLey: celdaVida,
        asistencia: celdaAsistencia,
        vacaciones: celdaVacaciones,
      },
    });
  }

  const porNombre = (a: PendienteItem, b: PendienteItem) => {
    const an = a.numero ?? Number.MAX_SAFE_INTEGER;
    const bn = b.numero ?? Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return a.nombre.localeCompare(b.nombre, "es");
  };
  contratos.sort(porNombre);
  vidaLey.sort(porNombre);
  asistencia.sort(porNombre);
  vacaciones.sort(porNombre);
  return { control: { contratos, vidaLey, asistencia, vacaciones }, filas };
}

export async function listControlEmpresa(entidadId: string): Promise<ControlEmpresa> {
  return (await cargarPendientes(entidadId)).control;
}

export async function listFilasPendientesTrabajadores(entidadId: string): Promise<FilaPendienteTrabajador[]> {
  return (await cargarPendientes(entidadId)).filas;
}

export async function listPendientes(entidadId: string): Promise<PendienteItem[]> {
  const control = await listControlEmpresa(entidadId);
  return [...control.contratos, ...control.vidaLey, ...control.asistencia, ...control.vacaciones];
}
