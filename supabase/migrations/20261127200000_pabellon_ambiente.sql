-- El pabellón es el edificio. El ambiente cuelga de él.
-- El piso del espacio pasa a la descripción de cada ambiente que lo ocupaba.
-- El nombre del ambiente queda «Espacio 01 - Nivel II».

ALTER TABLE public.edificios
  ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.edificios.descripcion IS
  'Descripción opcional del pabellón.';

ALTER TABLE public.ambientes
  ADD COLUMN IF NOT EXISTS edificio_id UUID REFERENCES public.edificios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ambientes_edificio_id
  ON public.ambientes (edificio_id)
  WHERE edificio_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_ambiente_edificio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_sede UUID;
BEGIN
  IF NEW.edificio_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.sede_id INTO v_sede
  FROM public.edificios e
  WHERE e.id = NEW.edificio_id AND e.activo = TRUE;

  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'El pabellón seleccionado no existe o está inactivo.';
  END IF;

  IF v_sede IS DISTINCT FROM NEW.sede_id THEN
    RAISE EXCEPTION 'El pabellón debe pertenecer a la misma sucursal del ambiente.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ambientes_validate_edificio ON public.ambientes;
CREATE TRIGGER ambientes_validate_edificio
  BEFORE INSERT OR UPDATE OF edificio_id, sede_id ON public.ambientes
  FOR EACH ROW EXECUTE FUNCTION public.validate_ambiente_edificio();

-- Copia piso y nombre solo de ambientes físicos que todavía ocupan un espacio.
UPDATE public.ambientes AS a
SET
  nombre = btrim(e.nombre) || ' - ' || btrim(a.nombre),
  descripcion = CASE
    WHEN btrim(coalesce(a.descripcion, '')) = '' THEN 'Piso ' || e.piso::text
    ELSE 'Piso ' || e.piso::text || E'\n' || btrim(a.descripcion)
  END,
  edificio_id = e.edificio_id,
  espacio_id = NULL
FROM public.espacios AS e
WHERE a.espacio_id = e.id
  AND a.es_preregistro = FALSE
  AND a.es_faltante = FALSE;
