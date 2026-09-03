"use server";

import { revalidatePath } from "next/cache";
import {
  RESPONSABLE_CARGO_DEFAULT,
  buildExistingAmbienteKeys,
  buildResponsableDniLookup,
  buildResponsableNombreLookup,
  buildSedeLookup,
  findPrincipalSede,
  isPrincipalSedeNombre,
  normalizeImportKey,
  normalizeResponsableDni,
  normalizeResponsableNombre,
  parseImportAmbienteFila,
  validateImportAmbienteDuplicado,
  type ImportAmbienteErrorItem,
  type ImportAmbienteFila,
  type ImportAmbienteRowData,
  type ImportAmbientesContext,
  type ImportAmbientesResult,
} from "@inventario/types";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/profile";
import { listAmbientesPorEntidad, listSedesConConteo } from "@/lib/actions/ubicacion";
import { listResponsables } from "@/lib/actions/responsables";

export type { ImportAmbientesContext };

export async function getImportAmbientesContext(entidadId: string): Promise<ImportAmbientesContext> {
  await requireProfile("CONTADOR");

  const [sedes, responsables, ambientes] = await Promise.all([
    listSedesConConteo(entidadId),
    listResponsables(entidadId),
    listAmbientesPorEntidad(entidadId),
  ]);

  return {
    sedes: sedes.map((s) => ({
      sedeId: s.id,
      sedeNombre: s.nombre,
      esPrincipal: s.es_principal,
    })),
    responsables: responsables
      .filter((r) => r.activo)
      .map((r) => ({ responsableId: r.id, nombre: r.nombre, dni: r.dni })),
    ambientes: ambientes.map((a) => ({
      sedeNombre: a.sede_nombre,
      ambienteNombre: a.nombre,
    })),
  };
}

async function resolveSedeId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entidadId: string,
  data: ImportAmbienteRowData,
  sedeLookup: Map<string, string>,
  principalSedeId: string | null,
  sedesCreadas: { count: number },
): Promise<{ id: string } | { error: string }> {
  const sedeKey = data.sedeNombre.trim();
  const lookupKey = normalizeImportKey(sedeKey);

  if (isPrincipalSedeNombre(sedeKey)) {
    if (!principalSedeId) {
      return { error: 'No existe la sucursal "Principal" en esta entidad.' };
    }
    return { id: principalSedeId };
  }

  const existingId = sedeLookup.get(lookupKey);
  if (existingId) {
    return { id: existingId };
  }

  const { data: sede, error } = await supabase
    .from("sedes")
    .insert({
      entidad_id: entidadId,
      nombre: sedeKey,
      direccion: data.sedeDireccion,
      es_principal: false,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  sedeLookup.set(lookupKey, sede.id as string);
  sedesCreadas.count += 1;
  return { id: sede.id as string };
}

async function resolveResponsableId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entidadId: string,
  data: ImportAmbienteRowData,
  responsableByDni: Map<string, string>,
  responsableByNombre: Map<string, string>,
  responsablesCreados: { count: number },
): Promise<{ id: string | null } | { error: string }> {
  if (!data.responsableNombre && !data.responsableDni) {
    return { id: null };
  }

  const dni = normalizeResponsableDni(data.responsableDni ?? "") || null;
  if (dni) {
    const existingByDni = responsableByDni.get(dni);
    if (existingByDni) return { id: existingByDni };
  }

  const nombre = normalizeResponsableNombre(data.responsableNombre!);
  const nombreKey = normalizeImportKey(nombre);
  const existingByNombre = responsableByNombre.get(nombreKey);
  if (existingByNombre) return { id: existingByNombre };

  const trimOrNull = (value: string | null) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  const { data: row, error } = await supabase
    .from("responsables")
    .insert({
      entidad_id: entidadId,
      nombre,
      dni,
      email: trimOrNull(data.responsableEmail),
      telefono: trimOrNull(data.responsableTelefono),
      cargo: RESPONSABLE_CARGO_DEFAULT,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && error.message.includes("dni")) {
      return { error: `Ya existe un responsable con DNI ${dni} en esta entidad.` };
    }
    if (error.code === "23505") {
      return { error: `Ya existe un responsable llamado «${nombre}» en esta entidad.` };
    }
    return { error: error.message };
  }

  if (dni) responsableByDni.set(dni, row.id as string);
  responsableByNombre.set(nombreKey, row.id as string);
  responsablesCreados.count += 1;
  return { id: row.id as string };
}

export async function importAmbientes(
  entidadId: string,
  filas: ImportAmbienteFila[],
  options?: { filaOffset?: number },
): Promise<{ data?: ImportAmbientesResult; error?: string }> {
  await requireProfile("CONTADOR");
  if (!entidadId) return { error: "Entidad no válida." };
  if (filas.length === 0) return { error: "No hay filas para importar." };

  const supabase = await createClient();
  const { data: entidad } = await supabase
    .from("entidades")
    .select("id")
    .eq("id", entidadId)
    .eq("activo", true)
    .maybeSingle();
  if (!entidad) return { error: "Entidad no encontrada." };

  const context = await getImportAmbientesContext(entidadId);
  const principal = findPrincipalSede(context.sedes);

  const sedeLookup = buildSedeLookup(context.sedes);
  const responsableByDni = buildResponsableDniLookup(context.responsables);
  const responsableByNombre = buildResponsableNombreLookup(context.responsables);
  const existingKeys = buildExistingAmbienteKeys(context.ambientes);
  const batchKeys = new Set<string>();
  const sedesCreadas = { count: 0 };
  const responsablesCreados = { count: 0 };

  const errores: ImportAmbienteErrorItem[] = [];
  let importados = 0;
  const filaOffset = options?.filaOffset ?? 0;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const filaExcel = filaOffset + i + 2;

    const parsed = parseImportAmbienteFila(fila);
    if (!parsed.ok) {
      errores.push({ fila: filaExcel, datos: fila, motivo: parsed.motivo });
      continue;
    }

    const dup = validateImportAmbienteDuplicado(parsed.data, existingKeys, batchKeys);
    if (!dup.ok) {
      errores.push({ fila: filaExcel, datos: fila, motivo: dup.motivo });
      continue;
    }

    const sedeResult = await resolveSedeId(
      supabase,
      entidadId,
      parsed.data,
      sedeLookup,
      principal?.sedeId ?? null,
      sedesCreadas,
    );
    if ("error" in sedeResult) {
      errores.push({ fila: filaExcel, datos: fila, motivo: sedeResult.error });
      continue;
    }

    const responsableResult = await resolveResponsableId(
      supabase,
      entidadId,
      parsed.data,
      responsableByDni,
      responsableByNombre,
      responsablesCreados,
    );
    if ("error" in responsableResult) {
      errores.push({ fila: filaExcel, datos: fila, motivo: responsableResult.error });
      continue;
    }

    const { error } = await supabase.from("ambientes").insert({
      sede_id: sedeResult.id,
      nombre: parsed.data.ambienteNombre,
      descripcion: parsed.data.ambienteDescripcion,
      responsable_id: responsableResult.id,
    });

    if (error) {
      errores.push({ fila: filaExcel, datos: fila, motivo: error.message });
      continue;
    }

    existingKeys.add(dup.key);
    batchKeys.add(dup.key);
    importados += 1;
  }

  revalidatePath("/contador/entidades");
  revalidatePath(`/contador/entidades/${entidadId}`);
  revalidatePath("/contador/inventario");

  return {
    data: {
      totalFilas: filas.length,
      importados,
      sedesCreadas: sedesCreadas.count,
      responsablesCreados: responsablesCreados.count,
      errores,
    },
  };
}
