"use server";

import { revalidatePath } from "next/cache";
import {
  esUsuarioEntidad,
  normalizeResponsableDni,
  parseRepresentanteLegalDni,
  validarAdminEntidadDni,
  type Entidad,
} from "@inventario/types";
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
      "id, nombre, ruc, direccion, representante_legal_nombre, representante_legal_dni, representante_legal_cargo, activo, usa_planillas",
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

export async function createEntidadPlanillas(formData: FormData): Promise<{
  error?: string;
  entidadId?: string;
  inviteMessage?: string | null;
}> {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearEntidad(profile)) return { error: "Solo el contador puede crear empresas." };

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
  const rlNombre = String(formData.get("representante_legal_nombre") ?? "").trim() || null;
  const rlCargo = String(formData.get("representante_legal_cargo") ?? "").trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entidades")
    .insert({
      nombre,
      ruc,
      direccion,
      admin_nombre: adminNombre,
      admin_email: adminEmail,
      admin_dni: adminDni,
      admin_telefono: adminTelefono,
      representante_legal_nombre: rlNombre,
      representante_legal_dni: rlDni.value,
      representante_legal_cargo: rlCargo,
      usa_inventarios: usaInventarios,
      usa_planillas: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await syncSedePrincipalDireccionFromEntidad(supabase, data.id, direccion);
  await syncAdminResponsableForEntidad(supabase, data.id, adminNombre, adminEmail, adminTelefono, adminDni);

  const planillas = await syncAdminTrabajadorPlanillas(
    supabase,
    data.id,
    adminNombre,
    adminEmail,
    adminTelefono,
    adminDni,
  );
  if (planillas.error) return { error: planillas.error };

  const invite = await inviteEntidadAdmin(data.id, adminEmail, adminNombre, nombre);
  if (invite.error) return { error: invite.error };

  revalidatePath("/");
  revalidatePath("/pendientes");
  return {
    entidadId: data.id,
    inviteMessage: invite.message ?? invite.warning ?? null,
  };
}
