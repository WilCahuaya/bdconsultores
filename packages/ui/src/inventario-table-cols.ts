/** Anchos % (legado / referencia). */
export const INVENTARIO_TABLE_COL_WIDTHS_PCT = [
  2.5, // N°
  2.8, // Cat.
  9.5, // Código (catálogo-correlativo)
  11.5, // Nombre del bien
  10, // Descripción
  5.8, // Fecha adq.
  6.5, // Cuenta contable
  4.2, // Estado
  5.5, // PA / VM
  3.2, // % Deprec.
  3.2, // Periodo
  5, // Dep. acum.
  5, // Valor neto
  9, // Observación
  5.5, // CP
  9.3, // Acciones
] as const;

/** Tabla compacta (xl–1919px): sin depreciación detallada, valor y deprec. unificados. */
export const INVENTARIO_TABLE_COMPACT_COL_WIDTHS_PCT = [
  3, // N°
  3, // Cat.
  10, // Código
  13, // Nombre
  13, // Descripción
  7, // Fecha
  7, // Cuenta contable
  6, // Estado
  7, // Precio PA/VM
  6, // Valor neto
  9, // Observación
  4, // CP
  11, // Acciones
] as const;

export const INVENTARIO_TABLE_COL_COUNT = INVENTARIO_TABLE_COL_WIDTHS_PCT.length;
export const INVENTARIO_TABLE_COMPACT_COL_COUNT = INVENTARIO_TABLE_COMPACT_COL_WIDTHS_PCT.length;

/** Ambiente preregistro (compacta): posible ambiente; sin CP ni valor neto. */
export const INVENTARIO_TABLE_PREREGISTRO_COL_WIDTHS_PCT = [
  3, // N°
  3, // Cat.
  9, // Código
  14, // Nombre del bien
  11, // Posible ambiente
  16, // Descripción
  7, // Fecha adq.
  7, // Cuenta contable
  6, // Estado
  7, // Precio
  12, // Observación
  5, // Acciones
] as const;

export const INVENTARIO_TABLE_PREREGISTRO_COL_COUNT = INVENTARIO_TABLE_PREREGISTRO_COL_WIDTHS_PCT.length;

/** Ambiente preregistro (pantalla ancha): todas las columnas + posible ambiente. */
export const INVENTARIO_TABLE_FULL_PREREGISTRO_COL_WIDTHS_PCT = [
  2.2, // N°
  2.6, // Cat.
  8.5, // Código
  10.5, // Nombre del bien
  7, // Posible ambiente
  8.5, // Descripción
  5.5, // Fecha adq.
  6.2, // Cuenta contable
  4, // Estado
  5.2, // PA / VM
  3, // % Deprec.
  3, // Periodo
  4.8, // Dep. acum.
  4.8, // Valor neto
  5, // Observación
  5.2, // CP
  8, // Acciones
] as const;

export const INVENTARIO_TABLE_FULL_PREREGISTRO_COL_COUNT =
  INVENTARIO_TABLE_FULL_PREREGISTRO_COL_WIDTHS_PCT.length;

/** Vista administrador: sin cuenta contable ni depreciación detallada (% / periodo / acum.). */
export const INVENTARIO_TABLE_ADMIN_COL_WIDTHS_PX = [
  40, // N°
  56, // Cat.
  108, // Código
  180, // Nombre del bien
  160, // Descripción
  100, // Fecha adq.
  84, // Estado
  118, // Importe PA/VM
  118, // Valor neto
  120, // Observación
  130, // Comprobante
  112, // Acciones
] as const;

export const INVENTARIO_TABLE_ADMIN_COL_COUNT = INVENTARIO_TABLE_ADMIN_COL_WIDTHS_PX.length;

/** Admin + posible ambiente (preregistro). */
export const INVENTARIO_TABLE_ADMIN_PREREGISTRO_COL_WIDTHS_PX = [
  40, // N°
  56, // Cat.
  108, // Código
  180, // Nombre del bien
  160, // Posible ambiente
  160, // Descripción
  100, // Fecha adq.
  84, // Estado
  118, // Importe PA/VM
  118, // Valor neto
  120, // Observación
  130, // Comprobante
  112, // Acciones
] as const;

export const INVENTARIO_TABLE_ADMIN_PREREGISTRO_COL_COUNT =
  INVENTARIO_TABLE_ADMIN_PREREGISTRO_COL_WIDTHS_PX.length;

/** Anchos mínimos por columna (px) — lectura cómoda con scroll horizontal. */
export const INVENTARIO_TABLE_SELECTION_COL_WIDTH_PX = 40;

/** Columnas fijas a la izquierda: N°, Cat., Código, Nombre (+ selección si aplica). */
export const INVENTARIO_STICKY_DATA_COL_COUNT = 4;

