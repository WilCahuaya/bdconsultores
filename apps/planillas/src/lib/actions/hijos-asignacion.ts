"use server";

import { revalidatePath } from "next/cache";
import { evaluarHijo, hoyLima } from "@/lib/asignacion-familiar";
import { puedeEditarFichaLaboral, requirePlanillasProfile } from "@/lib/auth/access";
import { parseFechaCampo } from "@/lib/planillas-labels";
import { planillasDb } from "@/lib/supabase/planillas";
import { getTrabajador } from "@/lib/actions/trabajadores";

export type HijoAsignacionRow = {
  id: string;
  nombre: string;
  fecha_nacimiento: string;
  menor: boolean;
  estudios_superiores: boolean;
  discapacidad: boolean;
};

export type HijoAsignacionInput = {
  nombre: string;
  fechaNacimiento: string;
  menor: boolean;
  estudios: boolean;
  discapacidad: boolean;
};

export async function listHijosAsignacion(relacionId: string): Promise<HijoAsignacionRow[]> {
  await requirePlanillasProfile();
  const db = await planillasDb();
  const { data, error } = await db
    .from("hijos_asignacion")
    .select("id, nombre, fecha_nacimiento, menor, estudios_superiores, discapacidad")
    .eq("relacion_id", relacionId)
    .order("fecha_nacimiento", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as HijoAsignacionRow[];
}

export async function guardarHijosAsignacion(
  relacionId: string,
  hijos: HijoAsignacionInput[],
): Promise<{ error?: string; recibe?: boolean }> {
  const profile = await requirePlanillasProfile();
  if (!puedeEditarFichaLaboral(profile)) return { error: "No tiene permiso para editar." };
  const trabajador = await getTrabajador(relacionId);
  if (!trabajador) return { error: "Trabajador no encontrado." };

  const hoy = hoyLima();
  const filas: {
    relacion_id: string;
    nombre: string;
    fecha_nacimiento: string;
    menor: boolean;
    estudios_superiores: boolean;
    discapacidad: boolean;
  }[] = [];

  for (const hijo of hijos) {
    const nombre = hijo.nombre.trim().replace(/\s+/g, " ");
    if (!nombre) return { error: "Indique el nombre completo de cada hijo." };
    if (nombre.length > 200) return { error: "El nombre del hijo es demasiado largo." };
    const fecha = parseFechaCampo(hijo.fechaNacimiento, "Fecha de nacimiento");
    if (fecha.error || !fecha.value) return { error: fecha.error ?? "Indique la fecha de nacimiento." };
    const evaluacion = evaluarHijo(
      {
        fechaNacimiento: fecha.value,
        menor: hijo.menor,
        estudios: hijo.estudios,
        discapacidad: hijo.discapacidad,
      },
      hoy,
    );
    if (evaluacion.edad == null || evaluacion.edad > 120) {
      return { error: evaluacion.avisos[0] ?? "Revise la fecha de nacimiento." };
    }
    if (!hijo.menor && !hijo.estudios && !hijo.discapacidad) {
      return { error: `Indique si ${nombre} es menor de 18, por estudios superiores o por discapacidad.` };
    }
    filas.push({
      relacion_id: relacionId,
      nombre,
      fecha_nacimiento: fecha.value,
      menor: hijo.menor,
      estudios_superiores: hijo.estudios,
      discapacidad: hijo.discapacidad,
    });
  }

  const recibe = filas.some((fila) =>
    evaluarHijo(
      {
        fechaNacimiento: fila.fecha_nacimiento,
        menor: fila.menor,
        estudios: fila.estudios_superiores,
        discapacidad: fila.discapacidad,
      },
      hoy,
    ).corresponde,
  );

  const db = await planillasDb();
  const { error: deleteError } = await db.from("hijos_asignacion").delete().eq("relacion_id", relacionId);
  if (deleteError) return { error: deleteError.message };
  if (filas.length > 0) {
    const { error: insertError } = await db.from("hijos_asignacion").insert(filas);
    if (insertError) return { error: insertError.message };
  }
  const { error: relError } = await db
    .from("relaciones_laborales")
    .update({ recibe_asignacion_familiar: recibe })
    .eq("id", relacionId);
  if (relError) return { error: relError.message };

  revalidatePath(`/trabajadores/${relacionId}`);
  revalidatePath(`/contratos/${relacionId}`);
  revalidatePath("/contratos");
  revalidatePath("/pendientes");
  revalidatePath("/");
  return { recibe };
}
