import type { Ambiente, Entidad } from "@inventario/types";
import { isOnline, listMasterDomain } from "./master-cache";
import { getSupabaseClient } from "./supabase";

export interface FichaAsignacionExportMeta {
  sedeNombre?: string | null;
  responsable?: string | null;
  responsableDni?: string | null;
  adminNombre?: string | null;
  adminDni?: string | null;
}

export async function resolveFichaAsignacionExportMeta(
  entidad: Pick<Entidad, "id" | "admin_nombre" | "admin_email">,
  ambiente: Pick<Ambiente, "responsable_id" | "responsable">,
  sedeNombre?: string | null,
): Promise<FichaAsignacionExportMeta> {
  let responsable = ambiente.responsable?.trim() || null;
  let responsableDni: string | null = null;
  const adminNombre = entidad.admin_nombre?.trim() || null;
  let adminDni: string | null = null;
  const adminEmail = entidad.admin_email?.trim().toLowerCase();

  if (!isOnline()) {
    const responsables = await listMasterDomain<{
      id: string;
      nombre: string;
      dni: string | null;
      email: string | null;
    }>("responsables", entidad.id);
    if (ambiente.responsable_id) {
      const resp = responsables.find((row) => row.id === ambiente.responsable_id);
      if (resp) {
        responsable = resp.nombre?.trim() || responsable;
        responsableDni = resp.dni?.trim() || null;
      }
    }
    if (adminEmail) {
      const admin = responsables.find((row) => row.email?.trim().toLowerCase() === adminEmail);
      adminDni = admin?.dni?.trim() || null;
    }
    return { sedeNombre: sedeNombre?.trim() || null, responsable, responsableDni, adminNombre, adminDni };
  }

  const supabase = getSupabaseClient();

  if (ambiente.responsable_id) {
    const { data: resp } = await supabase
      .from("responsables")
      .select("nombre, dni")
      .eq("id", ambiente.responsable_id)
      .maybeSingle();
    if (resp) {
      responsable = resp.nombre?.trim() || responsable;
      responsableDni = resp.dni?.trim() || null;
    }
  }

  if (adminEmail) {
    const { data: adminResp } = await supabase
      .from("responsables")
      .select("dni")
      .eq("entidad_id", entidad.id)
      .ilike("email", adminEmail)
      .maybeSingle();
    adminDni = adminResp?.dni?.trim() || null;
  }

  return {
    sedeNombre: sedeNombre?.trim() || null,
    responsable,
    responsableDni,
    adminNombre,
    adminDni,
  };
}
