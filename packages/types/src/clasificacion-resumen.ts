import {
  calcPeriodoMesesHasta,
  calcValorizacionActivo,
  formatCuentaContableDisplay,
  resolveCuentaContableActivo,
  resolveFechaInicioDepreciacion,
  valorActivoEfectivo,
  type ActivoCuentaContableSource,
  type CatalogoCuentaContableSource,
  type CategoriaBien,
  type EstadoBien,
} from "./index";

export interface ClasificacionResumen {
  /** Texto visible de la cuenta (código + nombre). */
  categoria: string;
  cuenta: string;
  grupo: string;
  /** Clasificación del bien: Activo o Cuenta de orden. */
  tipoBien: CategoriaBien;
  cantidad: number;
  valorAdquisicion: number;
  depreciacionAcumulada: number;
  valorNeto: number;
}

export interface ValorizacionTotales {
  cantidad: number;
  valorAdquisicion: number;
  depreciacionAcumulada: number;
  valorNeto: number;
}

export interface ClasificacionResumenSeccion {
  tipoBien: CategoriaBien;
  label: string;
  filas: ClasificacionResumen[];
  subtotal: ValorizacionTotales;
}

/** Activo mínimo para valorización y resumen contable. */
export interface ActivoValorizacionFuente extends ActivoCuentaContableSource {
  valor_adquisicion?: number | null;
  valor_incremento?: number | null;
  vida_util_meses?: number | null;
  fecha_adquisicion?: string | null;
  fecha_inicio_depreciacion?: string | null;
  categoria?: CategoriaBien | string | null;
  estado_registro?: string;
  estado_bien?: EstadoBien | null;
  cuenta_codigo?: string | null;
  contabilidad?: string | null;
  catalogo_grupo?: string | null;
  catalogo?: CatalogoCuentaContableSource | null;
}

export function tipoBienDesdeActivo(activo: {
  categoria?: CategoriaBien | string | null;
}): CategoriaBien {
  return activo.categoria === "CUENTA_ORDEN" ? "CUENTA_ORDEN" : "ACTIVO";
}

export function categoriaBienResumenLabel(tipo: CategoriaBien): string {
  return tipo === "CUENTA_ORDEN" ? "Cuenta de orden" : "Activo";
}

export function cuentaGrupoActivoValorizacion(
  activo: ActivoValorizacionFuente,
): { cuenta: string; grupo: string; categoria: string; codigo: string } {
  const resolved =
    activo.cuenta_codigo !== undefined || activo.contabilidad !== undefined
      ? {
          cuenta_codigo: activo.cuenta_codigo ?? null,
          contabilidad: activo.contabilidad ?? null,
        }
      : resolveCuentaContableActivo(activo, activo.catalogo ?? null);

  const codigo = resolved.cuenta_codigo?.trim() ?? "";
  const nombre = resolved.contabilidad?.trim() ?? "";
  const cuenta = formatCuentaContableDisplay(codigo, nombre);
  const grupo = activo.catalogo_grupo?.trim() || "—";
  const categoria = cuenta;

  return { cuenta, grupo, categoria, codigo: codigo || cuenta };
}

function emptyTotales(): ValorizacionTotales {
  return {
    cantidad: 0,
    valorAdquisicion: 0,
    depreciacionAcumulada: 0,
    valorNeto: 0,
  };
}

function sumarTotales(filas: ClasificacionResumen[]): ValorizacionTotales {
  const t = emptyTotales();
  for (const fila of filas) {
    t.cantidad += fila.cantidad;
    t.valorAdquisicion += fila.valorAdquisicion;
    t.depreciacionAcumulada += fila.depreciacionAcumulada;
    t.valorNeto += fila.valorNeto;
  }
  return t;
}

export function buildValorizacionTotales(
  activos: ActivoValorizacionFuente[],
  fechaCorte: Date = new Date(),
): ValorizacionTotales {
  let valorAdquisicion = 0;
  let depreciacionAcumulada = 0;
  let valorNeto = 0;

  for (const activo of activos) {
    const valor = valorActivoEfectivo(activo.valor_adquisicion, activo.valor_incremento);
    const periodo = calcPeriodoMesesHasta(
      resolveFechaInicioDepreciacion(activo.fecha_inicio_depreciacion, activo.fecha_adquisicion),
      fechaCorte,
    );
    const { depreciacionAcumulada: depAcum, valorNeto: neto } = calcValorizacionActivo({
      valor,
      vidaUtilMeses: activo.vida_util_meses ?? null,
      periodoMeses: periodo,
      categoria: activo.categoria,
      estadoRegistro: activo.estado_registro,
      estadoBien: activo.estado_bien,
    });
    valorAdquisicion += valor ?? 0;
    depreciacionAcumulada += depAcum ?? 0;
    valorNeto += neto ?? 0;
  }

  return {
    cantidad: activos.length,
    valorAdquisicion,
    depreciacionAcumulada,
    valorNeto,
  };
}

