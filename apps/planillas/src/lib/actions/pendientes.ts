"use server";

import type { EstadoContratoPlanilla, EstadoDocumentoPlanilla, TipoDocumentoPlanilla } from "@inventario/types";
import { entidadAlcance, requirePlanillasProfile } from "@/lib/auth/access";
import { planillasDb } from "@/lib/supabase/planillas";
import {
  ESTADO_CONTRATO_LABEL,
  ESTADO_DOCUMENTO_LABEL,
  TIPO_DOCUMENTO_LABEL,
  nombreCompleto,
  type PendienteItem,
  type PendienteTipo,
} from "@/lib/planillas-labels";

const HORIZONTE_DIAS = 30;

const CONTRATO_EN_TRAMITE = new Set<EstadoContratoPlanilla>([
  "PENDIENTE_DOCS",
  "ELABORADO",
  "ENVIADO_FIRMA",
  "FIRMADO",
  "PRESENTADO_MTPE",
  "RECEPCIONADO",
  "NO_UBICADO",
]);

const DOC_PENDIENTE = new Set<EstadoDocumentoPlanilla>(["PENDIENTE", "NO"]);

type PersonaEmbed = {
  dni: string;
  nombres: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function personaDe(row: { personas?: PersonaEmbed | PersonaEmbed[] | null }): PersonaEmbed | null {
  const raw = row.personas;
  const persona = Array.isArray(raw) ? raw[0] : raw;
  return persona ?? null;
}

export async function listPendientes(entidadId: string): Promise<PendienteItem[]> {
  const profile = await requirePlanillasProfile();
  const alcance = entidadAlcance(profile);
  if (alcance !== "todas" && alcance !== entidadId) return [];

  const db = await planillasDb();
  const { data: relaciones, error } = await db
    .from("relaciones_laborales")
    .select(
      "id, estado, validacion, personas!persona_id (dni, nombres, apellido_paterno, apellido_materno)",
    )
    .eq("entidad_id", entidadId);

  if (error) throw new Error(error.message);
  if (!relaciones?.length) return [];

  const ids = relaciones.map((r) => r.id);
  const [contratosRes, documentosRes, pensionesRes, vidaLeyRes, tRegistroRes] = await Promise.all([
    db.from("contratos").select("relacion_id, es_vigente, estado, fecha_fin").in("relacion_id", ids),
    db.from("documentos").select("id, relacion_id, tipo, estado").in("relacion_id", ids),
    db.from("pensiones").select("relacion_id, tipo, cuspp, tramite_estado").in("relacion_id", ids),
    db.from("vida_ley").select("relacion_id, estado, fecha_fin").in("relacion_id", ids),
    db.from("t_registro").select("relacion_id, tipo, realizado").in("relacion_id", ids),
  ]);

  for (const res of [contratosRes, documentosRes, pensionesRes, vidaLeyRes, tRegistroRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const hoy = todayIso();
  const limite = plusDays(hoy, HORIZONTE_DIAS);
  const items: PendienteItem[] = [];

  for (const relacion of relaciones) {
    const persona = personaDe(relacion);
    if (!persona) continue;
    const nombre = nombreCompleto(persona);
    const base = { relacionId: relacion.id, dni: persona.dni, nombre };
    const activa = relacion.estado === "ACTIVA";
    const pendienteValidacion = relacion.validacion === "PENDIENTE";

    const contratos = (contratosRes.data ?? []).filter((c) => c.relacion_id === relacion.id);
    const documentos = (documentosRes.data ?? []).filter((d) => d.relacion_id === relacion.id);
    const pension = (pensionesRes.data ?? []).find((p) => p.relacion_id === relacion.id);
    const vidaLey = (vidaLeyRes.data ?? []).find((v) => v.relacion_id === relacion.id);
    const tRegistros = (tRegistroRes.data ?? []).filter((t) => t.relacion_id === relacion.id);

    if (pendienteValidacion) {
      items.push({
        ...base,
        id: `${relacion.id}:validacion`,
        tipo: "validacion",
        detalle: "Alta pendiente de validación del estudio",
        tab: "persona",
      });
    }

    if (activa) {
      const vigente = contratos.find((c) => c.es_vigente);
      if (!vigente) {
        items.push({
          ...base,
          id: `${relacion.id}:contrato:sin-vigente`,
          tipo: "contrato",
          detalle: "Sin contrato vigente",
          tab: "contratos",
        });
      } else {
        const estado = vigente.estado as EstadoContratoPlanilla;
        if (CONTRATO_EN_TRAMITE.has(estado)) {
          const detalle =
            estado === "PENDIENTE_DOCS"
              ? "Contrato: falta generar el documento"
              : estado === "ELABORADO"
                ? "Contrato elaborado: falta recoger el firmado"
                : `Contrato: ${ESTADO_CONTRATO_LABEL[estado]}`;
          items.push({
            ...base,
            id: `${relacion.id}:contrato:${estado}`,
            tipo: "contrato",
            detalle,
            tab: "contratos",
          });
        }
        if (vigente.fecha_fin && vigente.fecha_fin <= limite) {
          items.push({
            ...base,
            id: `${relacion.id}:vencimiento:contrato`,
            tipo: "vencimiento",
            detalle:
              vigente.fecha_fin < hoy
                ? `Contrato vencido el ${vigente.fecha_fin}`
                : `Contrato vence el ${vigente.fecha_fin}`,
            tab: "contratos",
          });
        }
      }

      if (!pendienteValidacion) {
        if (!pension) {
        items.push({
          ...base,
          id: `${relacion.id}:afp:sin`,
          tipo: "afp",
          detalle: "Sin sistema de pensiones",
          tab: "pensiones",
        });
      } else if (pension.tipo === "AFP") {
        if (pension.tramite_estado === "PENDIENTE") {
          items.push({
            ...base,
            id: `${relacion.id}:afp:tramite`,
            tipo: "afp",
            detalle: "Trámite AFP pendiente",
            tab: "pensiones",
          });
        } else if (!pension.cuspp?.trim()) {
          items.push({
            ...base,
            id: `${relacion.id}:afp:cuspp`,
            tipo: "afp",
            detalle: "AFP sin CUSPP",
            tab: "pensiones",
          });
        }
      }

      const altaOk = tRegistros.some((t) => t.tipo === "ALTA" && t.realizado);
      if (!altaOk) {
        items.push({
          ...base,
          id: `${relacion.id}:tr:alta`,
          tipo: "t-registro",
          detalle: "Alta en T-Registro pendiente",
          tab: "t-registro",
        });
      }

      if (!vidaLey) {
        items.push({
          ...base,
          id: `${relacion.id}:vidaley:sin`,
          tipo: "vida-ley",
          detalle: "Sin Vida Ley",
          tab: "vida-ley",
        });
      } else {
        if (!vidaLey.estado?.trim()) {
          items.push({
            ...base,
            id: `${relacion.id}:vidaley:estado`,
            tipo: "vida-ley",
            detalle: "Vida Ley sin estado",
            tab: "vida-ley",
          });
        }
        if (!vidaLey.fecha_fin) {
          items.push({
            ...base,
            id: `${relacion.id}:vidaley:sin-fin`,
            tipo: "vida-ley",
            detalle: "Vida Ley sin fecha de fin",
            tab: "vida-ley",
          });
        } else if (vidaLey.fecha_fin <= limite) {
          items.push({
            ...base,
            id: `${relacion.id}:vencimiento:vidaley`,
            tipo: "vencimiento",
            detalle:
              vidaLey.fecha_fin < hoy
                ? `Vida Ley vencida el ${vidaLey.fecha_fin}`
                : `Vida Ley vence el ${vidaLey.fecha_fin}`,
            tab: "vida-ley",
          });
        }
      }
      }

      for (const doc of documentos) {
        const estado = doc.estado as EstadoDocumentoPlanilla;
        if (!DOC_PENDIENTE.has(estado)) continue;
        const tipo = doc.tipo as TipoDocumentoPlanilla;
        if (tipo === "TRAMITE_AFP") continue;
        items.push({
          ...base,
          id: `${relacion.id}:doc:${doc.id}`,
          tipo: "documento",
          detalle: `${TIPO_DOCUMENTO_LABEL[tipo]}: ${ESTADO_DOCUMENTO_LABEL[estado]}`,
          tab: "contratos",
        });
      }
    } else {
      const bajaOk = tRegistros.some((t) => t.tipo === "BAJA" && t.realizado);
      if (!bajaOk) {
        items.push({
          ...base,
          id: `${relacion.id}:tr:baja`,
          tipo: "t-registro",
          detalle: "Baja en T-Registro pendiente",
          tab: "t-registro",
        });
      }
    }
  }

  const ordenTipo: PendienteTipo[] = ["validacion", "contrato", "documento", "afp", "t-registro", "vida-ley", "vencimiento"];
  items.sort((a, b) => {
    const tipo = ordenTipo.indexOf(a.tipo) - ordenTipo.indexOf(b.tipo);
    if (tipo !== 0) return tipo;
    return a.nombre.localeCompare(b.nombre, "es");
  });
  return items;
}
