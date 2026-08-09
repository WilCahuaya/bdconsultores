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
  categoria: string;
  cuenta: string;
  grupo: string;
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
    const { cuenta, categoria, codigo } = cuentaGrupoActivoValorizacion(activo);
    const key = codigo || cuenta;
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
        cantidad: 1,
        valorAdquisicion: valor,
        depreciacionAcumulada: dep,
        valorNeto: neto,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.categoria.localeCompare(b.categoria, "es", { numeric: true }),
  );
}
