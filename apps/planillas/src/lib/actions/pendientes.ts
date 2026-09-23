"use server";

import { entidadAlcance, puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import { esMesAsistencia, mesActualLima, trabajadorActivoEnMes } from "@/lib/horario-asistencia";
import {
  formatFechaPlanilla,
  nombreCompleto,
  resolverEtapaVidaLey,
  type EtapaVidaLeyId,
  type PendienteItem,
} from "@/lib/planillas-labels";
import {
  altasAfiliacionListas,
  flujoDesdeTrabajador,
  hrefPasoTrabajador,
  resolverEtapaContrato,
  HORIZONTE_VENCIMIENTO_DIAS,
  type EtapaContratoId,
  type FlujoTab,
} from "@/lib/flujo-ficha";
import { planillasDb } from "@/lib/supabase/planillas";
import { anioActualLima, saldoVacaciones, tieneDerechoVacaciones } from "@/lib/vacaciones";

const HORIZONTE_DIAS = HORIZONTE_VENCIMIENTO_DIAS;

export type ControlEmpresa = {
  contratos: PendienteItem[];
  vidaLey: PendienteItem[];
  asistencia: PendienteItem[];
  vacaciones: PendienteItem[];
};

export type ColorPendiente = "gris" | "ambar" | "rojo" | "verde";

export type CeldaPendiente = {
  color: ColorPendiente;
  texto: string;
  titulo: string;
  href?: string;
};

export type ColumnaPendienteId = "contrato" | "vidaLey" | "asistencia" | "vacaciones";

export type FilaPendienteTrabajador = {
  id: string;
  dni: string;
  nombre: string;
  cargo: string | null;
  cesada: boolean;
  celdas: Record<ColumnaPendienteId, CeldaPendiente>;
};

const CONTRATO_CORTO: Record<EtapaContratoId, string> = {
  alta: "Alta",
  generar: "Generar",
  firmar: "Firmar",
  confirmar: "Confirmar",
  validar: "Validar",
  recoger: "Recoger",
  afp: "AFP",
  "t-registro": "T-Reg.",
  vence: "Vence",
  revisar: "Revisar",
  listo: "Listo",
};

const VIDA_LEY_CORTO: Record<EtapaVidaLeyId, string> = {
  sin: "Sin",
  elaborado: "Docs",
  recepcionado: "Envío",
  vence: "Vence",
  registrado: "Listo",
};

function celdaPendiente(
  color: ColorPendiente,
  texto: string,
  titulo: string,
  href?: string,
): CeldaPendiente {
  return href ? { color, texto, titulo, href } : { color, texto, titulo };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function baseDe(trabajador: { id: string; persona: { dni: string; nombres: string; apellido_paterno: string | null; apellido_materno: string | null } }) {
  return {
    relacionId: trabajador.id,
    dni: trabajador.persona.dni,
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
  const hoy = todayIso();
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
        nombre: base.nombre,
        cargo: trabajador.cargo,
        cesada: true,
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
    const celdaContrato = celdaPendiente(
      contrato.pendiente ? (contrato.id === "vence" ? "rojo" : "ambar") : "verde",
      contrato.pendiente ? CONTRATO_CORTO[contrato.id] : "Listo",
      contrato.etiqueta,
      paso(contrato.tab),
    );

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
      celdaVida = celdaPendiente(
        etapa.pendiente ? (etapa.id === "vence" ? "rojo" : "ambar") : "verde",
        etapa.pendiente ? VIDA_LEY_CORTO[etapa.id] : "Listo",
        etapa.etiqueta,
        paso("vida-ley"),
      );
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
      nombre: base.nombre,
      cargo: trabajador.cargo,
      cesada: false,
      celdas: {
        contrato: celdaContrato,
        vidaLey: celdaVida,
        asistencia: celdaAsistencia,
        vacaciones: celdaVacaciones,
      },
    });
  }

  const porNombre = (a: PendienteItem, b: PendienteItem) => a.nombre.localeCompare(b.nombre, "es");
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
