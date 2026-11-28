"use client";

import type { ReactNode } from "react";
import type { Activo } from "@inventario/types";
import {
  CATEGORIA_BIEN_LABELS,
  buildDescripcionBien,
  descripcionMenaje,
  esMenaje,
  categoriaBienCorto,
  formatActivoCodigoDisplay,
  formatCuentaContableDisplay,
  formatFechaISOToCortoES,
  formatMonedaPE,
  formatPosibleAmbienteLabel,
  valorActivoEfectivo,
} from "@inventario/types";
import { cn } from "./components";
import { EstadoBienBadge, fechaAdquisicionToneClass, inventarioDepreciacionFila } from "./inventario-table-cells";
import { ObservacionActivoDisplay } from "./observacion-activo-display";
import { Sheet } from "./sheet";

export type ActivoDetalle = Activo & {
  entidad_nombre?: string;
  sede_nombre?: string;
  ambiente_nombre?: string;
  posible_ambiente_nombre?: string;
  posible_sede_nombre?: string;
  cuenta_codigo?: string | null;
  contabilidad?: string | null;
  catalogo_grupo?: string | null;
  catalogo_clase?: string | null;
};

function DetalleMetric({
  label,
  value,
  highlight,
  sub,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  sub?: string;
}) {
  return (
    <div className="detalle-surface-divider min-w-0 flex-1 px-3 py-2.5 last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-sm uppercase tabular-nums",
          highlight ? "font-semibold text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[10px] uppercase text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DetalleField({
  label,
  value,
  className,
  mono,
  hideIfEmpty = true,
  fallback = "—",
}: {
  label: string;
  value?: ReactNode;
  className?: string;
  mono?: boolean;
  hideIfEmpty?: boolean;
  fallback?: string;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  if (isEmpty && hideIfEmpty) return null;
  const display = isEmpty ? fallback : value;
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 break-words text-sm uppercase text-foreground",
          mono && "font-mono text-xs",
          isEmpty && "text-muted-foreground",
        )}
      >
        {display}
      </dd>
    </div>
  );
}

type DetalleGridCols = 1 | 2 | 3;

function detalleGridClass(cols: DetalleGridCols): string {
  if (cols === 1) return "grid grid-cols-1 gap-y-3";
  if (cols === 3) return "grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3";
  return "grid grid-cols-2 gap-x-4 gap-y-3";
}

function DetalleSection({
  title,
  description,
  badge,
  children,
  compact,
  cols = 2,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  cols?: DetalleGridCols;
}) {
  return (
    <section className="detalle-surface flex h-full min-w-0 flex-col overflow-hidden bg-card">
      <div className="detalle-surface-header px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {badge}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <dl className={cn(detalleGridClass(cols), compact ? "p-3" : "p-4")}>{children}</dl>
    </section>
  );
}

function DetalleChip({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "amber" | "red" | "sky";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variant === "default" && "bg-muted text-muted-foreground",
        variant === "amber" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
        variant === "red" && "bg-red-500/15 text-red-800 dark:text-red-200",
        variant === "sky" && "bg-sky-500/15 text-sky-800 dark:text-sky-200",
      )}
    >
      {children}
    </span>
  );
}

function DetalleSplitRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

function tieneEspecificaciones(activo: Activo): boolean {
  return Boolean(
    activo.marca?.trim() ||
      activo.modelo?.trim() ||
      activo.serie?.trim() ||
      activo.color?.trim() ||
      activo.medidas?.trim() ||
      activo.caracteristicas?.trim(),
  );
}

