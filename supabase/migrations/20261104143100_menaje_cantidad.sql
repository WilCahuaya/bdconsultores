-- Menaje: una fila por código de catálogo y ambiente, con cantidad.
-- No lleva correlativo ni código de barras (no se imprime etiqueta).

ALTER TABLE public.activos
  ADD COLUMN IF NOT EXISTS cantidad INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.activos
  DROP CONSTRAINT IF EXISTS activos_cantidad_check;

ALTER TABLE public.activos
  ADD CONSTRAINT activos_cantidad_check CHECK (
    (categoria = 'MENAJE' AND cantidad >= 1)
    OR (categoria <> 'MENAJE' AND cantidad = 1)
  );

ALTER TABLE public.activos
  DROP CONSTRAINT IF EXISTS activos_registrado_correlativo_check;

ALTER TABLE public.activos
  ADD CONSTRAINT activos_registrado_correlativo_check CHECK (
    estado_registro <> 'REGISTRADO'
    OR (
      categoria = 'MENAJE'
      AND correlativo IS NULL
      AND codigo_barras IS NULL
    )
    OR (
      categoria <> 'MENAJE'
      AND correlativo IS NOT NULL
      AND codigo_barras IS NOT NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS activos_menaje_ambiente_unique
  ON public.activos (entidad_id, ambiente_id, codigo_catalogo)
  WHERE categoria = 'MENAJE'
    AND estado_registro = 'REGISTRADO'
    AND ambiente_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS activos_menaje_posible_ambiente_unique
  ON public.activos (entidad_id, posible_ambiente_id, codigo_catalogo)
  WHERE categoria = 'MENAJE'
    AND estado_registro = 'PREREGISTRADO'
    AND posible_ambiente_id IS NOT NULL;

COMMENT ON COLUMN public.activos.cantidad IS
  'Unidades en el ambiente. Solo el menaje usa un valor distinto de 1.';

CREATE OR REPLACE FUNCTION public.assign_correlativo_if_registrado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.categoria = 'MENAJE' THEN
    IF NEW.cantidad IS NULL OR NEW.cantidad < 1 THEN
      RAISE EXCEPTION 'La cantidad de menaje debe ser al menos 1';
    END IF;
    NEW.correlativo := NULL;
    NEW.codigo_barras := NULL;
    NEW.nombre_etiqueta := NULL;
    NEW.depreciacion := NULL;
    NEW.vida_util_meses := NULL;
    RETURN NEW;
  END IF;

  NEW.cantidad := 1;

  IF NEW.estado_registro = 'REGISTRADO' AND NEW.correlativo IS NULL THEN
    NEW.correlativo := public.next_correlativo(NEW.entidad_id, NEW.codigo_catalogo);
    NEW.codigo_barras := public.build_codigo_barras(NEW.codigo_catalogo, NEW.correlativo);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_activo_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket UUID;
BEGIN
  NEW.updated_by := auth.uid();

  IF NOT public.is_contador() THEN
    IF NEW.entidad_id IS DISTINCT FROM OLD.entidad_id THEN
      RAISE EXCEPTION 'No puede cambiar la entidad del activo';
    END IF;
    IF NEW.estado_registro IS DISTINCT FROM OLD.estado_registro
       AND NEW.estado_registro = 'REGISTRADO' THEN
      RAISE EXCEPTION 'Solo el contador puede registrar activos';
    END IF;

    IF OLD.estado_registro = 'PREREGISTRADO' AND NEW.estado_registro = 'PREREGISTRADO' THEN
      v_bucket := public.ensure_ambiente_preregistro(NEW.entidad_id);
      NEW.ambiente_id := v_bucket;
      SELECT sede_id INTO NEW.sede_id FROM public.ambientes WHERE id = v_bucket;
      IF NEW.posible_ambiente_id IS NOT NULL
         AND public.is_ambiente_preregistro(NEW.posible_ambiente_id) THEN
        NEW.posible_ambiente_id := NULL;
      END IF;
    END IF;
  END IF;

  IF NEW.estado_registro = 'REGISTRADO'
     AND OLD.estado_registro = 'PREREGISTRADO' THEN
    IF NEW.ambiente_id IS NULL OR public.is_ambiente_preregistro(NEW.ambiente_id) THEN
      RAISE EXCEPTION 'Seleccione un ambiente destino al registrar el preregistro';
    END IF;
    NEW.posible_ambiente_id := NULL;
  END IF;

  IF NEW.categoria IS DISTINCT FROM 'MENAJE'
     AND NEW.estado_registro = 'REGISTRADO'
     AND OLD.estado_registro = 'PREREGISTRADO'
     AND NEW.correlativo IS NULL THEN
    NEW.correlativo := public.next_correlativo(NEW.entidad_id, NEW.codigo_catalogo);
    NEW.codigo_barras := public.build_codigo_barras(NEW.codigo_catalogo, NEW.correlativo);
  END IF;

  IF NEW.estado_registro != 'REGISTRADO' THEN
    IF NEW.estado_registro = 'PREREGISTRADO' THEN
      NEW.correlativo := NULL;
      NEW.codigo_barras := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_historial_activo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fields TEXT[] := ARRAY[
    'nombre', 'nombre_etiqueta', 'descripcion', 'caracteristicas',
    'estado_registro', 'estado_bien', 'categoria',
    'codigo_catalogo', 'codigo_barras', 'correlativo', 'cantidad',
    'sede_id', 'ambiente_id', 'posible_ambiente_id',
    'valor_adquisicion', 'valor_es_mercado', 'fecha_adquisicion',
    'fecha_inicio_depreciacion',
    'incremento_detalle', 'valor_incremento',
    'vida_util_meses', 'depreciacion',
    'marca', 'modelo', 'serie', 'color', 'medidas',
    'medida_largo', 'medida_ancho', 'medida_altura',
    'responsable', 'observacion', 'motivo_baja',
    'comprobante_serie',
    'cuenta_contable_codigo', 'cuenta_contable_nombre',
    'foto_path', 'comprobante_path'
  ];
  v_field TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historial_cambios (activo_id, entidad_id, usuario_id, accion, campo, valor_nuevo)
    VALUES (NEW.id, NEW.entidad_id, auth.uid(), 'INSERT', 'activo', NEW.nombre);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH v_field IN ARRAY v_fields LOOP
      EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', v_field, v_field)
        INTO v_old, v_new USING OLD, NEW;
      IF v_old IS DISTINCT FROM v_new THEN
        INSERT INTO public.historial_cambios (
          activo_id, entidad_id, usuario_id, accion, campo, valor_anterior, valor_nuevo
        ) VALUES (
          NEW.id, NEW.entidad_id, auth.uid(), 'UPDATE', v_field, v_old, v_new
        );
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
