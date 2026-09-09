import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHECKLIST_DOCUMENTOS_ALTA_PLANILLAS,
  RESPONSABLE_CARGO_ADMIN,
  normalizeResponsableDni,
  normalizeResponsableNombre,
} from "@inventario/types";

function splitNombrePersona(full: string): {
  nombres: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { nombres: parts[0] || full, apellido_paterno: null, apellido_materno: null };
  }
  if (parts.length === 2) {
    return { nombres: parts[0], apellido_paterno: parts[1], apellido_materno: null };
  }
  return {
    nombres: parts.slice(0, -2).join(" "),
    apellido_paterno: parts[parts.length - 2],
    apellido_materno: parts[parts.length - 1],
  };
}

/** Crea o reutiliza la ficha laboral del administrador en Planillas. */
export async function syncAdminTrabajadorPlanillas(
  supabase: SupabaseClient,
  entidadId: string,
  adminNombre: string,
  adminEmail: string,
  adminTelefono?: string | null,
  adminDni?: string | null,
): Promise<{ error?: string }> {
  const dni = normalizeResponsableDni(adminDni ?? "");
  const nombre = normalizeResponsableNombre(adminNombre);
  if (!dni || dni.length < 8 || !nombre) return {};

  const db = supabase.schema("planillas");
  const { nombres, apellido_paterno, apellido_materno } = splitNombrePersona(nombre);
  const correo = adminEmail.trim().toLowerCase() || null;
  const celular = adminTelefono?.trim() || null;

  const { data: existente, error: findError } = await db.from("personas").select("id").eq("dni", dni).maybeSingle();
  if (findError) return { error: findError.message };

  let personaId = existente?.id as string | undefined;
  if (!personaId) {
    const { data: persona, error } = await db
      .from("personas")
      .insert({
        dni,
        nombres,
        apellido_paterno,
        apellido_materno,
        celular,
        correo,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    personaId = persona.id;
  } else {
    await db
      .from("personas")
      .update({ nombres, apellido_paterno, apellido_materno, celular, correo })
      .eq("id", personaId);
  }

  const { data: relaciones, error: relFindError } = await db
    .from("relaciones_laborales")
    .select("id")
    .eq("persona_id", personaId)
    .eq("entidad_id", entidadId)
    .limit(1);
  if (relFindError) return { error: relFindError.message };
  if (relaciones?.[0]) return {};

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: relacion, error: relError } = await db
    .from("relaciones_laborales")
    .insert({
      persona_id: personaId,
      entidad_id: entidadId,
      cargo: RESPONSABLE_CARGO_ADMIN,
      estado: "ACTIVA",
      validacion: "ACEPTADA",
      fecha_ingreso: hoy,
    })
    .select("id")
    .single();

  if (relError) {
    if (relError.message.includes("relaciones_persona_entidad_activa")) return {};
    return { error: relError.message };
  }

  const { error: docsError } = await db.from("documentos").insert(
    CHECKLIST_DOCUMENTOS_ALTA_PLANILLAS.map((tipo) => ({
      relacion_id: relacion.id,
      tipo,
      estado: "PENDIENTE",
    })),
  );
  if (docsError) return { error: docsError.message };

  return {};
}
