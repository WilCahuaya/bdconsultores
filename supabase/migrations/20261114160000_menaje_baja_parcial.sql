-- Una baja parcial de menaje inserta otra fila en DADO_DE_BAJA, en el mismo ambiente.
-- enforce_activo_on_insert trataba todo lo que no era REGISTRADO como preregistro
-- y movía esa fila al ambiente de preregistros.

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
