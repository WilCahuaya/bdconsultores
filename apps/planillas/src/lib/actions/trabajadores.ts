"use server";

import { revalidatePath } from "next/cache";
import type {
  ClasificacionTrabajador,
  EstadoRelacionLaboral,
  JornadaLaboral,
  TipoDocumentoPlanilla,
} from "@inventario/types";
import { entidadAlcance, puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
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
  fecha_ingreso: string | null;
  fecha_cese: string | null;
  estado: EstadoRelacionLaboral;
};

export type TrabajadorListItem = RelacionRow & {
  persona: PersonaRow;
  remuneracion: number | null;
};

type ContratoEmbed = {
  remuneracion: number | null;
  es_vigente: boolean;
  version: number;
};

function remuneracionDeContratos(contratos: ContratoEmbed[] | ContratoEmbed | null | undefined): number | null {
  const list = Array.isArray(contratos) ? contratos : contratos ? [contratos] : [];
  if (list.length === 0) return null;
  const vigente = list.find((c) => c.es_vigente) ?? [...list].sort((a, b) => b.version - a.version)[0];
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
      "id, persona_id, entidad_id, cargo, clasificacion, jornada, fecha_ingreso, fecha_cese, estado, personas!persona_id (id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, celular, correo, direccion), contratos (remuneracion, es_vigente, version)",
    )
    .eq("entidad_id", entidadId)
    .order("fecha_ingreso", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((row) => {
    const persona = Array.isArray(row.personas) ? row.personas[0] : row.personas;
    if (!persona) return [];
    const { personas: _p, contratos, ...relacion } = row;
    return [
      {
        ...(relacion as RelacionRow),
        persona: persona as PersonaRow,
        remuneracion: remuneracionDeContratos(contratos as ContratoEmbed[] | ContratoEmbed | null),
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
      "id, persona_id, entidad_id, cargo, clasificacion, jornada, fecha_ingreso, fecha_cese, estado, personas!persona_id (id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, celular, correo, direccion)",
    )
    .eq("id", relacionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== data.entidad_id) return null;

  const persona = Array.isArray(data.personas) ? data.personas[0] : data.personas;
  if (!persona) return null;
  const { personas: _p, ...relacion } = data;
  return { ...(relacion as RelacionRow), persona: persona as PersonaRow, remuneracion: null };
}

export async function createTrabajador(formData: FormData): Promise<{ error?: string; relacionId?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) return { error: "No tiene permiso para registrar trabajadores." };

  const entidadId = String(formData.get("entidad_id") ?? "").trim();
  const dni = normalizeDni(String(formData.get("dni") ?? ""));
  const nombres = String(formData.get("nombres") ?? "").trim();
  if (!entidadId) return { error: "Elija una empresa." };
  if (dni.length < 8) return { error: "El DNI debe tener al menos 8 dígitos." };
  if (!nombres) return { error: "El nombre es obligatorio." };

  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return { error: "Empresa no autorizada." };

  const db = await planillasDb();
  const { data: existente } = await db.from("personas").select("id").eq("dni", dni).maybeSingle();

  let personaId = existente?.id as string | undefined;
  if (!personaId) {
    const { data: persona, error } = await db
      .from("personas")
      .insert({
        dni,
        nombres,
        apellido_paterno: String(formData.get("apellido_paterno") ?? "").trim() || null,
        apellido_materno: String(formData.get("apellido_materno") ?? "").trim() || null,
        fecha_nacimiento: String(formData.get("fecha_nacimiento") ?? "").trim() || null,
        celular: String(formData.get("celular") ?? "").trim() || null,
        correo: String(formData.get("correo") ?? "").trim() || null,
        direccion: String(formData.get("direccion") ?? "").trim() || null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    personaId = persona.id;
  }

  const { data: relacion, error: relError } = await db
    .from("relaciones_laborales")
    .insert({
      persona_id: personaId,
      entidad_id: entidadId,
      cargo: String(formData.get("cargo") ?? "").trim() || null,
      clasificacion: (String(formData.get("clasificacion") ?? "").trim() || null) as ClasificacionTrabajador | null,
      jornada: (String(formData.get("jornada") ?? "").trim() || null) as JornadaLaboral | null,
      fecha_ingreso: String(formData.get("fecha_ingreso") ?? "").trim() || null,
      estado: "ACTIVA",
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

  const checklist: TipoDocumentoPlanilla[] = [
    "CONTRATO_FIRMADO",
    "DNI",
    "FICHA_DATOS",
    "PENSIONES_FIRMADO",
    "TR_ALTA",
    "ASIGNACION_FAMILIAR",
    "VIDA_LEY",
  ];
  await db.from("documentos").insert(
    checklist.map((tipo) => ({
      relacion_id: relacion.id,
      tipo,
      estado: "PENDIENTE",
    })),
  );

  return { relacionId: relacion.id };
}

export async function updateDatosTrabajador(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) return { error: "No tiene permiso para editar." };

  const actual = await getTrabajador(relacionId);
  if (!actual) return { error: "Trabajador no encontrado." };

  const db = await planillasDb();
  const { error: pError } = await db
    .from("personas")
    .update({
      nombres: String(formData.get("nombres") ?? "").trim(),
      apellido_paterno: String(formData.get("apellido_paterno") ?? "").trim() || null,
      apellido_materno: String(formData.get("apellido_materno") ?? "").trim() || null,
      fecha_nacimiento: String(formData.get("fecha_nacimiento") ?? "").trim() || null,
      celular: String(formData.get("celular") ?? "").trim() || null,
      correo: String(formData.get("correo") ?? "").trim() || null,
      direccion: String(formData.get("direccion") ?? "").trim() || null,
    })
    .eq("id", actual.persona.id);
  if (pError) return { error: pError.message };

  const cese = String(formData.get("fecha_cese") ?? "").trim() || null;
  const { error: rError } = await db
    .from("relaciones_laborales")
    .update({
      cargo: String(formData.get("cargo") ?? "").trim() || null,
      clasificacion: (String(formData.get("clasificacion") ?? "").trim() || null) as ClasificacionTrabajador | null,
      jornada: (String(formData.get("jornada") ?? "").trim() || null) as JornadaLaboral | null,
      fecha_ingreso: String(formData.get("fecha_ingreso") ?? "").trim() || null,
      fecha_cese: cese,
      estado: cese ? "CESADA" : "ACTIVA",
    })
    .eq("id", relacionId);
  if (rError) return { error: rError.message };

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath(`/trabajadores/${relacionId}`);
  return {};
}
