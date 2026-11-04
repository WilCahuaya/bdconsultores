type EstadoRegistroLocal = "PREREGISTRADO" | "REGISTRADO" | "DADO_DE_BAJA";
type EstadoBienLocal = "BUENO" | "REGULAR" | "MALO";

function formatMoney(value: number): string {
  return value.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface HistorialActivoItem {
  id: string;
  activo_id: string;
  entidad_id: string;
  usuario_id: string;
  accion: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  created_at: string;
  usuario_nombre?: string;
}

export interface HistorialLookupMaps {
  sedes: Record<string, string>;
  ambientes: Record<string, string>;
}

export type HistorialActivoEventoTipo =
  | "alta"
  | "edicion"
  | "ubicacion"
  | "baja"
  | "recuperacion"
  | "validacion"
  | "otro";

export interface HistorialActivoCambio {
  campo: string;
  label: string;
  anterior?: string;
  nuevo?: string;
}

export interface HistorialActivoEvento {
  id: string;
  titulo: string;
  fecha: string;
  usuarioNombre?: string;
  tipo: HistorialActivoEventoTipo;
  cambios: HistorialActivoCambio[];
}

const CAMPOS_HISTORIAL_LABELS: Record<string, string> = {
  nombre: "Nombre del bien",
  nombre_etiqueta: "Nombre en etiqueta",
  descripcion: "Descripción",
  caracteristicas: "Características",
  estado_registro: "Estado del registro",
  estado_bien: "Estado físico",
  categoria: "Categoría",
  codigo_catalogo: "Código de catálogo",
  codigo_barras: "Código de barras",
  correlativo: "Correlativo",
  cantidad: "Cantidad",
  sede_id: "Sede",
  ambiente_id: "Ambiente",
  posible_ambiente_id: "Ambiente probable",
  valor_adquisicion: "Valor de adquisición",
  valor_es_mercado: "Valor es de mercado",
  fecha_adquisicion: "Fecha de adquisición",
  vida_util_meses: "Vida útil (meses)",
  depreciacion: "Depreciación",
  marca: "Marca",
  modelo: "Modelo",
  serie: "Serie",
  color: "Color",
  material: "Material",
  medidas: "Medidas",
  medida_largo: "Largo",
  medida_ancho: "Ancho",
  medida_altura: "Altura",
  responsable: "Responsable",
  observacion: "Observación",
  motivo_baja: "Motivo de baja",
  comprobante_serie: "Serie de comprobante",
  cuenta_contable_codigo: "Código cuenta contable",
  cuenta_contable_nombre: "Nombre cuenta contable",
  foto_path: "Foto",
  comprobante_path: "Comprobante",
  activo: "Bien",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function labelHistorialCampo(campo: string | null | undefined): string {
  if (!campo) return "Cambio";
  return CAMPOS_HISTORIAL_LABELS[campo] ?? campo.replace(/_/g, " ");
}

function labelEstadoRegistro(value: string): string {
  const map: Record<EstadoRegistroLocal, string> = {
    PREREGISTRADO: "Preregistrado",
    REGISTRADO: "Registrado",
    DADO_DE_BAJA: "Dado de baja",
  };
  return map[value as EstadoRegistroLocal] ?? value;
}

function labelEstadoBien(value: string): string {
  const map: Record<EstadoBienLocal, string> = {
    BUENO: "Bueno",
    REGULAR: "Regular",
    MALO: "Malo",
  };
  return map[value as EstadoBienLocal] ?? value;
}

function labelCategoria(value: string): string {
  if (value === "CUENTA_ORDEN") return "Cuenta de orden";
  if (value === "MENAJE") return "Menaje";
  if (value === "ACTIVO") return "Activo";
  return value;
}

function labelBooleano(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "t" || v === "1") return "Sí";
  if (v === "false" || v === "f" || v === "0") return "No";
  return value;
}

function labelArchivo(value: string | null): string {
  if (!value?.trim()) return "Sin archivo";
  return "Archivo adjunto";
}

function resolveLookupNombre(
  campo: string,
  value: string | null,
  lookups?: HistorialLookupMaps,
): string | null {
  if (!value?.trim() || !lookups) return null;
  if (campo === "sede_id") return lookups.sedes[value] ?? null;
  if (campo === "ambiente_id" || campo === "posible_ambiente_id") {
    return lookups.ambientes[value] ?? null;
  }
  return null;
}

export function formatHistorialValor(
  campo: string,
  value: string | null | undefined,
  lookups?: HistorialLookupMaps,
): string {
  if (value == null || value === "") return "—";

  const lookup = resolveLookupNombre(campo, value, lookups);
  if (lookup) return lookup;

  if (UUID_RE.test(value) && (campo.endsWith("_id") || campo === "activo")) {
    return "—";
  }

  switch (campo) {
    case "estado_registro":
      return labelEstadoRegistro(value);
    case "estado_bien":
      return labelEstadoBien(value);
    case "categoria":
      return labelCategoria(value);
    case "valor_es_mercado":
      return labelBooleano(value);
    case "valor_adquisicion": {
      const num = Number(value);
      return Number.isFinite(num) ? `S/ ${formatMoney(num)}` : value;
    }
    case "foto_path":
    case "comprobante_path":
      return labelArchivo(value);
    case "fecha_adquisicion":
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split("-");
        return `${d}/${m}/${y}`;
      }
      return value;
    case "depreciacion":
      return value.includes("%") ? value : `${value} %`;
    default:
      return value;
  }
}

