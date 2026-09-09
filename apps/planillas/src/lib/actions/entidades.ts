"use server";

import { revalidatePath } from "next/cache";
import {
  esUsuarioEntidad,
  normalizeResponsableDni,
  parseRepresentanteLegalDni,
  validarAdminEntidadDni,
  type Entidad,
} from "@inventario/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consultarDniReniec, consultarRucSunat } from "@bd/config";
import { createClient } from "@/lib/supabase/server";
import { entidadAlcance, puedeCrearEntidad, puedeEditarFichaLaboral, requirePlanillasProfile } from "@/lib/auth/access";
import { inviteEntidadAdmin } from "@/lib/auth/entidad-admin";
import { syncAdminTrabajadorPlanillas } from "@/lib/planillas-admin-trabajador";
import { syncAdminResponsableForEntidad } from "@/lib/responsables-admin-sync";
import { syncSedePrincipalDireccionFromEntidad } from "@/lib/sede-principal-direccion";

export async function listEntidadesPlanillas(): Promise<Entidad[]> {
  const profile = await requirePlanillasProfile();
  const supabase = await createClient();

  let query = supabase
    .from("entidades")
    .select("id, nombre, ruc, pe_codigo, activo")
    .eq("activo", true)
    .eq("usa_planillas", true)
    .order("nombre");

  if (esUsuarioEntidad(profile.rol) && profile.entidad_id) {
    query = query.eq("id", profile.entidad_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Entidad[];
}

export async function getEntidadPlanillas(entidadId: string): Promise<Entidad | null> {
  const profile = await requirePlanillasProfile();
  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entidades")
    .select(
      "id, nombre, ruc, direccion, admin_nombre, admin_email, admin_dni, admin_telefono, representante_legal_nombre, representante_legal_dni, representante_legal_cargo, activo, usa_inventarios, usa_planillas",
    )
    .eq("id", entidadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as Entidad;
}

export async function consultarRuc(ruc: string): Promise<{
  error?: string;
  ruc?: string;
  nombre?: string;
  direccion?: string;
  estado?: string;
}> {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearEntidad(profile)) return { error: "No tiene permiso para consultar RUC." };
  return consultarRucSunat(ruc);
}

export async function consultarDni(dni: string): Promise<{
  error?: string;
  dni?: string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  nombre_completo?: string;
  fecha_nacimiento?: string;
}> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para consultar DNI." };
  return consultarDniReniec(dni);
}

type EmpresaFormParsed =
  | { error: string }
  | {
      nombre: string;
      ruc: string | null;
      direccion: string | null;
      adminNombre: string;
      adminEmail: string;
      adminTelefono: string | null;
      adminDni: string;
      usaInventarios: boolean;
      rlNombre: string | null;
      rlDni: string | null;
      rlCargo: string | null;
    };

function parseEmpresaForm(formData: FormData): EmpresaFormParsed {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const adminNombre = String(formData.get("admin_nombre") ?? "").trim();
  const adminEmail = String(formData.get("admin_email") ?? "").trim();
  const adminTelefono = String(formData.get("admin_telefono") ?? "").trim() || null;
  const adminDni = normalizeResponsableDni(String(formData.get("admin_dni") ?? ""));
  const usaInventarios = formData.get("usa_inventarios") === "on";

  if (!nombre) return { error: "La razón social es obligatoria." };
  if (!adminEmail) return { error: "El correo del administrador es obligatorio." };
  if (!adminNombre) return { error: "El nombre del administrador es obligatorio." };
  const dniError = validarAdminEntidadDni(adminDni);
  if (dniError) return { error: dniError };
  const rlDni = parseRepresentanteLegalDni(String(formData.get("representante_legal_dni") ?? ""));
  if (rlDni.error) return { error: rlDni.error };

  return {
    nombre,
    ruc,
    direccion,
    adminNombre,
    adminEmail,
    adminTelefono,
    adminDni,
    usaInventarios,
    rlNombre: String(formData.get("representante_legal_nombre") ?? "").trim() || null,
    rlDni: rlDni.value,
    rlCargo: String(formData.get("representante_legal_cargo") ?? "").trim() || null,
  };
}

async function syncEmpresaRelacionados(
  supabase: SupabaseClient,
  entidadId: string,
  parsed: Exclude<EmpresaFormParsed, { error: string }>,
  inviteMode: "invite" | "resend" = "invite",
) {
  await syncSedePrincipalDireccionFromEntidad(supabase, entidadId, parsed.direccion);
  await syncAdminResponsableForEntidad(
    supabase,
    entidadId,
    parsed.adminNombre,
    parsed.adminEmail,
    parsed.adminTelefono,
    parsed.adminDni,
  );

  const planillas = await syncAdminTrabajadorPlanillas(
    supabase,
    entidadId,
    parsed.adminNombre,
    parsed.adminEmail,
    parsed.adminTelefono,
    parsed.adminDni,
  );
  if (planillas.error) return { error: planillas.error };

  const invite = await inviteEntidadAdmin(
    entidadId,
    parsed.adminEmail,
    parsed.adminNombre,
    parsed.nombre,
    { mode: inviteMode },
  );
  if (invite.error) return { error: invite.error };

  return { inviteMessage: invite.message ?? invite.warning ?? null };
}

function entidadPayload(parsed: Exclude<EmpresaFormParsed, { error: string }>) {
  return {
    nombre: parsed.nombre,
    ruc: parsed.ruc,
    direccion: parsed.direccion,
    admin_nombre: parsed.adminNombre,
    admin_email: parsed.adminEmail,
    admin_dni: parsed.adminDni,
    admin_telefono: parsed.adminTelefono,
    representante_legal_nombre: parsed.rlNombre,
    representante_legal_dni: parsed.rlDni,
    representante_legal_cargo: parsed.rlCargo,
    usa_inventarios: parsed.usaInventarios,
    usa_planillas: true,
  };
}

export async function createEntidadPlanillas(formData: FormData): Promise<{
  error?: string;
  entidadId?: string;
  inviteMessage?: string | null;
}> {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearEntidad(profile)) return { error: "Solo el contador puede crear empresas." };

  const parsed = parseEmpresaForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entidades")
    .insert(entidadPayload(parsed))
    .select("id")
    .single();

  if (error) return { error: error.message };

  const synced = await syncEmpresaRelacionados(supabase, data.id, parsed);
  if ("error" in synced) return { error: synced.error };

  revalidatePath("/");
  revalidatePath("/pendientes");
  return {
    entidadId: data.id,
    inviteMessage: synced.inviteMessage,
  };
}

