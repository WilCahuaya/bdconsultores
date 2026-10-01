"use server";

import { revalidatePath } from "next/cache";
import type { EstadoContratoPlanilla } from "@inventario/types";
import { TIPOS_DOCUMENTO_ALTA_INICIALES, esPersonalEstudio } from "@inventario/types";
import {
  entidadAlcance,
  puedeCrearTrabajador,
  puedeEscribirPlanillas,
  requirePlanillasProfile,
} from "@/lib/auth/access";
import { leerTrabajadoresExcel, type FilaLeida } from "@/lib/importar-trabajadores-excel";
import { montoAsignacionFamiliar, nombreCompleto, nombresCoinciden } from "@/lib/planillas-labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { planillasDb } from "@/lib/supabase/planillas";

export type FilaImportPreview = {
  fila: number;
  numero: string;
  dni: string;
  nombre: string;
  estado: "listo" | "revisar" | "omitido";
  detalle: string;
};

export type PreviewImportacion = {
  filas: FilaImportPreview[];
  listos: number;
};

type PersonaExistente = {
  id: string;
  dni: string;
  nombres: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
};

type ClasificacionFila = {
  leida: FilaLeida;
  estado: FilaImportPreview["estado"];
  detalle: string;
  personaId: string | null;
};

function revalidar() {
  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/contratos");
  revalidatePath("/vida-ley");
  revalidatePath("/asistencias");
  revalidatePath("/vacaciones");
}

function mensajeNumero(message: string): string | null {
  if (message.includes("relaciones_numero_por_entidad")) {
    return "Ya hay un trabajador con ese número en esta empresa.";
  }
  return null;
}

async function matrizDesdeArchivo(formData: FormData): Promise<{ error?: string; rows?: string[][] }> {
  const file = formData.get("archivo");
  if (!(file instanceof File) || file.size === 0) return { error: "Elija el Excel de la plantilla." };
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
    return { error: "Suba la plantilla en Excel (.xlsx)." };
  }
  if (file.size > 8 * 1024 * 1024) return { error: "El archivo supera 8 MB." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const XLSX = await import("xlsx-js-style");
  const libro = name.endsWith(".csv")
    ? XLSX.read(buffer.toString("utf8"), { type: "string", FS: ";" })
    : XLSX.read(buffer, { type: "buffer" });

  const nombres = [...libro.SheetNames].sort((a, b) => {
    const an = a.toLowerCase().includes("planilla") ? 0 : 1;
    const bn = b.toLowerCase().includes("planilla") ? 0 : 1;
    return an - bn;
  });
  for (const hoja of nombres) {
    const sheet = libro.Sheets[hoja];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    const texto = rows.map((row) => (row ?? []).map((celda) => (celda == null ? "" : String(celda).trim())));
    const leido = leerTrabajadoresExcel(texto);
    if (!leido.error) return { rows: texto };
  }
  return { error: "No encuentro la fila de títulos (DNI, Ítem, Nombre completo)." };
}