export const INVENTARIO_TABLE_COL_WIDTHS_PX = [
  40, // N°
  56, // Cat.
  108, // Código
  180, // Nombre del bien
  160, // Descripción
  100, // Fecha adq.
  148, // Cuenta contable
  84, // Estado
  118, // Importe PA/VM
  88, // % Deprec.
  72, // Periodo
  118, // Dep. acum.
  118, // Valor neto
  120, // Observación
  130, // Comprobante
  112, // Acciones
] as const;

const INVENTARIO_UBICACION_COL_WIDTH_PX = 160;

function withUbicacionColumn(widths: readonly number[]): number[] {
  const next = [...widths];
  next.splice(next.length - 1, 0, INVENTARIO_UBICACION_COL_WIDTH_PX);
  return next;
}

/** Inventario de entidad: columna Ubicación antes de Acciones. */
export const INVENTARIO_TABLE_ENTITY_UBICACION_COL_WIDTHS_PX = withUbicacionColumn(
  INVENTARIO_TABLE_COL_WIDTHS_PX,
);

export const INVENTARIO_TABLE_ENTITY_UBICACION_COL_COUNT =
  INVENTARIO_TABLE_ENTITY_UBICACION_COL_WIDTHS_PX.length;

export const INVENTARIO_TABLE_ADMIN_ENTITY_UBICACION_COL_WIDTHS_PX = withUbicacionColumn(
  INVENTARIO_TABLE_ADMIN_COL_WIDTHS_PX,
);

export const INVENTARIO_TABLE_ADMIN_ENTITY_UBICACION_COL_COUNT =
  INVENTARIO_TABLE_ADMIN_ENTITY_UBICACION_COL_WIDTHS_PX.length;

export const INVENTARIO_TABLE_COMPACT_COL_WIDTHS_PX = [
  40, // N°
  56, // Cat.
  108, // Código
  180, // Nombre
  160, // Descripción
  100, // Fecha
  148, // Cuenta contable
  84, // Estado
  118, // Precio PA/VM
  118, // Valor neto
  120, // Observación
  130, // CP
  112, // Acciones
] as const;

export const INVENTARIO_TABLE_PREREGISTRO_COL_WIDTHS_PX = [
  40, // N°
  56, // Cat.
  108, // Código
  180, // Nombre del bien
  160, // Posible ambiente
  160, // Descripción
  100, // Fecha adq.
  148, // Cuenta contable
  84, // Estado
  118, // Precio
  120, // Observación
  112, // Acciones
] as const;

export const INVENTARIO_TABLE_FULL_PREREGISTRO_COL_WIDTHS_PX = [
  40, // N°
  56, // Cat.
  108, // Código
  180, // Nombre del bien
  160, // Posible ambiente
  160, // Descripción
  100, // Fecha adq.
  148, // Cuenta contable
  84, // Estado
  118, // Importe PA/VM
  88, // % Deprec.
  72, // Periodo
  118, // Dep. acum.
  118, // Valor neto
  120, // Observación
  130, // Comprobante
  112, // Acciones
] as const;

function sumWidths(widths: readonly number[]): number {
  return widths.reduce((total, width) => total + width, 0);
}

export const INVENTARIO_TABLE_MIN_WIDTH_PX = sumWidths(INVENTARIO_TABLE_COL_WIDTHS_PX);
export const INVENTARIO_TABLE_PREREGISTRO_MIN_WIDTH_PX = sumWidths(
  INVENTARIO_TABLE_FULL_PREREGISTRO_COL_WIDTHS_PX,
);

/** @deprecated Usar INVENTARIO_TABLE_COL_WIDTHS_PX */
export const INVENTARIO_TABLE_FECHA_MIN_WIDTH_PX = 88;
/** @deprecated Usar INVENTARIO_TABLE_COL_WIDTHS_PX */
export const INVENTARIO_TABLE_COMPROBANTE_MIN_WIDTH_PX = 140;
/** @deprecated Usar INVENTARIO_TABLE_COL_WIDTHS_PX */
export const INVENTARIO_TABLE_ACCIONES_MIN_WIDTH_PX = 136;

export function inventarioFechaColIndex(modoPreregistro: boolean, withSelection: boolean): number {
  const base = 5 + (modoPreregistro ? 1 : 0);
  return withSelection ? base + 1 : base;
}

export function inventarioComprobanteColIndex(modoPreregistro: boolean, withSelection: boolean): number {
  const base = 14 + (modoPreregistro ? 1 : 0);
  return withSelection ? base + 1 : base;
}

export function inventarioAccionesColIndex(modoPreregistro: boolean, withSelection: boolean): number {
  const count = modoPreregistro
    ? INVENTARIO_TABLE_FULL_PREREGISTRO_COL_COUNT
    : INVENTARIO_TABLE_COL_COUNT;
  return (withSelection ? 1 : 0) + count - 1;
}

export const INVENTARIO_TABLE_SELECTION_COL_PCT = 3;

