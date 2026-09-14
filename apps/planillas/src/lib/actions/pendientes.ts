"use server";

import { entidadAlcance, puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { listTrabajadores } from "@/lib/actions/trabajadores";
import { esMesAsistencia, mesActualLima, trabajadorActivoEnMes } from "@/lib/horario-asistencia";
import { nombreCompleto, resolverEtapaVidaLey, type PendienteItem } from "@/lib/planillas-labels";
import { resolverEtapaContrato, HORIZONTE_VENCIMIENTO_DIAS } from "@/lib/flujo-ficha";
import { planillasDb } from "@/lib/supabase/planillas";
import { anioActualLima, saldoVacaciones, tieneDerechoVacaciones } from "@/lib/vacaciones";

const HORIZONTE_DIAS = HORIZONTE_VENCIMIENTO_DIAS;

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

      if (esEstudio && trabajador.validacion !== "PENDIENTE") {
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