async function clasificar(
  entidadId: string,
  filas: FilaLeida[],
  guardarVidaLey: boolean,
): Promise<ClasificacionFila[]> {
  const db = await planillasDb();
  const admin = createAdminClient();
  const lookup = admin?.schema("planillas") ?? db;
  const dnis = [...new Set(filas.map((fila) => fila.dni).filter((dni) => dni.length === 8))];
  const personasRes = dnis.length
    ? await lookup.from("personas").select("id, dni, nombres, apellido_paterno, apellido_materno").in("dni", dnis)
    : { data: [], error: null };
  if (personasRes.error) throw new Error(personasRes.error.message);

  const relacionesRes = await db
    .from("relaciones_laborales")
    .select("numero, personas!persona_id(dni)")
    .eq("entidad_id", entidadId);
  if (relacionesRes.error) throw new Error(relacionesRes.error.message);

  const personas = new Map<string, PersonaExistente>();
  for (const row of (personasRes.data ?? []) as PersonaExistente[]) {
    personas.set(row.dni, row);
  }
  const dnisEmpresa = new Set<string>();
  const numerosEmpresa = new Set<number>();
  for (const row of relacionesRes.data ?? []) {
    if (typeof row.numero === "number") numerosEmpresa.add(row.numero);
    const persona = Array.isArray(row.personas) ? row.personas[0] : row.personas;
    const dni = persona && typeof persona === "object" && "dni" in persona ? String(persona.dni) : "";
    if (dni) dnisEmpresa.add(dni);
  }

  const vistosDni = new Set<string>();
  const vistosNumero = new Set<number>();
  return filas.map((leida) => {
    if (leida.errores.length > 0) {
      return { leida, estado: "omitido" as const, detalle: leida.errores.join(" "), personaId: null };
    }
    if (vistosDni.has(leida.dni)) {
      return { leida, estado: "omitido" as const, detalle: "Ese DNI ya aparece antes en el archivo.", personaId: null };
    }
    vistosDni.add(leida.dni);
    if (leida.numero != null && vistosNumero.has(leida.numero)) {
      return { leida, estado: "omitido" as const, detalle: "Ese número ya aparece antes en el archivo.", personaId: null };
    }
    if (leida.numero != null) vistosNumero.add(leida.numero);
    if (dnisEmpresa.has(leida.dni)) {
      return { leida, estado: "omitido" as const, detalle: "Ya tiene ficha en esta empresa.", personaId: null };
    }
    if (leida.numero != null && numerosEmpresa.has(leida.numero)) {
      return {
        leida,
        estado: "omitido" as const,
        detalle: "Ya hay un trabajador con ese número en esta empresa.",
        personaId: null,
      };
    }
    const existente = personas.get(leida.dni);
    if (existente && !nombresCoinciden(leida.nombreCompleto, nombreCompleto(existente))) {
      return {
        leida,
        estado: "revisar" as const,
        detalle: `El DNI ya está registrado como ${nombreCompleto(existente)}. No se importa.`,
        personaId: null,
      };
    }
    const notas = [...leida.avisos];
    if (existente) notas.unshift("El DNI ya existe y el nombre coincide. Se reutiliza la persona.");
    if (!guardarVidaLey && leida.vidaLey) notas.push("Vida Ley no se guarda: lo registra el estudio.");
    return {
      leida,
      estado: "listo" as const,
      detalle: notas.join(" ") || "Se crea la ficha.",
      personaId: existente?.id ?? null,
    };
  });
}

async function leerClasificado(entidadId: string, formData: FormData): Promise<{ error?: string; filas?: ClasificacionFila[] }> {
  const profile = await requirePlanillasProfile();
  if (!puedeCrearTrabajador(profile)) return { error: "No tiene permiso para importar trabajadores." };
  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return { error: "Empresa no autorizada." };
  if (!entidadId) return { error: "Elija una empresa." };

  const matriz = await matrizDesdeArchivo(formData);
  if (matriz.error || !matriz.rows) return { error: matriz.error ?? "No pude leer el Excel." };
  const leido = leerTrabajadoresExcel(matriz.rows);
  if (leido.error) return { error: leido.error };
  if (leido.filas.length === 0) return { error: "El Excel no tiene trabajadores para importar." };
  const filas = await clasificar(entidadId, leido.filas, puedeEscribirPlanillas(profile));
  return { filas };
}

function aPreview(filas: ClasificacionFila[]): PreviewImportacion {
  return {
    filas: filas.map((fila) => ({
      fila: fila.leida.fila,
      numero: fila.leida.numeroTexto,
      dni: fila.leida.dni,
      nombre: fila.leida.nombreCompleto,
      estado: fila.estado,
      detalle: fila.detalle,
    })),
    listos: filas.filter((fila) => fila.estado === "listo").length,
  };
}

