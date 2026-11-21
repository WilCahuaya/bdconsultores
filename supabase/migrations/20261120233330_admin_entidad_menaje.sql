-- El administrador de la entidad registra y da de baja el menaje de su entidad.
-- Puede agregar ítems MJ al catálogo del estudio. No puede editarlos ni eliminarlos.

DROP POLICY IF EXISTS catalogo_insert_contador ON public.catalogo_nacional;
CREATE POLICY catalogo_insert_contador ON public.catalogo_nacional
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_contador()
      AND origen IN ('PROPIO', 'NACIONAL', 'MENAJE')
    )
    OR (
      origen = 'MENAJE'
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.rol = 'ADMIN_ENTIDAD'
          AND p.activo = TRUE
          AND p.entidad_id IS NOT NULL
      )
    )
  );

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

  IF NEW.categoria = 'MENAJE'
     AND NOT public.is_contador()
     AND public.my_entidad_id() IS NOT NULL
     AND NEW.entidad_id = public.my_entidad_id()
     AND NEW.estado_registro IN ('REGISTRADO', 'DADO_DE_BAJA') THEN
    IF NEW.ambiente_id IS NULL THEN
      RAISE EXCEPTION 'Seleccione sede y ambiente para registrar el menaje';
    END IF;
    IF public.is_ambiente_preregistro(NEW.ambiente_id) THEN
      RAISE EXCEPTION 'El menaje se registra en un ambiente de la entidad';
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
