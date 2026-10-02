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
  fecha_nacimiento: string | null;
  celular: string | null;
  correo: string | null;
  direccion: string | null;
  tipo_via: string | null;
  via_nombre: string | null;
  via_numero: string | null;
  distrito: string | null;
  provincia: string | null;
  region: string | null;
};

type RelacionExistente = {
  id: string;
  numero: number | null;
  cargo: string | null;
  clasificacion: string | null;
  jornada: string | null;
  horario: string | null;
  fecha_ingreso: string | null;
  fecha_cese: string | null;
  recibe_asignacion_familiar: boolean | null;
  persona: PersonaExistente;
};

type ContratoExistente = {
  id: string;
  version: number;
  es_vigente: boolean;
  cargo: string | null;
  horario: string | null;
  jornada: string | null;
  fecha_inicio: string | null;
  remuneracion: number | string | null;
  asignacion_familiar: number | string | null;
};

type VidaLeyExistente = {
  estado: string | null;
  numero_poliza: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

type PlanCompletado = {
  persona: Record<string, string>;
  relacion: Record<string, string | number | boolean>;
  contrato: Record<string, string | number | null>;
  crearContrato: boolean;
  vida: Record<string, string | null>;
  crearVida: boolean;
};

type ClasificacionFila = {
  leida: FilaLeida;
  estado: FilaImportPreview["estado"];
  detalle: string;
  personaId: string | null;
  relacionId: string | null;
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

function sinDato(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function textoSiVacio(patch: Record<string, string>, campo: string, actual: string | null | undefined, nuevo: string | null | undefined) {
  const valor = nuevo?.trim();
  if (!valor || !sinDato(actual)) return;
  patch[campo] = valor;
}

function planVacio(): PlanCompletado {
  return { persona: {}, relacion: {}, contrato: {}, crearContrato: false, vida: {}, crearVida: false };
}

function hayCambios(plan: PlanCompletado): boolean {
  return (
    Object.keys(plan.persona).length > 0 ||
    Object.keys(plan.relacion).length > 0 ||
    Object.keys(plan.contrato).length > 0 ||
    plan.crearContrato ||
    Object.keys(plan.vida).length > 0 ||
    plan.crearVida
  );
}

function planPersona(persona: PersonaExistente, leida: FilaLeida): Record<string, string> {
  const patch: Record<string, string> = {};
  textoSiVacio(patch, "apellido_paterno", persona.apellido_paterno, leida.apellidoPaterno);
  textoSiVacio(patch, "apellido_materno", persona.apellido_materno, leida.apellidoMaterno);
  textoSiVacio(patch, "fecha_nacimiento", persona.fecha_nacimiento, leida.nacimiento);
  textoSiVacio(patch, "celular", persona.celular, leida.celular);
  textoSiVacio(patch, "correo", persona.correo, leida.correo);
  textoSiVacio(patch, "direccion", persona.direccion, leida.direccion.direccion);
  textoSiVacio(patch, "tipo_via", persona.tipo_via, leida.direccion.tipo_via);
  textoSiVacio(patch, "via_nombre", persona.via_nombre, leida.direccion.via_nombre);
  textoSiVacio(patch, "via_numero", persona.via_numero, leida.direccion.via_numero);
  textoSiVacio(patch, "distrito", persona.distrito, leida.direccion.distrito);
  textoSiVacio(patch, "provincia", persona.provincia, leida.direccion.provincia);
  textoSiVacio(patch, "region", persona.region, leida.direccion.region);
  return patch;
}

function planDeCompletado(
  persona: PersonaExistente,
  relacion: RelacionExistente,
  contrato: ContratoExistente | null,
  vida: VidaLeyExistente | null,
  leida: FilaLeida,
  numeroLibre: boolean,
  guardarVidaLey: boolean,
): PlanCompletado {
  const plan = planVacio();
  plan.persona = planPersona(persona, leida);
  if (leida.numero != null && relacion.numero == null && numeroLibre) plan.relacion.numero = leida.numero;
  if (leida.cargo && sinDato(relacion.cargo)) plan.relacion.cargo = leida.cargo;
  if (leida.clasificacion && sinDato(relacion.clasificacion)) plan.relacion.clasificacion = leida.clasificacion;
  if (leida.jornada && sinDato(relacion.jornada)) plan.relacion.jornada = leida.jornada;
  if (leida.horario && sinDato(relacion.horario)) plan.relacion.horario = leida.horario;
  if (leida.fechaIngreso && sinDato(relacion.fecha_ingreso)) plan.relacion.fecha_ingreso = leida.fechaIngreso;
  if (leida.recibeAsignacion != null && relacion.recibe_asignacion_familiar == null) {
    plan.relacion.recibe_asignacion_familiar = leida.recibeAsignacion;
  }
  if (!contrato && leida.remuneracion != null) {
    plan.crearContrato = true;
  } else if (contrato) {
    if (leida.cargo && sinDato(contrato.cargo)) plan.contrato.cargo = leida.cargo;
    if (leida.horario && sinDato(contrato.horario)) plan.contrato.horario = leida.horario;
    if (leida.jornada && sinDato(contrato.jornada)) plan.contrato.jornada = leida.jornada;
    if (leida.fechaIngreso && sinDato(contrato.fecha_inicio)) plan.contrato.fecha_inicio = leida.fechaIngreso;
    if (leida.remuneracion != null && sinDato(contrato.remuneracion)) plan.contrato.remuneracion = leida.remuneracion;
    if (leida.recibeAsignacion != null && sinDato(contrato.asignacion_familiar)) {
      plan.contrato.asignacion_familiar = montoAsignacionFamiliar(leida.recibeAsignacion);
    }
  }
  if (guardarVidaLey && leida.vidaLey) {
    if (!vida) plan.crearVida = true;
    else {
      if (leida.vidaLey.estado && sinDato(vida.estado)) plan.vida.estado = leida.vidaLey.estado;
      if (leida.vidaLey.poliza && sinDato(vida.numero_poliza)) plan.vida.numero_poliza = leida.vidaLey.poliza;
      if (leida.vidaLey.inicio && sinDato(vida.fecha_inicio)) plan.vida.fecha_inicio = leida.vidaLey.inicio;
      if (leida.vidaLey.fin && sinDato(vida.fecha_fin)) plan.vida.fecha_fin = leida.vidaLey.fin;
    }
  }
  return plan;
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
  const personaSelect =
    "id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, celular, correo, direccion, tipo_via, via_nombre, via_numero, distrito, provincia, region";
  const personasRes = dnis.length
    ? await lookup.from("personas").select(personaSelect).in("dni", dnis)
    : { data: [], error: null };
  if (personasRes.error) throw new Error(personasRes.error.message);

  const relacionesRes = await db
    .from("relaciones_laborales")
    .select(
      `id, numero, cargo, clasificacion, jornada, horario, fecha_ingreso, fecha_cese, recibe_asignacion_familiar, personas!persona_id(${personaSelect})`,
    )
    .eq("entidad_id", entidadId);
  if (relacionesRes.error) throw new Error(relacionesRes.error.message);

  const personas = new Map<string, PersonaExistente>();
  for (const row of (personasRes.data ?? []) as PersonaExistente[]) {
    personas.set(row.dni, row);
  }
  const relaciones = new Map<string, RelacionExistente>();
  const numerosEmpresa = new Set<number>();
  for (const row of relacionesRes.data ?? []) {
    if (typeof row.numero === "number") numerosEmpresa.add(row.numero);
    const anidada = Array.isArray(row.personas) ? row.personas[0] : row.personas;
    if (!anidada || typeof anidada !== "object" || !("dni" in anidada)) continue;
    const persona = anidada as PersonaExistente;
    const candidata: RelacionExistente = {
      id: row.id as string,
      numero: typeof row.numero === "number" ? row.numero : null,
      cargo: (row.cargo as string | null) ?? null,
      clasificacion: (row.clasificacion as string | null) ?? null,
      jornada: (row.jornada as string | null) ?? null,
      horario: (row.horario as string | null) ?? null,
      fecha_ingreso: (row.fecha_ingreso as string | null) ?? null,
      fecha_cese: (row.fecha_cese as string | null) ?? null,
      recibe_asignacion_familiar: (row.recibe_asignacion_familiar as boolean | null) ?? null,
      persona,
    };
    const previa = relaciones.get(persona.dni);
    if (!previa || (previa.fecha_cese && !candidata.fecha_cese)) relaciones.set(persona.dni, candidata);
  }

  const relacionIds = [...relaciones.values()].map((relacion) => relacion.id);
  const contratosRes = relacionIds.length
    ? await db
        .from("contratos")
        .select("id, relacion_id, version, es_vigente, cargo, horario, jornada, fecha_inicio, remuneracion, asignacion_familiar")
        .in("relacion_id", relacionIds)
    : { data: [], error: null };
  if (contratosRes.error) throw new Error(contratosRes.error.message);
  const vidasRes = relacionIds.length
    ? await db
        .from("vida_ley")
        .select("relacion_id, estado, numero_poliza, fecha_inicio, fecha_fin")
        .in("relacion_id", relacionIds)
    : { data: [], error: null };
  if (vidasRes.error) throw new Error(vidasRes.error.message);

  const contratos = new Map<string, ContratoExistente>();
  for (const row of contratosRes.data ?? []) {
    const actual = contratos.get(row.relacion_id as string);
    const candidata = row as ContratoExistente & { relacion_id: string };
    if (!actual || candidata.es_vigente || (!actual.es_vigente && candidata.version > actual.version)) {
      contratos.set(candidata.relacion_id, candidata);
    }
  }
  const vidas = new Map<string, VidaLeyExistente>();
  for (const row of vidasRes.data ?? []) {
    vidas.set(row.relacion_id as string, {
      estado: (row.estado as string | null) ?? null,
      numero_poliza: (row.numero_poliza as string | null) ?? null,
      fecha_inicio: (row.fecha_inicio as string | null) ?? null,
      fecha_fin: (row.fecha_fin as string | null) ?? null,
    });
  }

  const vistosDni = new Set<string>();
  const vistosNumero = new Set<number>();
  return filas.map((leida) => {
    const vacia = { leida, personaId: null, relacionId: null };
    if (leida.errores.length > 0) {
      return { ...vacia, estado: "omitido" as const, detalle: leida.errores.join(" ") };
    }
    if (vistosDni.has(leida.dni)) {
      return { ...vacia, estado: "omitido" as const, detalle: "Ese DNI ya aparece antes en el archivo." };
    }
    vistosDni.add(leida.dni);
    if (leida.numero != null && vistosNumero.has(leida.numero)) {
      return { ...vacia, estado: "omitido" as const, detalle: "Ese número ya aparece antes en el archivo." };
    }
    if (leida.numero != null) vistosNumero.add(leida.numero);

    const relacion = relaciones.get(leida.dni);
    const existente = personas.get(leida.dni) ?? relacion?.persona;
    if (existente && !nombresCoinciden(leida.nombreCompleto, nombreCompleto(existente))) {
      return {
        ...vacia,
        estado: "revisar" as const,
        detalle: `El DNI ya está registrado como ${nombreCompleto(existente)}. No se importa.`,
      };
    }

    if (relacion && existente) {
      const numeroLibre = leida.numero == null || leida.numero === relacion.numero || !numerosEmpresa.has(leida.numero);
      const plan = planDeCompletado(
        existente,
        relacion,
        contratos.get(relacion.id) ?? null,
        vidas.get(relacion.id) ?? null,
        leida,
        numeroLibre,
        guardarVidaLey,
      );
      if (!hayCambios(plan)) {
        return { ...vacia, personaId: existente.id, estado: "omitido" as const, detalle: "Ya tiene ficha y no hay datos vacíos por completar." };
      }
      const notas = ["Ya tiene ficha. Se completan solo los datos que están vacíos."];
      if (leida.numero != null && relacion.numero == null && !numeroLibre) {
        notas.push("El número ya lo usa otro trabajador; ese dato no se asigna.");
      }
      if (!guardarVidaLey && leida.vidaLey) notas.push("Vida Ley no se guarda: lo registra el estudio.");
      return {
        leida,
        estado: "listo" as const,
        detalle: notas.join(" "),
        personaId: existente.id,
        relacionId: relacion.id,
      };
    }

    if (leida.numero != null && numerosEmpresa.has(leida.numero)) {
      return {
        ...vacia,
        estado: "omitido" as const,
        detalle: "Ya hay un trabajador con ese número en esta empresa.",
      };
    }
    const notas = [...leida.avisos];
    if (existente) {
      const faltan = Object.keys(planPersona(existente, leida));
      notas.unshift(
        faltan.length > 0
          ? "El DNI ya existe. Se reutiliza la persona y se completan sus datos vacíos."
          : "El DNI ya existe y el nombre coincide. Se reutiliza la persona.",
      );
    }
    if (!guardarVidaLey && leida.vidaLey) notas.push("Vida Ley no se guarda: lo registra el estudio.");
    return {
      leida,
      estado: "listo" as const,
      detalle: notas.join(" ") || "Se crea la ficha.",
      personaId: existente?.id ?? null,
      relacionId: null,
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

async function aplicarFichaExistente(
  db: Awaited<ReturnType<typeof planillasDb>>,
  entidadId: string,
  relacionId: string,
  leida: FilaLeida,
  guardarVidaLey: boolean,
): Promise<{ error?: string; cambios?: boolean }> {
  const { data: relacionRow, error: relError } = await db
    .from("relaciones_laborales")
    .select(
      "id, numero, cargo, clasificacion, jornada, horario, fecha_ingreso, fecha_cese, recibe_asignacion_familiar, personas!persona_id(id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, celular, correo, direccion, tipo_via, via_nombre, via_numero, distrito, provincia, region)",
    )
    .eq("id", relacionId)
    .maybeSingle();
  if (relError) return { error: relError.message };
  const anidada = relacionRow ? (Array.isArray(relacionRow.personas) ? relacionRow.personas[0] : relacionRow.personas) : null;
  if (!relacionRow || !anidada) return { error: "No se encontró la ficha del trabajador." };
  const persona = anidada as PersonaExistente;
  const relacion: RelacionExistente = {
    id: relacionRow.id as string,
    numero: typeof relacionRow.numero === "number" ? relacionRow.numero : null,
    cargo: (relacionRow.cargo as string | null) ?? null,
    clasificacion: (relacionRow.clasificacion as string | null) ?? null,
    jornada: (relacionRow.jornada as string | null) ?? null,
    horario: (relacionRow.horario as string | null) ?? null,
    fecha_ingreso: (relacionRow.fecha_ingreso as string | null) ?? null,
    fecha_cese: (relacionRow.fecha_cese as string | null) ?? null,
    recibe_asignacion_familiar: (relacionRow.recibe_asignacion_familiar as boolean | null) ?? null,
    persona,
  };

  let numeroLibre = leida.numero == null || leida.numero === relacion.numero;
  if (leida.numero != null && relacion.numero == null) {
    const ocupado = await db
      .from("relaciones_laborales")
      .select("id")
      .eq("entidad_id", entidadId)
      .eq("numero", leida.numero)
      .neq("id", relacionId)
      .limit(1);
    if (ocupado.error) return { error: ocupado.error.message };
    numeroLibre = (ocupado.data ?? []).length === 0;
  }

  const contratoRes = await db
    .from("contratos")
    .select("id, version, es_vigente, cargo, horario, jornada, fecha_inicio, remuneracion, asignacion_familiar")
    .eq("relacion_id", relacionId);
  if (contratoRes.error) return { error: contratoRes.error.message };
  const contratos = (contratoRes.data ?? []) as ContratoExistente[];
  const contrato =
    contratos.find((item) => item.es_vigente) ?? [...contratos].sort((a, b) => b.version - a.version)[0] ?? null;
  const vidaRes = await db
    .from("vida_ley")
    .select("estado, numero_poliza, fecha_inicio, fecha_fin")
    .eq("relacion_id", relacionId)
    .maybeSingle();
  if (vidaRes.error) return { error: vidaRes.error.message };
  const vida = (vidaRes.data as VidaLeyExistente | null) ?? null;
  const plan = planDeCompletado(persona, relacion, contrato, vida, leida, numeroLibre, guardarVidaLey);
  if (!hayCambios(plan)) return { cambios: false };

  if (Object.keys(plan.persona).length > 0) {
    const { error } = await db.from("personas").update(plan.persona).eq("id", persona.id);
    if (error) return { error: error.message };
  }
  if (Object.keys(plan.relacion).length > 0) {
    const { error } = await db.from("relaciones_laborales").update(plan.relacion).eq("id", relacionId);
    if (error) return { error: mensajeNumero(error.message) ?? error.message };
  }
  if (plan.crearContrato) {
    const { error } = await db.from("contratos").insert({
      relacion_id: relacionId,
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
    if (error) return { error: error.message };
  } else if (contrato && Object.keys(plan.contrato).length > 0) {
    const { error } = await db.from("contratos").update(plan.contrato).eq("id", contrato.id);
    if (error) return { error: error.message };
  }
  if (plan.crearVida && leida.vidaLey) {
    const { error } = await db.from("vida_ley").upsert(
      {
        relacion_id: relacionId,
        entidad_id: entidadId,
        estado: leida.vidaLey.estado,
        numero_poliza: leida.vidaLey.poliza,
        fecha_inicio: leida.vidaLey.inicio,
        fecha_fin: leida.vidaLey.fin,
      },
      { onConflict: "relacion_id" },
    );
    if (error) return { error: error.message };
  } else if (Object.keys(plan.vida).length > 0) {
    const { error } = await db.from("vida_ley").update(plan.vida).eq("relacion_id", relacionId);
    if (error) return { error: error.message };
  }
  return { cambios: true };
}

async function completarPersonaExistente(
  db: Awaited<ReturnType<typeof planillasDb>>,
  personaId: string,
  leida: FilaLeida,
): Promise<{ error?: string }> {
  const { data, error } = await db
    .from("personas")
    .select(
      "id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, celular, correo, direccion, tipo_via, via_nombre, via_numero, distrito, provincia, region",
    )
    .eq("id", personaId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return {};
  const patch = planPersona(data as PersonaExistente, leida);
  if (Object.keys(patch).length === 0) return {};
  const guardado = await db.from("personas").update(patch).eq("id", personaId);
  if (guardado.error) return { error: guardado.error.message };
  return {};
}

export async function importarTrabajadores(
  entidadId: string,
  formData: FormData,
): Promise<{ error?: string; importados?: number; completados?: number; omitidos?: number }> {
  try {
    const profile = await requirePlanillasProfile();
    const leido = await leerClasificado(entidadId, formData);
    if (leido.error || !leido.filas) return { error: leido.error ?? "No pude leer el Excel." };
    const listos = leido.filas.filter((fila) => fila.estado === "listo");
    if (listos.length === 0) return { error: "No hay filas listas para importar." };

    const db = await planillasDb();
    const estudio = puedeEscribirPlanillas(profile);
    let importados = 0;
    let completados = 0;
    const omitidos = leido.filas.filter((fila) => fila.estado !== "listo").length;

    for (const fila of listos) {
      const leida = fila.leida;
      if (fila.relacionId) {
        const aplicado = await aplicarFichaExistente(db, entidadId, fila.relacionId, leida, estudio);
        if (aplicado.error) {
          if (importados > 0 || completados > 0) revalidar();
          return { error: aplicado.error, importados, completados };
        }
        if (aplicado.cambios) {
          completados += 1;
          revalidatePath(`/trabajadores/${fila.relacionId}`);
        }
        continue;
      }
      let personaId = fila.personaId;
      if (personaId) {
        const persona = await completarPersonaExistente(db, personaId, leida);
        if (persona.error) {
          if (importados > 0 || completados > 0) revalidar();
          return { error: persona.error, importados, completados };
        }
      }
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
          if (importados > 0 || completados > 0) revalidar();
          return { error: error?.message ?? "No se pudo crear la persona.", importados, completados };
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
        if (importados > 0 || completados > 0) revalidar();
        return {
          error: mensajeNumero(relError?.message ?? "") ?? relError?.message ?? "No se pudo crear la ficha.",
          importados,
          completados,
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
        if (importados > 0 || completados > 0) revalidar();
        return { error: docsError.message, importados, completados };
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
          if (importados > 0 || completados > 0) revalidar();
          return { error: contratoError.message, importados, completados };
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
          if (importados > 0 || completados > 0) revalidar();
          return { error: vidaError.message, importados, completados };
        }
      }

      importados += 1;
      revalidatePath(`/trabajadores/${relacion.id}`);
    }

    revalidar();
    return { importados, completados, omitidos };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo importar." };
  }
}
