"use server";

import { revalidatePath } from "next/cache";
import type {
  EstadoVisitaAmbiente,
  VisitaCampoActiva,
  VisitaCampoAmbienteDetalle,
  VisitaCampoHistorial,
} from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { getProfile, requireProfile } from "@/lib/auth/profile";
import type { AmbienteConSede } from "./ubicacion";

function revalidateEntidadVisita(entidadId: string) {
  revalidatePath(`/contador/entidades/${entidadId}`);
  revalidatePath("/admin/activos");
}

type SedeJoin = { nombre: string } | { nombre: string }[] | null;

function sedeNombre(join: SedeJoin): string | null {
  if (!join) return null;
  if (Array.isArray(join)) return join[0]?.nombre ?? null;
  return join.nombre;
}

type ProfileJoin = { nombre: string } | { nombre: string }[] | null;

function profileNombre(join: ProfileJoin): string | null {
  if (!join) return null;
  if (Array.isArray(join)) return join[0]?.nombre ?? null;
  return join.nombre;
}

type VisitaRow = {
  id: string;
  entidad_id: string;
  numero: number;
  estado: VisitaCampoActiva["estado"];
  abierto_at: string;
  abierto_por: string;
  sede_id: string | null;
  profiles: ProfileJoin;
  sedes: SedeJoin;
};

async function mapVisitaConConteo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  visita: VisitaRow,
): Promise<VisitaCampoActiva> {
  const { data: filas } = await supabase
    .from("visita_ambientes")
    .select("estado")
    .eq("visita_id", visita.id);

  const ambientes_total = filas?.length ?? 0;
  const ambientes_culminados =
    filas?.filter((f) => f.estado === "CULMINADO").length ?? 0;

  return {
    id: visita.id,
    entidad_id: visita.entidad_id,
    numero: visita.numero,
    estado: visita.estado,
    abierto_at: visita.abierto_at,
    abierto_por_nombre: profileNombre(visita.profiles),
    sede_id: visita.sede_id ?? null,
    sede_nombre: sedeNombre(visita.sedes),
    ambientes_total,
    ambientes_culminados,
  };
}

export type AmbienteConVisita = AmbienteConSede & {
  visita_estado: EstadoVisitaAmbiente | null;
};

const VISITA_SELECT =
  "id, entidad_id, numero, estado, abierto_at, abierto_por, sede_id, profiles:abierto_por(nombre), sedes:sede_id(nombre)";

export async function getVisitasCampoActivas(
  entidadId: string,
): Promise<VisitaCampoActiva[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data: visitas } = await supabase
    .from("visitas_campo")
    .select(VISITA_SELECT)
    .eq("entidad_id", entidadId)
    .eq("estado", "ABIERTO")
    .order("abierto_at", { ascending: true });

  if (!visitas?.length) return [];

  return Promise.all(
    visitas.map((v) => mapVisitaConConteo(supabase, v as VisitaRow)),
  );
}

/** @deprecated Usar getVisitasCampoActivas */
export async function getVisitaCampoActiva(
  entidadId: string,
): Promise<VisitaCampoActiva | null> {
  const visitas = await getVisitasCampoActivas(entidadId);
  return visitas[0] ?? null;
}

export async function attachVisitaEstadoToAmbientes(
  ambientes: AmbienteConSede[],
  entidadId: string,
): Promise<AmbienteConVisita[]> {
  const visitas = await getVisitasCampoActivas(entidadId);
  if (visitas.length === 0) {
    return ambientes.map((a) => ({ ...a, visita_estado: null }));
  }

  const supabase = await createClient();
  const porAmbiente = new Map<string, EstadoVisitaAmbiente>();

  for (const visita of visitas) {
    const { data: filas } = await supabase
      .from("visita_ambientes")
      .select("ambiente_id, estado")
      .eq("visita_id", visita.id);

    for (const fila of filas ?? []) {
      porAmbiente.set(fila.ambiente_id, fila.estado as EstadoVisitaAmbiente);
    }
  }

  return ambientes.map((a) => ({
    ...a,
    visita_estado: a.es_preregistro ? null : (porAmbiente.get(a.id) ?? null),
  }));
}

