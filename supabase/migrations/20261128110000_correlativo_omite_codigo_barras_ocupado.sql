-- Al cambiar el código de catálogo de un bien registrado, el código de barras
-- impreso se conserva. Ese texto sigue ocupando el número del catálogo anterior,
-- y MAX(correlativo)+1 lo volvía a emitir al duplicar. El siguiente correlativo
-- ahora salta cualquier código de barras que ya exista en la entidad.

CREATE OR REPLACE FUNCTION public.correlativo_libre(
  p_entidad_id UUID,
  p_catalogo TEXT,
  p_desde INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
  v_barcode TEXT;
BEGIN
  IF p_catalogo IS NULL OR btrim(p_catalogo) = '' THEN
    RAISE EXCEPTION 'El código de catálogo es obligatorio';
  END IF;

  IF p_desde IS NULL THEN
    SELECT COALESCE(MAX(a.correlativo), 0)
      INTO v_next
    FROM public.activos AS a
    WHERE a.entidad_id = p_entidad_id
      AND a.codigo_catalogo = p_catalogo
      AND a.correlativo IS NOT NULL;
  ELSE
    v_next := p_desde;
  END IF;

  LOOP
    v_next := v_next + 1;
    v_barcode := public.build_codigo_barras(p_catalogo, v_next);

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.activos AS a
      WHERE a.entidad_id = p_entidad_id
        AND a.codigo_barras = v_barcode
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.activos AS a
      WHERE a.entidad_id = p_entidad_id
        AND a.codigo_catalogo = p_catalogo
        AND a.correlativo = v_next
    );

    IF v_next >= 1000000 THEN
      RAISE EXCEPTION 'No hay correlativo disponible para el catálogo %', p_catalogo;
    END IF;
  END LOOP;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.correlativo_libre(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.correlativo_libre(UUID, TEXT, INTEGER) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.next_correlativo(p_entidad_id UUID, p_catalogo TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('activo-correlativo'),
    hashtext(p_entidad_id::text || ':' || coalesce(p_catalogo, ''))
  );

  RETURN public.correlativo_libre(p_entidad_id, p_catalogo, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_codigo_barras(
  p_entidad_id UUID,
  p_catalogo TEXT
)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.build_codigo_barras(
    p_catalogo,
    public.correlativo_libre(p_entidad_id, p_catalogo, NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.preview_activos_similares_rango(
  p_entidad_id UUID,
  p_catalogo TEXT,
  p_cantidad INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalogo TEXT := trim(p_catalogo);
  v_inicio INTEGER;
  v_fin INTEGER;
  v_i INTEGER;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 OR p_cantidad > 500 THEN
    RAISE EXCEPTION 'La cantidad debe estar entre 1 y 500';
  END IF;

  IF NOT public.can_access_entidad(p_entidad_id) THEN
    RAISE EXCEPTION 'Sin permiso para esta entidad';
  END IF;

  IF NOT public.is_contador() THEN
    RETURN jsonb_build_object('es_registrado', false);
  END IF;

  v_inicio := public.correlativo_libre(p_entidad_id, v_catalogo, NULL);
  v_fin := v_inicio;

  FOR v_i IN 2..p_cantidad LOOP
    v_fin := public.correlativo_libre(p_entidad_id, v_catalogo, v_fin);
  END LOOP;

  RETURN jsonb_build_object(
    'es_registrado', true,
    'primer_codigo', public.build_codigo_barras(v_catalogo, v_inicio),
    'ultimo_codigo', public.build_codigo_barras(v_catalogo, v_fin)
  );
END;
$$;
