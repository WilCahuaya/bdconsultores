-- Cada edificio tiene sus pisos. El Piso 1 nace con el edificio.
-- Un espacio de ese edificio solo puede usar un piso ya creado.

CREATE TABLE IF NOT EXISTS public.pisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edificio_id UUID NOT NULL REFERENCES public.edificios(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL CHECK (numero >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (edificio_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_pisos_edificio ON public.pisos(edificio_id);

INSERT INTO public.pisos (edificio_id, numero)
SELECT e.id, 1
FROM public.edificios e
ON CONFLICT (edificio_id, numero) DO NOTHING;

INSERT INTO public.pisos (edificio_id, numero)
SELECT DISTINCT s.edificio_id, s.piso
FROM public.espacios s
WHERE s.edificio_id IS NOT NULL
  AND s.piso >= 1
ON CONFLICT (edificio_id, numero) DO NOTHING;

CREATE OR REPLACE FUNCTION public.crear_piso_1_edificio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.pisos (edificio_id, numero)
  VALUES (NEW.id, 1)
  ON CONFLICT (edificio_id, numero) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS edificios_crear_piso_1 ON public.edificios;
CREATE TRIGGER edificios_crear_piso_1
  AFTER INSERT ON public.edificios
  FOR EACH ROW EXECUTE FUNCTION public.crear_piso_1_edificio();

CREATE OR REPLACE FUNCTION public.validate_espacio_edificio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_sede UUID;
BEGIN
  IF NEW.piso IS NULL OR NEW.piso < 1 THEN
    RAISE EXCEPTION 'El piso debe ser 1 o mayor.';
  END IF;

  IF NEW.edificio_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.sede_id INTO v_sede
  FROM public.edificios e
  WHERE e.id = NEW.edificio_id AND e.activo = TRUE;

  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'El edificio seleccionado no existe o está inactivo.';
  END IF;

  IF v_sede IS DISTINCT FROM NEW.sede_id THEN
    RAISE EXCEPTION 'El edificio debe pertenecer a la misma sucursal del espacio.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pisos p
    WHERE p.edificio_id = NEW.edificio_id AND p.numero = NEW.piso
  ) THEN
    RAISE EXCEPTION 'Ese piso no existe en el edificio. Créelo antes de asignar el espacio.';
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.pisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pisos_select ON public.pisos;
CREATE POLICY pisos_select ON public.pisos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.edificios e
      JOIN public.sedes s ON s.id = e.sede_id
      WHERE e.id = edificio_id AND public.can_access_entidad(s.entidad_id)
    )
  );

DROP POLICY IF EXISTS pisos_write_contador ON public.pisos;
CREATE POLICY pisos_write_contador ON public.pisos FOR ALL TO authenticated
  USING (public.is_contador())
  WITH CHECK (public.is_contador());

DROP POLICY IF EXISTS pisos_insert_admin ON public.pisos;
CREATE POLICY pisos_insert_admin ON public.pisos FOR INSERT TO authenticated
  WITH CHECK (
    public.is_contador()
    OR (
      public.my_entidad_id() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.edificios e
        JOIN public.sedes s ON s.id = e.sede_id
        WHERE e.id = edificio_id AND s.entidad_id = public.my_entidad_id()
      )
    )
  );

COMMENT ON TABLE public.pisos IS
  'Pisos de un edificio. El número 1 se crea junto con el edificio.';
