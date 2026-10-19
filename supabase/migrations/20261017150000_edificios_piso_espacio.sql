-- Edificio opcional dentro de la sucursal. El piso vive en el espacio (1 por defecto).

CREATE TABLE IF NOT EXISTS public.edificios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edificios_sede_nombre_activo
  ON public.edificios (sede_id, lower(trim(nombre)))
  WHERE activo = TRUE;

CREATE INDEX IF NOT EXISTS idx_edificios_sede ON public.edificios(sede_id);

DROP TRIGGER IF EXISTS edificios_updated_at ON public.edificios;
CREATE TRIGGER edificios_updated_at
  BEFORE UPDATE ON public.edificios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.espacios
  ADD COLUMN IF NOT EXISTS edificio_id UUID REFERENCES public.edificios(id) ON DELETE SET NULL;

ALTER TABLE public.espacios
  ADD COLUMN IF NOT EXISTS piso INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.espacios DROP CONSTRAINT IF EXISTS espacios_piso_positivo;
ALTER TABLE public.espacios
  ADD CONSTRAINT espacios_piso_positivo CHECK (piso >= 1);

CREATE INDEX IF NOT EXISTS idx_espacios_edificio
  ON public.espacios (edificio_id)
  WHERE edificio_id IS NOT NULL;

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS espacios_validate_edificio ON public.espacios;
CREATE TRIGGER espacios_validate_edificio
  BEFORE INSERT OR UPDATE OF edificio_id, sede_id, piso ON public.espacios
  FOR EACH ROW EXECUTE FUNCTION public.validate_espacio_edificio();

ALTER TABLE public.edificios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edificios_select ON public.edificios;
CREATE POLICY edificios_select ON public.edificios FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sedes s
      WHERE s.id = sede_id AND public.can_access_entidad(s.entidad_id)
    )
  );

DROP POLICY IF EXISTS edificios_write_contador ON public.edificios;
CREATE POLICY edificios_write_contador ON public.edificios FOR ALL TO authenticated
  USING (public.is_contador())
  WITH CHECK (public.is_contador());

DROP POLICY IF EXISTS edificios_insert_admin ON public.edificios;
CREATE POLICY edificios_insert_admin ON public.edificios FOR INSERT TO authenticated
  WITH CHECK (
    public.is_contador()
    OR (
      public.my_entidad_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.sedes s
        WHERE s.id = sede_id AND s.entidad_id = public.my_entidad_id()
      )
    )
  );

DROP POLICY IF EXISTS edificios_update_admin ON public.edificios;
CREATE POLICY edificios_update_admin ON public.edificios FOR UPDATE TO authenticated
  USING (
    public.is_contador()
    OR (
      public.my_entidad_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.sedes s
        WHERE s.id = sede_id AND s.entidad_id = public.my_entidad_id()
      )
    )
  )
  WITH CHECK (
    public.is_contador()
    OR (
      public.my_entidad_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.sedes s
        WHERE s.id = sede_id AND s.entidad_id = public.my_entidad_id()
      )
    )
  );

COMMENT ON TABLE public.edificios IS
  'Bloque o pabellón dentro de una sucursal. Opcional: una sucursal puede no tener edificios.';
COMMENT ON COLUMN public.espacios.piso IS
  'Planta. 1 es el primer piso y se omite en la ruta cuando no hay otras plantas.';
COMMENT ON COLUMN public.espacios.edificio_id IS
  'Edificio de la sucursal. Nulo si el espacio está directo en el predio.';
