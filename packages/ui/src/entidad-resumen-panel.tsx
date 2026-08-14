"use client";

import { useMemo, useState, Fragment } from "react";
import type { ReactNode } from "react";
import {
  agruparClasificacionResumenPorTipo,
  buildClasificacionResumen,
  buildDepreciacionMensualResumen,
  buildValorizacionTotales,
  entidadMuestraSelectorSede,
  filtrarActivosPorFechaCorte,
  parseFechaDDMMYYYY,
  validarFechaDDMMYYYY,
  type ActivoValorizacionFuente,
  type ClasificacionResumen,
} from "@inventario/types";
import { FechaDdMmYyyyInput } from "./fecha-dd-mm-yyyy-input";
import {
  PanelEmptyState,
  PanelCountLabel,
  PanelTableColgroup,
  PanelTableTd,
  PanelTableTh,
  StatusBadge,
  panelCardClass,
  panelTableHeadRowClass,
  panelTableShrinkCellClass,
  panelTableNowrapCellClass,
  panelTableStickyHeadClass,
} from "./panel";
import { scrollbarThemedClass } from "./responsive-layout";

function dateToDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function dateFromISO(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export interface EntidadResumenAmbiente {
  id: string;
  nombre: string;
  descripcion?: string | null;
  responsable?: string | null;
  sede_id: string;
  sede_nombre: string;
  sede_es_principal: boolean;
  activo_count?: number;
  activo?: boolean;
}

export interface EntidadResumenSede {
  id: string;
  nombre: string;
  es_principal?: boolean;
}

export interface EntidadResumenActivo extends ActivoValorizacionFuente {
  ambiente_id?: string | null;
  estado_registro?: string;
}

export interface EntidadResumenPanelProps {
  entidadNombre: string;
  entidadRuc?: string | null;
  activos: EntidadResumenActivo[];
  ambientes: EntidadResumenAmbiente[];
  sedes: EntidadResumenSede[];
  /** Valor inicial del corte (por defecto hoy). El usuario puede cambiarlo en el panel. */
  fechaResumen?: Date;
  headerExtra?: ReactNode;
  /** Oculta el bloque superior con nombre/RUC (p. ej. dashboard con tabla de entidades arriba). */
  showEntidadHeader?: boolean;
}

const RESUMEN_TABLE_WIDTHS_PCT = [38, 22, 22, 18] as const;
const DEPRECIACION_MENSUAL_WIDTHS_PCT = [40, 60] as const;
const AMBIENTES_RESUMEN_TABLE_WIDTHS_PCT = [18, 14, 30, 10, 12] as const;

/** Incluye registrados y preregistrados; excluye dados de baja. */
function filtrarParaResumenDashboard<T extends { estado_registro?: string }>(
  activos: T[],
): T[] {
  return activos.filter(
    (a) => a.estado_registro === "REGISTRADO" || a.estado_registro === "PREREGISTRADO",
  );
}

function conteosPorAmbiente(activos: EntidadResumenActivo[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const activo of filtrarParaResumenDashboard(activos)) {
    const ambienteId = activo.ambiente_id?.trim();
    if (!ambienteId) continue;
    map.set(ambienteId, (map.get(ambienteId) ?? 0) + 1);
  }
  return map;
}

function conteoActivosAmbiente(
  ambiente: EntidadResumenAmbiente,
  conteos: Map<string, number>,
): number {
  if (typeof ambiente.activo_count === "number") return ambiente.activo_count;
  return conteos.get(ambiente.id) ?? 0;
}

function formatResumenNumero(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  });
}

const RESUMEN_TABLA_HEAD_CLASS =
  "bg-sky-100 text-foreground dark:bg-sky-950/50 [&_th]:bg-sky-100 dark:[&_th]:bg-sky-950/50";
const RESUMEN_TABLA_TOTAL_CLASS = "bg-sky-100/80 font-semibold dark:bg-sky-950/40";
const RESUMEN_TABLA_SECTION_CLASS =
  "bg-muted/60 font-semibold uppercase tracking-wide text-foreground dark:bg-muted/40";
const RESUMEN_TABLA_SUBTOTAL_CLASS =
  "bg-sky-50/90 font-semibold text-foreground dark:bg-sky-950/25";

