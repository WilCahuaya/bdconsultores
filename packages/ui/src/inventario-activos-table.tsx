"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import type { Activo, InventarioColumnFilterOptions, InventarioColumnFilters } from "@inventario/types";
import {
  buildValorizacionTotales,
  emptyInventarioColumnFilterOptions,
  formatMonedaPE,
  formatPosibleAmbienteLabel,
} from "@inventario/types";
import { ColumnHeaderFilter } from "./inventario-column-header-filter";
import {
  INVENTARIO_STICKY_DATA_COL_COUNT,
  INVENTARIO_TABLE_ADMIN_COL_COUNT,
  INVENTARIO_TABLE_ADMIN_ENTITY_UBICACION_COL_COUNT,
  INVENTARIO_TABLE_ADMIN_PREREGISTRO_COL_COUNT,
  INVENTARIO_TABLE_COL_COUNT,
  INVENTARIO_TABLE_ENTITY_UBICACION_COL_COUNT,
  INVENTARIO_TABLE_FULL_PREREGISTRO_COL_COUNT,
  inventarioStickyLeftOffsets,
  inventarioTableColWidths,
  inventarioTableColWidthsAdmin,
  inventarioTableColWidthsAdminEntityUbicacion,
  inventarioTableColWidthsAdminPreregistro,
  inventarioTableColWidthsEntityUbicacion,
  inventarioTableColWidthsFullPreregistro,
  inventarioTableMinWidthPx,
  inventarioTableWidthValuesPx,
} from "./inventario-table-cols";
import {
  EstadoBienBadge,
  InventarioCategoriaCell,
  InventarioEstadoRegistroFilaHint,
  InventarioCodigoCellContent,
  InventarioFechaCell,
  InventarioTextCell,
  InventarioUbicacionCell,
  InventarioValorPaVmCell,
  ObservacionCell,
  inventarioCuentaContable,
  inventarioDepreciacionFila,
  inventarioDescripcion,
  inventarioTdAccionesClass,
  inventarioTdComprobanteClass,
  inventarioTdFechaClass,
  inventarioThAccent,
  inventarioThStd,
} from "./inventario-table-cells";
import {
  panelDataTableFullClass,
  panelDataTableWrapClass,
  panelDataTableWrapEmbeddedClass,
} from "./responsive-layout";

const tdBase =
  "max-w-0 overflow-hidden border-b border-r border-border/40 px-2.5 py-2 text-xs leading-snug text-foreground last:border-r-0";

const tdTotalBase =
  "border-t border-b border-r border-border/60 px-2.5 py-2 text-xs font-semibold leading-none text-foreground last:border-r-0";

const tdTotalAccent =
  "border-t border-b border-r border-border/60 px-2 py-2 text-right text-[11px] font-semibold tabular-nums leading-none whitespace-nowrap text-primary last:border-r-0";

function Colgroup({
  modoPreregistro,
  modoAdmin,
  mostrarUbicacion,
  withSelection,
}: {
  modoPreregistro?: boolean;
  modoAdmin?: boolean;
  mostrarUbicacion?: boolean;
  withSelection?: boolean;
}) {
  const widths = modoAdmin
    ? modoPreregistro
      ? inventarioTableColWidthsAdminPreregistro({ withSelection })
      : mostrarUbicacion
        ? inventarioTableColWidthsAdminEntityUbicacion({ withSelection })
        : inventarioTableColWidthsAdmin({ withSelection })
    : modoPreregistro
      ? inventarioTableColWidthsFullPreregistro({ withSelection })
      : mostrarUbicacion
        ? inventarioTableColWidthsEntityUbicacion({ withSelection })
        : inventarioTableColWidths({ withSelection });
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: w, minWidth: w }} />
      ))}
    </colgroup>
  );
}

