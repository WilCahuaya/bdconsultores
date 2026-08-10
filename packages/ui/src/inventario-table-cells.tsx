"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Activo, CategoriaBien, EstadoBien } from "@inventario/types";
import {
  buildDescripcionBien,
  calcPeriodoMeses,
  calcValorizacionActivo,
  resolveFechaInicioDepreciacion,
  valorActivoEfectivo,
  categoriaBienLetra,
  estadoBienLabel,
  formatActivoCodigoDisplay,
  formatCuentaContableDisplay,
  formatFechaISOToCortoES,
  splitObservacionActivo,
  formatFechaISOToDDMMYYYY,
  formatMonedaPE,
} from "@inventario/types";
import { ObservacionActivoDisplay } from "./observacion-activo-display";

export const INVENTARIO_TABLA_LEYENDA =
  "A = Activo · C = Cuenta de orden · PA = Precio adquisición · VM = Valor mercado";

export type InventarioTablaBadgeKind = "A" | "C" | "PA" | "VM";

export function inventarioTablaBadgeClass(kind: InventarioTablaBadgeKind): string {
  switch (kind) {
    case "A":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
    case "C":
      return "bg-violet-500/15 text-violet-900 dark:text-violet-200";
    case "PA":
      return "bg-sky-500/15 text-sky-900 dark:text-sky-200";
    case "VM":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-200";
  }
}

const inventarioTablaBadgeBaseClass =
  "inline-block shrink-0 rounded px-1 py-0.5 text-[9px] font-bold leading-none";

export function InventarioTablaLeyendaBadge({ kind }: { kind: InventarioTablaBadgeKind }) {
  return (
    <span className={`${inventarioTablaBadgeBaseClass} ${inventarioTablaBadgeClass(kind)}`}>
      {kind}
    </span>
  );
}

function InventarioTablaLeyendaItem({
  kind,
  label,
}: {
  kind: InventarioTablaBadgeKind;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <InventarioTablaLeyendaBadge kind={kind} />
      <span>= {label}</span>
    </span>
  );
}

export function InventarioTablaLeyenda({
  className,
  inline = false,
}: {
  className?: string;
  inline?: boolean;
}) {
  return (
    <div
      role="note"
      aria-label={INVENTARIO_TABLA_LEYENDA}
      className={
        inline
          ? `text-[10px] leading-relaxed text-muted-foreground sm:text-xs ${className ?? ""}`
          : `border-t border-border/50 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground sm:px-4 sm:text-xs ${className ?? ""}`
      }
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:gap-x-3">
        <InventarioTablaLeyendaItem kind="A" label="Activo" />
        <InventarioTablaLeyendaItem kind="C" label="Cuenta de orden" />
        <InventarioTablaLeyendaItem kind="PA" label="Precio adquisición" />
        <InventarioTablaLeyendaItem kind="VM" label="Valor mercado" />
      </div>
    </div>
  );
}

const tdBase =
  "max-w-0 overflow-hidden border-b border-r border-border/40 px-2.5 py-2 text-xs leading-snug text-foreground last:border-r-0";

export const inventarioThStd =
  "inventario-th-std max-w-0 border-b border-r border-border/50 px-2.5 py-2 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-foreground/80 last:border-r-0";

export const inventarioThAccent =
  "inventario-th-accent max-w-0 border-b border-r border-border/50 px-2.5 py-2 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-primary last:border-r-0";