function colWidthsPx(
  widths: readonly number[],
  withSelection: boolean,
): { css: string[]; total: number } {
  const values = withSelection
    ? [INVENTARIO_TABLE_SELECTION_COL_WIDTH_PX, ...widths]
    : [...widths];
  return {
    css: values.map((width) => `${width}px`),
    total: sumWidths(values),
  };
}

function scaleWidths(widths: readonly number[], withSelection: boolean): string[] {
  if (!withSelection) {
    return widths.map((w) => `${w}%`);
  }
  const dataScale = (100 - INVENTARIO_TABLE_SELECTION_COL_PCT) / 100;
  return [
    `${INVENTARIO_TABLE_SELECTION_COL_PCT}%`,
    ...widths.map((w) => `${w * dataScale}%`),
  ];
}

export function inventarioTableColWidths(options?: { withSelection?: boolean }): string[] {
  return colWidthsPx(INVENTARIO_TABLE_COL_WIDTHS_PX, options?.withSelection ?? false).css;
}

export function inventarioTableColWidthsCompact(options?: { withSelection?: boolean }): string[] {
  return colWidthsPx(INVENTARIO_TABLE_COMPACT_COL_WIDTHS_PX, options?.withSelection ?? false).css;
}

export function inventarioTableColWidthsPreregistro(options?: { withSelection?: boolean }): string[] {
  return colWidthsPx(INVENTARIO_TABLE_PREREGISTRO_COL_WIDTHS_PX, options?.withSelection ?? false).css;
}

export function inventarioTableColWidthsFullPreregistro(options?: {
  withSelection?: boolean;
}): string[] {
  return colWidthsPx(
    INVENTARIO_TABLE_FULL_PREREGISTRO_COL_WIDTHS_PX,
    options?.withSelection ?? false,
  ).css;
}

export function inventarioTableColWidthsAdmin(options?: { withSelection?: boolean }): string[] {
  return colWidthsPx(INVENTARIO_TABLE_ADMIN_COL_WIDTHS_PX, options?.withSelection ?? false).css;
}

export function inventarioTableColWidthsAdminPreregistro(options?: {
  withSelection?: boolean;
}): string[] {
  return colWidthsPx(
    INVENTARIO_TABLE_ADMIN_PREREGISTRO_COL_WIDTHS_PX,
    options?.withSelection ?? false,
  ).css;
}

export function inventarioTableColWidthsEntityUbicacion(options?: {
  withSelection?: boolean;
}): string[] {
  return colWidthsPx(
    INVENTARIO_TABLE_ENTITY_UBICACION_COL_WIDTHS_PX,
    options?.withSelection ?? false,
  ).css;
}

export function inventarioTableColWidthsAdminEntityUbicacion(options?: {
  withSelection?: boolean;
}): string[] {
  return colWidthsPx(
    INVENTARIO_TABLE_ADMIN_ENTITY_UBICACION_COL_WIDTHS_PX,
    options?.withSelection ?? false,
  ).css;
}

export function inventarioTableWidthValuesPx(options?: {
  modoPreregistro?: boolean;
  modoAdmin?: boolean;
  mostrarUbicacion?: boolean;
  withSelection?: boolean;
}): number[] {
  const withSelection = options?.withSelection ?? false;
  let widths: readonly number[];
  if (options?.modoAdmin) {
    widths = options.mostrarUbicacion
      ? INVENTARIO_TABLE_ADMIN_ENTITY_UBICACION_COL_WIDTHS_PX
      : options.modoPreregistro
        ? INVENTARIO_TABLE_ADMIN_PREREGISTRO_COL_WIDTHS_PX
        : INVENTARIO_TABLE_ADMIN_COL_WIDTHS_PX;
  } else if (options?.modoPreregistro) {
    widths = INVENTARIO_TABLE_FULL_PREREGISTRO_COL_WIDTHS_PX;
  } else {
    widths = options?.mostrarUbicacion
      ? INVENTARIO_TABLE_ENTITY_UBICACION_COL_WIDTHS_PX
      : INVENTARIO_TABLE_COL_WIDTHS_PX;
  }
  return withSelection
    ? [INVENTARIO_TABLE_SELECTION_COL_WIDTH_PX, ...widths]
    : [...widths];
}

/** Offsets `left` (px) para columnas sticky. */
export function inventarioStickyLeftOffsets(
  widthsPx: readonly number[],
  stickyCount: number,
): number[] {
  const offsets: number[] = [];
  let left = 0;
  for (let i = 0; i < stickyCount && i < widthsPx.length; i++) {
    offsets.push(left);
    left += widthsPx[i]!;
  }
  return offsets;
}

export function inventarioTableMinWidthPx(options?: {
  modoPreregistro?: boolean;
  modoAdmin?: boolean;
  mostrarUbicacion?: boolean;
  withSelection?: boolean;
}): number {
  return sumWidths(inventarioTableWidthValuesPx(options));
}
