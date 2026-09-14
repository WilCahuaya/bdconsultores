"use server";

import type { EstadoContratoPlanilla } from "@inventario/types";
import { entidadAlcance, puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import { esMesAsistencia, mesActualLima, trabajadorActivoEnMes } from "@/lib/horario-asistencia";
import {
  ESTADO_CONTRATO_LABEL,
  nombreCompleto,
  vidaLeyPendienteRecepcion,
  type PendienteItem,
} from "@/lib/planillas-labels";
import {
  contratoBorrador,
  contratoConfirmado,
  contratoVigente,
  documentoCargado,
  estadoPasosAlta,
  flujoDesdeTrabajador,
} from "@/lib/flujo-ficha";
import { planillasDb } from "@/lib/supabase/planillas";
import { anioActualLima, saldoVacaciones, tieneDerechoVacaciones } from "@/lib/vacaciones";

const HORIZONTE_DIAS = 30;

export type ControlEmpresa = {
  contratos: PendienteItem[];
  vidaLey: PendienteItem[];
  asistencia: PendienteItem[];
  vacaciones: PendienteItem[];
};

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

function detalleContrato(
  trabajador: Parameters<typeof flujoDesdeTrabajador>[0],
  esEstudio: boolean,
): { detalle: string; tab: PendienteItem["tab"] } | null {
  const flujo = flujoDesdeTrabajador(trabajador);
  const pasos = estadoPasosAlta(flujo);
  const borrador = contratoBorrador(flujo.contratos);
  const confirmado = contratoConfirmado(flujo.contratos);
  const vigente = confirmado ?? contratoVigente(flujo.contratos);
  const firmado = documentoCargado(flujo.documentos, "CONTRATO_FIRMADO");

  if (!pasos.documentos) return { detalle: "Falta documentos para generar el contrato", tab: "documentos" };
  if (!pasos.persona) return { detalle: "Falta completar persona para generar el contrato", tab: "persona" };
  if (!pasos.puesto) return { detalle: "Falta completar puesto para generar el contrato", tab: "puesto" };
  if (!borrador && !confirmado) return { detalle: "Falta generar el documento de contrato", tab: "contratos" };
  if (borrador && !firmado) return { detalle: "Contrato generado: falta subir el firmado", tab: "contratos" };
  if (borrador && firmado) return { detalle: "Falta confirmar datos del contrato firmado", tab: "contratos" };
  if (flujo.validacion === "PENDIENTE") {
    return esEstudio
      ? { detalle: "Alta pendiente de validación", tab: "persona" }
      : { detalle: "Contrato en revisión del estudio", tab: "contratos" };
  }
  if (vigente?.estado === "ELABORADO" && firmado) {
    return esEstudio
      ? { detalle: "Contrato firmado: falta marcar recogido", tab: "contratos" }
      : { detalle: "Contrato en revisión del estudio", tab: "contratos" };
  }
  return null;
}

export async function listControlEmpresa(entidadId: string): Promise<ControlEmpresa> {
  const profile = await requirePlanillasProfile();
  const alcance = entidadAlcance(profile);
  const vacio: ControlEmpresa = { contratos: [], vidaLey: [], asistencia: [], vacaciones: [] };
  if (alcance !== "todas" && alcance !== entidadId) return vacio;

  const esEstudio = puedeEscribirPlanillas(profile);
  const trabajadores = await listTrabajadores(entidadId);
  if (trabajadores.length === 0) return vacio;

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

  for (const trabajador of trabajadores) {
    const base = baseDe(trabajador);
    const activa = trabajador.estado === "ACTIVA";

    if (activa) {
      const contrato = detalleContrato(trabajador, esEstudio);
      if (contrato) {
        contratos.push({
          ...base,
          id: `${trabajador.id}:contrato`,
          tipo: "contrato",
          detalle: contrato.detalle,
          tab: contrato.tab,
        });
      } else {
        const vigente = contratoVigente(flujoDesdeTrabajador(trabajador).contratos);
        const estado = vigente?.estado as EstadoContratoPlanilla | undefined;
        if (vigente?.fecha_fin && vigente.fecha_fin <= limite && estado !== "BAJA") {
          contratos.push({
            ...base,
            id: `${trabajador.id}:contrato:vence`,
            tipo: "contrato",
            detalle:
              vigente.fecha_fin < hoy
                ? `Contrato vencido el ${vigente.fecha_fin}`
                : `Contrato vence el ${vigente.fecha_fin}`,
            tab: "contratos",
          });
        } else if (vigente && estado && estado !== "RECOGIDO" && estado !== "COMPLETO") {
          contratos.push({
            ...base,
            id: `${trabajador.id}:contrato:${estado}`,
            tipo: "contrato",
            detalle: `Contrato: ${ESTADO_CONTRATO_LABEL[estado]}`,
            tab: "contratos",
          });
        }
      }

      if (esEstudio && trabajador.validacion !== "PENDIENTE") {
        const registro = vidaLeyPorId.get(trabajador.id);
        if (!registro) {
          vidaLey.push({
            ...base,
            id: `${trabajador.id}:vidaley:sin`,
            tipo: "vida-ley",
            detalle: "Sin Vida Ley",
            tab: "vida-ley",
          });
        } else if (vidaLeyPendienteRecepcion(registro.estado)) {
          vidaLey.push({
            ...base,
            id: `${trabajador.id}:vidaley:docs`,
            tipo: "vida-ley",
            detalle: registro.estado?.trim()
              ? "Falta documentos de la aseguradora"
              : "Vida Ley sin estado",
            tab: "vida-ley",
          });
        } else if (registro.fecha_fin && registro.fecha_fin <= limite) {
          vidaLey.push({
            ...base,
            id: `${trabajador.id}:vidaley:vence`,
            tipo: "vida-ley",
            detalle:
              registro.fecha_fin < hoy
                ? `Vida Ley vencida el ${registro.fecha_fin}`
                : `Vida Ley vence el ${registro.fecha_fin}`,
            tab: "vida-ley",
          });
        }
      }

      if (trabajadorActivoEnMes(mes, trabajador.fecha_ingreso, trabajador.fecha_cese) && !pdfAsistencia.has(trabajador.id)) {
        asistencia.push({
          ...base,
          id: `${trabajador.id}:asistencia:${mes}`,
          tipo: "asistencia",
          detalle: "Falta PDF firmado del mes",
          tab: "asistencia",
        });
      }

      if (tieneDerechoVacaciones(trabajador.fecha_ingreso)) {
        const tomados = diasVacacion.get(trabajador.id) ?? 0;
        const saldo = saldoVacaciones(tomados);
        if (saldo > 0) {
          vacaciones.push({
            ...base,
            id: `${trabajador.id}:vacaciones:${periodo}`,
            tipo: "vacaciones",
            detalle:
              tomados === 0
                ? `Sin vacaciones registradas en ${periodo}`
                : `Quedan ${saldo} día${saldo === 1 ? "" : "s"} de goce en ${periodo}`,
            tab: "vacaciones",
          });
        }
      }
    }
  }

  const porNombre = (a: PendienteItem, b: PendienteItem) => a.nombre.localeCompare(b.nombre, "es");
  contratos.sort(porNombre);
  vidaLey.sort(porNombre);
  asistencia.sort(porNombre);
  vacaciones.sort(porNombre);
  return { contratos, vidaLey, asistencia, vacaciones };
}

export async function listPendientes(entidadId: string): Promise<PendienteItem[]> {
  const control = await listControlEmpresa(entidadId);
  return [...control.contratos, ...control.vidaLey, ...control.asistencia, ...control.vacaciones];
}