export function EstadoBienBadge({ estado }: { estado: EstadoBien | null | undefined }) {
  if (!estado) {
    return (
      <span className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:text-xs">
        —
      </span>
    );
  }
  const label = estadoBienLabel(estado);
  const className =
    estado === "BUENO"
      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
      : estado === "REGULAR"
        ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
        : "bg-red-500/15 text-red-800 dark:text-red-300";

  return (
    <span
      className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${className}`}
    >
      {label}
    </span>
  );
}

export function InventarioEstadoRegistroFilaHint({
  activo,
  mostrarPreregistro = true,
}: {
  activo: Activo;
  mostrarPreregistro?: boolean;
}) {
  if (activo.estado_registro === "DADO_DE_BAJA") {
    return (
      <span className="mt-0.5 block text-[9px] font-semibold uppercase text-red-700 dark:text-red-300">
        Dado de baja
      </span>
    );
  }
  if (mostrarPreregistro && activo.estado_registro === "PREREGISTRADO") {
    return (
      <span className="mt-0.5 block text-[9px] font-medium uppercase text-amber-700 dark:text-amber-300">
        Pendiente de validación
      </span>
    );
  }
  return null;
}

export type ActivoConUbicacionLista = Activo & {
  sede_nombre?: string | null;
  ambiente_nombre?: string | null;
};

export function InventarioUbicacionCell({
  activo,
  mostrarSede,
  className,
}: {
  activo: ActivoConUbicacionLista;
  mostrarSede: boolean;
  className?: string;
}) {
  const ambiente = activo.ambiente_nombre?.trim() || "—";
  const sede = activo.sede_nombre?.trim();
  const title = mostrarSede && sede ? `${sede} · ${ambiente}` : ambiente;

  return (
    <InventarioTextCell title={title} lineClamp2 className={className}>
      {mostrarSede && sede ? (
        <>
          <span className="block truncate">{ambiente}</span>
          <span className="block truncate text-[10px] leading-tight text-muted-foreground">{sede}</span>
        </>
      ) : (
        ambiente
      )}
    </InventarioTextCell>
  );
}

export type ActivoConContabilidad = Activo & {
  cuenta_codigo?: string | null;
  contabilidad?: string | null;
};

export function inventarioCuentaContable(activo: ActivoConContabilidad): string {
  return formatCuentaContableDisplay(activo.cuenta_codigo, activo.contabilidad);
}

export function InventarioCodigoCellContent({ activo }: { activo: Activo }) {
  if (activo.estado_registro === "DADO_DE_BAJA") {
    return (
      <span className="inline-block rounded bg-red-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-red-800 dark:text-red-200">
        Baja
      </span>
    );
  }
  if (activo.estado_registro === "PREREGISTRADO") {
    return (
      <span className="inline-block rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-800 dark:text-amber-200">
        Prereg.
      </span>
    );
  }
  return (
    <span className="block font-mono text-xs leading-snug">
      {formatActivoCodigoDisplay(activo)}
    </span>
  );
}

/** @deprecated Use InventarioCodigoCellContent */
export function InventarioCorrelativoCellContent({ activo }: { activo: Activo }) {
  return <InventarioCodigoCellContent activo={activo} />;
}

export function CategoriaBienCell({
  categoria,
  className,
  style,
}: {
  categoria: CategoriaBien;
  className?: string;
  style?: CSSProperties;
}) {
  const letra = categoriaBienLetra(categoria);
  const titulo = categoria === "CUENTA_ORDEN" ? "Cuenta de orden" : "Activo";
  const badgeKind: InventarioTablaBadgeKind = letra === "C" ? "C" : "A";

  return (
    <td className={`${tdBase} text-center ${className ?? ""}`} style={style} title={titulo}>
      <InventarioTablaLeyendaBadge kind={badgeKind} />
    </td>
  );
}

/** @deprecated Use CategoriaBienCell */
export function CategoriaLetraCell({
  categoria,
  fullOnWide: _fullOnWide,
}: {
  categoria: CategoriaBien;
  fullOnWide?: boolean;
}) {
  return <CategoriaBienCell categoria={categoria} />;
}

export function InventarioCategoriaCell({
  activo,
  className,
  style,
}: {
  activo: Activo;
  className?: string;
  style?: CSSProperties;
}) {
  return <CategoriaBienCell categoria={activo.categoria} className={className} style={style} />;
}

export function ValorBienCell({ activo }: { activo: Activo }) {
  const esMercado = activo.valor_es_mercado;
  const monto = valorActivoEfectivo(activo.valor_adquisicion, activo.valor_incremento);

  if (monto == null) {
    return (
      <td className={`${tdBase} text-center text-muted-foreground`}>
        —
      </td>
    );
  }

  const titulo = esMercado ? "Valor mercado" : "Precio adquisición";
  const badgeKind: InventarioTablaBadgeKind = esMercado ? "VM" : "PA";
  const detalleMejora = activo.incremento_detalle?.trim();
  const titleExtra =
    activo.valor_incremento != null && Number(activo.valor_incremento) > 0
      ? ` · Incluye incremento${detalleMejora ? `: ${detalleMejora}` : ""}`
      : "";

  return (
    <td
      className={`${tdBase} text-right tabular-nums`}
      title={`${titulo}: S/ ${formatMonedaPE(monto)}${titleExtra}`}
    >
      <span className="inline-flex max-w-full items-center justify-end gap-1">
        <InventarioTablaLeyendaBadge kind={badgeKind} />
        <span className="truncate text-[11px] sm:text-xs">{formatMonedaPE(monto)}</span>
      </span>
    </td>
  );
}

export function ValorNetoCell({
  activo,
  inactivo,
}: {
  activo: Activo;
  inactivo: boolean;
}) {
  const { valorNeto } = inventarioDepreciacionFila(activo, inactivo);

  return (
    <td className={`${tdBase} text-right tabular-nums`} title={valorNeto != null ? `S/ ${formatMonedaPE(valorNeto)}` : undefined}>
      {valorNeto != null ? (
        <span className="font-semibold text-primary">S/ {formatMonedaPE(valorNeto)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </td>
  );
}

export function formatInventarioListaTexto(value?: string | null): string {
  const text = value?.trim() ?? "";
  return text ? text.toLocaleUpperCase("es") : "";
}

export function ObservacionCell({
  observacion,
  lineClamp2,
}: {
  observacion?: string | null;
  lineClamp2?: boolean;
}) {
  const { contador, admin } = splitObservacionActivo(observacion);
  const tieneTexto = Boolean(contador || admin);

  if (!tieneTexto) {
    return (
      <td className={`${tdBase} text-muted-foreground`}>
        —
      </td>
    );
  }

  const title = [contador, admin].filter(Boolean).join("\n");

  return (
    <td className={tdBase} title={title}>
      <ObservacionActivoDisplay observacion={observacion} lineClamp2={lineClamp2} />
    </td>
  );
}

export const inventarioTdFechaClass = `${tdBase} text-center text-xs whitespace-nowrap tabular-nums`;

export const inventarioTdComprobanteClass =
  "overflow-visible border-b border-r border-border/40 px-2.5 py-2 text-center align-top text-xs leading-snug text-foreground last:border-r-0";

export const inventarioTdAccionesClass =
  "inventario-td-acciones overflow-visible whitespace-nowrap border-b border-r border-border/40 px-1.5 py-2 text-xs text-foreground last:border-r-0";

export function InventarioValorPaVmCell({ activo }: { activo: Activo }) {
  return <ValorBienCell activo={activo} />;
}

/** Color de fecha: segura (precio/factura) vs aproximada (valor de mercado). */
export function fechaAdquisicionToneClass(valorEsMercado?: boolean | null): string {
  if (valorEsMercado) {
    return "text-amber-700 dark:text-amber-300";
  }
  return "text-sky-700 dark:text-sky-300";
}

export function InventarioFechaCell({
  fecha,
  valorEsMercado,
  className,
}: {
  fecha?: string | null;
  valorEsMercado?: boolean | null;
  className?: string;
}) {
  const corto = formatFechaISOToCortoES(fecha);
  const tabla = formatFechaISOToDDMMYYYY(fecha) || "—";
  const tone =
    fecha && valorEsMercado != null
      ? fechaAdquisicionToneClass(valorEsMercado)
      : "text-foreground";
  const titulo =
    fecha && valorEsMercado != null
      ? `${corto || tabla} · ${valorEsMercado ? "Fecha aproximada (valor de mercado)" : "Fecha segura (adquisición)"}`
      : corto || undefined;
  return (
    <td className={`${inventarioTdFechaClass} ${tone} ${className ?? ""}`} title={titulo}>
      {tabla}
    </td>
  );
}

export function InventarioTextCell({
  children,
  center,
  className,
  style,
  title,
  lineClamp2,
}: {
  children?: ReactNode;
  center?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  lineClamp2?: boolean;
}) {
  const empty = children === null || children === undefined || children === "";
  return (
    <td
      className={`${tdBase} ${center ? "text-center" : ""} ${className ?? ""}`}
      style={style}
      title={title}
    >
      {empty ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className={lineClamp2 ? "line-clamp-2 text-xs leading-snug" : "block truncate text-xs leading-snug"}>
          {children}
        </span>
      )}
    </td>
  );
}

export function inventarioDescripcion(activo: Activo): string {
  return formatInventarioListaTexto(
    buildDescripcionBien(
      activo.marca,
      activo.modelo,
      activo.serie,
      activo.color,
      activo.medidas,
    ),
  );
}

export function inventarioDepreciacionFila(activo: Activo, inactivo: boolean) {
  const periodo = calcPeriodoMeses(
    resolveFechaInicioDepreciacion(activo.fecha_inicio_depreciacion, activo.fecha_adquisicion),
  );
  const valor = valorActivoEfectivo(activo.valor_adquisicion, activo.valor_incremento);
  const { depreciacionAcumulada: depAcum, valorNeto } = calcValorizacionActivo({
    valor,
    vidaUtilMeses: activo.vida_util_meses,
    periodoMeses: periodo,
    categoria: activo.categoria,
    estadoRegistro: inactivo ? "DADO_DE_BAJA" : activo.estado_registro,
    estadoBien: activo.estado_bien,
  });
  return { periodo, depAcum, valorNeto };
}
