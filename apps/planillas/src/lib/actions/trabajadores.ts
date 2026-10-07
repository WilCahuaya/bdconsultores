"use server";

import { revalidatePath } from "next/cache";
import type {
  ClasificacionTrabajador,
  EstadoRelacionLaboral,
  EstadoValidacionAltaPlanilla,
  JornadaLaboral,
} from "@inventario/types";
import { TIPOS_DOCUMENTO_ALTA_INICIALES, esPersonalEstudio } from "@inventario/types";
import {
  entidadAlcance,
  puedeCrearTrabajador,
  puedeEditarFichaLaboral,
  puedeEscribirPlanillas,
  puedeValidarAlta,
  requirePlanillasProfile,
} from "@/lib/auth/access";
import {
  parseFechaCampo,
  parseCargoCampo,
  esDocumentoTrabajador,
  parseNumeroTrabajador,
  armarDireccionPersona,
  compareTrabajadoresPorNumero,
  nombreCompleto,
  nombresCoinciden,
} from "@/lib/planillas-labels";
import type { FlujoContrato, FlujoDocumento, FlujoPension, FlujoTRegistro } from "@/lib/flujo-ficha";
import { documentoCargado } from "@/lib/flujo-ficha";
import { DOCUMENTOS_PLANILLAS_BUCKET } from "@/lib/documento-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { planillasDb } from "@/lib/supabase/planillas";
import { createClient } from "@/lib/supabase/server";

export type PersonaRow = {
  id: string;
  dni: string;
  nombres: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  fecha_nacimiento: string | null;
  celular: string | null;
  correo: string | null;
  direccion: string | null;
  tipo_via: string | null;
  via_nombre: string | null;
  via_numero: string | null;
  referencia: string | null;
  distrito: string | null;
  provincia: string | null;
  region: string | null;
};

export type TipoBajaRelacion = "CARTA_RENUNCIA" | "TERMINO_CONTRATO";

export type RelacionRow = {
  id: string;
  persona_id: string;
  entidad_id: string;
  numero: number | null;
  cargo: string | null;
  clasificacion: ClasificacionTrabajador | null;
  jornada: JornadaLaboral | null;
  horario: string | null;
  fecha_ingreso: string | null;
  fecha_cese: string | null;
  tipo_baja: TipoBajaRelacion | null;
  observacion_baja: string | null;
  baja_afp: boolean;
  recibe_asignacion_familiar: boolean | null;
  estado: EstadoRelacionLaboral;
  validacion: EstadoValidacionAltaPlanilla;
};

export type TrabajadorListItem = RelacionRow & {
  persona: PersonaRow;
  remuneracion: number | null;
  contratos: FlujoContrato[];
  documentos: FlujoDocumento[];
  pension: FlujoPension | null;
  tRegistro: FlujoTRegistro[];
};

type ContratoEmbed = {
  remuneracion: number | null;
  es_vigente: boolean;
  version: number;
  estado: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  datos_confirmados?: boolean;
  documento_id?: string | null;
  solicitud_registro_id?: string | null;
  solicitudes_registro?: { storage_path: string | null } | { storage_path: string | null }[] | null;
};

type DocumentoEmbed = {
  id?: string;
  tipo: string;
  estado: string;
  storage_path: string | null;
};

const TRABAJADOR_SELECT =
  "id, persona_id, entidad_id, numero, cargo, clasificacion, jornada, horario, fecha_ingreso, fecha_cese, tipo_baja, observacion_baja, baja_afp, recibe_asignacion_familiar, estado, validacion, personas!persona_id (id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, celular, correo, direccion, tipo_via, via_nombre, via_numero, referencia, distrito, provincia, region), contratos (remuneracion, es_vigente, version, estado, fecha_inicio, fecha_fin, datos_confirmados, documento_id, solicitud_registro_id, solicitudes_registro (storage_path)), documentos (id, tipo, estado, storage_path), pensiones (tipo, afp_nombre, cuspp, tramite_estado, fecha_tramite), t_registro (tipo, realizado)";

function asList<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pensionDe(value: FlujoPension | FlujoPension[] | null | undefined): FlujoPension | null {
  const row = asList(value)[0];
  if (!row) return null;
  return {
    tipo: row.tipo ?? null,
    afp_nombre: row.afp_nombre ?? null,
    cuspp: row.cuspp ?? null,
    tramite_estado: row.tramite_estado ?? null,
    fecha_tramite: row.fecha_tramite ?? null,
  };
}