export function ActivoDetalleSheet({
  activo,
  open,
  onClose,
  footer,
  banner,
  ejemplaresHint,
  extraSections,
  onVerFoto,
  onVerComprobante,
}: {
  activo: ActivoDetalle;
  open: boolean;
  onClose: () => void;
  footer?: ReactNode;
  banner?: ReactNode;
  ejemplaresHint?: ReactNode;
  extraSections?: ReactNode;
  onVerFoto?: () => void;
  onVerComprobante?: () => void;
}) {
  const inactivo = activo.estado_registro === "DADO_DE_BAJA";
  const preregistrado = activo.estado_registro === "PREREGISTRADO";
  const { periodo, depAcum, valorNeto } = inventarioDepreciacionFila(activo, inactivo);
  const periodoTexto = periodo > 0 ? String(Math.round(periodo)) : "—";
  const esMercado = activo.valor_es_mercado;
  const precioLabel = esMercado ? "Valor mercado" : "Precio adquisición";
  const valorEfectivo = valorActivoEfectivo(activo.valor_adquisicion, activo.valor_incremento);
  const precioValor = valorEfectivo != null ? `S/ ${formatMonedaPE(valorEfectivo)}` : "—";
  const mejoraTexto =
    activo.valor_incremento != null && Number(activo.valor_incremento) > 0
      ? [
          activo.incremento_detalle?.trim() || "Mejora",
          `+ S/ ${formatMonedaPE(activo.valor_incremento)}`,
        ].join(" · ")
      : null;
  const valorNetoTexto = valorNeto != null ? `S/ ${formatMonedaPE(valorNeto)}` : "—";
  const depAcumTexto = depAcum != null ? `S/ ${formatMonedaPE(depAcum)}` : "—";

  const codigoTitulo = formatActivoCodigoDisplay(activo);
  const cuentaContable = formatCuentaContableDisplay(activo.cuenta_codigo, activo.contabilidad);

  const descripcion = esMenaje(activo.categoria)
    ? descripcionMenaje(activo)
    : buildDescripcionBien(
        activo.marca,
        activo.modelo,
        activo.serie,
        activo.color,
        activo.medidas,
      );

  const estadoRegistroLabel = preregistrado
    ? "Preregistrado"
    : inactivo
      ? "Dado de baja"
      : "Registrado";

  const estadoRegistroVariant = preregistrado ? "amber" : inactivo ? "red" : "default";

  const depreciacionAnual = activo.depreciacion?.trim() || "—";
  const comprobanteTexto =
    activo.comprobante_serie?.trim() || (activo.comprobante_path ? "PDF adjunto" : undefined);

  const tieneArchivos = Boolean(activo.foto_path || activo.comprobante_path);
  const tieneNotas = Boolean(activo.observacion?.trim() || activo.motivo_baja?.trim());

  return (
    <Sheet
      open={open}
      onClose={onClose}
      subtitle={`${categoriaBienCorto(activo.categoria)} · ${CATEGORIA_BIEN_LABELS[activo.categoria].titulo}`}
      title={codigoTitulo}
      footer={footer}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        {banner}

        <div className="detalle-surface bg-gradient-to-br from-muted/30 to-muted/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3
              className={cn(
                "text-base font-semibold uppercase leading-snug text-foreground",
                inactivo && "line-through decoration-muted-foreground/50",
              )}
            >
              {activo.nombre}
            </h3>
            {ejemplaresHint}
          </div>
          {descripcion && (
            <p className="mt-1.5 text-sm uppercase leading-relaxed text-muted-foreground">{descripcion}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <DetalleChip>{categoriaBienCorto(activo.categoria)}</DetalleChip>
            {activo.categoria === "MENAJE" && (
              <DetalleChip>Cant. {activo.cantidad ?? 1}</DetalleChip>
            )}
            <EstadoBienBadge estado={activo.estado_bien} />
            <DetalleChip variant={estadoRegistroVariant}>{estadoRegistroLabel}</DetalleChip>
          </div>
        </div>

        <div className="detalle-surface flex overflow-hidden bg-muted/15">
          <DetalleMetric
            label={precioLabel}
            value={precioValor}
            sub={mejoraTexto ?? undefined}
          />
          <DetalleMetric label="Valor neto" value={valorNetoTexto} highlight />
          <DetalleMetric
            label="Depreciación"
            value={depreciacionAnual}
            sub={periodo > 0 ? `${periodoTexto} meses` : undefined}
          />
        </div>

        <DetalleSplitRow>
          <DetalleSection title="Ubicación" description="Dónde se encuentra el bien" cols={2}>
            <DetalleField label="Sede" value={activo.sede_nombre} hideIfEmpty={false} />
            <DetalleField label="Ambiente" value={activo.ambiente_nombre} hideIfEmpty={false} />
            <DetalleField
              label="Entidad"
              value={activo.entidad_nombre}
              className="col-span-2"
              hideIfEmpty={false}
            />
            {preregistrado && (
              <DetalleField
                label="Posible ambiente"
                value={formatPosibleAmbienteLabel(activo)}
                className="col-span-2"
                hideIfEmpty={false}
              />
            )}
          </DetalleSection>

          <DetalleSection title="Catálogo nacional" description="Clasificación del bien" cols={2}>
            <DetalleField label="Grupo" value={activo.catalogo_grupo} hideIfEmpty={false} />
            <DetalleField label="Clase" value={activo.catalogo_clase} hideIfEmpty={false} />
            <DetalleField
              label="Código catálogo"
              value={activo.codigo_catalogo}
              className="col-span-2"
              mono
              hideIfEmpty={false}
            />
          </DetalleSection>
        </DetalleSplitRow>

        <DetalleSection title="Registro" description="Códigos, responsable y fechas" cols={3}>
          <DetalleField
            label={activo.categoria === "MENAJE" ? "Código de catálogo" : "Código de barras"}
            value={formatActivoCodigoDisplay(activo)}
            mono
            hideIfEmpty={false}
          />
          <DetalleField
            label="Fecha adquisición"
            value={
              <span className={activo.fecha_adquisicion ? fechaAdquisicionToneClass(activo.valor_es_mercado) : undefined}>
                {formatFechaISOToCortoES(activo.fecha_adquisicion) || "—"}
              </span>
            }
            hideIfEmpty={false}
          />
          <DetalleField label="Responsable" value={activo.responsable} hideIfEmpty={false} />
          <DetalleField
            label="Cuenta contable"
            value={cuentaContable !== "—" ? cuentaContable : undefined}
            className="sm:col-span-2"
            hideIfEmpty={false}
          />
          <DetalleField label="Nombre en etiqueta" value={activo.nombre_etiqueta} />
        </DetalleSection>

        <DetalleSplitRow>
          {tieneEspecificaciones(activo) ? (
            <DetalleSection
              title="Especificaciones"
              description="Marca, modelo y detalles físicos"
              cols={3}
            >
              <DetalleField label="Marca" value={activo.marca} />
              <DetalleField label="Modelo" value={activo.modelo} />
              <DetalleField label="Serie" value={activo.serie} mono />
              <DetalleField label="Color" value={activo.color} />
              <DetalleField label="Medidas" value={activo.medidas} />
              <DetalleField
                label="Detalle adicional"
                value={activo.caracteristicas}
                className="col-span-2 sm:col-span-3"
              />
            </DetalleSection>
          ) : (
            <DetalleSection title="Depreciación" description="Detalle contable" compact cols={2}>
              <DetalleField label="Deprec. acumulada" value={depAcumTexto} hideIfEmpty={false} />
              <DetalleField
                label="Vida útil"
                value={activo.vida_util_meses != null ? `${activo.vida_util_meses} meses` : undefined}
                hideIfEmpty={false}
              />
              <DetalleField
                label="Periodo transcurrido"
                value={`${periodoTexto} meses`}
                hideIfEmpty={false}
              />
              <DetalleField label="Comprobante" value={comprobanteTexto} mono />
            </DetalleSection>
          )}

          {tieneEspecificaciones(activo) ? (
            <DetalleSection title="Depreciación" description="Detalle contable" compact cols={2}>
              <DetalleField label="Deprec. acumulada" value={depAcumTexto} hideIfEmpty={false} />
              <DetalleField
                label="Vida útil"
                value={activo.vida_util_meses != null ? `${activo.vida_util_meses} meses` : undefined}
                hideIfEmpty={false}
              />
              <DetalleField
                label="Periodo transcurrido"
                value={`${periodoTexto} meses`}
                hideIfEmpty={false}
              />
              <DetalleField label="Comprobante" value={comprobanteTexto} mono />
            </DetalleSection>
          ) : tieneArchivos ? (
            <ArchivosSection
              activo={activo}
              onVerFoto={onVerFoto}
              onVerComprobante={onVerComprobante}
            />
          ) : null}
        </DetalleSplitRow>

        {(tieneNotas || (tieneArchivos && tieneEspecificaciones(activo))) && (
          <DetalleSplitRow>
            {tieneNotas && (
              <DetalleSection title="Notas" cols={1}>
                <DetalleField
                  label="Observación"
                  value={
                    activo.observacion?.trim() ? (
                      <ObservacionActivoDisplay observacion={activo.observacion} />
                    ) : undefined
                  }
                />
                <DetalleField label="Motivo de baja" value={activo.motivo_baja} />
              </DetalleSection>
            )}
            {tieneArchivos && tieneEspecificaciones(activo) && (
              <ArchivosSection
                activo={activo}
                onVerFoto={onVerFoto}
                onVerComprobante={onVerComprobante}
              />
            )}
          </DetalleSplitRow>
        )}

        {extraSections}
      </div>
    </Sheet>
  );
}

function ArchivosSection({
  activo,
  onVerFoto,
  onVerComprobante,
}: {
  activo: ActivoDetalle;
  onVerFoto?: () => void;
  onVerComprobante?: () => void;
}) {
  return (
    <section className="detalle-surface flex h-full min-w-0 flex-col overflow-hidden bg-card">
      <div className="detalle-surface-header px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">Archivos</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Foto y comprobante del bien</p>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {activo.foto_path && onVerFoto && (
          <ArchivoButton
            titulo="Ver foto"
            subtitulo="Imagen del bien"
            onClick={onVerFoto}
            icon="foto"
          />
        )}
        {activo.comprobante_path && onVerComprobante && (
          <ArchivoButton
            titulo="Ver comprobante"
            subtitulo={(activo.comprobante_serie?.trim() || "Documento PDF").toLocaleUpperCase("es")}
            onClick={onVerComprobante}
            icon="pdf"
          />
        )}
      </div>
    </section>
  );
}

function ArchivoButton({
  titulo,
  subtitulo,
  onClick,
  icon,
}: {
  titulo: string;
  subtitulo: string;
  onClick: () => void;
  icon: "foto" | "pdf";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="detalle-surface-button flex min-w-0 items-center gap-3 px-3 py-2.5 text-left"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon === "foto" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10.5" r="1.5" />
            <path d="m21 16-5.5-5.5L5 21" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{titulo}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitulo}</span>
      </span>
    </button>
  );
}
