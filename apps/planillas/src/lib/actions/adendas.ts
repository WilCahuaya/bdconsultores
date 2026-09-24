"use server";

import { revalidatePath } from "next/cache";
import type { EstadoContratoPlanilla, JornadaLaboral, TipoAdendaPlanilla } from "@inventario/types";
import { puedeEditarFichaLaboral, puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { getTrabajador, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { pathPerteneceAlDocumento } from "@/lib/documento-storage";
import { horarioEstaCompleto } from "@/lib/horario-laboral";
import { parseCargoCampo, parseFechaCampo } from "@/lib/planillas-labels";
import { planillasDb } from "@/lib/supabase/planillas";

export type AdendaRow = {
  id: string;
  contrato_id: string;
  numero: number;
  tipo: TipoAdendaPlanilla;
  fecha_vigencia: string;
  fecha_suscripcion: string;
  cargo_anterior: string | null;
  cargo_nuevo: string | null;
  remuneracion_anterior: number | null;
  remuneracion_nueva: number | null;
  horario_anterior: string | null;
  horario_nuevo: string | null;
  jornada_anterior: JornadaLaboral | null;
  jornada_nueva: JornadaLaboral | null;
  estado: EstadoContratoPlanilla;
  datos_confirmados: boolean;
  storage_path: string | null;
};

const ADENDA_SELECT =
  "id, contrato_id, numero, tipo, fecha_vigencia, fecha_suscripcion, cargo_anterior, cargo_nuevo, remuneracion_anterior, remuneracion_nueva, horario_anterior, horario_nuevo, jornada_anterior, jornada_nueva, estado, datos_confirmados, storage_path";

function adendaCerrada(estado: EstadoContratoPlanilla): boolean {
  return estado === "RECOGIDO" || estado === "BAJA" || estado === "COMPLETO";
}

async function assertEscrituraFicha(
  relacionId: string,
): Promise<{ error: string } | { trabajador: TrabajadorListItem }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para editar." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };
  return { trabajador };
}

function revalidar(relacionId: string) {
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath("/contratos");
  revalidatePath("/pendientes");
  revalidatePath("/");
}

export async function listAdendas(relacionId: string): Promise<AdendaRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("adendas")
    .select(ADENDA_SELECT)
    .eq("relacion_id", relacionId)
    .neq("estado", "BAJA")
    .order("numero", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdendaRow[];
}

export async function generarAdenda(
  relacionId: string,
  formData: FormData,
  adendaId?: string,
): Promise<{ error?: string; adendaId?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const trabajador = gate.trabajador;

  const tipo = String(formData.get("tipo") ?? "").trim();
  if (tipo !== "CARGO" && tipo !== "REMUNERACION" && tipo !== "HORARIO") {
    return { error: "Elija si la adenda cambia cargo, sueldo u horario." };
  }
  const fechaVigencia = parseFechaCampo(String(formData.get("fecha_vigencia") ?? ""), "Fecha de vigencia");
  if (fechaVigencia.error) return { error: fechaVigencia.error };
  if (!fechaVigencia.value) return { error: "Indique desde cuándo rige la adenda." };
  const fechaSuscripcion = parseFechaCampo(String(formData.get("fecha_suscripcion") ?? ""), "Fecha de suscripción");
  if (fechaSuscripcion.error) return { error: fechaSuscripcion.error };
  if (!fechaSuscripcion.value) return { error: "Indique la fecha en que se suscribe la adenda." };

  const cargoActual = trabajador.cargo?.trim() || null;
  if (!cargoActual) return { error: "El trabajador no tiene cargo vigente." };

  const campos: Record<string, unknown> = {
    tipo,
    fecha_vigencia: fechaVigencia.value,
    fecha_suscripcion: fechaSuscripcion.value,
    cargo_anterior: cargoActual,
    cargo_nuevo: null,
    remuneracion_anterior: trabajador.remuneracion,
    remuneracion_nueva: null,
    horario_anterior: trabajador.horario,
    horario_nuevo: null,
    jornada_anterior: trabajador.jornada,
    jornada_nueva: null,
    datos_confirmados: false,
  };

  if (tipo === "CARGO") {
    const cargo = parseCargoCampo(String(formData.get("cargo") ?? ""), null);
    if (cargo.error || !cargo.value) return { error: cargo.error ?? "Elija el cargo nuevo." };
    if (cargo.value === cargoActual) return { error: "El cargo nuevo es el mismo que el vigente." };
    campos.cargo_nuevo = cargo.value;
  } else if (tipo === "REMUNERACION") {
    const remuneracion = Number(formData.get("remuneracion") || 0);
    if (!Number.isFinite(remuneracion) || remuneracion <= 0) return { error: "Indique la remuneración nueva." };
    if (trabajador.remuneracion != null && remuneracion === Number(trabajador.remuneracion)) {
      return { error: "La remuneración nueva es la misma que la vigente." };
    }
    campos.remuneracion_nueva = remuneracion;
  } else {
    const jornada = String(formData.get("jornada") ?? "").trim();
    if (jornada !== "TIEMPO_COMPLETO" && jornada !== "TIEMPO_PARCIAL") {
      return { error: "Elija tiempo completo o parcial." };
    }
    const horario = String(formData.get("horario") ?? "").trim();
    if (!horarioEstaCompleto(horario)) return { error: "Complete el horario nuevo." };
    if (horario === (trabajador.horario ?? "") && jornada === trabajador.jornada) {
      return { error: "El horario nuevo es el mismo que el vigente." };
    }
    campos.horario_nuevo = horario;
    campos.jornada_nueva = jornada;
  }

  const db = await planillasDb();
  const { data: contrato, error: contratoError } = await db
    .from("contratos")
    .select("id, fecha_inicio, jornada, datos_confirmados, es_vigente, estado")
    .eq("relacion_id", relacionId)
    .eq("es_vigente", true)
    .eq("datos_confirmados", true)
    .neq("estado", "BAJA")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (contratoError) return { error: contratoError.message };
  if (!contrato?.fecha_inicio || (contrato.jornada !== "TIEMPO_COMPLETO" && contrato.jornada !== "TIEMPO_PARCIAL")) {
    return { error: "Confirme el contrato vigente antes de generar una adenda." };
  }

  const { data: existentes, error: listError } = await db
    .from("adendas")
    .select("id, numero, estado, datos_confirmados")
    .eq("relacion_id", relacionId)
    .order("numero", { ascending: false });
  if (listError) return { error: listError.message };

  const abierto = (existentes ?? []).find((row) => !adendaCerrada(row.estado as EstadoContratoPlanilla));
  const destino = adendaId ? (existentes ?? []).find((row) => row.id === adendaId) : abierto;
  if (adendaId && !destino) return { error: "Adenda no encontrada." };
  if (destino && adendaCerrada(destino.estado as EstadoContratoPlanilla)) {
    return { error: "Esta adenda ya está cerrada." };
  }
  if (destino?.datos_confirmados) return { error: "Esta adenda ya fue confirmada." };
  if (!adendaId && abierto) return { error: "Hay una adenda sin confirmar. Ciérrela o elimínela antes de generar otra." };

  if (destino) {
    const { error } = await db.from("adendas").update(campos).eq("id", destino.id).eq("relacion_id", relacionId);
    if (error) return { error: error.message };
    if (destino.estado !== "ELABORADO") {
      const { error: estadoError } = await db
        .from("adendas")
        .update({ estado: "ELABORADO" as EstadoContratoPlanilla })
        .eq("id", destino.id)
        .eq("relacion_id", relacionId);
      if (estadoError) return { error: estadoError.message };
    }
    revalidar(relacionId);
    return { adendaId: destino.id };
  }

  const numero = ((existentes ?? [])[0]?.numero ?? 0) + 1;
  const { data: creado, error } = await db
    .from("adendas")
    .insert({
      relacion_id: relacionId,
      contrato_id: contrato.id,
      numero,
      estado: "PENDIENTE_DOCS" as EstadoContratoPlanilla,
      ...campos,
    })
    .select("id")
    .single();
  if (error || !creado) return { error: error?.message ?? "No se pudo generar la adenda." };
  const { error: estadoError } = await db
    .from("adendas")
    .update({ estado: "ELABORADO" as EstadoContratoPlanilla })
    .eq("id", creado.id)
    .eq("relacion_id", relacionId);
  if (estadoError) return { error: estadoError.message };
  revalidar(relacionId);
  return { adendaId: creado.id };
}

export async function setAdendaArchivo(
  relacionId: string,
  adendaId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  if (!pathPerteneceAlDocumento(gate.trabajador.entidad_id, relacionId, adendaId, storagePath)) {
    return { error: "Ruta de archivo no válida." };
  }
  const db = await planillasDb();
  const { data: actual, error: loadError } = await db
    .from("adendas")
    .select("id, estado, datos_confirmados")
    .eq("id", adendaId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!actual) return { error: "Adenda no encontrada." };
  if (adendaCerrada(actual.estado as EstadoContratoPlanilla) || actual.datos_confirmados) {
    return { error: "Esta adenda ya fue confirmada." };
  }
  const { error } = await db
    .from("adendas")
    .update({ storage_path: storagePath })
    .eq("id", adendaId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };
  revalidar(relacionId);
  return {};
}

export async function confirmarAdenda(relacionId: string, adendaId: string): Promise<{ error?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { data: adenda, error: loadError } = await db
    .from("adendas")
    .select(ADENDA_SELECT)
    .eq("id", adendaId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!adenda) return { error: "Adenda no encontrada." };
  const row = adenda as AdendaRow;
  if (adendaCerrada(row.estado)) return { error: "Esta adenda ya está cerrada." };
  if (row.datos_confirmados) return {};
  if (!row.storage_path) return { error: "Suba el PDF firmado antes de confirmar la adenda." };

  const { error } = await db
    .from("adendas")
    .update({ datos_confirmados: true })
    .eq("id", adendaId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };

  if (row.tipo === "CARGO" && row.cargo_nuevo) {
    const { error: relError } = await db
      .from("relaciones_laborales")
      .update({ cargo: row.cargo_nuevo })
      .eq("id", relacionId);
    if (relError) return { error: relError.message };
  }
  if (row.tipo === "HORARIO" && row.horario_nuevo && row.jornada_nueva) {
    const { error: relError } = await db
      .from("relaciones_laborales")
      .update({ horario: row.horario_nuevo, jornada: row.jornada_nueva })
      .eq("id", relacionId);
    if (relError) return { error: relError.message };
  }

  revalidar(relacionId);
  return {};
}

export async function marcarAdendaRecogida(relacionId: string, adendaId: string): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) return { error: "No tiene permiso para marcar la adenda como recogida." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };

  const db = await planillasDb();
  const { data: adenda, error: loadError } = await db
    .from("adendas")
    .select("id, estado, datos_confirmados, storage_path")
    .eq("id", adendaId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!adenda) return { error: "Adenda no encontrada." };
  if (adenda.estado === "RECOGIDO") return {};
  if (adenda.estado !== "ELABORADO") return { error: "Primero hay que generar el documento." };
  if (!adenda.datos_confirmados) return { error: "Confirme el PDF firmado antes de marcarla como recogida." };
  if (!adenda.storage_path) return { error: "Suba el PDF firmado antes de marcarla como recogida." };

  const { error } = await db
    .from("adendas")
    .update({ estado: "RECOGIDO" as EstadoContratoPlanilla })
    .eq("id", adendaId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };
  revalidar(relacionId);
  return {};
}

export async function eliminarAdenda(relacionId: string, adendaId: string): Promise<{ error?: string }> {
  const gate = await assertEscrituraFicha(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { data: adenda, error: loadError } = await db
    .from("adendas")
    .select("id, estado, datos_confirmados")
    .eq("id", adendaId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!adenda) return { error: "Adenda no encontrada." };
  if (adendaCerrada(adenda.estado as EstadoContratoPlanilla)) return { error: "Esta adenda ya está cerrada." };
  if (adenda.datos_confirmados) return { error: "Esta adenda ya fue confirmada. No se puede eliminar." };

  const { error } = await db
    .from("adendas")
    .update({ estado: "BAJA" as EstadoContratoPlanilla, datos_confirmados: false })
    .eq("id", adendaId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };
  revalidar(relacionId);
  return {};
}
