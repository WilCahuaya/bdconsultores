-- Edición de los bienes marcados que comparten nombre.
-- No mueve ubicación: eso sigue en Mover. No toca código, serie ni nombre.

CREATE OR REPLACE FUNCTION public.update_activos_seleccion(
  p_ids UUID[],
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
  v_esperados INTEGER;
  v_encontrados INTEGER;
  v_entidades INTEGER;
  v_nombres INTEGER;
  v_estados INTEGER;
  v_bajas INTEGER;
  v_entidad UUID;
  v_nombre TEXT;
  v_estado public.estado_registro;
  v_updated INTEGER;
  v_es_contador BOOLEAN;
  v_key TEXT;
  v_allowed TEXT[];
  v_forbidden TEXT[] := ARRAY[
    'id', 'entidad_id', 'correlativo', 'codigo_barras', 'serie',
    'estado_registro', 'motivo_baja', 'created_by', 'created_at', 'updated_at',
    'nombre', 'codigo_catalogo', 'nombre_etiqueta', 'descripcion',
    'sede_id', 'ambiente_id'
  ];
  v_clear_comprobante BOOLEAN := FALSE;
BEGIN
  IF p_patch IS NULL OR p_patch = '{}'::JSONB THEN
    RAISE EXCEPTION 'No hay cambios para aplicar';
  END IF;

  SELECT coalesce(array_agg(DISTINCT id), '{}')
  INTO v_ids
  FROM unnest(coalesce(p_ids, '{}'::UUID[])) AS id
  WHERE id IS NOT NULL;

  v_esperados := coalesce(cardinality(v_ids), 0);
  IF v_esperados < 2 THEN
    RAISE EXCEPTION 'Seleccione al menos dos bienes';
  END IF;
  IF v_esperados > 500 THEN
    RAISE EXCEPTION 'Máximo 500 bienes por edición';
  END IF;

  SELECT
    count(*)::INTEGER,
    count(DISTINCT a.entidad_id)::INTEGER,
    count(DISTINCT trim(a.nombre))::INTEGER,
    count(DISTINCT a.estado_registro)::INTEGER,
    count(*) FILTER (WHERE a.estado_registro = 'DADO_DE_BAJA')::INTEGER,
    min(a.entidad_id),
    min(trim(a.nombre)),
    min(a.estado_registro)
  INTO
    v_encontrados,
    v_entidades,
    v_nombres,
    v_estados,
    v_bajas,
    v_entidad,
    v_nombre,
    v_estado
  FROM public.activos a
  WHERE a.id = ANY (v_ids);

  IF v_encontrados <> v_esperados THEN
    RAISE EXCEPTION 'Alguno de los bienes seleccionados ya no existe';
  END IF;
  IF v_bajas > 0 THEN
    RAISE EXCEPTION 'No puede editar bienes dados de baja';
  END IF;
  IF v_entidades <> 1 OR v_entidad IS NULL THEN
    RAISE EXCEPTION 'Los bienes seleccionados deben ser de la misma entidad';
  END IF;
  IF NOT public.can_access_entidad(v_entidad) THEN
    RAISE EXCEPTION 'Sin permiso para esta entidad';
  END IF;
  IF v_nombres <> 1 OR v_nombre IS NULL OR v_nombre = '' THEN
    RAISE EXCEPTION 'Solo puede editar juntos bienes con el mismo nombre';
  END IF;
  IF v_estados <> 1 OR v_estado IS NULL THEN
    RAISE EXCEPTION 'Los bienes seleccionados deben tener el mismo estado de registro';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_patch)
  LOOP
    IF v_key = ANY (v_forbidden) THEN
      RAISE EXCEPTION 'Campo no permitido en edición de la selección: %', v_key;
    END IF;
  END LOOP;

  v_es_contador := public.is_contador();

  IF v_es_contador THEN
    v_allowed := ARRAY[
      'categoria',
      'cuenta_contable_codigo',
      'cuenta_contable_nombre',
      'marca',
      'modelo',
      'color',
      'medidas',
      'caracteristicas',
      'estado_bien',
      'observacion',
      'valor_adquisicion',
      'valor_es_mercado',
      'fecha_adquisicion',
      'fecha_inicio_depreciacion',
      'incremento_detalle',
      'valor_incremento',
      'comprobante_serie',
      'comprobante_path',
      'foto_path',
      'depreciacion',
      'vida_util_meses'
    ];
    IF v_estado = 'PREREGISTRADO' THEN
      v_allowed := v_allowed || ARRAY['posible_ambiente_id'];
    END IF;
  ELSIF v_estado = 'PREREGISTRADO' THEN
    v_allowed := ARRAY[
      'categoria',
      'marca',
      'modelo',
      'color',
      'medidas',
      'caracteristicas',
      'estado_bien',
      'observacion',
      'valor_adquisicion',
      'valor_es_mercado',
      'fecha_adquisicion',
      'fecha_inicio_depreciacion',
      'incremento_detalle',
      'valor_incremento',
      'comprobante_serie',
      'comprobante_path',
      'foto_path',
      'posible_ambiente_id'
    ];
  ELSE
    v_allowed := ARRAY[
      'estado_bien',
      'observacion_admin'
    ];
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_patch)
  LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'Campo no permitido para su rol: %', v_key;
    END IF;
  END LOOP;

  IF p_patch ? 'valor_es_mercado' AND (p_patch->>'valor_es_mercado')::BOOLEAN THEN
    v_clear_comprobante := TRUE;
  END IF;

  UPDATE public.activos a
  SET
    categoria = CASE WHEN p_patch ? 'categoria'
      THEN (p_patch->>'categoria')::public.categoria_bien ELSE a.categoria END,
    cuenta_contable_codigo = CASE WHEN p_patch ? 'cuenta_contable_codigo'
      THEN NULLIF(trim(p_patch->>'cuenta_contable_codigo'), '') ELSE a.cuenta_contable_codigo END,
    cuenta_contable_nombre = CASE WHEN p_patch ? 'cuenta_contable_nombre'
      THEN NULLIF(trim(p_patch->>'cuenta_contable_nombre'), '') ELSE a.cuenta_contable_nombre END,
    marca = CASE WHEN p_patch ? 'marca'
      THEN NULLIF(trim(p_patch->>'marca'), '') ELSE a.marca END,
    modelo = CASE WHEN p_patch ? 'modelo'
      THEN NULLIF(trim(p_patch->>'modelo'), '') ELSE a.modelo END,
    color = CASE WHEN p_patch ? 'color'
      THEN NULLIF(trim(p_patch->>'color'), '') ELSE a.color END,
    medidas = CASE WHEN p_patch ? 'medidas'
      THEN NULLIF(trim(p_patch->>'medidas'), '') ELSE a.medidas END,
    caracteristicas = CASE WHEN p_patch ? 'caracteristicas'
      THEN NULLIF(trim(p_patch->>'caracteristicas'), '') ELSE a.caracteristicas END,
    estado_bien = CASE WHEN p_patch ? 'estado_bien'
      THEN (p_patch->>'estado_bien')::public.estado_bien ELSE a.estado_bien END,
    observacion = CASE
      WHEN p_patch ? 'observacion_admin'
        THEN public.merge_observacion_admin(a.observacion, p_patch->>'observacion_admin')
      WHEN p_patch ? 'observacion'
        THEN NULLIF(trim(p_patch->>'observacion'), '')
      ELSE a.observacion
    END,
    valor_adquisicion = CASE WHEN p_patch ? 'valor_adquisicion'
      THEN NULLIF(p_patch->>'valor_adquisicion', '')::NUMERIC ELSE a.valor_adquisicion END,
    valor_es_mercado = CASE WHEN p_patch ? 'valor_es_mercado'
      THEN (p_patch->>'valor_es_mercado')::BOOLEAN ELSE a.valor_es_mercado END,
    fecha_adquisicion = CASE WHEN p_patch ? 'fecha_adquisicion'
      THEN NULLIF(p_patch->>'fecha_adquisicion', '')::DATE ELSE a.fecha_adquisicion END,
    fecha_inicio_depreciacion = CASE WHEN p_patch ? 'fecha_inicio_depreciacion'
      THEN NULLIF(p_patch->>'fecha_inicio_depreciacion', '')::DATE ELSE a.fecha_inicio_depreciacion END,
    incremento_detalle = CASE WHEN p_patch ? 'incremento_detalle'
      THEN NULLIF(trim(p_patch->>'incremento_detalle'), '') ELSE a.incremento_detalle END,
    valor_incremento = CASE WHEN p_patch ? 'valor_incremento'
      THEN NULLIF(p_patch->>'valor_incremento', '')::NUMERIC ELSE a.valor_incremento END,
    comprobante_serie = CASE
      WHEN v_clear_comprobante THEN NULL
      WHEN p_patch ? 'comprobante_serie'
        THEN NULLIF(trim(p_patch->>'comprobante_serie'), '')
      ELSE a.comprobante_serie
    END,
    comprobante_path = CASE
      WHEN v_clear_comprobante THEN NULL
      WHEN p_patch ? 'comprobante_path'
        THEN NULLIF(trim(p_patch->>'comprobante_path'), '')
      ELSE a.comprobante_path
    END,
    foto_path = CASE WHEN p_patch ? 'foto_path'
      THEN NULLIF(trim(p_patch->>'foto_path'), '') ELSE a.foto_path END,
    depreciacion = CASE WHEN p_patch ? 'depreciacion'
      THEN NULLIF(trim(p_patch->>'depreciacion'), '') ELSE a.depreciacion END,
    vida_util_meses = CASE WHEN p_patch ? 'vida_util_meses'
      THEN NULLIF(p_patch->>'vida_util_meses', '')::INTEGER ELSE a.vida_util_meses END,
    posible_ambiente_id = CASE WHEN p_patch ? 'posible_ambiente_id'
      THEN NULLIF(p_patch->>'posible_ambiente_id', '')::UUID ELSE a.posible_ambiente_id END,
    updated_by = auth.uid()
  WHERE a.id = ANY (v_ids)
    AND a.entidad_id = v_entidad
    AND trim(a.nombre) = v_nombre
    AND a.estado_registro = v_estado;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> v_esperados THEN
    RAISE EXCEPTION 'No se pudieron actualizar todos los bienes seleccionados';
  END IF;

  RETURN jsonb_build_object('actualizados', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_activos_seleccion(UUID[], JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
