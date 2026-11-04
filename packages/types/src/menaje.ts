/** Tope de unidades de un menaje en un ambiente. */
export const MAX_CANTIDAD_MENAJE = 999999;

/** Datos que distinguen dos existencias del mismo código en un ambiente. */
export interface MenajeVariante {
  material?: unknown;
  color?: unknown;
  medidas?: unknown;
  caracteristicas?: unknown;
}

export function esMenaje(categoria: string | null | undefined): boolean {
  return categoria === "MENAJE";
}

export function textoMenaje(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

export function claveVarianteMenaje(variante: MenajeVariante): string {
  return [variante.material, variante.color, variante.medidas, variante.caracteristicas]
    .map((part) => (textoMenaje(part) ?? "").toLocaleLowerCase("es"))
    .join("\u0000");
}

export function mismaVarianteMenaje(a: MenajeVariante, b: MenajeVariante): boolean {
  return claveVarianteMenaje(a) === claveVarianteMenaje(b);
}

/** Copia la variante al payload de una edición que, si no, solo mueve la ubicación. */
export function completarPayloadMenaje(
  payload: Record<string, unknown>,
  input: MenajeVariante & {
    categoria?: string | null;
    codigo_catalogo?: string;
    nombre?: string;
    observacion?: string | null;
    estado_bien?: unknown;
  },
): void {
  if (!esMenaje(input.categoria)) return;
  if (input.codigo_catalogo?.trim()) payload.codigo_catalogo = input.codigo_catalogo.trim();
  if (input.nombre?.trim()) payload.nombre = input.nombre.trim();
  if ("material" in input) payload.material = textoMenaje(input.material);
  if ("color" in input) payload.color = textoMenaje(input.color);
  if ("medidas" in input) payload.medidas = textoMenaje(input.medidas);
  if ("caracteristicas" in input) payload.caracteristicas = textoMenaje(input.caracteristicas);
  if ("observacion" in input) payload.observacion = textoMenaje(input.observacion);
  if ("estado_bien" in input) payload.estado_bien = input.estado_bien ?? null;
}

/** Si el payload no trae el campo, se conserva el valor ya guardado. */
export function varianteMenajeEfectiva(
  payload: Record<string, unknown>,
  existing?: MenajeVariante | null,
): MenajeVariante {
  return {
    material: "material" in payload ? payload.material : existing?.material,
    color: "color" in payload ? payload.color : existing?.color,
    medidas: "medidas" in payload ? payload.medidas : existing?.medidas,
    caracteristicas:
      "caracteristicas" in payload ? payload.caracteristicas : existing?.caracteristicas,
  };
}

export function descripcionMenaje(activo: MenajeVariante): string {
  const partes: string[] = [];
  const material = textoMenaje(activo.material);
  const color = textoMenaje(activo.color);
  const medidas = textoMenaje(activo.medidas);
  const caracteristicas = textoMenaje(activo.caracteristicas);
  if (material) partes.push(material);
  if (color) partes.push(`color: ${color.toLocaleLowerCase("es")}`);
  if (medidas) partes.push(medidas.toLocaleLowerCase("es"));
  if (caracteristicas) partes.push(caracteristicas);
  return partes.join(", ");
}

export function buildNombreConsolidadoMenaje(
  nombre: string,
  material?: string | null,
  color?: string | null,
  medidas?: string | null,
  caracteristicas?: string | null,
): string {
  const base = nombre.trim().toUpperCase();
  if (!base) return "";
  const detalle = descripcionMenaje({ material, color, medidas, caracteristicas });
  return detalle ? `${base} ${detalle}` : base;
}

export function parseCantidadMenaje(
  value: unknown,
): { error?: string; cantidad?: number } {
  const raw = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(raw) || raw < 1 || raw > MAX_CANTIDAD_MENAJE) {
    return {
      error: `La cantidad de menaje debe ser un entero entre 1 y ${MAX_CANTIDAD_MENAJE}.`,
    };
  }
  return { cantidad: raw };
}

/** Unidades que cuenta un bien en listados y reportes. El menaje usa su stock. */
export function cantidadInventarioBien(activo: {
  categoria?: string | null;
  cantidad?: number | null;
}): number {
  if (!esMenaje(activo.categoria)) return 1;
  const parsed = parseCantidadMenaje(activo.cantidad);
  return parsed.cantidad ?? 1;
}

const CAMPOS_VARIANTE_MENAJE = ["material", "color", "medidas", "caracteristicas"] as const;

/**
 * Menaje no lleva etiqueta, depreciación ni cuenta contable.
 * Devuelve un mensaje si la cantidad no es válida.
 */