function stickyCellProps(
  offsets: number[],
  index: number,
  widthsPx?: readonly number[],
  baseZ = 12,
): { className: string; style: CSSProperties } | undefined {
  if (index < 0 || index >= offsets.length) return undefined;
  const isLast = index === offsets.length - 1;
  const width = widthsPx?.[index];
  return {
    className: `inventario-sticky-col${isLast ? " inventario-sticky-col--last" : ""}`,
    style: {
      left: offsets[index],
      zIndex: baseZ + index,
      ...(width != null
        ? { width, minWidth: width, maxWidth: width }
        : null),
    },
  };
}

function Th({
  children,
  className,
  rowSpan,
  colSpan,
  style,
  title,
}: {
  children: ReactNode;
  className?: string;
  rowSpan?: number;
  colSpan?: number;
  /** @deprecated Sin efecto: los títulos usan una sola tipografía. */
  multiline?: boolean;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={className ?? inventarioThStd}
      style={style}
      title={title}
    >
      <span className="block truncate whitespace-nowrap text-[11px] font-semibold leading-tight tracking-wide">
        {children}
      </span>
    </th>
  );
}

export interface InventarioSelectionProps {
  withSelection: boolean;
  selectedIds: Set<string>;
  /** Filas seleccionables en la página actual. */
  selectableOnPage: Activo[];
  /** @deprecated use selectableOnPage */
  printableOnPage?: Activo[];
  allPageSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAllPage: () => void;
  puedeSeleccionar?: (activo: Activo) => boolean;
  puedeImprimir?: (activo: Activo) => boolean;
}

export interface ActivosInventarioTableProps<T extends Activo> {
  activos: T[];
  paginated: T[];
  rowOffset: number;
  emptyMessage: string;
  selection?: InventarioSelectionProps;
  mostrarEstadoRegistro?: boolean;
  mostrarPosibleAmbiente?: boolean;
  mostrarUbicacion?: boolean;
  ubicacionMultiplesSedes?: boolean;
  modoAdmin?: boolean;
  columnFilters?: InventarioColumnFilters;
  onColumnFiltersChange?: (next: InventarioColumnFilters) => void;
  columnFilterOptions?: InventarioColumnFilterOptions;
  /** Fecha de corte para depreciación / valor neto (por defecto: hoy). */
  fechaCorte?: Date;
  renderComprobante: (activo: T, meta?: { columnFiltered?: boolean }) => ReactNode;
  renderAcciones: (activo: T) => ReactNode;
  tableScrollRef?: (node: HTMLDivElement | null) => void;
  embeddedInParentScroll?: boolean;
}

type ActivoConPosible = Activo & {
  posible_ambiente_nombre?: string;
  posible_sede_nombre?: string;
};

function posibleAmbienteLabel(activo: Activo): string {
  return formatPosibleAmbienteLabel(activo as ActivoConPosible);
}

const inventarioActivosTableClass = "inventario-activos-table";

function rowClassName(activo: Activo, rowIndex: number): string {
  const inactivo = activo.estado_registro === "DADO_DE_BAJA";
  const preregistrado = activo.estado_registro === "PREREGISTRADO";
  const zebra = rowIndex % 2 === 0 ? "inventario-row-even" : "inventario-row-odd";

  if (inactivo) return `inventario-table-row inventario-row-inactivo ${zebra}`;
  if (preregistrado) return `inventario-table-row inventario-row-prereg ${zebra}`;
  return `inventario-table-row ${zebra}`;
}

function SelectionHeader({
  selection,
  sticky,
}: {
  selection: InventarioSelectionProps;
  sticky?: { className: string; style: CSSProperties };
}) {
  const selectableOnPage =
    selection.selectableOnPage.length > 0
      ? selection.selectableOnPage
      : (selection.printableOnPage ?? []);

  return (
    <th
      className={`${inventarioThStd} normal-case ${sticky?.className ?? ""}`}
      style={sticky?.style}
    >
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-input"
        checked={selection.allPageSelected}
        disabled={selectableOnPage.length === 0}
        onChange={selection.onToggleSelectAllPage}
        aria-label="Seleccionar página"
      />
    </th>
  );
}

