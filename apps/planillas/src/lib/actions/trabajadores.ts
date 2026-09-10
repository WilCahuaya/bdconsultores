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
  puedeValidarAlta,
  requirePlanillasProfile,
} from "@/lib/auth/access";
import { parseFechaCampo, parseCargoCampo } from "@/lib/planillas-labels";
import type { FlujoContrato, FlujoDocumento } from "@/lib/flujo-ficha";
import { createAdminClient } from "@/lib/supabase/admin";
import { planillasDb } from "@/lib/supabase/planillas";

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
};

export type RelacionRow = {
  id: string;
  persona_id: string;
  entidad_id: string;
  cargo: string | null;
  clasificacion: ClasificacionTrabajador | null;
  jornada: JornadaLaboral | null;
  horario: string | null;
  fecha_ingreso: string | null;
  fecha_cese: string | null;
  recibe_asignacion_familiar: boolean | null;
  estado: EstadoRelacionLaboral;
  validacion: EstadoValidacionAltaPlanilla;
};

export type TrabajadorListItem = RelacionRow & {
  persona: PersonaRow;
  remuneracion: number | null;
  contratos: FlujoContrato[];
  documentos: FlujoDocumento[];
};

type ContratoEmbed = {
  remuneracion: number | null;
  es_vigente: boolean;
  version: number;
  estado: string | null;
  fecha_inicio: string | null;
  datos_confirmados?: boolean;
};

type DocumentoEmbed = {
  tipo: string;
  estado: string;
  storage_path: string | null;
};

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

export async function listTrabajadores(entidadId: string): Promise<TrabajadorListItem[]> {
  const profile = await requirePlanillasProfile();
  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return [];

  const db = await planillasDb();
  const { data, error } = await db
    .from("relaciones_laborales")
    .select(
      "id, persona_id, entidad_id, cargo, clasificacion, jornada, horario, fecha_ingreso, fecha_cese, recibe_asignacion_familiar, estado, validacion, personas!persona_id (id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, celular, correo, direccion), contratos (remuneracion, es_vigente, version, estado, fecha_inicio, datos_confirmados), documentos (tipo, estado, storage_path)",
    )
    .eq("entidad_id", entidadId)
    .order("fecha_ingreso", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((row) => {
    const persona = Array.isArray(row.personas) ? row.personas[0] : row.personas;
    if (!persona) return [];
    const { personas: _p, contratos, documentos, ...relacion } = row;
    const contratosList = (Array.isArray(contratos) ? contratos : contratos ? [contratos] : []) as FlujoContrato[];
    const documentosList = (Array.isArray(documentos) ? documentos : documentos ? [documentos] : []) as FlujoDocumento[];
    return [
      {
        ...(relacion as RelacionRow),
        persona: persona as PersonaRow,
        remuneracion: remuneracionDeContratos(contratos as ContratoEmbed[] | ContratoEmbed | null),
        contratos: contratosList,
        documentos: documentosList,
      },
    ];
  });
}

export async function getTrabajador(relacionId: string): Promise<TrabajadorListItem | null> {
  const profile = await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("relaciones_laborales")
    .select(
      "id, persona_id, entidad_id, cargo, clasificacion, jornada, horario, fecha_ingreso, fecha_cese, recibe_asignacion_familiar, estado, validacion, personas!persona_id (id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, celular, correo, direccion), contratos (remuneracion, es_vigente, version, estado, fecha_inicio, datos_confirmados), documentos (tipo, estado, storage_path)",
    )
    .eq("id", relacionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== data.entidad_id) return null;

  const persona = Array.isArray(data.personas) ? data.personas[0] : data.personas;
  if (!persona) return null;
  const { personas: _p, contratos, documentos, ...relacion } = data;
  const contratosList = (Array.isArray(contratos) ? contratos : contratos ? [contratos] : []) as FlujoContrato[];
  const documentosList = (Array.isArray(documentos) ? documentos : documentos ? [documentos] : []) as FlujoDocumento[];
  return {
    ...(relacion as RelacionRow),
    persona: persona as PersonaRow,
    remuneracion: remuneracionDeContratos(contratos as ContratoEmbed[] | ContratoEmbed | null),
    contratos: contratosList,
    documentos: documentosList,
  };
}

export async function createTrabajador(formData: FormData): Promise<{ error?: string; relacionId?: string; dniDocumentoId?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearTrabajador(profile)) return { error: "No tiene permiso para registrar trabajadores." };

  const entidadId = String(formData.get("entidad_id") ?? "").trim();
  const dni = normalizeDni(String(formData.get("dni") ?? ""));
  const nombres = String(formData.get("nombres") ?? "").trim();
  if (!entidadId) return { error: "Elija una empresa." };
  if (dni.length < 8) return { error: "El DNI debe tener al menos 8 dígitos." };
  if (!nombres) return { error: "El nombre es obligatorio." };

  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return { error: "Empresa no autorizada." };

  const nacimiento = parseFechaCampo(String(formData.get("fecha_nacimiento") ?? ""), "Fecha de nacimiento");
  if (nacimiento.error) return { error: nacimiento.error };
  const ingreso = parseFechaCampo(String(formData.get("fecha_ingreso") ?? ""), "Fecha de ingreso");
  if (ingreso.error) return { error: ingreso.error };
  const cargo = parseCargoCampo(String(formData.get("cargo") ?? ""));
  if (cargo.error) return { error: cargo.error };

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
    return { error: relError.message };
  }

  revalidatePath("/");
  revalidatePath("/pendientes");
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
      direccion: String(formData.get("direccion") ?? "").trim() || null,
    })
    .eq("id", actual.persona.id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/pendientes");
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

  const ingreso = parseFechaCampo(String(formData.get("fecha_ingreso") ?? ""), "Fecha de ingreso");
  if (ingreso.error) return { error: ingreso.error };
  const cese = parseFechaCampo(String(formData.get("fecha_cese") ?? ""), "Fecha de cese");
  if (cese.error) return { error: cese.error };
  const cargo = parseCargoCampo(String(formData.get("cargo") ?? ""), actual.cargo);
  if (cargo.error) return { error: cargo.error };

  const db = await planillasDb();
  const { error } = await db
    .from("relaciones_laborales")
    .update({
      cargo: cargo.value,
      clasificacion: (String(formData.get("clasificacion") ?? "").trim() || null) as ClasificacionTrabajador | null,
      jornada: (String(formData.get("jornada") ?? "").trim() || null) as JornadaLaboral | null,
      horario: String(formData.get("horario") ?? "").trim() || null,
      fecha_ingreso: ingreso.value,
      fecha_cese: cese.value,
      estado: cese.value ? "CESADA" : "ACTIVA",
    })
    .eq("id", relacionId);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath(`/trabajadores/${relacionId}`);
  return {};
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
  revalidatePath(`/trabajadores/${relacionId}`);
  return {};
}
