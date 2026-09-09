"use server";

import { revalidatePath } from "next/cache";
import type {
  EstadoContratoPlanilla,
  EstadoDocumentoPlanilla,
  EstadoTramitePension,
  JornadaLaboral,
  TipoDocumentoPlanilla,
  TipoPension,
  TipoTRegistro,
} from "@inventario/types";
import { puedeEscribirPlanillas, requirePlanillasProfile } from "@/lib/auth/access";
import { getTrabajador, type TrabajadorListItem } from "@/lib/actions/trabajadores";
import { pathPerteneceAlDocumento } from "@/lib/documento-storage";
import { planillasDb } from "@/lib/supabase/planillas";

async function assertEscritura(
  relacionId: string,
): Promise<{ error: string } | { trabajador: TrabajadorListItem }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEscribirPlanillas(profile)) return { error: "No tiene permiso para editar." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };
  return { trabajador };
}

export type ContratoRow = {
  id: string;
  version: number;
  numero_contrato: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  remuneracion: number | null;
  asignacion_familiar: number | null;
  jornada: JornadaLaboral | null;
  es_vigente: boolean;
  estado: EstadoContratoPlanilla;
};

export type DocumentoRow = {
  id: string;
  tipo: TipoDocumentoPlanilla;
  estado: EstadoDocumentoPlanilla;
  observaciones: string | null;
  storage_path: string | null;
  created_at: string;
};

export type PensionRow = {
  id: string;
  tipo: TipoPension;
  afp_nombre: string | null;
  cuspp: string | null;
  tramite_estado: EstadoTramitePension;
  fecha_tramite: string | null;
};

export type VidaLeyRow = {
  id: string;
  estado: string | null;
  numero_poliza: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

export type TRegistroRow = {
  id: string;
  tipo: TipoTRegistro;
  realizado: boolean;
  fecha: string | null;
  observaciones: string | null;
};

export async function listContratos(relacionId: string): Promise<ContratoRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("contratos")
    .select("id, version, numero_contrato, fecha_inicio, fecha_fin, remuneracion, asignacion_familiar, jornada, es_vigente, estado")
    .eq("relacion_id", relacionId)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContratoRow[];
}

export async function addContrato(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const gate = await assertEscritura(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const vigentes = await db.from("contratos").select("id").eq("relacion_id", relacionId).eq("es_vigente", true);
  const { count } = await db
    .from("contratos")
    .select("id", { count: "exact", head: true })
    .eq("relacion_id", relacionId);
  const version = (count ?? 0) + 1;
  const esVigente = formData.get("es_vigente") === "on";
  if (esVigente && (vigentes.data?.length ?? 0) > 0) {
    await db.from("contratos").update({ es_vigente: false }).eq("relacion_id", relacionId);
  }
  const { error } = await db.from("contratos").insert({
    relacion_id: relacionId,
    version,
    numero_contrato: String(formData.get("numero_contrato") ?? "").trim() || null,
    fecha_inicio: String(formData.get("fecha_inicio") ?? "").trim() || null,
    fecha_fin: String(formData.get("fecha_fin") ?? "").trim() || null,
    remuneracion: Number(formData.get("remuneracion") || 0) || null,
    asignacion_familiar: Number(formData.get("asignacion_familiar") || 0) || null,
    jornada: (String(formData.get("jornada") ?? "").trim() || null) as JornadaLaboral | null,
    es_vigente: esVigente,
    estado: (String(formData.get("estado") ?? "PENDIENTE_DOCS") as EstadoContratoPlanilla),
  });
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}

export async function listDocumentos(relacionId: string): Promise<DocumentoRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("documentos")
    .select("id, tipo, estado, observaciones, storage_path, created_at")
    .eq("relacion_id", relacionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentoRow[];
}

export async function addDocumento(
  relacionId: string,
  formData: FormData,
): Promise<{ error?: string; documentoId?: string }> {
  const gate = await assertEscritura(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { data, error } = await db
    .from("documentos")
    .insert({
      relacion_id: relacionId,
      tipo: String(formData.get("tipo")) as TipoDocumentoPlanilla,
      estado: String(formData.get("estado")) as EstadoDocumentoPlanilla,
      observaciones: String(formData.get("observaciones") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return { documentoId: data.id };
}

export async function setDocumentoArchivo(
  relacionId: string,
  documentoId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const gate = await assertEscritura(relacionId);
  if ("error" in gate) return { error: gate.error };

  if (!pathPerteneceAlDocumento(gate.trabajador.entidad_id, relacionId, documentoId, storagePath)) {
    return { error: "Ruta de archivo no válida." };
  }

  const db = await planillasDb();
  const { data: actual, error: loadError } = await db
    .from("documentos")
    .select("id")
    .eq("id", documentoId)
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!actual) return { error: "Documento no encontrado." };

  const { error } = await db
    .from("documentos")
    .update({ storage_path: storagePath, estado: "SI" })
    .eq("id", documentoId)
    .eq("relacion_id", relacionId);
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}

export async function getPension(relacionId: string): Promise<PensionRow | null> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("pensiones")
    .select("id, tipo, afp_nombre, cuspp, tramite_estado, fecha_tramite")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as PensionRow | null;
}

export async function savePension(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const gate = await assertEscritura(relacionId);
  if ("error" in gate) return { error: gate.error };
  const tipo = String(formData.get("tipo")) as TipoPension;
  const payload = {
    relacion_id: relacionId,
    tipo,
    afp_nombre: tipo === "AFP" ? String(formData.get("afp_nombre") ?? "").trim() || null : null,
    cuspp: String(formData.get("cuspp") ?? "").trim() || null,
    tramite_estado: (tipo === "ONP" ? "NO_APLICA" : String(formData.get("tramite_estado"))) as EstadoTramitePension,
    fecha_tramite: String(formData.get("fecha_tramite") ?? "").trim() || null,
  };
  const db = await planillasDb();
  const { error } = await db.from("pensiones").upsert(payload, { onConflict: "relacion_id" });
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}

export async function getVidaLey(relacionId: string): Promise<VidaLeyRow | null> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("vida_ley")
    .select("id, estado, numero_poliza, fecha_inicio, fecha_fin")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as VidaLeyRow | null;
}

export async function saveVidaLey(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const gate = await assertEscritura(relacionId);
  if ("error" in gate) return { error: gate.error };
  const payload = {
    relacion_id: relacionId,
    estado: String(formData.get("estado") ?? "").trim() || null,
    numero_poliza: String(formData.get("numero_poliza") ?? "").trim() || null,
    fecha_inicio: String(formData.get("fecha_inicio") ?? "").trim() || null,
    fecha_fin: String(formData.get("fecha_fin") ?? "").trim() || null,
  };
  const db = await planillasDb();
  const { error } = await db.from("vida_ley").upsert(payload, { onConflict: "relacion_id" });
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}

export async function listTRegistro(relacionId: string): Promise<TRegistroRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("t_registro")
    .select("id, tipo, realizado, fecha, observaciones")
    .eq("relacion_id", relacionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TRegistroRow[];
}

export async function addTRegistro(relacionId: string, formData: FormData): Promise<{ error?: string }> {
  const gate = await assertEscritura(relacionId);
  if ("error" in gate) return { error: gate.error };
  const db = await planillasDb();
  const { error } = await db.from("t_registro").insert({
    relacion_id: relacionId,
    tipo: String(formData.get("tipo")) as TipoTRegistro,
    realizado: formData.get("realizado") === "on",
    fecha: String(formData.get("fecha") ?? "").trim() || null,
    observaciones: String(formData.get("observaciones") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath("/pendientes");
  return {};
}
