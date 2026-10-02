import { parseFechaCampo } from "@/lib/planillas-labels";

export type MotivoAsignacion = "menor" | "estudios" | "discapacidad";

export type HijoAsignacionEval = {
  fechaNacimiento: string;
  menor: boolean;
  estudios: boolean;
  discapacidad: boolean;
};

export type EvaluacionHijo = {
  edad: number | null;
  corresponde: boolean;
  motivos: MotivoAsignacion[];
  avisos: string[];
};

const DOC_MENOR = "partida de nacimiento";
const DOC_ESTUDIOS = "constancia de estudios superiores del periodo vigente";
const DOC_DISCAPACIDAD = "certificado de discapacidad";

export function hoyLima(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function edadCumplida(nacimientoIso: string, hoyIso: string): number | null {
  const nacimiento = nacimientoIso.slice(0, 10);
  const hoy = hoyIso.slice(0, 10);
  const [anioN, mesN, diaN] = nacimiento.split("-").map(Number);
  const [anioH, mesH, diaH] = hoy.split("-").map(Number);
  if (!anioN || !mesN || !diaN || !anioH || !mesH || !diaH) return null;
  let edad = anioH - anioN;
  if (mesH < mesN || (mesH === mesN && diaH < diaN)) edad -= 1;
  return edad;
}

export function evaluarHijo(hijo: HijoAsignacionEval, hoy = hoyLima()): EvaluacionHijo {
  const fecha = parseFechaCampo(hijo.fechaNacimiento, "Fecha de nacimiento");
  if (fecha.error || !fecha.value) {
    return { edad: null, corresponde: false, motivos: [], avisos: ["Indique la fecha de nacimiento."] };
  }
  if (fecha.value > hoy) {
    return { edad: null, corresponde: false, motivos: [], avisos: ["La fecha de nacimiento no puede ser futura."] };
  }
  const edad = edadCumplida(fecha.value, hoy);
  if (edad == null || edad > 120) {
    return { edad, corresponde: false, motivos: [], avisos: ["Revise la fecha de nacimiento."] };
  }

  const motivos: MotivoAsignacion[] = [];
  const avisos: string[] = [];

  if (hijo.menor) {
    if (edad < 18) motivos.push("menor");
    else avisos.push("La fecha indica que ya cumplió 18 años. No cuenta como menor.");
  }
  if (hijo.estudios) {
    if (edad < 18) avisos.push("Aún no cumple 18. Márquelo como menor de 18.");
    else if (edad >= 24) avisos.push("Los estudios superiores dejan de contar al cumplir 24 años.");
    else motivos.push("estudios");
  }
  if (hijo.discapacidad) motivos.push("discapacidad");

  return { edad, corresponde: motivos.length > 0, motivos, avisos };
}

export function textoResultadoHijo(evaluacion: EvaluacionHijo): string {
  if (evaluacion.edad == null) return "No corresponde";
  const edad = `${evaluacion.edad} ${evaluacion.edad === 1 ? "año" : "años"}`;
  if (!evaluacion.corresponde) return `No corresponde · ${edad}`;
  const motivos = evaluacion.motivos.map((motivo) => {
    if (motivo === "menor") return "menor de 18";
    if (motivo === "estudios") return "estudios superiores";
    return "discapacidad";
  });
  return `Corresponde por ${unir(motivos)} · ${edad}`;
}

export function papelesAsignacion(evaluaciones: EvaluacionHijo[]): string[] {
  const papeles: string[] = [];
  if (evaluaciones.some((item) => item.motivos.includes("menor"))) papeles.push(DOC_MENOR);
  if (evaluaciones.some((item) => item.motivos.includes("estudios"))) papeles.push(DOC_ESTUDIOS);
  if (evaluaciones.some((item) => item.motivos.includes("discapacidad"))) papeles.push(DOC_DISCAPACIDAD);
  return papeles;
}

export function hintArchivoAsignacion(evaluaciones: EvaluacionHijo[]): string {
  const papeles = papelesAsignacion(evaluaciones);
  if (papeles.length === 0) {
    return "Con estos datos no corresponde la asignación. No hace falta subir el archivo.";
  }
  return `Suba un solo archivo con ${unir(papeles)}. Si hay varios hijos, van juntos en ese archivo.`;
}

function unir(partes: string[]): string {
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return `${partes[0]} y ${partes[1]}`;
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}