export async function listVisitasCampoHistorial(
  entidadId: string,
): Promise<VisitaCampoHistorial[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data: visitas, error } = await supabase
    .from("visitas_campo")
    .select(
      "id, numero, estado, abierto_at, cerrado_at, abierto_por, cerrado_por, sede_id, abierto:abierto_por(nombre), cerrado:cerrado_por(nombre), sedes:sede_id(nombre)",
    )
    .eq("entidad_id", entidadId)
    .order("numero", { ascending: false });

  if (error || !visitas) return [];

  const result: VisitaCampoHistorial[] = [];
  for (const v of visitas) {
    const { data: filas } = await supabase
      .from("visita_ambientes")
      .select("estado")
      .eq("visita_id", v.id);

    const ambientes_total = filas?.length ?? 0;
    const ambientes_culminados =
      filas?.filter((f) => f.estado === "CULMINADO").length ?? 0;

    result.push({
      id: v.id,
      numero: v.numero,
      estado: v.estado,
      abierto_at: v.abierto_at,
      cerrado_at: v.cerrado_at,
      abierto_por_nombre: profileNombre(v.abierto as ProfileJoin),
      cerrado_por_nombre: profileNombre(v.cerrado as ProfileJoin),
      sede_id: v.sede_id ?? null,
      sede_nombre: sedeNombre(v.sedes as SedeJoin),
      ambientes_total,
      ambientes_culminados,
    });
  }

  return result;
}

export async function getVisitaCampoDetalle(
  visitaId: string,
): Promise<VisitaCampoAmbienteDetalle[]> {
  const profile = await getProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data: filas, error } = await supabase
    .from("visita_ambientes")
    .select(
      "estado, culminado_at, ambiente_id, culminado:culminado_por(nombre), ambientes(nombre, es_preregistro, sedes(nombre))",
    )
    .eq("visita_id", visitaId)
    .order("created_at");

  if (error || !filas) return [];

  return filas.map((fila) => {
    const ambRaw = fila.ambientes as unknown;
    const amb = (Array.isArray(ambRaw) ? ambRaw[0] : ambRaw) as {
      nombre: string;
      es_preregistro: boolean;
      sedes: { nombre: string } | { nombre: string }[] | null;
    } | null;
    const sede = amb?.sedes;
    const sedeNombre = Array.isArray(sede) ? sede[0]?.nombre : sede?.nombre;

    return {
      ambiente_id: fila.ambiente_id,
      ambiente_nombre: amb?.nombre ?? "—",
      sede_nombre: sedeNombre ?? "—",
      es_preregistro: amb?.es_preregistro ?? false,
      estado: fila.estado as EstadoVisitaAmbiente,
      culminado_at: fila.culminado_at,
      culminado_por_nombre: profileNombre(fila.culminado as ProfileJoin),
    };
  });
}

export async function abrirVisitaCampo(entidadId: string, sedeId?: string | null) {
  try {
    await requireProfile("CONTADOR");
  } catch {
    return { error: "No autorizado." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("abrir_visita_campo", {
    p_entidad_id: entidadId,
    p_sede_id: sedeId ?? null,
  });

  if (error) return { error: error.message };

  revalidateEntidadVisita(entidadId);
  return { success: true, visitaId: data as string };
}

export async function culminarAmbienteVisita(ambienteId: string, entidadId: string) {
  try {
    await requireProfile("CONTADOR");
  } catch {
    return { error: "No autorizado." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("culminar_ambiente_visita", {
    p_ambiente_id: ambienteId,
  });

  if (error) return { error: error.message };

  revalidateEntidadVisita(entidadId);
  return { success: true };
}

export async function cerrarVisitaCampo(visitaId: string, entidadId: string) {
  try {
    await requireProfile("CONTADOR");
  } catch {
    return { error: "No autorizado." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_visita_campo", {
    p_visita_id: visitaId,
  });

  if (error) return { error: error.message };

  revalidateEntidadVisita(entidadId);
  return { success: true };
}