function SelectionCell<T extends Activo>({
  activo,
  selection,
  sticky,
}: {
  activo: T;
  selection: InventarioSelectionProps;
  sticky?: { className: string; style: CSSProperties };
}) {
  const puede =
    selection.puedeSeleccionar?.(activo) ??
    selection.puedeImprimir?.(activo) ??
    (activo.estado_registro === "REGISTRADO" && Boolean(activo.codigo_barras));

  return (
    <td className={`${tdBase} text-center ${sticky?.className ?? ""}`} style={sticky?.style}>
      {puede ? (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={selection.selectedIds.has(activo.id)}
          onChange={() => selection.onToggleSelect(activo.id)}
          aria-label={`Seleccionar ${activo.nombre}`}
        />
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </td>
  );
}

function CuentaContableCell<T extends Activo>({
  activo,
  className,
}: {
  activo: T;
  className?: string;
}) {
  const texto = inventarioCuentaContable(activo);
  return (
    <InventarioTextCell title={texto} lineClamp2 className={className}>
      {texto !== "—" ? texto : ""}
    </InventarioTextCell>
  );
}

function filteredColClass(active: boolean, extra?: string): string {
  return [extra, active ? "inventario-col-filtered" : null].filter(Boolean).join(" ");
}

function TotalsFooter({
  activos,
  fechaCorte,
  modoAdmin,
  modoPreregistro,
  mostrarUbicacion,
  stickyOffsets,
  stickyWidths,
}: {
  activos: Activo[];
  fechaCorte?: Date;
  modoAdmin?: boolean;
  modoPreregistro?: boolean;
  mostrarUbicacion?: boolean;
  stickyOffsets: number[];
  stickyWidths: readonly number[];
}) {
  const totales = useMemo(
    () => buildValorizacionTotales(activos, fechaCorte ?? new Date()),
    [activos, fechaCorte],
  );
  if (activos.length === 0) return null;

  const stickyCount = stickyOffsets.length;
  const stickyLabelWidth = stickyWidths.reduce((sum, w) => sum + w, 0);
  const stickyLabelStyle: CSSProperties = {
    left: 0,
    zIndex: 38,
    width: stickyLabelWidth,
    minWidth: stickyLabelWidth,
    maxWidth: stickyLabelWidth,
  };
  const label = `Total (${totales.cantidad})`;
  const importe = `S/ ${formatMonedaPE(totales.valorAdquisicion)}`;
  const depAcum = `S/ ${formatMonedaPE(totales.depreciacionAcumulada)}`;
  const valorNeto = `S/ ${formatMonedaPE(totales.valorNeto)}`;

  return (
    <tfoot>
      <tr className="inventario-totales-row">
        <td
          colSpan={stickyCount}
          className={`${tdTotalBase} inventario-sticky-col inventario-sticky-col--last`}
          style={stickyLabelStyle}
          title={label}
        >
          <span className="block truncate whitespace-nowrap">{label}</span>
        </td>
        {modoPreregistro && <td className={tdTotalBase} />}
        <td className={tdTotalBase} />
        <td className={tdTotalBase} />
        {!modoAdmin && <td className={tdTotalBase} />}
        <td className={tdTotalBase} />
        <td className={`${tdTotalAccent} inventario-totales-monto`} title={`Importe: ${importe}`}>
          {importe}
        </td>
        {!modoAdmin && (
          <>
            <td className={tdTotalBase} />
            <td className={tdTotalBase} />
            <td className={`${tdTotalAccent} inventario-totales-monto`} title={`Depreciación acumulada: ${depAcum}`}>
              {depAcum}
            </td>
          </>
        )}
        <td className={`${tdTotalAccent} inventario-totales-monto`} title={`Valor neto: ${valorNeto}`}>
          {valorNeto}
        </td>
        <td className={tdTotalBase} />
        <td className={tdTotalBase} />
        {mostrarUbicacion && <td className={tdTotalBase} />}
        <td className={tdTotalBase} />
      </tr>
    </tfoot>
  );
}

function FullTableBody<T extends Activo>({
  activos,
  paginated,
  rowOffset,
  emptyMessage,
  colSpan,
  selection,
  mostrarEstadoRegistro,
  mostrarPosibleAmbiente,
  mostrarUbicacion,
  ubicacionMultiplesSedes = false,
  modoAdmin,
  columnFilters,
  renderComprobante,
  renderAcciones,
  stickyOffsets,
  stickyWidths,
  fechaCorte,
}: ActivosInventarioTableProps<T> & {
  colSpan: number;
  stickyOffsets: number[];
  stickyWidths: readonly number[];
}) {
  const modoPreregistro = Boolean(mostrarPosibleAmbiente);
  const sel = selection?.withSelection ? 1 : 0;
  const f = columnFilters;
  const catOn = Boolean(f?.categoria);
  const nomOn = Boolean(f?.nombre.trim());
  const anioOn = Boolean(f?.anioAdquisicion);
  const cuentaOn = Boolean(f?.cuentaContable.trim());
  const estadoOn = Boolean(f?.estadoBien);
  const compOn = Boolean(f?.comprobante.trim());
  const ubiOn = Boolean(f?.ubicacion.trim());
  const corte = fechaCorte ?? new Date();

  return (
    <tbody>
      {activos.length === 0 && (
        <tr>
          <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </td>
        </tr>
      )}
      {paginated.map((activo, index) => {
        const rowIndex = rowOffset + index;
        const descripcion = inventarioDescripcion(activo);
        const inactivo = activo.estado_registro === "DADO_DE_BAJA";
        const { periodo, depAcum, valorNeto } = inventarioDepreciacionFila(activo, inactivo, corte);
        const stickySel = stickyCellProps(stickyOffsets, 0, stickyWidths);
        const stickyN = stickyCellProps(stickyOffsets, sel, stickyWidths);
        const stickyCat = stickyCellProps(stickyOffsets, sel + 1, stickyWidths);
        const stickyCod = stickyCellProps(stickyOffsets, sel + 2, stickyWidths);
        const stickyNom = stickyCellProps(stickyOffsets, sel + 3, stickyWidths);

        return (
          <tr key={activo.id} className={rowClassName(activo, rowIndex)}>
            {selection?.withSelection && (
              <SelectionCell activo={activo} selection={selection} sticky={stickySel} />
            )}
            <InventarioTextCell
              center
              className={stickyN?.className}
              style={stickyN?.style}
            >
              {rowIndex + 1}
            </InventarioTextCell>
            <InventarioCategoriaCell
              activo={activo}
              className={filteredColClass(catOn, stickyCat?.className)}
              style={stickyCat?.style}
            />
            <td
              className={`${tdBase} text-center ${stickyCod?.className ?? ""}`}
              style={stickyCod?.style}
            >
              <InventarioCodigoCellContent activo={activo} />
            </td>
            <InventarioTextCell
              title={activo.nombre}
              lineClamp2
              className={filteredColClass(nomOn, stickyNom?.className)}
              style={stickyNom?.style}
            >
              <span className={inactivo ? "line-through decoration-red-400/60" : undefined}>
                {activo.nombre}
              </span>
              <InventarioEstadoRegistroFilaHint
                activo={activo}
                mostrarPreregistro={mostrarEstadoRegistro && !modoPreregistro}
              />
            </InventarioTextCell>
            {modoPreregistro && (
              <InventarioTextCell title={posibleAmbienteLabel(activo)} lineClamp2>
                {posibleAmbienteLabel(activo)}
              </InventarioTextCell>
            )}
            <InventarioTextCell title={descripcion} lineClamp2>
              {descripcion}
            </InventarioTextCell>
            <InventarioFechaCell
              fecha={activo.fecha_adquisicion}
              valorEsMercado={activo.valor_es_mercado}
              className={filteredColClass(anioOn)}
            />
            {!modoAdmin && (
              <CuentaContableCell activo={activo} className={filteredColClass(cuentaOn)} />
            )}
            <td className={`${tdBase} text-center ${filteredColClass(estadoOn)}`}>
              <EstadoBienBadge estado={activo.estado_bien} />
            </td>
            <InventarioValorPaVmCell activo={activo} />
            {!modoAdmin && (
              <>
                <InventarioTextCell center>
                  {activo.depreciacion?.trim() || ""}
                </InventarioTextCell>
                <InventarioTextCell center className="tabular-nums">
                  {periodo > 0 ? String(Math.round(periodo)) : ""}
                </InventarioTextCell>
                <InventarioTextCell className="text-right tabular-nums">
                  {depAcum != null ? `S/ ${formatMonedaPE(depAcum)}` : ""}
                </InventarioTextCell>
              </>
            )}
            <InventarioTextCell className="text-right tabular-nums font-semibold text-primary">
              {valorNeto != null ? `S/ ${formatMonedaPE(valorNeto)}` : ""}
            </InventarioTextCell>
            <ObservacionCell observacion={activo.observacion} lineClamp2 />
            {renderComprobante(activo, { columnFiltered: compOn })}
            {mostrarUbicacion && (
              <InventarioUbicacionCell
                activo={activo}
                mostrarSede={ubicacionMultiplesSedes}
                className={filteredColClass(ubiOn)}
              />
            )}
            <td className={inventarioTdAccionesClass}>
              <div className="flex flex-nowrap items-center justify-center gap-0.5">
                {renderAcciones(activo)}
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

export function ActivosInventarioTable<T extends Activo>(props: ActivosInventarioTableProps<T>) {
  const {
    selection,
    mostrarPosibleAmbiente,
    mostrarUbicacion,
    modoAdmin,
    tableScrollRef,
    embeddedInParentScroll,
    columnFilters,
    onColumnFiltersChange,
    columnFilterOptions = emptyInventarioColumnFilterOptions(),
  } = props;
  const modoPreregistro = Boolean(mostrarPosibleAmbiente);
  const withSelection = selection?.withSelection ?? false;
  const colSpan =
    (modoAdmin
      ? mostrarUbicacion
        ? INVENTARIO_TABLE_ADMIN_ENTITY_UBICACION_COL_COUNT
        : modoPreregistro
          ? INVENTARIO_TABLE_ADMIN_PREREGISTRO_COL_COUNT
          : INVENTARIO_TABLE_ADMIN_COL_COUNT
      : mostrarUbicacion
        ? INVENTARIO_TABLE_ENTITY_UBICACION_COL_COUNT
        : modoPreregistro
          ? INVENTARIO_TABLE_FULL_PREREGISTRO_COL_COUNT
          : INVENTARIO_TABLE_COL_COUNT) + (withSelection ? 1 : 0);
  const tableClass = `${inventarioActivosTableClass}${modoPreregistro ? " inventario-activos-table--preregistro" : ""}${modoAdmin ? " inventario-activos-table--admin" : ""}${mostrarUbicacion ? " inventario-activos-table--ubicacion" : ""}`;
  const tableMinWidth = inventarioTableMinWidthPx({
    modoPreregistro,
    modoAdmin,
    mostrarUbicacion,
    withSelection,
  });
  const widthValues = inventarioTableWidthValuesPx({
    modoPreregistro,
    modoAdmin,
    mostrarUbicacion,
    withSelection,
  });
  const stickyCount = (withSelection ? 1 : 0) + INVENTARIO_STICKY_DATA_COL_COUNT;
  const stickyOffsets = inventarioStickyLeftOffsets(widthValues, stickyCount);
  const stickyWidths = widthValues.slice(0, stickyCount);
  const sel = withSelection ? 1 : 0;
  const stickySel = stickyCellProps(stickyOffsets, 0, stickyWidths, 40);
  const stickyN = stickyCellProps(stickyOffsets, sel, stickyWidths, 40);
  const stickyCat = stickyCellProps(stickyOffsets, sel + 1, stickyWidths, 40);
  const stickyCod = stickyCellProps(stickyOffsets, sel + 2, stickyWidths, 40);
  const stickyNom = stickyCellProps(stickyOffsets, sel + 3, stickyWidths, 40);
  const tableWrapClass = embeddedInParentScroll
    ? `${panelDataTableWrapClass} ${panelDataTableWrapEmbeddedClass}`
    : panelDataTableWrapClass;
  const showColumnFilters = Boolean(columnFilters && onColumnFiltersChange);

  function patchFilters(partial: Partial<InventarioColumnFilters>) {
    if (!columnFilters || !onColumnFiltersChange) return;
    onColumnFiltersChange({ ...columnFilters, ...partial });
  }

  return (
    <div ref={tableScrollRef} className={tableWrapClass}>
      <div className={panelDataTableFullClass}>
        <table
          className={`${tableClass} w-full table-fixed border-separate border-spacing-0`}
          style={{ minWidth: tableMinWidth }}
        >
          <Colgroup
            modoPreregistro={modoPreregistro}
            modoAdmin={modoAdmin}
            mostrarUbicacion={mostrarUbicacion}
            withSelection={withSelection}
          />
          <thead>
            <tr>
              {withSelection && selection && (
                <SelectionHeader selection={selection} sticky={stickySel} />
              )}
              <Th
                className={`${inventarioThStd} normal-case ${stickyN?.className ?? ""}`}
                style={stickyN?.style}
              >
                N°
              </Th>
              {showColumnFilters && columnFilters ? (
                <ColumnHeaderFilter
                  label="Cat."
                  ariaLabel="Filtrar por categoría"
                  title="Categoría"
                  value={columnFilters.categoria}
                  options={columnFilterOptions.categorias}
                  emptyLabel="Todas"
                  onChange={(value) =>
                    patchFilters({ categoria: value as InventarioColumnFilters["categoria"] })
                  }
                  className={`normal-case ${stickyCat?.className ?? ""}`}
                  style={stickyCat?.style}
                />
              ) : (
                <Th
                  className={`${inventarioThStd} normal-case ${stickyCat?.className ?? ""}`}
                  style={stickyCat?.style}
                  title="Categoría"
                >
                  Cat.
                </Th>
              )}
              <Th
                className={`${inventarioThStd} ${stickyCod?.className ?? ""}`}
                style={stickyCod?.style}
              >
                Código
              </Th>
              {showColumnFilters && columnFilters ? (
                <ColumnHeaderFilter
                  label="Nombre del bien"
                  ariaLabel="Filtrar por nombre del bien"
                  value={columnFilters.nombre}
                  options={columnFilterOptions.nombres}
                  emptyLabel="Todos"
                  multiline
                  onChange={(value) => patchFilters({ nombre: value })}
                  className={`normal-case ${stickyNom?.className ?? ""}`}
                  style={stickyNom?.style}
                />
              ) : (
                <Th
                  className={`${inventarioThStd} normal-case ${stickyNom?.className ?? ""}`}
                  style={stickyNom?.style}
                  multiline
                >
                  Nombre del bien
                </Th>
              )}
              {modoPreregistro && (
                <Th multiline className={`${inventarioThStd} normal-case`}>
                  Posible ambiente
                </Th>
              )}
              <Th multiline className={`${inventarioThStd} normal-case`}>
                Descripción
              </Th>
              {showColumnFilters && columnFilters ? (
                <ColumnHeaderFilter
                  label="Fecha adq."
                  ariaLabel="Filtrar por año de adquisición"
                  value={columnFilters.anioAdquisicion}
                  options={columnFilterOptions.anios}
                  emptyLabel="Todos"
                  multiline
                  onChange={(value) => patchFilters({ anioAdquisicion: value })}
                  className="whitespace-nowrap"
                />
              ) : (
                <Th multiline className={`${inventarioThStd} whitespace-nowrap`}>
                  Fecha adq.
                </Th>
              )}
              {!modoAdmin &&
                (showColumnFilters && columnFilters ? (
                  <ColumnHeaderFilter
                    label="Cuenta contable"
                    ariaLabel="Filtrar por cuenta contable"
                    value={columnFilters.cuentaContable}
                    options={columnFilterOptions.cuentas}
                    emptyLabel="Todas"
                    multiline
                    onChange={(value) => patchFilters({ cuentaContable: value })}
                    className="normal-case"
                  />
                ) : (
                  <Th multiline className={`${inventarioThStd} normal-case`}>
                    Cuenta contable
                  </Th>
                ))}
              {showColumnFilters && columnFilters ? (
                <ColumnHeaderFilter
                  label="Estado"
                  ariaLabel="Filtrar por estado del bien"
                  value={columnFilters.estadoBien}
                  options={columnFilterOptions.estados}
                  emptyLabel="Todos"
                  onChange={(value) =>
                    patchFilters({ estadoBien: value as InventarioColumnFilters["estadoBien"] })
                  }
                />
              ) : (
                <Th>Estado</Th>
              )}
              <Th multiline title="Precio de adquisición o valor de mercado">
                Importe
              </Th>
              {!modoAdmin && (
                <>
                  <Th
                    className={inventarioThAccent}
                    multiline
                    title="Porcentaje de depreciación"
                  >
                    % Deprec.
                  </Th>
                  <Th
                    className={inventarioThAccent}
                    multiline
                    title="Periodo en meses"
                  >
                    Periodo
                  </Th>
                  <Th
                    className={inventarioThAccent}
                    multiline
                    title="Depreciación acumulada"
                  >
                    Dep. acum.
                  </Th>
                </>
              )}
              <Th className={inventarioThAccent} multiline title="Valor neto">
                Valor neto
              </Th>
              <Th multiline className={`${inventarioThStd} normal-case`}>
                Observación
              </Th>
              {showColumnFilters && columnFilters ? (
                <ColumnHeaderFilter
                  label="Comprobante"
                  ariaLabel="Filtrar por comprobante"
                  value={columnFilters.comprobante}
                  options={columnFilterOptions.comprobantes}
                  emptyLabel="Todos"
                  multiline
                  onChange={(value) => patchFilters({ comprobante: value })}
                  className="normal-case"
                />
              ) : (
                <Th multiline className={`${inventarioThStd} normal-case`}>
                  Comprobante
                </Th>
              )}
              {mostrarUbicacion &&
                (showColumnFilters && columnFilters ? (
                  <ColumnHeaderFilter
                    label="Ubicación"
                    ariaLabel="Filtrar por ubicación"
                    value={columnFilters.ubicacion}
                    options={columnFilterOptions.ubicaciones}
                    emptyLabel="Todas"
                    multiline
                    onChange={(value) => patchFilters({ ubicacion: value })}
                    className="normal-case"
                  />
                ) : (
                  <Th multiline className={`${inventarioThStd} normal-case`}>
                    Ubicación
                  </Th>
                ))}
              <Th className={`${inventarioThStd} whitespace-nowrap`}>Acciones</Th>
            </tr>
          </thead>
          <FullTableBody {...props} colSpan={colSpan} stickyOffsets={stickyOffsets} stickyWidths={stickyWidths} />
          <TotalsFooter
            activos={props.activos}
            fechaCorte={props.fechaCorte}
            modoAdmin={modoAdmin}
            modoPreregistro={modoPreregistro}
            mostrarUbicacion={mostrarUbicacion}
            stickyOffsets={stickyOffsets}
            stickyWidths={stickyWidths}
          />
        </table>
      </div>
    </div>
  );
}