export function aplicarMenajeEnPayload(
  payload: Record<string, unknown>,
  categoria: string | null | undefined,
  cantidad: unknown,
): string | null {
  if (!esMenaje(categoria)) {
    payload.cantidad = 1;
    if ("material" in payload) payload.material = null;
    return null;
  }
  const parsed = parseCantidadMenaje(cantidad);
  if (parsed.error || parsed.cantidad == null) {
    return parsed.error ?? "La cantidad de menaje no es válida.";
  }
  payload.cantidad = parsed.cantidad;
  payload.nombre_etiqueta = null;
  payload.marca = null;
  payload.modelo = null;
  payload.serie = null;
  payload.depreciacion = null;
  payload.vida_util_meses = null;
  payload.valor_adquisicion = null;
  payload.valor_incremento = null;
  payload.incremento_detalle = null;
  payload.valor_es_mercado = false;
  payload.fecha_inicio_depreciacion = null;
  payload.cuenta_contable_codigo = null;
  payload.cuenta_contable_nombre = null;
  for (const campo of CAMPOS_VARIANTE_MENAJE) {
    if (campo in payload) payload[campo] = textoMenaje(payload[campo]);
  }
  return null;
}

export function mensajeErrorMenajeDuplicado(): string {
  return "Ya hay este menaje, con el mismo material, medida, color y características, en ese ambiente. Edite esa línea para cambiar la cantidad.";
}

export function esErrorMenajeDuplicado(message: string): boolean {
  return (
    message.includes("activos_menaje_ambiente_unique") ||
    message.includes("activos_menaje_posible_ambiente_unique")
  );
}

export function traducirErrorMenaje(message: string): string {
  if (esErrorMenajeDuplicado(message)) return mensajeErrorMenajeDuplicado();
  return message;
}

type FilaMenaje = MenajeVariante & { id: string; cantidad: number | null };

/**
 * Crea la línea de menaje del ambiente o suma la cantidad si la misma variante ya existe.
 * El cliente es el de Supabase; se tipa ancho para no pelear con el builder genérico.
 */
export async function insertarOSumarMenaje(
  supabase: { from(table: "activos"): any },
  args: {
    payload: Record<string, unknown>;
    entidadId: string;
    codigoCatalogo: string;
    cantidad: number;
    esPreregistro: boolean;
    ambienteId: string;
  },
): Promise<{ data?: unknown; error?: string; aviso?: string }> {
  if (!args.ambienteId) {
    return { error: "Indique el ambiente del menaje." };
  }

  let query = supabase
    .from("activos")
    .select("id, cantidad, material, color, medidas, caracteristicas")
    .eq("entidad_id", args.entidadId)
    .eq("codigo_catalogo", args.codigoCatalogo)
    .eq("categoria", "MENAJE")
    .neq("estado_registro", "DADO_DE_BAJA");

  query = args.esPreregistro
    ? query.eq("estado_registro", "PREREGISTRADO").eq("posible_ambiente_id", args.ambienteId)
    : query.eq("estado_registro", "REGISTRADO").eq("ambiente_id", args.ambienteId);

  const { data: filas, error: findError } = await query;
  if (findError) return { error: findError.message };

  const variante = varianteMenajeEfectiva(args.payload);
  const existing = ((filas ?? []) as FilaMenaje[]).find((row) =>
    mismaVarianteMenaje(row, variante),
  );

  if (existing) {
    const total = Number(existing.cantidad) + args.cantidad;
    const tope = parseCantidadMenaje(total);
    if (tope.error) return { error: tope.error };
    const cambios: Record<string, unknown> = {
      cantidad: total,
      nombre: args.payload.nombre,
    };
    const observacionNueva = textoMenaje(args.payload.observacion);
    if (observacionNueva) cambios.observacion = observacionNueva;
    if (args.payload.estado_bien) cambios.estado_bien = args.payload.estado_bien;
    const { data, error } = await supabase
      .from("activos")
      .update(cambios)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return { error: traducirErrorMenaje(error.message) };
    const nombre = String(args.payload.nombre ?? "Menaje");
    return {
      data,
      aviso: `Se sumaron ${args.cantidad} a ${nombre} (${args.codigoCatalogo}). Total en el ambiente: ${total}.`,
    };
  }

  const { data, error } = await supabase.from("activos").insert(args.payload).select("*").single();
  if (error) return { error: traducirErrorMenaje(error.message) };
  return { data };
}

/**
 * Si la misma variante ya está en el ambiente de destino, suma las cantidades
 * en esa línea y elimina la que se estaba editando.
 */
