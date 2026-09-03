import { labelFechaCorte, labelFechaEmision } from "@inventario/types";
import { EMPRESA } from "./branding";
import { esReporteAdquiridosEjercicio } from "./ejercicio";
import { reporteTitulo } from "./rows";
import type { ReporteContexto } from "./types";
import { REPORTES } from "./types";

export function fechaCorteCalculo(ctx: ReporteContexto): Date {
  if (ctx.fechaCorte) {
    return new Date(`${ctx.fechaCorte}T12:00:00`);
  }
  return new Date(ctx.fechaGeneracion);
}

export interface ReporteInstitutionalHeader {
  titulo: string;
  razonSocial: string;
  productoRuc: string;
  fechaEmision: string;
  fechaCorte: string | null;
  metaLine: string;
  usuarioLine: string;
}

export function buildInstitutionalHeader(
  ctx: ReporteContexto,
  totalRegistros: number,
): ReporteInstitutionalHeader {
  const def = REPORTES.find((r) => r.id === ctx.reporteId)!;
  const metaParts: string[] = [`Entidad: ${ctx.entidadNombre}`];

  if (def.scope === "ambiente") {
    if (ctx.sedeNombre) metaParts.push(`Sede: ${ctx.sedeNombre}`);
    if (ctx.ambienteNombre) metaParts.push(`Ambiente: ${ctx.ambienteNombre}`);
    if (ctx.responsable?.trim()) metaParts.push(`Responsable: ${ctx.responsable.trim()}`);
  }
  metaParts.push(`Registros: ${totalRegistros}`);

  const mostrarCorte = Boolean(ctx.fechaCorte) && !esReporteAdquiridosEjercicio(ctx.reporteId);

  return {
    titulo: reporteTitulo(ctx.reporteId, def.valorizado, ctx.fechaCorte ?? undefined),
    razonSocial: EMPRESA.razonSocial,
    productoRuc: `${EMPRESA.producto}  ·  RUC ${EMPRESA.ruc}`,
    fechaEmision: labelFechaEmision(ctx.fechaGeneracion),
    fechaCorte: mostrarCorte && ctx.fechaCorte ? labelFechaCorte(ctx.fechaCorte) : null,
    metaLine: metaParts.join("   |   "),
    usuarioLine: `${ctx.usuarioNombre} · ${ctx.usuarioEmail}`,
  };
}
