import { redirect } from "next/navigation";
import { portalOrigin } from "@bd/config";
import { esPersonalEstudio, esUsuarioEntidad, type Profile } from "@inventario/types";
import { getProfile } from "@/lib/auth/profile";

export async function requirePlanillasProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect(`${portalOrigin()}/login`);
  return profile;
}

/** Estudio: pensiones, T-Registro, Vida Ley y validar altas. */
export function puedeEscribirPlanillas(profile: Profile): boolean {
  return esPersonalEstudio(profile.rol);
}

export function puedeCrearEntidad(profile: Profile): boolean {
  return profile.rol === "CONTADOR";
}

/** Estudio o usuario de empresa: alta, datos de ficha/contrato y PDFs. */
export function puedeEditarFichaLaboral(profile: Profile): boolean {
  return esPersonalEstudio(profile.rol) || esUsuarioEntidad(profile.rol);
}

export function puedeCrearTrabajador(profile: Profile): boolean {
  return puedeEditarFichaLaboral(profile);
}

export function puedeValidarAlta(profile: Profile): boolean {
  return esPersonalEstudio(profile.rol);
}

export function entidadAlcance(profile: Profile): string | "todas" {
  if (esUsuarioEntidad(profile.rol) && profile.entidad_id) return profile.entidad_id;
  return "todas";
}
