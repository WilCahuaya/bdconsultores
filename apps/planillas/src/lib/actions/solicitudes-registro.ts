"use server";

import { revalidatePath } from "next/cache";
import { entidadAlcance, puedeEditarFichaLaboral, requirePlanillasProfile } from "@/lib/auth/access";
import { isUuid, pathPerteneceASolicitud } from "@/lib/documento-storage";
import { etiquetaTrabajador } from "@/lib/planillas-labels";
import { planillasDb } from "@/lib/supabase/planillas";

export type SolicitudTrabajador = {
  contratoId: string;
  etiqueta: string;
};

export type SolicitudRegistroVista = {
  id: string;
  storage_path: string | null;
  observaciones: string | null;
  created_at: string;
  trabajadores: SolicitudTrabajador[];
};

export type ContratoEnlazable = {
  contratoId: string;
  relacionId: string;
  etiqueta: string;
  version: number;
  solicitudId: string | null;
};

const CERRADOS = new Set(["RECOGIDO", "BAJA", "COMPLETO"]);

type PersonaEmbed = {
  nombres: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
};

type RelacionEmbed = {
  id: string;
  numero: number | null;
  estado: string;
  personas: PersonaEmbed | PersonaEmbed[] | null;
};

function personaDe(value: RelacionEmbed["personas"]): PersonaEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function revalidarRelaciones(relacionIds: string[]) {
  for (const relacionId of relacionIds) {
    revalidatePath(`/trabajadores/${relacionId}`);
    revalidatePath(`/contratos/${relacionId}`);
  }
  revalidatePath("/");
  revalidatePath("/contratos");
  revalidatePath("/pendientes");
  revalidatePath("/tablero");
}

async function assertEmpresa(relacionId: string): Promise<{ error: string } | { entidadId: string }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para editar." };
  const db = await planillasDb();
  const { data, error } = await db
    .from("relaciones_laborales")
    .select("id, entidad_id")
    .eq("id", relacionId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Trabajador no encontrado." };
  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== data.entidad_id) return { error: "No tiene permiso para editar." };
  return { entidadId: data.entidad_id as string };
}