export function EntidadResumenPanel({
  entidadNombre,
  entidadRuc,
  activos,
  ambientes,
  sedes,
  fechaResumen = new Date(),
  headerExtra,
  showEntidadHeader = true,
}: EntidadResumenPanelProps) {
  const [fechaCorteText, setFechaCorteText] = useState(() => dateToDDMMYYYY(fechaResumen));
  const [fechaCorte, setFechaCorte] = useState(() => fechaResumen);
  const [fechaError, setFechaError] = useState<string | null>(null);

  const activosResumen = useMemo(
    () => filtrarActivosPorFechaCorte(filtrarParaResumenDashboard(activos), fechaCorte),
    [activos, fechaCorte],
  );
  const resumenFilas = useMemo(
    () => buildClasificacionResumen(activosResumen, fechaCorte),
    [activosResumen, fechaCorte],
  );
  const resumenSecciones = useMemo(
    () => agruparClasificacionResumenPorTipo(resumenFilas),
    [resumenFilas],
  );
  const depreciacionMensual = useMemo(
    () => buildDepreciacionMensualResumen(activosResumen, fechaCorte),
    [activosResumen, fechaCorte],
  );
  const totales = useMemo(
    () => buildValorizacionTotales(activosResumen, fechaCorte),
    [activosResumen, fechaCorte],
  );

  const conteosAmbiente = useMemo(() => conteosPorAmbiente(activos), [activos]);
  const multiplesSedes = entidadMuestraSelectorSede(sedes);

  const gruposAmbientes = useMemo(() => {
    const porSede = new Map<string, EntidadResumenAmbiente[]>();
    for (const amb of ambientes) {
      const lista = porSede.get(amb.sede_id) ?? [];
      lista.push(amb);
      porSede.set(amb.sede_id, lista);
    }

    const sedesOrdenadas = [...sedes].sort((a, b) => {
      if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
      return a.nombre.localeCompare(b.nombre);
    });

    return sedesOrdenadas
      .filter((sede) => porSede.has(sede.id))
      .map((sede) => ({
        sede,
        ambientes: [...(porSede.get(sede.id) ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      }));
  }, [ambientes, sedes]);

  const fechaLabel = fechaCorte.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const aplicarFechaCorte = (raw: string, { fromBlur }: { fromBlur?: boolean } = {}) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (fromBlur) {
        setFechaError("Ingrese la fecha de corte.");
        setFechaCorteText(dateToDDMMYYYY(fechaCorte));
      } else {
        setFechaError(null);
      }
      return;
    }

    const iso = parseFechaDDMMYYYY(trimmed);
    if (iso) {
      setFechaError(null);
      setFechaCorteText(dateToDDMMYYYY(dateFromISO(iso)));
      setFechaCorte(dateFromISO(iso));
      return;
    }

    const completa = /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed);
    if (completa || fromBlur) {
      setFechaError(validarFechaDDMMYYYY(trimmed) ?? "Fecha inválida.");
      if (fromBlur) {
        // Mantener el cálculo con la última fecha válida
        setFechaCorteText(dateToDDMMYYYY(fechaCorte));
      }
      return;
    }

    setFechaError(null);
  };

  const onFechaCorteChange = (next: string) => {
    setFechaCorteText(next);
    aplicarFechaCorte(next);
  };

  return (
    <div className="space-y-6">
      {showEntidadHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{entidadNombre}</h2>
            {entidadRuc && (
              <p className="text-sm text-muted-foreground">RUC {entidadRuc}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Registrados y preregistrados · valorización al {fechaLabel}
            </p>
          </div>
          {headerExtra}
        </div>
      )}

      {!showEntidadHeader && headerExtra ? (
        <div className="flex flex-wrap items-center justify-end gap-2">{headerExtra}</div>
      ) : null}

      <section className={panelCardClass}>
        <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
            <h3 className="text-xl font-bold tracking-wide text-foreground">RESUMEN</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Depreciación y valor neto recalculados a la fecha de corte
            </p>
          </div>
          <div className="mx-auto w-full max-w-[12.5rem] space-y-1 sm:mx-0">
            <label
              htmlFor="resumen_fecha_corte"
              className="text-xs font-medium text-muted-foreground"
            >
              Fecha de corte
            </label>
            <FechaDdMmYyyyInput
              id="resumen_fecha_corte"
              value={fechaCorteText}
              onChange={onFechaCorteChange}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => aplicarFechaCorte(e.currentTarget.value, { fromBlur: true })}
              aria-invalid={Boolean(fechaError)}
            />
            {fechaError && <p className="text-xs text-destructive">{fechaError}</p>}
          </div>
        </div>

        {resumenFilas.length === 0 ? (
          <PanelEmptyState message="No hay activos registrados ni preregistrados para valorizar en esta entidad." />
        ) : (
          <div className={`${scrollbarThemedClass} overflow-x-auto`}>
            <table className="w-full min-w-[44rem] table-fixed text-left text-sm">
              <PanelTableColgroup widths={RESUMEN_TABLE_WIDTHS_PCT} />
              <thead className={`${panelTableStickyHeadClass} ${RESUMEN_TABLA_HEAD_CLASS}`}>
                <tr className={panelTableHeadRowClass}>
                  <PanelTableTh>Cuenta contable</PanelTableTh>
                  <PanelTableTh align="right" className="whitespace-nowrap">
                    Suma de Importe
                  </PanelTableTh>
                  <PanelTableTh align="right" className="whitespace-nowrap">
                    Suma de Depreciación acumulada
                  </PanelTableTh>
                  <PanelTableTh align="right" className="whitespace-nowrap">
                    Suma de Valor neto
                  </PanelTableTh>
                </tr>
              </thead>
              <tbody>
                {resumenSecciones.map((seccion) => (
                  <Fragment key={seccion.tipoBien}>
                    <tr className={RESUMEN_TABLA_SECTION_CLASS}>
                      <PanelTableTd colSpan={4}>{seccion.label}</PanelTableTd>
                    </tr>
                    {seccion.filas.map((fila: ClasificacionResumen) => (
                      <tr key={`${seccion.tipoBien}-${fila.cuenta}`}>
                        <PanelTableTd className="font-medium">{fila.categoria}</PanelTableTd>
                        <PanelTableTd
                          align="right"
                          className="whitespace-nowrap font-mono text-xs tabular-nums"
                        >
                          {formatResumenNumero(fila.valorAdquisicion)}
                        </PanelTableTd>
                        <PanelTableTd
                          align="right"
                          className="whitespace-nowrap font-mono text-xs tabular-nums"
                        >
                          {formatResumenNumero(fila.depreciacionAcumulada)}
                        </PanelTableTd>
                        <PanelTableTd
                          align="right"
                          className="whitespace-nowrap font-mono text-xs tabular-nums"
                        >
                          {formatResumenNumero(fila.valorNeto)}
                        </PanelTableTd>
                      </tr>
                    ))}
                    <tr className={RESUMEN_TABLA_SUBTOTAL_CLASS}>
                      <PanelTableTd>Total {seccion.label}</PanelTableTd>
                      <PanelTableTd
                        align="right"
                        className="whitespace-nowrap font-mono text-xs tabular-nums"
                      >
                        {formatResumenNumero(seccion.subtotal.valorAdquisicion)}
                      </PanelTableTd>
                      <PanelTableTd
                        align="right"
                        className="whitespace-nowrap font-mono text-xs tabular-nums"
                      >
                        {formatResumenNumero(seccion.subtotal.depreciacionAcumulada)}
                      </PanelTableTd>
                      <PanelTableTd
                        align="right"
                        className="whitespace-nowrap font-mono text-xs tabular-nums"
                      >
                        {formatResumenNumero(seccion.subtotal.valorNeto)}
                      </PanelTableTd>
                    </tr>
                  </Fragment>
                ))}
                <tr className={RESUMEN_TABLA_TOTAL_CLASS}>
                  <PanelTableTd>Total general</PanelTableTd>
                  <PanelTableTd
                    align="right"
                    className="whitespace-nowrap font-mono text-xs tabular-nums"
                  >
                    {formatResumenNumero(totales.valorAdquisicion)}
                  </PanelTableTd>
                  <PanelTableTd
                    align="right"
                    className="whitespace-nowrap font-mono text-xs tabular-nums"
                  >
                    {formatResumenNumero(totales.depreciacionAcumulada)}
                  </PanelTableTd>
                  <PanelTableTd
                    align="right"
                    className="whitespace-nowrap font-mono text-xs tabular-nums"
                  >
                    {formatResumenNumero(totales.valorNeto)}
                  </PanelTableTd>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {resumenFilas.length > 0 && (
        <section className={panelCardClass}>
          <div className="border-b border-border/60 px-4 py-4 text-center sm:text-left">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Depreciación acumulada por mes
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Del año {fechaCorte.getFullYear()}, de enero hasta el mes de la fecha de corte
            </p>
          </div>
          <div className={`${scrollbarThemedClass} overflow-x-auto`}>
            <table className="w-full min-w-[20rem] table-fixed text-left text-sm">
              <PanelTableColgroup widths={DEPRECIACION_MENSUAL_WIDTHS_PCT} />
              <thead className={`${panelTableStickyHeadClass} ${RESUMEN_TABLA_HEAD_CLASS}`}>
                <tr className={panelTableHeadRowClass}>
                  <PanelTableTh>Mes</PanelTableTh>
                  <PanelTableTh align="right" className="whitespace-nowrap">
                    Depreciación acumulada
                  </PanelTableTh>
                </tr>
              </thead>
              <tbody>
                {depreciacionMensual.map((fila) => (
                  <tr key={fila.mes}>
                    <PanelTableTd className="font-medium">{fila.label}</PanelTableTd>
                    <PanelTableTd
                      align="right"
                      className="whitespace-nowrap font-mono text-xs tabular-nums"
                    >
                      {formatResumenNumero(fila.depreciacionAcumulada)}
                    </PanelTableTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={panelCardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">Ambientes</h3>
            <p className="text-xs text-muted-foreground">
              {multiplesSedes ? "Agrupados por sucursal" : "Inventario por ambiente"}
            </p>
          </div>
          <PanelCountLabel count={ambientes.length} singular="ambiente" plural="ambientes" />
        </div>

        {gruposAmbientes.length === 0 ? (
          <PanelEmptyState message="No hay ambientes registrados en esta entidad." />
        ) : (
          <div className="divide-y divide-border/60">
            {gruposAmbientes.map(({ sede, ambientes: lista }) => (
              <div key={sede.id}>
                {multiplesSedes && (
                  <div className="border-b border-border/40 bg-muted/20 px-4 py-2.5">
                    <h4 className="text-sm font-bold uppercase tracking-wide text-primary">
                      {sede.nombre}
                    </h4>
                  </div>
                )}
                <div className={`${scrollbarThemedClass} overflow-x-auto`}>
                  <table className="w-full min-w-[48rem] table-fixed text-left text-sm">
                    <PanelTableColgroup widths={AMBIENTES_RESUMEN_TABLE_WIDTHS_PCT} />
                    <thead className={panelTableStickyHeadClass}>
                      <tr className={panelTableHeadRowClass}>
                        <PanelTableTh>Ambiente</PanelTableTh>
                        <PanelTableTh>Responsable</PanelTableTh>
                        <PanelTableTh>Descripción</PanelTableTh>
                        <PanelTableTh align="center" className={panelTableShrinkCellClass}>
                          Activos
                        </PanelTableTh>
                        <PanelTableTh className={panelTableNowrapCellClass}>Estado</PanelTableTh>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((amb) => (
                        <tr key={amb.id} className="border-b border-border/40 last:border-b-0">
                          <PanelTableTd className="font-medium" title={amb.nombre}>
                            {amb.nombre}
                          </PanelTableTd>
                          <PanelTableTd title={amb.responsable ?? undefined}>
                            {amb.responsable ?? "—"}
                          </PanelTableTd>
                          <PanelTableTd
                            className="text-muted-foreground"
                            title={amb.descripcion ?? undefined}
                          >
                            {amb.descripcion ?? "—"}
                          </PanelTableTd>
                          <PanelTableTd align="center" className={panelTableShrinkCellClass}>
                            {conteoActivosAmbiente(amb, conteosAmbiente)}
                          </PanelTableTd>
                          <PanelTableTd className={panelTableNowrapCellClass}>
                            <StatusBadge variant={amb.activo !== false ? "active" : "default"}>
                              {amb.activo !== false ? "Activo" : "Inactivo"}
                            </StatusBadge>
                          </PanelTableTd>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