export function buildClasificacionResumen(
  activos: ActivoValorizacionFuente[],
  fechaCorte: Date = new Date(),
): ClasificacionResumen[] {
  const map = new Map<string, ClasificacionResumen>();

  for (const activo of activos) {
    const tipoBien = tipoBienDesdeActivo(activo);
    const { cuenta, categoria, codigo } = cuentaGrupoActivoValorizacion(activo);
    const key = `${tipoBien}::${codigo || cuenta}`;
    const valorEfectivo = valorActivoEfectivo(activo.valor_adquisicion, activo.valor_incremento);
    const periodo = calcPeriodoMesesHasta(
      resolveFechaInicioDepreciacion(activo.fecha_inicio_depreciacion, activo.fecha_adquisicion),
      fechaCorte,
    );
    const { depreciacionAcumulada: depAcum, valorNeto } = calcValorizacionActivo({
      valor: valorEfectivo,
      vidaUtilMeses: activo.vida_util_meses ?? null,
      periodoMeses: periodo,
      categoria: activo.categoria,
      estadoRegistro: activo.estado_registro,
      estadoBien: activo.estado_bien,
    });
    const valor = valorEfectivo ?? 0;
    const dep = depAcum ?? 0;
    const neto = valorNeto ?? 0;

    const existing = map.get(key);
    if (existing) {
      existing.cantidad += 1;
      existing.valorAdquisicion += valor;
      existing.depreciacionAcumulada += dep;
      existing.valorNeto += neto;
    } else {
      map.set(key, {
        categoria,
        cuenta,
        grupo: "",
        tipoBien,
        cantidad: 1,
        valorAdquisicion: valor,
        depreciacionAcumulada: dep,
        valorNeto: neto,
      });
    }
  }

  const tipoOrder = (t: CategoriaBien) => (t === "ACTIVO" ? 0 : 1);

  return Array.from(map.values()).sort((a, b) => {
    const byTipo = tipoOrder(a.tipoBien) - tipoOrder(b.tipoBien);
    if (byTipo !== 0) return byTipo;
    return a.categoria.localeCompare(b.categoria, "es", { numeric: true });
  });
}

/** Agrupa filas del resumen en secciones Activo / Cuenta de orden (solo las que tengan datos). */
export function agruparClasificacionResumenPorTipo(
  resumen: ClasificacionResumen[],
): ClasificacionResumenSeccion[] {
  const order: CategoriaBien[] = ["ACTIVO", "CUENTA_ORDEN"];
  const secciones: ClasificacionResumenSeccion[] = [];

  for (const tipoBien of order) {
    const filas = resumen.filter((r) => r.tipoBien === tipoBien);
    if (filas.length === 0) continue;
    secciones.push({
      tipoBien,
      label: categoriaBienResumenLabel(tipoBien),
      filas,
      subtotal: sumarTotales(filas),
    });
  }

  return secciones;
}

export interface DepreciacionMensualFila {
  /** 1 = enero … 12 = diciembre */
  mes: number;
  label: string;
  depreciacionAcumulada: number;
}

const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/**
 * Depreciación acumulada del inventario por mes del año de la fecha de corte,
 * desde enero hasta el mes de corte (inclusive).
 * Meses anteriores usan el último día del mes; el mes de corte usa la fecha de corte.
 */
export function buildDepreciacionMensualResumen(
  activos: ActivoValorizacionFuente[],
  fechaCorte: Date = new Date(),
): DepreciacionMensualFila[] {
  const year = fechaCorte.getFullYear();
  const mesCorte = fechaCorte.getMonth(); // 0-based
  const filas: DepreciacionMensualFila[] = [];

  for (let mes = 0; mes <= mesCorte; mes++) {
    const hasta =
      mes === mesCorte
        ? new Date(
            fechaCorte.getFullYear(),
            fechaCorte.getMonth(),
            fechaCorte.getDate(),
          )
        : new Date(year, mes + 1, 0); // último día del mes
    const totales = buildValorizacionTotales(activos, hasta);
    filas.push({
      mes: mes + 1,
      label: MESES_ES[mes]!,
      depreciacionAcumulada: totales.depreciacionAcumulada,
    });
  }

  return filas;
}