export async function contextoSolicitudesRegistro(entidadId: string): Promise<{
  solicitudes: SolicitudRegistroVista[];
  enlazables: ContratoEnlazable[];
}> {
  const vacio = { solicitudes: [], enlazables: [] };
  if (!isUuid(entidadId)) return vacio;
  const profile = await requirePlanillasProfile();
  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return vacio;

  const db = await planillasDb();
  const [solicitudesRes, contratosRes, relacionesRes] = await Promise.all([
    db
      .from("solicitudes_registro")
      .select("id, storage_path, observaciones, created_at")
      .eq("entidad_id", entidadId)
      .order("created_at", { ascending: false }),
    db
      .from("contratos")
      .select("id, version, estado, relacion_id, solicitud_registro_id")
      .eq("entidad_id", entidadId)
      .neq("estado", "BAJA"),
    db
      .from("relaciones_laborales")
      .select("id, numero, estado, personas!persona_id (nombres, apellido_paterno, apellido_materno)")
      .eq("entidad_id", entidadId),
  ]);
  if (solicitudesRes.error) throw new Error(solicitudesRes.error.message);
  if (contratosRes.error) throw new Error(contratosRes.error.message);
  if (relacionesRes.error) throw new Error(relacionesRes.error.message);

  const relaciones = new Map<string, { etiqueta: string; estado: string }>();
  for (const row of (relacionesRes.data ?? []) as RelacionEmbed[]) {
    const persona = personaDe(row.personas);
    relaciones.set(row.id, {
      etiqueta: persona ? etiquetaTrabajador(persona, row.numero) : "Trabajador",
      estado: row.estado,
    });
  }

  const contratos = (contratosRes.data ?? []) as {
    id: string;
    version: number;
    estado: string;
    relacion_id: string;
    solicitud_registro_id: string | null;
  }[];

  function etiquetaContrato(relacionId: string, version: number): string {
    const relacion = relaciones.get(relacionId);
    const base = relacion?.etiqueta ?? "Trabajador";
    const baja = relacion?.estado === "CESADA" ? " · Baja" : "";
    return `${base}${baja} · versión ${version}`;
  }

  const solicitudes: SolicitudRegistroVista[] = ((solicitudesRes.data ?? []) as SolicitudRegistroVista[]).map((solicitud) => ({
    id: solicitud.id,
    storage_path: solicitud.storage_path,
    observaciones: solicitud.observaciones,
    created_at: solicitud.created_at,
    trabajadores: contratos
      .filter((contrato) => contrato.solicitud_registro_id === solicitud.id)
      .map((contrato) => ({
        contratoId: contrato.id,
        etiqueta: etiquetaContrato(contrato.relacion_id, contrato.version),
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
  }));

  const abiertos = new Map<string, (typeof contratos)[number]>();
  for (const contrato of contratos) {
    const relacion = relaciones.get(contrato.relacion_id);
    if (!relacion || relacion.estado !== "ACTIVA") continue;
    if (CERRADOS.has(contrato.estado)) continue;
    const previo = abiertos.get(contrato.relacion_id);
    if (!previo || contrato.version > previo.version) abiertos.set(contrato.relacion_id, contrato);
  }

  const enlazables: ContratoEnlazable[] = [...abiertos.values()]
    .map((contrato) => ({
      contratoId: contrato.id,
      relacionId: contrato.relacion_id,
      etiqueta: etiquetaContrato(contrato.relacion_id, contrato.version),
      version: contrato.version,
      solicitudId: contrato.solicitud_registro_id,
    }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));

  return { solicitudes, enlazables };
}

type FilaContratoEmpresa = {
  id: string;
  relacion_id: string;
  entidad_id: string;
  estado: string;
};

async function contratosDeLaEmpresa(
  entidadId: string,
  contratoIds: string[],
): Promise<{ error: string } | { rows: FilaContratoEmpresa[] }> {
  const ids = [...new Set(contratoIds.filter((id) => isUuid(id)))];
  if (ids.length === 0) return { error: "Elija al menos un contrato." };
  const db = await planillasDb();
  const { data, error } = await db
    .from("contratos")
    .select("id, relacion_id, entidad_id, estado")
    .in("id", ids);
  if (error) return { error: error.message };
  const rows = (data ?? []) as FilaContratoEmpresa[];
  if (rows.length !== ids.length) return { error: "Hay un contrato que no existe." };
  if (rows.some((row) => row.entidad_id !== entidadId)) return { error: "El contrato no es de esta empresa." };
  if (rows.some((row) => CERRADOS.has(row.estado))) {
    return { error: "Un contrato cerrado no se puede enlazar a la solicitud." };
  }
  const { data: relaciones, error: relError } = await db
    .from("relaciones_laborales")
    .select("id, estado")
    .in(
      "id",
      rows.map((row) => row.relacion_id),
    );
  if (relError) return { error: relError.message };
  if (((relaciones ?? []) as { estado: string }[]).some((row) => row.estado === "CESADA")) {
    return { error: "Esta ficha está de baja. Los datos se consultan." };
  }
  return { rows };
}

export async function registrarSolicitudRegistro(
  relacionId: string,
  solicitudId: string,
  storagePath: string,
  contratoIds: string[],
  observaciones: string,
): Promise<{ error?: string }> {
  const gate = await assertEmpresa(relacionId);
  if ("error" in gate) return { error: gate.error };
  if (!isUuid(solicitudId) || !pathPerteneceASolicitud(gate.entidadId, solicitudId, storagePath)) {
    return { error: "Ruta de archivo no válida." };
  }
  const contratos = await contratosDeLaEmpresa(gate.entidadId, contratoIds);
  if ("error" in contratos) return { error: contratos.error };

  const nota = observaciones.trim().slice(0, 200) || null;
  const db = await planillasDb();
  const { error: insertError } = await db.from("solicitudes_registro").insert({
    id: solicitudId,
    entidad_id: gate.entidadId,
    storage_path: storagePath,
    observaciones: nota,
  });
  if (insertError) return { error: insertError.message };

  const { error: linkError } = await db
    .from("contratos")
    .update({ solicitud_registro_id: solicitudId })
    .in(
      "id",
      contratos.rows.map((row) => row.id),
    )
    .eq("entidad_id", gate.entidadId);
  if (linkError) return { error: linkError.message };

  revalidarRelaciones(contratos.rows.map((row) => row.relacion_id));
  return {};
}

export async function guardarArchivoSolicitud(
  relacionId: string,
  solicitudId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const gate = await assertEmpresa(relacionId);
  if ("error" in gate) return { error: gate.error };
  if (!isUuid(solicitudId) || !pathPerteneceASolicitud(gate.entidadId, solicitudId, storagePath)) {
    return { error: "Ruta de archivo no válida." };
  }
  const db = await planillasDb();
  const { data, error: loadError } = await db
    .from("solicitudes_registro")
    .select("id")
    .eq("id", solicitudId)
    .eq("entidad_id", gate.entidadId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!data) return { error: "Solicitud no encontrada." };

  const { error } = await db
    .from("solicitudes_registro")
    .update({ storage_path: storagePath })
    .eq("id", solicitudId)
    .eq("entidad_id", gate.entidadId);
  if (error) return { error: error.message };

  const { data: ligados } = await db
    .from("contratos")
    .select("relacion_id")
    .eq("solicitud_registro_id", solicitudId)
    .eq("entidad_id", gate.entidadId);
  const relaciones = [...new Set((ligados ?? []).map((row) => row.relacion_id as string))];
  revalidarRelaciones(relaciones.length > 0 ? relaciones : [relacionId]);
  return {};
}

export async function quitarArchivoSolicitudRegistro(
  relacionId: string,
  solicitudId: string,
): Promise<{ error?: string; path?: string }> {
  const gate = await assertEmpresa(relacionId);
  if ("error" in gate) return { error: gate.error };
  if (!isUuid(solicitudId)) return { error: "Solicitud no válida." };
  const db = await planillasDb();
  const { data, error: loadError } = await db
    .from("solicitudes_registro")
    .select("id, storage_path")
    .eq("id", solicitudId)
    .eq("entidad_id", gate.entidadId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!data) return { error: "Solicitud no encontrada." };
  const path = (data.storage_path as string | null) ?? null;
  if (!path) return { error: "Esta solicitud no tiene archivo." };
  const { error } = await db
    .from("solicitudes_registro")
    .update({ storage_path: null })
    .eq("id", solicitudId)
    .eq("entidad_id", gate.entidadId);
  if (error) return { error: error.message };
  const { data: ligados } = await db
    .from("contratos")
    .select("relacion_id")
    .eq("solicitud_registro_id", solicitudId)
    .eq("entidad_id", gate.entidadId);
  const relaciones = [...new Set((ligados ?? []).map((row) => row.relacion_id as string))];
  revalidarRelaciones(relaciones.length > 0 ? relaciones : [relacionId]);
  return { path };
}

export async function vincularContratosASolicitud(
  relacionId: string,
  solicitudId: string,
  contratoIds: string[],
): Promise<{ error?: string }> {
  const gate = await assertEmpresa(relacionId);
  if ("error" in gate) return { error: gate.error };
  if (!isUuid(solicitudId)) return { error: "Solicitud no válida." };
  const contratos = await contratosDeLaEmpresa(gate.entidadId, contratoIds);
  if ("error" in contratos) return { error: contratos.error };

  const db = await planillasDb();
  const { data, error: loadError } = await db
    .from("solicitudes_registro")
    .select("id, storage_path")
    .eq("id", solicitudId)
    .eq("entidad_id", gate.entidadId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!data?.storage_path) return { error: "Esa solicitud no tiene archivo." };

  const { error } = await db
    .from("contratos")
    .update({ solicitud_registro_id: solicitudId })
    .in(
      "id",
      contratos.rows.map((row) => row.id),
    )
    .eq("entidad_id", gate.entidadId);
  if (error) return { error: error.message };
  revalidarRelaciones(contratos.rows.map((row) => row.relacion_id));
  return {};
}

export async function desvincularSolicitudContrato(
  relacionId: string,
  contratoId: string,
): Promise<{ error?: string }> {
  const gate = await assertEmpresa(relacionId);
  if ("error" in gate) return { error: gate.error };
  if (!isUuid(contratoId)) return { error: "Contrato no válido." };
  const db = await planillasDb();
  const { error } = await db
    .from("contratos")
    .update({ solicitud_registro_id: null })
    .eq("id", contratoId)
    .eq("relacion_id", relacionId)
    .eq("entidad_id", gate.entidadId);
  if (error) return { error: error.message };
  revalidarRelaciones([relacionId]);
  return {};
}