function remuneracionDeContratos(contratos: ContratoEmbed[] | ContratoEmbed | null | undefined): number | null {
  const list = Array.isArray(contratos) ? contratos : contratos ? [contratos] : [];
  if (list.length === 0) return null;
  const vigente =
    list.find((c) => c.es_vigente && c.datos_confirmados) ??
    list.find((c) => c.es_vigente) ??
    [...list].sort((a, b) => b.version - a.version)[0];
  return vigente?.remuneracion ?? null;
}

function normalizeDni(value: string): string {
  return value.replace(/\D/g, "").trim();
}

function mensajeErrorNumero(error: { code?: string; message?: string }): string | null {
  const message = error.message ?? "";
  if (error.code === "23505" && message.includes("relaciones_numero")) {
    return "Ya hay un trabajador con ese número en esta empresa.";
  }
  if (error.code === "23514" && message.includes("relaciones_numero_positivo")) {
    return "Use un número como 01 o 15.";
  }
  return null;
}

export async function listTrabajadores(entidadId: string): Promise<TrabajadorListItem[]> {
  const profile = await requirePlanillasProfile();
  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return [];

  const db = await planillasDb();
  const { data, error } = await db
    .from("relaciones_laborales")
    .select(TRABAJADOR_SELECT)
    .eq("entidad_id", entidadId)
    .order("fecha_ingreso", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  const items = await aplicarSueldoAdendas(
    (data ?? []).flatMap((row) => {
      const mapped = mapTrabajadorRow(row);
      return mapped ? [mapped] : [];
    }),
  );
  items.sort(compareTrabajadoresPorNumero);
  return items;
}

export async function getTrabajador(relacionId: string): Promise<TrabajadorListItem | null> {
  const profile = await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("relaciones_laborales")
    .select(TRABAJADOR_SELECT)
    .eq("id", relacionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== data.entidad_id) return null;

  const mapped = mapTrabajadorRow(data);
  if (!mapped) return null;
  const [conSueldo] = await aplicarSueldoAdendas([mapped]);
  return conSueldo ?? mapped;
}

async function aplicarSueldoAdendas(items: TrabajadorListItem[]): Promise<TrabajadorListItem[]> {
  if (items.length === 0) return items;
  const db = await planillasDb();
  const { data, error } = await db
    .from("adendas")
    .select("relacion_id, remuneracion_nueva, fecha_vigencia, created_at")
    .eq("tipo", "REMUNERACION")
    .eq("datos_confirmados", true)
    .in(
      "relacion_id",
      items.map((item) => item.id),
    );
  if (error || !data) return items;
  const orden = new Map<string, { rem: number; fecha: string; created: string }>();
  for (const row of data) {
    if (row.remuneracion_nueva == null) continue;
    const fecha = String(row.fecha_vigencia ?? "");
    const created = String(row.created_at ?? "");
    const prev = orden.get(String(row.relacion_id));
    if (!prev || fecha > prev.fecha || (fecha === prev.fecha && created > prev.created)) {
      orden.set(String(row.relacion_id), { rem: Number(row.remuneracion_nueva), fecha, created });
    }
  }
  return items.map((item) => {
    const sueldo = orden.get(item.id);
    return sueldo ? { ...item, remuneracion: sueldo.rem } : item;
  });
}

function mapTrabajadorRow(row: {
  personas?: PersonaRow | PersonaRow[] | null;
  contratos?: ContratoEmbed | ContratoEmbed[] | null;
  documentos?: DocumentoEmbed | DocumentoEmbed[] | null;
  pensiones?: FlujoPension | FlujoPension[] | null;
  t_registro?: FlujoTRegistro | FlujoTRegistro[] | null;
  [key: string]: unknown;
}): TrabajadorListItem | null {
  const persona = Array.isArray(row.personas) ? row.personas[0] : row.personas;
  if (!persona) return null;
  const { personas: _p, contratos, documentos, pensiones, t_registro, ...relacion } = row;
  const contratosList = asList(contratos).map((contrato) => {
    const { solicitudes_registro: solicitud, ...resto } = contrato;
    const anidada = Array.isArray(solicitud) ? solicitud[0] : solicitud;
    return {
      ...resto,
      solicitud_storage_path: anidada?.storage_path ?? null,
    } as FlujoContrato;
  });
  const documentosList = asList(documentos) as FlujoDocumento[];
  const tipoBaja = relacion.tipo_baja;
  return {
    ...(relacion as RelacionRow),
    tipo_baja:
      tipoBaja === "CARTA_RENUNCIA" || tipoBaja === "TERMINO_CONTRATO"
        ? tipoBaja
        : null,
    observacion_baja: (relacion.observacion_baja as string | null | undefined) ?? null,
    baja_afp: Boolean(relacion.baja_afp),
    persona: persona as PersonaRow,
    remuneracion: remuneracionDeContratos(contratos),
    contratos: contratosList,
    documentos: documentosList,
    pension: pensionDe(pensiones),
    tRegistro: asList(t_registro).map((item) => ({ tipo: item.tipo, realizado: Boolean(item.realizado) })),
  };
}

export async function createTrabajador(formData: FormData): Promise<{ error?: string; relacionId?: string; dniDocumentoId?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearTrabajador(profile)) return { error: "No tiene permiso para registrar trabajadores." };

  const entidadId = String(formData.get("entidad_id") ?? "").trim();
  const dni = normalizeDni(String(formData.get("dni") ?? ""));
  const nombres = String(formData.get("nombres") ?? "").trim();
  if (!entidadId) return { error: "Elija una empresa." };
  if (!esDocumentoTrabajador(dni)) {
    return { error: "Indique el DNI (8 dígitos) o el carné de extranjería (9 dígitos)." };
  }
  if (!nombres) return { error: "El nombre es obligatorio." };

  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return { error: "Empresa no autorizada." };

  const nacimiento = parseFechaCampo(String(formData.get("fecha_nacimiento") ?? ""), "Fecha de nacimiento");
  if (nacimiento.error) return { error: nacimiento.error };
  const ingreso = parseFechaCampo(String(formData.get("fecha_ingreso") ?? ""), "Fecha de ingreso");
  if (ingreso.error) return { error: ingreso.error };
  const cargo = parseCargoCampo(String(formData.get("cargo") ?? ""));
  if (cargo.error) return { error: cargo.error };
  const numero = parseNumeroTrabajador(String(formData.get("numero") ?? ""));
  if (numero.error || numero.value == null) return { error: numero.error ?? "El número del trabajador es obligatorio." };

  const db = await planillasDb();
  const admin = createAdminClient();
  const lookup = admin?.schema("planillas") ?? db;
  const { data: existente } = await lookup.from("personas").select("id").eq("dni", dni).maybeSingle();

  let personaId = existente?.id as string | undefined;
  if (!personaId) {
    const { data: persona, error } = await db
      .from("personas")
      .insert({
        dni,
        nombres,
        apellido_paterno: String(formData.get("apellido_paterno") ?? "").trim() || null,
        apellido_materno: String(formData.get("apellido_materno") ?? "").trim() || null,
        fecha_nacimiento: nacimiento.value,
        celular: String(formData.get("celular") ?? "").trim() || null,
        correo: String(formData.get("correo") ?? "").trim() || null,
        direccion: String(formData.get("direccion") ?? "").trim() || null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    personaId = persona.id;
  }

  const { data: relacionExistente } = await lookup
    .from("relaciones_laborales")
    .select("id")
    .eq("persona_id", personaId)
    .eq("entidad_id", entidadId)
    .limit(1);
  if (relacionExistente?.[0]) {
    return { error: "Esta persona ya tiene una ficha en esa empresa.", relacionId: relacionExistente[0].id as string };
  }

  const { data: relacion, error: relError } = await db
    .from("relaciones_laborales")
    .insert({
      persona_id: personaId,
      entidad_id: entidadId,
      numero: numero.value,
      cargo: cargo.value,
      clasificacion: (String(formData.get("clasificacion") ?? "").trim() || null) as ClasificacionTrabajador | null,
      jornada: (String(formData.get("jornada") ?? "").trim() || null) as JornadaLaboral | null,
      horario: String(formData.get("horario") ?? "").trim() || null,
      fecha_ingreso: ingreso.value,
      estado: "ACTIVA",
      validacion: esPersonalEstudio(profile.rol) ? "ACEPTADA" : "PENDIENTE",
    })
    .select("id")
    .single();

  if (relError) {
    if (relError.message.includes("relaciones_persona_entidad_activa")) {
      return { error: "Esta persona ya tiene una relación activa en esa empresa." };
    }
    return { error: mensajeErrorNumero(relError) ?? relError.message };
  }

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${relacion.id}`);
  revalidatePath(`/trabajadores/${relacion.id}`);

  await db.from("documentos").insert(
    TIPOS_DOCUMENTO_ALTA_INICIALES.map((tipo) => ({
      relacion_id: relacion.id,
      tipo,
      estado: "PENDIENTE",
    })),
  );

  const { data: dniDoc } = await db
    .from("documentos")
    .select("id")
    .eq("relacion_id", relacion.id)
    .eq("tipo", "DNI")
    .maybeSingle();

  return { relacionId: relacion.id, dniDocumentoId: dniDoc?.id as string | undefined };
}

export async function updatePersonaTrabajador(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para editar." };

  const actual = await getTrabajador(relacionId);
  if (!actual) return { error: "Trabajador no encontrado." };

  const nombres = String(formData.get("nombres") ?? "").trim();
  if (!nombres) return { error: "El nombre es obligatorio." };
  const nacimiento = parseFechaCampo(String(formData.get("fecha_nacimiento") ?? ""), "Fecha de nacimiento");
  if (nacimiento.error) return { error: nacimiento.error };

  const tipoVia = String(formData.get("tipo_via") ?? "").trim() || null;
  const viaNombre = String(formData.get("via_nombre") ?? "").trim() || null;
  const viaNumero = String(formData.get("via_numero") ?? "").trim() || null;
  const referencia = String(formData.get("referencia") ?? "").trim() || null;
  const distrito = String(formData.get("distrito") ?? "").trim() || null;
  const provincia = String(formData.get("provincia") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  const direccion =
    armarDireccionPersona({
      tipo_via: tipoVia,
      via_nombre: viaNombre,
      via_numero: viaNumero,
      referencia,
      distrito,
      provincia,
      region,
      direccion: String(formData.get("direccion") ?? "").trim() || null,
    });

  const db = await planillasDb();
  const { error } = await db
    .from("personas")
    .update({
      nombres,
      apellido_paterno: String(formData.get("apellido_paterno") ?? "").trim() || null,
      apellido_materno: String(formData.get("apellido_materno") ?? "").trim() || null,
      fecha_nacimiento: nacimiento.value,
      celular: String(formData.get("celular") ?? "").trim() || null,
      correo: String(formData.get("correo") ?? "").trim() || null,
      direccion,
      tipo_via: tipoVia,
      via_nombre: viaNombre,
      via_numero: viaNumero,
      referencia,
      distrito,
      provincia,
      region,
    })
    .eq("id", actual.persona.id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath(`/trabajadores/${relacionId}`);
  return {};
}

export async function updatePuestoTrabajador(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para editar." };

  const actual = await getTrabajador(relacionId);
  if (!actual) return { error: "Trabajador no encontrado." };

  const ingreso = parseFechaCampo(String(formData.get("fecha_ingreso") ?? ""), "Fecha de ingreso a la empresa");
  if (ingreso.error) return { error: ingreso.error };
  const cargo = parseCargoCampo(String(formData.get("cargo") ?? ""), actual.cargo);
  if (cargo.error) return { error: cargo.error };
  const numero = parseNumeroTrabajador(String(formData.get("numero") ?? ""));
  if (numero.error || numero.value == null) return { error: numero.error ?? "El número del trabajador es obligatorio." };

  const db = await planillasDb();
  const { error } = await db
    .from("relaciones_laborales")
    .update({
      numero: numero.value,
      cargo: cargo.value,
      clasificacion: (String(formData.get("clasificacion") ?? "").trim() || null) as ClasificacionTrabajador | null,
      jornada: (String(formData.get("jornada") ?? "").trim() || null) as JornadaLaboral | null,
      horario: String(formData.get("horario") ?? "").trim() || null,
      fecha_ingreso: ingreso.value,
    })
    .eq("id", relacionId);
  if (error) return { error: mensajeErrorNumero(error) ?? error.message };

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath(`/trabajadores/${relacionId}`);
  return {};
}

export async function darDeBajaTrabajador(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para editar." };

  const actual = await getTrabajador(relacionId);
  if (!actual) return { error: "Trabajador no encontrado." };
  if (actual.estado === "CESADA") return { error: "Esta ficha ya está de baja." };

  const cese = parseFechaCampo(String(formData.get("fecha_cese") ?? ""), "Fecha de cese en la empresa");
  if (cese.error) return { error: cese.error };
  if (!cese.value) return { error: "Indique la fecha de cese en la empresa." };
  if (actual.fecha_ingreso && cese.value < actual.fecha_ingreso) {
    return { error: "El cese no puede ser anterior al ingreso a la empresa." };
  }
  const motivo = String(formData.get("tipo_baja") ?? "").trim();
  if (motivo !== "CARTA_RENUNCIA" && motivo !== "TERMINO_CONTRATO") {
    return { error: "Indique si la baja es por carta de renuncia o término de contrato." };
  }
  if (motivo === "CARTA_RENUNCIA" && !documentoCargado(actual.documentos, "CARTA_RENUNCIA")) {
    return { error: "Suba la carta de renuncia." };
  }
  if (!documentoCargado(actual.documentos, "TR_BAJA")) {
    return { error: "Suba el documento de T-Registro baja." };
  }
  const observacion = String(formData.get("observacion_baja") ?? "").trim() || null;
  const bajaAfp =
    formData.get("baja_afp") === "on" ||
    formData.get("baja_afp") === "true" ||
    formData.get("baja_afp") === "1";
  if (!bajaAfp) {
    return { error: "Marque que se dio de baja de AFP antes de confirmar el cese." };
  }

  const db = await planillasDb();
  const { error } = await db
    .from("relaciones_laborales")
    .update({
      fecha_cese: cese.value,
      tipo_baja: motivo,
      observacion_baja: observacion,
      baja_afp: bajaAfp,
      estado: "CESADA",
      numero: null,
    })
    .eq("id", relacionId);
  if (error) return { error: error.message };

  const yaBajaTr = actual.tRegistro.some((item) => item.tipo === "BAJA");
  if (!yaBajaTr) {
    const { error: trError } = await db.from("t_registro").insert({
      relacion_id: relacionId,
      tipo: "BAJA",
      realizado: true,
      fecha: cese.value,
    });
    if (trError) return { error: trError.message };
  }

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath(`/trabajadores/${relacionId}`);
  return {};
}

export async function eliminarTrabajador(
  relacionId: string,
  nombreEscrito: string,
): Promise<{ error?: string; entidadId?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) return { error: "Solo el estudio puede eliminar un trabajador." };

  const actual = await getTrabajador(relacionId);
  if (!actual) return { error: "Trabajador no encontrado." };
  if (!nombresCoinciden(nombreEscrito, nombreCompleto(actual.persona))) {
    return { error: "Escriba el nombre completo tal como aparece en la ficha." };
  }

  const db = await planillasDb();
  const [{ data: documentos }, { data: adendas }] = await Promise.all([
    db.from("documentos").select("storage_path").eq("relacion_id", relacionId),
    db.from("adendas").select("storage_path").eq("relacion_id", relacionId),
  ]);
  const paths = [...(documentos ?? []), ...(adendas ?? [])]
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path));

  const { error } = await db.from("relaciones_laborales").delete().eq("id", relacionId);
  if (error) return { error: error.message };

  const { count } = await db
    .from("relaciones_laborales")
    .select("id", { count: "exact", head: true })
    .eq("persona_id", actual.persona.id);
  if (!count) {
    await db.from("personas").delete().eq("id", actual.persona.id);
  }

  if (paths.length > 0) {
    const supabase = await createClient();
    await supabase.storage.from(DOCUMENTOS_PLANILLAS_BUCKET).remove(paths);
  }

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath("/asistencias");
  revalidatePath("/vacaciones");
  revalidatePath("/vida-ley");
  return { entidadId: actual.entidad_id };
}

export async function aceptarAltaTrabajador(relacionId: string): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeValidarAlta(profile)) return { error: "Solo el estudio puede validar el alta." };

  const actual = await getTrabajador(relacionId);
  if (!actual) return { error: "Trabajador no encontrado." };
  if (actual.validacion === "ACEPTADA") return {};

  const db = await planillasDb();
  const { error } = await db
    .from("relaciones_laborales")
    .update({ validacion: "ACEPTADA" })
    .eq("id", relacionId);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath(`/trabajadores/${relacionId}`);
  return {};
}