function historialGrupoKey(item: HistorialActivoItem): string {
  const segundo = item.created_at.slice(0, 19);
  return `${segundo}|${item.usuario_id}|${item.accion}`;
}

export function groupHistorialItems(items: HistorialActivoItem[]): HistorialActivoItem[][] {
  const grupos = new Map<string, HistorialActivoItem[]>();
  for (const item of items) {
    const key = historialGrupoKey(item);
    const lista = grupos.get(key);
    if (lista) lista.push(item);
    else grupos.set(key, [item]);
  }
  return [...grupos.values()];
}

function detectarTipoEvento(
  accion: string,
  cambios: HistorialActivoCambio[],
): HistorialActivoEventoTipo {
  if (accion === "INSERT") return "alta";

  const porCampo = new Map(cambios.map((c) => [c.campo, c]));
  const estado = porCampo.get("estado_registro");
  if (estado) {
    if (estado.nuevo === "Dado de baja") return "baja";
    if (estado.anterior === "Dado de baja") return "recuperacion";
    if (estado.anterior === "Preregistrado" && estado.nuevo === "Registrado") return "validacion";
  }
  if (porCampo.has("sede_id") || porCampo.has("ambiente_id") || porCampo.has("posible_ambiente_id")) {
    return "ubicacion";
  }
  return cambios.length > 0 ? "edicion" : "otro";
}

function tituloEvento(tipo: HistorialActivoEventoTipo, cambios: HistorialActivoCambio[]): string {
  switch (tipo) {
    case "alta":
      return "Bien registrado";
    case "baja":
      return "Dado de baja";
    case "recuperacion":
      return "Bien recuperado";
    case "validacion":
      return "Bien validado";
    case "ubicacion":
      return "Cambio de ubicación";
    case "edicion":
      return cambios.length === 1
        ? `Actualización: ${cambios[0].label}`
        : `Actualización (${cambios.length} campos)`;
    default:
      return "Cambio registrado";
  }
}

export function buildHistorialEventos(
  items: HistorialActivoItem[],
  lookups?: HistorialLookupMaps,
): HistorialActivoEvento[] {
  const grupos = groupHistorialItems(items);

  return grupos
    .map((grupo) => {
      const primero = grupo[0];
      const grupoFiltrado = filterCuentaBackfillEnGrupo(grupo);
      const cambios: HistorialActivoCambio[] = grupoFiltrado
        .filter((item) => item.campo && item.campo !== "activo")
        .map((item) => ({
          campo: item.campo!,
          label: labelHistorialCampo(item.campo),
          anterior: item.valor_anterior
            ? formatHistorialValor(item.campo!, item.valor_anterior, lookups)
            : undefined,
          nuevo: item.valor_nuevo
            ? formatHistorialValor(item.campo!, item.valor_nuevo, lookups)
            : undefined,
        }));

      if (primero.accion === "INSERT" && cambios.length === 0 && primero.valor_nuevo) {
        cambios.push({
          campo: "nombre",
          label: "Nombre del bien",
          nuevo: primero.valor_nuevo,
        });
      }

      const tipo = detectarTipoEvento(primero.accion, cambios);
      return {
        id: primero.id,
        titulo: tituloEvento(tipo, cambios),
        fecha: primero.created_at,
        usuarioNombre: primero.usuario_nombre,
        tipo,
        cambios,
      };
    })
    .filter((evento) => evento.cambios.length > 0 || evento.tipo === "alta")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

const CAMPOS_CUENTA_ACTIVO = new Set(["cuenta_contable_codigo", "cuenta_contable_nombre"]);

/** Oculta en UI el ruido de cuenta contable al guardar otros campos (null → valor del catálogo). */
function filterCuentaBackfillEnGrupo(grupo: HistorialActivoItem[]): HistorialActivoItem[] {
  const hayOtrosCambios = grupo.some(
    (item) => item.campo && !CAMPOS_CUENTA_ACTIVO.has(item.campo) && item.campo !== "activo",
  );
  if (!hayOtrosCambios) return grupo;

  return grupo.filter((item) => {
    if (!item.campo || !CAMPOS_CUENTA_ACTIVO.has(item.campo)) return true;
    return Boolean(item.valor_anterior?.trim());
  });
}

export function collectHistorialLookupIds(items: HistorialActivoItem[]): {
  sedeIds: string[];
  ambienteIds: string[];
} {
  const sedeIds = new Set<string>();
  const ambienteIds = new Set<string>();

  for (const item of items) {
    if (!item.campo) continue;
    const valores = [item.valor_anterior, item.valor_nuevo];
    for (const valor of valores) {
      if (!valor || !UUID_RE.test(valor)) continue;
      if (item.campo === "sede_id") sedeIds.add(valor);
      if (item.campo === "ambiente_id" || item.campo === "posible_ambiente_id") {
        ambienteIds.add(valor);
      }
    }
  }

  return { sedeIds: [...sedeIds], ambienteIds: [...ambienteIds] };
}