export async function updateEntidadPlanillas(
  entidadId: string,
  formData: FormData,
): Promise<{
  error?: string;
  entidadId?: string;
  inviteMessage?: string | null;
}> {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearEntidad(profile)) return { error: "Solo el contador puede editar empresas." };

  const parsed = parseEmpresaForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data: entidadAnterior } = await supabase
    .from("entidades")
    .select("admin_email")
    .eq("id", entidadId)
    .eq("activo", true)
    .maybeSingle();

  if (!entidadAnterior) return { error: "Empresa no encontrada." };

  const adminEmailAnterior = entidadAnterior.admin_email?.trim().toLowerCase() ?? null;
  const inviteMode =
    adminEmailAnterior && adminEmailAnterior === parsed.adminEmail.toLowerCase() ? "resend" : "invite";

  const { data, error } = await supabase
    .from("entidades")
    .update(entidadPayload(parsed))
    .eq("id", entidadId)
    .eq("activo", true)
    .select("id")
    .single();

  if (error) return { error: error.message };

  const synced = await syncEmpresaRelacionados(supabase, data.id, parsed, inviteMode);
  if ("error" in synced) return { error: synced.error };

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath(`/empresas/${entidadId}/editar`);
  return {
    entidadId: data.id,
    inviteMessage: synced.inviteMessage,
  };
}
