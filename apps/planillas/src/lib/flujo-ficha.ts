import {
  CHECKLIST_DOCUMENTOS_ALTA_PLANILLAS,
  type EstadoContratoPlanilla,
  type EstadoDocumentoPlanilla,
  type EstadoValidacionAltaPlanilla,
  type TipoDocumentoPlanilla,
} from "@inventario/types";
import { horarioEstaCompleto } from "@/lib/horario-laboral";

export const PASOS_ALTA = [
  { id: "datos", n: 1, label: "Persona y puesto" },
  { id: "documentos", n: 2, label: "Documentos" },
  { id: "contratos", n: 3, label: "Contrato" },
] as const;

export type PasoAltaId = (typeof PASOS_ALTA)[number]["id"];
export type FlujoTab = PasoAltaId | "firma" | "pensiones" | "t-registro" | "vida-ley";

export type FlujoDocumento = {
  tipo: TipoDocumentoPlanilla;
  estado: EstadoDocumentoPlanilla;
  storage_path: string | null;
};

export type FlujoContrato = {
  estado: EstadoContratoPlanilla;
  fecha_inicio: string | null;
  remuneracion: number | null;
  es_vigente: boolean;
  datos_confirmados?: boolean;
};

export type FlujoFichaInput = {
  cargo: string | null;
  horario: string | null;
  direccion: string | null;
  validacion: EstadoValidacionAltaPlanilla;
  contratos: FlujoContrato[];
  documentos: FlujoDocumento[];
};

export type SiguientePaso = {
  paso: PasoAltaId | "listo";
  tab: FlujoTab;
  etiqueta: string;
  rol: "empresa" | "estudio" | "hecho";
};

export function documentoCargado(docs: FlujoDocumento[], tipo: TipoDocumentoPlanilla): boolean {
  return docs.some((d) => d.tipo === tipo && d.estado === "SI" && Boolean(d.storage_path));
}

export function contratoVigente(contratos: FlujoContrato[]): FlujoContrato | null {
  if (contratos.length === 0) return null;
  return contratos.find((c) => c.es_vigente) ?? contratos[0];
}

export function contratoBorrador(contratos: FlujoContrato[]): FlujoContrato | null {
  return (
    contratos.find(
      (c) =>
        !c.datos_confirmados &&
        c.estado !== "RECOGIDO" &&
        c.estado !== "BAJA" &&
        c.estado !== "COMPLETO",
    ) ?? null
  );
}

export function contratoConfirmado(contratos: FlujoContrato[]): FlujoContrato | null {
  return contratos.find((c) => c.datos_confirmados && c.es_vigente) ?? contratos.find((c) => c.datos_confirmados) ?? null;
}

export function estadoPasosAlta(input: FlujoFichaInput): Record<PasoAltaId, boolean> {
  return {
    datos: Boolean(input.cargo?.trim() && horarioEstaCompleto(input.horario) && input.direccion?.trim()),
    documentos: CHECKLIST_DOCUMENTOS_ALTA_PLANILLAS.every((tipo) => documentoCargado(input.documentos, tipo)),
    contratos: Boolean(contratoConfirmado(input.contratos)),
  };
}

export function resolverSiguientePaso(input: FlujoFichaInput, esEstudio: boolean): SiguientePaso {
  const borrador = contratoBorrador(input.contratos);
  const confirmado = contratoConfirmado(input.contratos);
  const vigente = confirmado ?? contratoVigente(input.contratos);
  const firmado = documentoCargado(input.documentos, "CONTRATO_FIRMADO");
  const pasos = estadoPasosAlta(input);

  if (!pasos.datos) {
    return { paso: "datos", tab: "datos", etiqueta: "Completar puesto", rol: "empresa" };
  }
  if (!pasos.documentos) {
    return { paso: "documentos", tab: "documentos", etiqueta: "Subir documentos", rol: "empresa" };
  }
  if (!borrador && !confirmado) {
    return { paso: "contratos", tab: "contratos", etiqueta: "Generar contrato", rol: "empresa" };
  }
  if (borrador && !firmado) {
    return { paso: "contratos", tab: "contratos", etiqueta: "Subir contrato firmado", rol: "empresa" };
  }
  if (borrador && firmado) {
    return { paso: "contratos", tab: "contratos", etiqueta: "Confirmar datos del firmado", rol: "empresa" };
  }
  if (input.validacion === "PENDIENTE") {
    return esEstudio
      ? { paso: "datos", tab: "datos", etiqueta: "Validar alta", rol: "estudio" }
      : { paso: "contratos", tab: "contratos", etiqueta: "En revisión del estudio", rol: "empresa" };
  }
  if (vigente?.estado === "ELABORADO" && firmado) {
    return esEstudio
      ? { paso: "contratos", tab: "contratos", etiqueta: "Marcar recogido", rol: "estudio" }
      : { paso: "contratos", tab: "contratos", etiqueta: "En revisión del estudio", rol: "empresa" };
  }
  if (vigente?.estado === "RECOGIDO" || vigente?.estado === "COMPLETO") {
    return { paso: "listo", tab: "contratos", etiqueta: "Recogido", rol: "hecho" };
  }
  return { paso: "contratos", tab: "contratos", etiqueta: "Revisar contrato", rol: "empresa" };
}

export function claseBadgePaso(rol: SiguientePaso["rol"]): string {
  if (rol === "estudio") return "bg-amber-100 text-amber-950";
  if (rol === "hecho") return "bg-emerald-100 text-emerald-950";
  return "bg-sky-100 text-sky-950";
}

export function flujoDesdeTrabajador(input: {
  cargo: string | null;
  horario: string | null;
  persona: { direccion: string | null };
  validacion: EstadoValidacionAltaPlanilla;
  contratos: FlujoContrato[];
  documentos: FlujoDocumento[];
}): FlujoFichaInput {
  return {
    cargo: input.cargo,
    horario: input.horario,
    direccion: input.persona.direccion,
    validacion: input.validacion,
    contratos: input.contratos,
    documentos: input.documentos,
  };
}