export async function previsualizarImportacionTrabajadores(
  entidadId: string,
  formData: FormData,
): Promise<{ error?: string; preview?: PreviewImportacion }> {
  try {
    const leido = await leerClasificado(entidadId, formData);
    if (leido.error || !leido.filas) return { error: leido.error ?? "No pude leer el Excel." };
    return { preview: aPreview(leido.filas) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pude leer el Excel." };
  }
}

export async function importarTrabajadores(
  entidadId: string,
  formData: FormData,
): Promise<{ error?: string; importados?: number; omitidos?: number }> {
  try {
    const profile = await requirePlanillasProfile();
    const leido = await leerClasificado(entidadId, formData);
    if (leido.error || !leido.filas) return { error: leido.error ?? "No pude leer el Excel." };
    const listos = leido.filas.filter((fila) => fila.estado === "listo");
    if (listos.length === 0) return { error: "No hay filas listas para importar." };

    const db = await planillasDb();
    const estudio = puedeEscribirPlanillas(profile);
    let importados = 0;

    for (const fila of listos) {
      const leida = fila.leida;
      let personaId = fila.personaId;
      if (!personaId) {
        const { data: persona, error } = await db
          .from("personas")
          .insert({
            dni: leida.dni,
            nombres: leida.nombres,
            apellido_paterno: leida.apellidoPaterno,
            apellido_materno: leida.apellidoMaterno,
            fecha_nacimiento: leida.nacimiento,
            celular: leida.celular,
            correo: leida.correo,
            direccion: leida.direccion.direccion,
            tipo_via: leida.direccion.tipo_via,
            via_nombre: leida.direccion.via_nombre,
            via_numero: leida.direccion.via_numero,
            distrito: leida.direccion.distrito,
            provincia: leida.direccion.provincia,
            region: leida.direccion.region,
          })
          .select("id")
          .single();
        if (error || !persona) {
          if (importados > 0) revalidar();
          return { error: error?.message ?? "No se pudo crear la persona.", importados };
        }
        personaId = persona.id as string;
      }

      const { data: relacion, error: relError } = await db
        .from("relaciones_laborales")
        .insert({
          persona_id: personaId,
          entidad_id: entidadId,
          numero: leida.numero,
          cargo: leida.cargo,
          clasificacion: leida.clasificacion,
          jornada: leida.jornada,
          horario: leida.horario,
          fecha_ingreso: leida.fechaIngreso,
          recibe_asignacion_familiar: leida.recibeAsignacion,
          estado: "ACTIVA",
          validacion: esPersonalEstudio(profile.rol) ? "ACEPTADA" : "PENDIENTE",
        })
        .select("id")
        .single();
      if (relError || !relacion) {
        if (importados > 0) revalidar();
        return {
          error: mensajeNumero(relError?.message ?? "") ?? relError?.message ?? "No se pudo crear la ficha.",
          importados,
        };
      }

      const { error: docsError } = await db.from("documentos").insert(
        TIPOS_DOCUMENTO_ALTA_INICIALES.map((tipo) => ({
          relacion_id: relacion.id,
          entidad_id: entidadId,
          tipo,
          estado: "PENDIENTE",
        })),
      );
      if (docsError) {
        if (importados > 0) revalidar();
        return { error: docsError.message, importados };
      }

      if (leida.remuneracion != null) {
        const { error: contratoError } = await db.from("contratos").insert({
          relacion_id: relacion.id,
          entidad_id: entidadId,
          version: 1,
          cargo: leida.cargo,
          horario: leida.horario,
          jornada: leida.jornada,
          fecha_inicio: leida.fechaIngreso,
          remuneracion: leida.remuneracion,
          asignacion_familiar: montoAsignacionFamiliar(leida.recibeAsignacion),
          es_vigente: false,
          estado: "PENDIENTE_DOCS" as EstadoContratoPlanilla,
          datos_confirmados: false,
        });
        if (contratoError) {
          if (importados > 0) revalidar();
          return { error: contratoError.message, importados };
        }
      }

      if (estudio && leida.vidaLey) {
        const { error: vidaError } = await db.from("vida_ley").upsert(
          {
            relacion_id: relacion.id,
            entidad_id: entidadId,
            estado: leida.vidaLey.estado,
            numero_poliza: leida.vidaLey.poliza,
            fecha_inicio: leida.vidaLey.inicio,
            fecha_fin: leida.vidaLey.fin,
          },
          { onConflict: "relacion_id" },
        );
        if (vidaError) {
          if (importados > 0) revalidar();
          return { error: vidaError.message, importados };
        }
      }

      importados += 1;
    }

    revalidar();
    return { importados, omitidos: leido.filas.length - importados };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo importar." };
  }
}
