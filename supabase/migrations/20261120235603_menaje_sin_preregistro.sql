-- El menaje no entra a preregistro: lo administra el administrador y queda registrado
-- en un ambiente real. Las filas que ya estaban en la bandeja pasan a ese ambiente.

CREATE OR REPLACE FUNCTION public.enforce_activo_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := auth.uid();
  NEW.updated_by := auth.uid();

  IF NEW.estado_registro = 'DADO_DE_BAJA' AND public.is_contador() THEN
    RETURN NEW;
  END IF;

  IF NEW.categoria = 'MENAJE' AND NEW.estado_registro IS DISTINCT FROM 'DADO_DE_BAJA' THEN
    IF NOT public.is_contador() THEN
      IF public.my_entidad_id() IS NULL THEN
        RAISE EXCEPTION 'No autorizado';
      END IF;
      NEW.entidad_id := public.my_entidad_id();
    END IF;

    IF NEW.ambiente_id IS NULL OR public.is_ambiente_preregistro(NEW.ambiente_id) THEN
      IF NEW.posible_ambiente_id IS NOT NULL
         AND NOT public.is_ambiente_preregistro(NEW.posible_ambiente_id) THEN
        NEW.ambiente_id := NEW.posible_ambiente_id;
      ELSE
        RAISE EXCEPTION 'El menaje se registra en un ambiente. No pasa a preregistro';
      END IF;
    END IF;

    SELECT a.sede_id INTO NEW.sede_id
    FROM public.ambientes a
    WHERE a.id = NEW.ambiente_id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.ambientes a
      JOIN public.sedes s ON s.id = a.sede_id
      WHERE a.id = NEW.ambiente_id
        AND s.entidad_id = NEW.entidad_id
    ) THEN
      RAISE EXCEPTION 'El ambiente no pertenece a la entidad';
    END IF;

    NEW.estado_registro := 'REGISTRADO';
    NEW.posible_ambiente_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.categoria = 'MENAJE'
     AND NEW.estado_registro = 'DADO_DE_BAJA'
     AND NOT public.is_contador() THEN
    IF public.my_entidad_id() IS NULL OR NEW.entidad_id IS DISTINCT FROM public.my_entidad_id() THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;
    IF NEW.ambiente_id IS NULL OR public.is_ambiente_preregistro(NEW.ambiente_id) THEN
      RAISE EXCEPTION 'Seleccione sede y ambiente para registrar el menaje';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.ambientes a
      JOIN public.sedes s ON s.id = a.sede_id
      WHERE a.id = NEW.ambiente_id
        AND s.entidad_id = NEW.entidad_id
        AND (NEW.sede_id IS NULL OR a.sede_id = NEW.sede_id)
    ) THEN
      RAISE EXCEPTION 'El ambiente no pertenece a su entidad';
    END IF;
    NEW.entidad_id := public.my_entidad_id();
    NEW.posible_ambiente_id := NULL;
    RETURN NEW;
  END IF;

  IF public.is_contador() THEN
    IF NEW.estado_registro = 'REGISTRADO' THEN
      IF NEW.ambiente_id IS NULL THEN
        RAISE EXCEPTION 'Seleccione sede y ambiente para registrar el activo';
      END IF;
      IF public.is_ambiente_preregistro(NEW.ambiente_id) THEN
        RAISE EXCEPTION 'Use preregistrar para el ambiente de preregistros';
      END IF;
      NEW.posible_ambiente_id := NULL;
    ELSE
      NEW := public.apply_preregistro_ubicacion(NEW);
    END IF;
  ELSE
    NEW.entidad_id := public.my_entidad_id();
    NEW := public.apply_preregistro_ubicacion(NEW);
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
       AND NEW.estado_registro = 'REGISTRADO'
       AND NEW.categoria IS DISTINCT FROM 'MENAJE' THEN
      RAISE EXCEPTION 'Solo el contador puede registrar activos';
    END IF;

    IF OLD.estado_registro = 'PREREGISTRADO'
       AND NEW.estado_registro = 'PREREGISTRADO'
       AND NEW.categoria IS DISTINCT FROM 'MENAJE' THEN
      v_bucket := public.ensure_ambiente_preregistro(NEW.entidad_id);
      NEW.ambiente_id := v_bucket;
      SELECT sede_id INTO NEW.sede_id FROM public.ambientes WHERE id = v_bucket;
      IF NEW.posible_ambiente_id IS NOT NULL
         AND public.is_ambiente_preregistro(NEW.posible_ambiente_id) THEN
        NEW.posible_ambiente_id := NULL;
      END IF;
    END IF;
  END IF;

  IF NEW.categoria = 'MENAJE' AND NEW.estado_registro = 'PREREGISTRADO' THEN
    IF NEW.posible_ambiente_id IS NOT NULL
       AND NOT public.is_ambiente_preregistro(NEW.posible_ambiente_id) THEN
      NEW.ambiente_id := NEW.posible_ambiente_id;
      SELECT sede_id INTO NEW.sede_id FROM public.ambientes WHERE id = NEW.ambiente_id;
    END IF;
    IF NEW.ambiente_id IS NULL OR public.is_ambiente_preregistro(NEW.ambiente_id) THEN
      RAISE EXCEPTION 'El menaje se registra en un ambiente. No pasa a preregistro';
    END IF;
    NEW.estado_registro := 'REGISTRADO';
    NEW.posible_ambiente_id := NULL;
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

-- Cucharas que quedaron en la bandeja: el menaje de esa entidad ya está en un ambiente.
ALTER TABLE public.activos DISABLE TRIGGER activos_before_update;
ALTER TABLE public.activos DISABLE TRIGGER activos_historial;

UPDATE public.activos AS destino
SET cantidad = destino.cantidad + origen.cantidad
FROM public.activos AS origen
WHERE destino.id = 'a4f86afb-5ddc-49b3-b8ea-36af6dda2139'
  AND origen.id = 'd6b8d81f-6fd7-4f1e-bb89-22adece49fc3'
  AND destino.estado_registro = 'PREREGISTRADO'
  AND origen.estado_registro = 'PREREGISTRADO';

DELETE FROM public.activos
WHERE id = 'd6b8d81f-6fd7-4f1e-bb89-22adece49fc3'
  AND estado_registro = 'PREREGISTRADO';

UPDATE public.activos
SET estado_registro = 'REGISTRADO',
    ambiente_id = '181f60eb-a445-4aa1-b9e9-599bd92ee480',
    sede_id = '83d586ba-4060-415c-bbe0-85216e237977',
    posible_ambiente_id = NULL
WHERE id IN (
  'a4f86afb-5ddc-49b3-b8ea-36af6dda2139',
  'ca996bc6-b793-47a2-b4d6-c1ede2941825'
)
  AND estado_registro = 'PREREGISTRADO';

ALTER TABLE public.activos ENABLE TRIGGER activos_before_update;
ALTER TABLE public.activos ENABLE TRIGGER activos_historial;