export async function fusionarMenajeSiHayOtro(
  supabase: { from(table: "activos"): any },
  args: {
    activoId: string;
    entidadId: string;
    codigoCatalogo: string;
    cantidad: number;
    nombre: string;
    esPreregistro: boolean;
    ambienteId: string;
    variante: MenajeVariante;
    estadoBien?: unknown;
    observacion?: unknown;
  },
): Promise<{ fusionado: boolean; data?: unknown; aviso?: string; error?: string }> {
  if (!args.ambienteId || !args.codigoCatalogo) return { fusionado: false };

  let query = supabase
    .from("activos")
    .select("id, cantidad, material, color, medidas, caracteristicas")
    .eq("entidad_id", args.entidadId)
    .eq("codigo_catalogo", args.codigoCatalogo)
    .eq("categoria", "MENAJE")
    .neq("id", args.activoId)
    .neq("estado_registro", "DADO_DE_BAJA");

  query = args.esPreregistro
    ? query.eq("estado_registro", "PREREGISTRADO").eq("posible_ambiente_id", args.ambienteId)
    : query.eq("estado_registro", "REGISTRADO").eq("ambiente_id", args.ambienteId);

  const { data: filas, error: findError } = await query;
  if (findError) return { fusionado: false, error: findError.message };
  const otro = ((filas ?? []) as FilaMenaje[]).find((row) =>
    mismaVarianteMenaje(row, args.variante),
  );
  if (!otro) return { fusionado: false };

  const total = Number(otro.cantidad) + args.cantidad;
  const tope = parseCantidadMenaje(total);
  if (tope.error) return { fusionado: false, error: tope.error };

  const { data, error } = await supabase
    .from("activos")
    .update({
      cantidad: total,
      nombre: args.nombre,
      estado_bien: args.estadoBien ?? null,
      observacion: textoMenaje(args.observacion),
    })
    .eq("id", otro.id)
    .select("*")
    .single();
  if (error) return { fusionado: false, error: traducirErrorMenaje(error.message) };

  const { error: deleteError } = await supabase.from("activos").delete().eq("id", args.activoId);
  if (deleteError) return { fusionado: false, error: deleteError.message };

  return {
    fusionado: true,
    data,
    aviso: `Se unió con el menaje que ya estaba en el ambiente. Total: ${total}.`,
  };
}

/**
 * Da de baja parte o toda la cantidad de un menaje.
 * Si no es el total, la fila sigue activa con el resto y las unidades dadas de baja
 * quedan en otra fila, con el motivo, para el reporte de bajas.
 */
export async function ejecutarBajaMenaje(
  supabase: { from(table: "activos"): any },
  args: {
    activoId: string;
    motivo: string;
    cantidad: number;
    usuarioId: string | null;
  },
): Promise<{ error?: string; aviso?: string; entidadId?: string; ambienteId?: string | null }> {
  const motivo = args.motivo.trim();
  if (!motivo) return { error: "Indique el motivo de baja." };

  const pedida = parseCantidadMenaje(args.cantidad);
  if (!pedida.cantidad) return { error: pedida.error ?? "La cantidad no es válida." };

  const { data: row, error: findError } = await supabase
    .from("activos")
    .select("*")
    .eq("id", args.activoId)
    .maybeSingle();
  if (findError) return { error: findError.message };
  if (!row) return { error: "Menaje no encontrado." };
  if (!esMenaje(row.categoria)) return { error: "Esta acción es solo para menaje." };
  if (row.estado_registro === "DADO_DE_BAJA") return { error: "El menaje ya está dado de baja." };
  if (row.estado_registro === "PREREGISTRADO") {
    return { error: "Un menaje preregistrado no puede darse de baja. Elimínelo si fue un error." };
  }

  const actual = Number(row.cantidad ?? 1);
  if (pedida.cantidad > actual) {
    return { error: `Solo hay ${actual} en este ambiente.` };
  }

  const nombre = String(row.nombre ?? "Menaje");
  const entidadId = String(row.entidad_id ?? "");
  const ambienteId = (row.ambiente_id as string | null) ?? null;

  if (pedida.cantidad === actual) {
    const { error } = await supabase
      .from("activos")
      .update({
        estado_registro: "DADO_DE_BAJA",
        motivo_baja: motivo,
        updated_by: args.usuarioId,
      })
      .eq("id", args.activoId);
    if (error) return { error: error.message };
    return { aviso: `${nombre} quedó dado de baja.`, entidadId, ambienteId };
  }

  const quedan = actual - pedida.cantidad;
  const { error: updateError } = await supabase
    .from("activos")
    .update({ cantidad: quedan, updated_by: args.usuarioId })
    .eq("id", args.activoId);
  if (updateError) return { error: updateError.message };

  const copia: Record<string, unknown> = { ...row };
  delete copia.id;
  delete copia.created_at;
  delete copia.updated_at;
  copia.cantidad = pedida.cantidad;
  copia.estado_registro = "DADO_DE_BAJA";
  copia.motivo_baja = motivo;
  copia.correlativo = null;
  copia.codigo_barras = null;
  copia.updated_by = args.usuarioId;

  const { error: insertError } = await supabase.from("activos").insert(copia);
  if (insertError) {
    await supabase
      .from("activos")
      .update({ cantidad: actual, updated_by: args.usuarioId })
      .eq("id", args.activoId);
    return { error: insertError.message };
  }

  return {
    aviso: `Se dieron de baja ${pedida.cantidad} de ${nombre}. Quedan ${quedan}.`,
    entidadId,
    ambienteId,
  };
}

/** En el reporte de bajas, el menaje muestra cuántas unidades salieron. */
export function nombreEnReporteBaja(activo: {
  categoria?: string | null;
  nombre: string;
  cantidad?: number | null;
}): string {
  const cantidad = Number(activo.cantidad ?? 1);
  if (esMenaje(activo.categoria) && Number.isFinite(cantidad) && cantidad > 1) {
    return `${activo.nombre} (${cantidad})`;
  }
  return activo.nombre;
}
